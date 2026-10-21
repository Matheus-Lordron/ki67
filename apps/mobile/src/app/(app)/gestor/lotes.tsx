import type { DocumentPickerAsset } from 'expo-document-picker';
import { AlertTriangle, FileImage, Plus, UploadCloud } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Callout, Card, EmptyState, KeyValue, PageHeader } from '@/components/ui/Card';
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
        title="Lotes"
        description={<ProjectPicker />}
        actions={
          <>
            <Button label="Enviar imagens" icon={UploadCloud} variant="outline" disabled={!batches.length} onPress={() => openUpload()} />
            <Button label="Novo lote" icon={Plus} disabled={!project} onPress={() => setCreateOpen(true)} />
          </>
        }
      />

      {batches.length === 0 ? (
        <EmptyState title="Nenhum lote neste projeto" description="Crie um lote, defina quantos avaliadores cada imagem recebe e envie as imagens." />
      ) : (
        <Grid>
          {batches.map((b) => {
            const count = images.filter((i) => i.batchId === b.id).length;
            return (
              <Card key={b.id} className="h-full justify-between p-4">
                <View className="gap-1">
                  <Text className="font-sans-semibold text-[15px] text-ink">{b.name}</Text>
                  <Text className="font-sans text-[13px] leading-5 text-ink-muted">{b.description || 'Sem descrição.'}</Text>
                </View>
                <View className="mt-4 gap-1.5">
                  <KeyValue label="Imagens" value={count} />
                  <KeyValue label="Avaliadores por imagem" value={b.evaluatorsPerImage} />
                  <KeyValue label="Criado em" value={new Date(b.createdAt).toLocaleDateString('pt-BR')} />
                </View>
                <Pressable onPress={() => openUpload(b.id)} className="mt-3 min-h-11 justify-center border-t border-line pt-2">
                  <Text className="font-sans text-[13px] text-ink underline">Enviar imagens para este lote</Text>
                </Pressable>
              </Card>
            );
          })}
        </Grid>
      )}

      <Dialog
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Novo lote"
        subtitle="Cada imagem do lote será anotada por esse número de avaliadores."
        footer={
          <>
            <Button label="Cancelar" variant="outline" onPress={() => setCreateOpen(false)} />
            <Button label="Criar lote" onPress={submitBatch} disabled={!name.trim()} />
          </>
        }
      >
        <TextField label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Biópsias gástricas, outubro" />
        <View>
          <TextField label="Avaliadores por imagem" value={n} onChangeText={(v) => setN(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" mono />
          <Text className="mt-1 font-sans text-xs text-ink-subtle">Quantas análises independentes cada imagem precisa antes da validação. Com 1, não há comparação.</Text>
        </View>
        <TextField label="Descrição" value={description} onChangeText={setDescription} multiline placeholder="Material, ampliação, coloração…" />
      </Dialog>

      <Dialog
        visible={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Enviar imagens"
        subtitle={`JPG, PNG ou TIFF de até ${env.uploadMaxMb} MB cada`}
        icon={UploadCloud}
        maxWidth={560}
        footer={
          <>
            <Button label="Fechar" variant="outline" onPress={() => setUploadOpen(false)} />
            <Button label={progress ? 'Enviando…' : picked.length ? `Enviar ${picked.length}` : 'Enviar'} loading={!!progress} disabled={!picked.length || !batchId} onPress={upload} />
          </>
        }
      >
        <Callout tone="info" title="Metadados são removidos antes do envio">
          Textos guardados no arquivo (EXIF, XMP, IPTC, comentários e tags do TIFF) podem conter nome do paciente, prontuário ou datas. O app apaga esses campos sem alterar os pixels.
        </Callout>
        <Select
          label="Lote"
          value={batchId}
          onChange={setTargetBatch}
          options={batches.map((b) => ({ value: b.id, label: b.name, description: `N = ${b.evaluatorsPerImage}` }))}
        />
        <Pressable onPress={choose} className="items-center gap-1 rounded-xs border border-dashed border-ink-subtle p-6 web:hover:bg-surface" accessibilityRole="button">
          <FileImage size={24} color={colors.inkMuted} />
          <Text className="font-sans-medium text-[13px] text-ink">{picked.length ? `${picked.length} arquivo(s) escolhido(s). Trocar` : 'Escolher arquivos'}</Text>
          <Text className="font-sans text-xs text-ink-subtle">JPG, PNG ou TIFF</Text>
        </Pressable>

        {progress ? <Text className="font-sans text-xs text-ink-subtle">{progress}</Text> : null}

        {withMetadata.length ? (
          <Callout tone="warning" icon={AlertTriangle} title={`${withMetadata.length} arquivo(s) com metadados que serão removidos`}>
            <View className="gap-1">
              {withMetadata.map((r) => (
                <Text key={r.name} className="font-sans text-xs text-warn">
                  • {r.name}: {r.findings.map((f) => (f.preview ? `${f.kind} (“${f.preview}”)` : f.kind)).join(', ')}
                </Text>
              ))}
            </View>
          </Callout>
        ) : null}
        {reports.filter((r) => r.error).map((r) => (
          <Text key={r.name} className="font-sans text-xs text-danger">• {r.name}: {r.error}</Text>
        ))}

        {summary ? (
          <View className="gap-1.5 rounded-xs bg-surface p-3">
            <KeyValue label="Enviadas" value={summary.uploaded.length} />
            <KeyValue label="Já existiam (mesmo arquivo)" value={summary.duplicates.length} />
            <KeyValue label="Recusadas" value={summary.rejected.length} />
            {summary.sanitized ? <Text className="font-sans text-xs text-ink-muted">{summary.sanitized} arquivo(s) tiveram metadados removidos.</Text> : null}
            {summary.uploaded.length ? <Text className="font-sans text-xs text-ink-muted">Códigos: <Text className="font-mono">{summary.uploaded.join(', ')}</Text></Text> : null}
            {summary.duplicates.length ? <Text className="font-sans text-xs text-ink-muted">Já cadastradas: <Text className="font-mono">{summary.duplicates.join(', ')}</Text></Text> : null}
            {summary.rejected.map((r, i) => (
              <Text key={i} className="font-sans text-xs text-danger">• {r.filename}: {r.reason}</Text>
            ))}
          </View>
        ) : null}
      </Dialog>
    </Screen>
  );
}
