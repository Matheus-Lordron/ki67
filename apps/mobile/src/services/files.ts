import type { DocumentPickerAsset } from 'expo-document-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/tiff'];

/** Abre o seletor de arquivos do sistema (sem pedir permissão, RNF-11). */
export async function pickImages(): Promise<DocumentPickerAsset[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ACCEPTED_IMAGE_TYPES,
    multiple: true,
    copyToCacheDirectory: true,
    base64: false, // na web, devolve o File em vez de base64 (arquivos de até 50 MB)
  });
  return result.canceled ? [] : result.assets;
}

/** Lê o arquivo escolhido inteiro como bytes, na web e no celular. */
export async function readAssetBytes(asset: DocumentPickerAsset): Promise<Uint8Array> {
  if (Platform.OS === 'web') {
    if (asset.file) return new Uint8Array(await asset.file.arrayBuffer());
    return new Uint8Array(await (await fetch(asset.uri)).arrayBuffer());
  }
  return new File(asset.uri).bytes();
}
