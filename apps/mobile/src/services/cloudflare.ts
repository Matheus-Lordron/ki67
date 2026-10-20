/**
 * Imagens no Cloudflare R2 (bucket privado).
 *
 * O app NUNCA recebe as chaves do R2. Ele pede URLs pré-assinadas a duas Edge
 * Functions do Supabase (escritas na Fase 4), que conferem quem está pedindo
 * com o RLS antes de assinar:
 *   r2-upload-url   → URL de PUT, válida por poucos minutos, só para o gestor do lote
 *   r2-download-url → URL de GET de 5 min (RNF-06), só para quem enxerga a imagem
 *
 * Fluxo de upload de cada arquivo (RF-08, RF-11, RNF-07):
 *   ler bytes → validar formato → remover metadados de texto → SHA-256
 *   → pedir URL → PUT direto no R2 → register_image no banco
 */
import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import type { DocumentPickerAsset } from 'expo-document-picker';

import { env } from '@/config/env';
import { deviceLabel } from '@/services/device';
import { readAssetBytes } from '@/services/files';
import { ApiError, invokeFunction, rpc } from '@/services/supabase';
import type { RegisterImageResult, UploadBatchResult } from '@/types';
import { ImageFormatError, type MetadataFinding, inspectImage, sanitizeImage } from '@/utils/imageMetadata';

// --- Contrato das Edge Functions ---------------------------------------------------

export interface UploadUrlRequest {
  batch_id: string;
  sha256: string;
  mime_type: string;
  size_bytes: number;
}

export type UploadUrlResponse =
  | { duplicate: false; upload_url: string; storage_key: string; headers?: Record<string, string> }
  | { duplicate: true; existing_code: string | null };

export interface DownloadUrlResponse {
  url?: string;
  urls: Record<string, string>;
  expires_in: number;
}

// --- Leitura e preparo -------------------------------------------------------------

export interface FileMetadataReport {
  name: string;
  findings: MetadataFinding[];
  error?: string;
}

/**
 * Lê os arquivos escolhidos e lista os metadados de texto de cada um, para a
 * tela avisar o gestor ANTES de enviar (RNF-07). Nada é enviado aqui.
 */
export async function inspectAssets(assets: DocumentPickerAsset[]): Promise<FileMetadataReport[]> {
  const reports: FileMetadataReport[] = [];
  for (const asset of assets) {
    try {
      const { findings } = inspectImage(await readAssetBytes(asset));
      reports.push({ name: asset.name, findings });
    } catch (e) {
      reports.push({ name: asset.name, findings: [], error: errorMessage(e) });
    }
  }
  return reports;
}

export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const hash = new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, bytes));
  return Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
}

// --- Upload --------------------------------------------------------------------------

export interface UploadOptions {
  batchId: string;
  organ?: string;
  opticalMagnification?: string;
  /** Depois do registro no banco: usado para calcular e gravar a pré-anotação (D10). */
  onRegistered?: (imageVersionId: string, bytes: Uint8Array<ArrayBuffer>, mimeType: string) => Promise<void>;
  /** Chamado após cada arquivo, para a barra de progresso. */
  onProgress?: (done: number, total: number, fileName: string) => void;
}

export interface UploadBatchReport extends UploadBatchResult {
  uploadedCodes: string[];
  duplicateFiles: { filename: string; existingCode: string | null }[];
  /** Quantos arquivos tinham metadados de texto removidos. */
  sanitized: number;
}

/** Envia vários arquivos para um lote e devolve o resumo do RF-08. */
export async function uploadImagesToBatch(assets: DocumentPickerAsset[], options: UploadOptions): Promise<UploadBatchReport> {
  const report: UploadBatchReport = {
    uploaded: 0,
    duplicates: 0,
    rejected: [],
    exifWarningShown: false,
    uploadedCodes: [],
    duplicateFiles: [],
    sanitized: 0,
  };

  for (const [index, asset] of assets.entries()) {
    try {
      const result = await uploadOne(asset, options);
      if (result.status === 'uploaded') {
        report.uploaded += 1;
        report.uploadedCodes.push(result.code);
      } else if (result.status === 'duplicate') {
        report.duplicates += 1;
        report.duplicateFiles.push({ filename: asset.name, existingCode: result.existingCode });
      } else {
        report.rejected.push({ filename: asset.name, reason: result.reason });
      }
      if (result.hadMetadata) {
        report.exifWarningShown = true;
        report.sanitized += 1;
      }
    } catch (e) {
      report.rejected.push({ filename: asset.name, reason: errorMessage(e) });
    }
    options.onProgress?.(index + 1, assets.length, asset.name);
  }
  return report;
}

type UploadOneResult =
  | { status: 'uploaded'; code: string; hadMetadata: boolean }
  | { status: 'duplicate'; existingCode: string | null; hadMetadata: boolean }
  | { status: 'rejected'; reason: string; hadMetadata: boolean };

async function uploadOne(asset: DocumentPickerAsset, options: UploadOptions): Promise<UploadOneResult> {
  const maxBytes = env.uploadMaxMb * 1024 * 1024;
  if (asset.size && asset.size > maxBytes) {
    return { status: 'rejected', reason: `Arquivo acima de ${env.uploadMaxMb} MB.`, hadMetadata: false };
  }

  const original = await readAssetBytes(asset);
  const image = sanitizeImage(original); // lança ImageFormatError se não for JPG/PNG/TIFF válido
  const hadMetadata = image.removed.length > 0;
  if (image.bytes.byteLength > maxBytes) {
    return { status: 'rejected', reason: `Arquivo acima de ${env.uploadMaxMb} MB.`, hadMetadata };
  }

  const sha256 = await sha256Hex(image.bytes);
  const target = await invokeFunction<UploadUrlResponse>('r2-upload-url', {
    batch_id: options.batchId,
    sha256,
    mime_type: image.mimeType,
    size_bytes: image.bytes.byteLength,
  } satisfies UploadUrlRequest);

  if (target.duplicate) {
    return { status: 'duplicate', existingCode: target.existing_code, hadMetadata };
  }

  const put = await fetch(target.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': image.mimeType, ...target.headers },
    body: image.bytes,
  });
  if (!put.ok) {
    return { status: 'rejected', reason: `O armazenamento recusou o arquivo (HTTP ${put.status}).`, hadMetadata };
  }

  const registered = await rpc<RegisterImageResult>('register_image', {
    p_batch_id: options.batchId,
    p_sha256: sha256,
    p_storage_key: target.storage_key,
    p_mime_type: image.mimeType,
    p_size_bytes: image.bytes.byteLength,
    p_width_px: image.width,
    p_height_px: image.height,
    p_metadata_sanitized: image.fullySanitized,
    p_organ: options.organ ?? null,
    p_optical_magnification: options.opticalMagnification ?? null,
    p_device: deviceLabel(),
  });

  if (registered.ok) {
    try {
      await options.onRegistered?.(registered.image_version_id, image.bytes, image.mimeType);
    } catch {
      // a pré-anotação é opcional: a imagem já está registrada
    }
    return { status: 'uploaded', code: registered.code, hadMetadata };
  }
  if (registered.status === 'duplicate') return { status: 'duplicate', existingCode: registered.existing_code, hadMetadata };
  return { status: 'rejected', reason: registered.reason, hadMetadata };
}

// --- Download ------------------------------------------------------------------------

/** URL temporária (5 min) para exibir a imagem no canvas. Não guarde em cache. */
export async function getSignedImageUrl(imageVersionId: string, variant: 'original' | 'preview' = 'preview'): Promise<string | null> {
  const res = await invokeFunction<DownloadUrlResponse>('r2-download-url', { image_version_id: imageVersionId, variant });
  return res.url ?? res.urls[imageVersionId] ?? null;
}

/** Várias URLs de uma vez (miniaturas das listas). Falha de rede devolve {}. */
export async function getSignedImageUrls(imageVersionIds: string[], variant: 'original' | 'preview' = 'preview'): Promise<Record<string, string>> {
  if (!imageVersionIds.length) return {};
  try {
    const res = await invokeFunction<DownloadUrlResponse>('r2-download-url', { image_version_ids: imageVersionIds, variant });
    return res.urls ?? {};
  } catch {
    return {};
  }
}

function errorMessage(e: unknown): string {
  if (e instanceof ImageFormatError || e instanceof ApiError) return e.message;
  return e instanceof Error ? e.message : 'Erro desconhecido.';
}
