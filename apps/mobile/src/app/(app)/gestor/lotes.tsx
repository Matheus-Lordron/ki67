import type { DocumentPickerAsset } from 'expo-document-picker';
import { AlertTriangle, CheckCircle2, FileImage, Plus, UploadCloud } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Badge, Callout, Card, EmptyState, KeyValue, PageHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/Field';
import { Grid } from '@/components/ui/Grid';
import { Screen } from '@/components/ui/Screen';
import { Select } from '@/components/ui/Select';
import { env } from '@/config/env';
import { ProjectPicker, useManagerScope } from '@/features/gestor/useManagerScope';
import { type FileMetadataReport, inspectAssets } from '@/services/cloudflare';
import { pickImages } from '@/services/files';
import { type UploadSummary, useAppStore } from '@/state/appStore';
import { colors } from '@/theme/colors';

// Lotes e upload (RF-08, RF-09, RF-11, RF-29, RNV-07).
export default function BatchesAndImagesScreen() {
  const { project, batches, images } = useManagerScope();
  const createBatch = useAppStore((s) => s.createBatch);
  const uploadImages = useAppStore((s) => s.uploadImages);
  const showToast = useAppStore((s) => s.showToast);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [n, setN] = useState('3');
  const [description, setDescription] = useState('');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [targetBatch, setTargetBatch] = useState<string | null>(null);
  const [picked, setPicked] = useState<DocumentPickerAsset[]>([]);
  const [reports, setReports] = useState<FileMetadataReport[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [summary, setSummary] = useState<UploadSummary | null>(null);

  const batchId = targetBatch ?? batches[0]?.id ?? null;

  const submitBatch = async () => {
    if (!project) return;
    const result = await createBatch(project.id, name, Number.parseInt(n, 10) || 0, description);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(`Lote "${name.trim()}" criado.`);
    setCreateOpen(false);
    setName('');
    setN('3');
    setDescription('');
  };

  const openUpload = (id?: string) => {
    setTargetBatch(id ?? batchId);
    setPicked([]);
    setReports([]);
    setSummary(null);
    setUploadOpen(true);
  };

  const choose = async () => {
    const assets = await pickImages();
    if (!assets.length) return;
    setSummary(null);
    setPicked(assets);
    setProgress('Lendo metadados...');
    setReports(await inspectAssets(assets)); // aviso de metadados ANTES de enviar (RNV-07)
    setProgress(null);
  };

  const upload = async () => {
    if (!batchId || !picked.length) return;
    // Higieniza metadados, calcula o SHA-256 e envia (modo real: R2 + register_image + pré-anotação).
    const result = await uploadImages(batchId, picked, setProgress);
    setSummary(result);
    setPicked([]);
    setReports([]);
    setProgress(null);
    showToast(`Upload concluído: ${result.uploaded.length} enviadas, ${result.duplicates.length} duplicadas, ${result.rejected.length} recusadas.`);
  };

  const withMetadata = reports.filter((r) => r.findings.length);

  return (
    <Screen>
      <PageHeader
        title="Gerenciamento de Lotes e Imagens IHC"
        description={<ProjectPicker />}
        actions={
          <>
            <Button label={`Upload em lote (até ${env.uploadMaxMb} MB)`} icon={UploadCloud} variant="outline" disabled={!batches.length} onPress={() => openUpload()} />
            <Button label="Criar Novo Lote" icon={Plus} disabled={!project} onPress={() => setCreateOpen(true)} />
          </>
        }
      />

      {batches.length === 0 ? (
        <EmptyState icon={FileImage} title="Nenhum lote neste projeto" description="Crie um lote, defina quantos avaliadores cada imagem recebe (N) e envie as imagens." />
      ) : (
        <Grid>
          {batches.map((b) => {
            const count = images.filter((i) => i.batchId === b.id).length;
            return (
              <Card key={b.id} className="h-full justify-between">
                <View>
                  <View className="mb-2 flex-row items-center justify-between">
                    <Badge label={`N = ${b.evaluatorsPerImage} avaliadores/img`} />
                    <Text className="font-mono text-[11px] text-ink-subtle">{new Date(b.createdAt).toLocaleDateString('pt-BR')}</Text>
                  </View>
                  <Text className="mb-1 font-sans-bold text-base text-ink">{b.name}</Text>
                  <Text className="mb-4 font-sans text-xs leading-5 text-ink-muted">{b.description || 'Sem descrição.'}</Text>
                  <View className="mb-4 gap-1 rounded-xs border border-line bg-surface p-3">
                    <KeyValue label="Imagens no lote:" value={`${count} lâminas`} />
                    <KeyValue label="Criado por:" value={b.createdBy} />
                  </View>
                </View>
                <View className="flex-row items-center justify-between border-t border-surface-alt pt-3">
                  <View className="flex-row items-center gap-1">
                    <CheckCircle2 size={14} color="#047857" />
                    <Text className="font-sans-semibold text-[11px] text-emerald-700">Protocolo cego ativo</Text>
                  </View>
                  <Pressable onPress={() => openUpload(b.id)} className="min-h-11 justify-center">
                    <Text className="font-sans-semibold text-xs text-primary">Adicionar lâminas</Text>
                  </Pressable>
                </View>
              </Card>
            );
          })}
        </Grid>
      )}

      <Dialog
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Criar novo lote de anotação"
        subtitle="Defina o nome e N avaliadores por imagem (mínimo 1, padrão 3)"
        footer={
          <>
            <Button label="Cancelar" variant="outline" onPress={() => setCreateOpen(false)} />
            <Button label="Salvar e criar lote" onPress={submitBatch} disabled={!name.trim()} />
          </>
        }
      >
        <TextField label="Nome do lote *" value={name} onChangeText={setName} placeholder="Ex.: Lote #845 - Biópsias gástricas Ki-67" />
        <View>
          <TextField label="Avaliadores por imagem (N) *" value={n} onChangeText={(v) => setN(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" mono />
          <Text className="mt-1 font-sans text-[10px] text-ink-subtle">Quantas análises independentes e cegas cada imagem precisa antes de ir para a validação. Com N = 1 não há comparação.</Text>
        </View>
        <TextField label="Descrição do lote" value={description} onChangeText={setDescription} multiline placeholder="Contexto clínico, ampliação, coloração (ex.: 40x DAB)..." />
      </Dialog>

      <Dialog
        visible={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload em lote de imagens"
        subtitle={`JPG, PNG ou TIFF de até ${env.uploadMaxMb} MB cada`}
        icon={UploadCloud}
        maxWidth={560}
        footer={
          <>
            <Button label="Fechar" variant="outline" onPress={() => setUploadOpen(false)} />
            <Button label={progress ? 'Processando...' : `Higienizar e enviar ${picked.length || ''}`.trim()} icon={UploadCloud} loading={!!progress} disabled={!picked.length || !batchId} onPress={upload} />
          </>
        }
      >
        <Callout tone="warning" icon={AlertTriangle} title="Aviso obrigatório: metadados de texto (EXIF/TIFF)">
          Antes do envio, o app remove do arquivo os metadados de texto (EXIF, XMP, IPTC, comentários e tags de texto do TIFF), que podem conter nome do paciente, prontuário ou datas. Os pixels da imagem não são alterados.
        </Callout>
        <Select
          label="Lote de destino"
          value={batchId}
          onChange={setTargetBatch}
          options={batches.map((b) => ({ value: b.id, label: b.name, description: `N = ${b.evaluatorsPerImage}` }))}
        />
        <Pressable onPress={choose} className="items-center gap-1 rounded-xs border-2 border-dashed border-line p-6 web:hover:bg-surface-alt" accessibilityRole="button">
          <FileImage size={40} color={colors.primary} />
          <Text className="font-sans-semibold text-xs text-primary">{picked.length ? `${picked.length} arquivo(s) selecionado(s) · trocar seleção` : 'Toque para selecionar arquivos JPG, PNG ou TIFF'}</Text>
          <Text className="font-sans text-[11px] text-ink-subtle">Seletor de arquivos do sistema, sem pedir permissão</Text>
        </Pressable>

        {progress ? <Text className="font-mono text-[11px] text-ink-subtle">{progress}</Text> : null}

        {withMetadata.length ? (
          <Callout tone="warning" icon={AlertTriangle} title={`${withMetadata.length} arquivo(s) com metadados de texto (serão removidos):`}>
            <View className="gap-1">
              {withMetadata.map((r) => (
                <Text key={r.name} className="font-mono text-[10px] text-amber-900">
                  • {r.name}: {r.findings.map((f) => (f.preview ? `${f.kind} (“${f.preview}”)` : f.kind)).join(', ')}
                </Text>
              ))}
            </View>
          </Callout>
        ) : null}
        {reports.filter((r) => r.error).map((r) => (
          <Text key={r.name} className="font-mono text-[10px] text-rose-800">• {r.name}: {r.error}</Text>
        ))}

        {summary ? (
          <View className="gap-2 rounded-xs border border-line bg-surface-alt p-3">
            <View className="flex-row items-center gap-1.5">
              <CheckCircle2 size={16} color="#047857" />
              <Text className="font-sans-bold text-xs text-primary">Resumo do processamento</Text>
            </View>
            <View className="flex-row gap-2">
              <SummaryBox value={summary.uploaded.length} label="Enviadas" tone="success" />
              <SummaryBox value={summary.duplicates.length} label="Duplicadas" tone="warning" />
              <SummaryBox value={summary.rejected.length} label="Recusadas" tone="danger" />
            </View>
            {summary.sanitized ? <Text className="font-mono text-[10px] text-ink-muted">{summary.sanitized} arquivo(s) tiveram metadados removidos.</Text> : null}
            {summary.uploaded.length ? <Text className="font-mono text-[10px] text-emerald-800">Códigos gerados: {summary.uploaded.join(', ')}</Text> : null}
            {summary.duplicates.length ? <Text className="font-mono text-[10px] text-amber-800">Mesmo SHA-256 já cadastrado: {summary.duplicates.join(', ')}</Text> : null}
            {summary.rejected.length ? (
              <View className="gap-1 border-t border-line pt-2">
                <Text className="font-sans-semibold text-[10px] text-rose-900">Motivos de recusa:</Text>
                {summary.rejected.map((r, i) => (
                  <Text key={i} className="font-mono text-[10px] text-rose-800">• {r.filename}: {r.reason}</Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </Dialog>
    </Screen>
  );
}

function SummaryBox({ value, label, tone }: { value: number; label: string; tone: 'success' | 'warning' | 'danger' }) {
  const style = { success: 'border-emerald-200 bg-emerald-50 text-emerald-800', warning: 'border-amber-200 bg-amber-50 text-amber-800', danger: 'border-rose-200 bg-rose-50 text-rose-800' }[tone];
  const [border, bg, fg] = style.split(' ');
  return (
    <View className={`flex-1 items-center rounded-xs border p-1.5 ${border} ${bg}`}>
      <Text className={`font-mono-bold text-sm ${fg}`}>{value}</Text>
      <Text className={`font-mono text-[11px] ${fg}`}>{label}</Text>
    </View>
  );
}
