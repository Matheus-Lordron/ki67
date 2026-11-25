import type { DocumentPickerAsset } from 'expo-document-picker';
import { AlertTriangle, CheckCircle2, FileImage, Layers, Upload } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Callout, Card, EmptyState, PageHeader } from '@/components/ui/Card';
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
import { newRequestId, useSubmitOnce } from '@/utils/submitGuard';

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
  const [requestId, setRequestId] = useState(newRequestId);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [targetBatch, setTargetBatch] = useState<string | null>(null);
  const [picked, setPicked] = useState<DocumentPickerAsset[]>([]);
  const [reports, setReports] = useState<FileMetadataReport[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [summary, setSummary] = useState<UploadSummary | null>(null);

  const batchId = targetBatch ?? batches[0]?.id ?? null;

  const openCreate = () => {
    setRequestId(newRequestId());
    setCreateOpen(true);
  };

  const { submit: submitBatch, pending: creatingBatch } = useSubmitOnce(async () => {
    if (!project) return;
    const result = await createBatch(project.id, name, Number.parseInt(n, 10) || 0, description, requestId);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(`Lote criado: ${name.trim()} já está na lista.`);
    setCreateOpen(false);
    setName('');
    setN('3');
    setDescription('');
  });

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
    const result = await uploadImages(batchId, picked, setProgress);
    setSummary(result);
    setPicked([]);
    setReports([]);
    setProgress(null);
    showToast(`Upload concluído: ${result.uploaded.length} enviada(s), ${result.duplicates.length} duplicada(s), ${result.rejected.length} recusada(s).`);
  };

  const withMetadata = reports.filter((r) => r.findings.length);

  return (
    <Screen maxWidth={1240}>
      <PageHeader
        title="Lotes"
        description="Gerencie os lotes e as imagens do projeto."
        actions={
          <>
            <ProjectPicker />
            <Button label="Upload de imagens" variant="outline" disabled={!batches.length} onPress={() => openUpload()} />
            <Button label="Novo lote" disabled={!project} onPress={openCreate} />
          </>
        }
      />

      {batches.length === 0 ? (
        <EmptyState
          icon={FileImage}
          title="Nenhum lote neste projeto"
          description="Crie um lote, defina quantos avaliadores cada imagem recebe (N) e envie as lâminas."
        />
      ) : (
        <Grid cols={{ base: 1, md: 2, lg: 3 }} gap={24}>
          {batches.map((b) => {
            const count = images.filter((i) => i.batchId === b.id).length;
            return (
              <Card key={b.id} className="h-full justify-between gap-6 p-7">
                <View className="gap-6">
                  <View className="flex-row items-center gap-3.5">
                    <Layers size={26} color={colors.primary} />
                    <View className="flex-1 gap-1">
                      <Text numberOfLines={1} className="font-sans-black text-[22px] leading-[26.4px] tracking-[-0.44px] text-ink">
                        {b.name}
                      </Text>
                      <Text numberOfLines={2} className="font-sans text-[14px] leading-[21px] text-ink-muted">
                        {b.description || 'Sem descrição.'}
                      </Text>
                    </View>
                  </View>

                  <View className="gap-5 border-t border-line pt-6">
                    <View className="flex-row gap-4">
                      <View className="flex-1 gap-1.5">
                        <Text className="font-sans-semibold text-[13px] text-ink-muted">Avaliadores por imagem</Text>
                        <Text className="font-sans-black text-[22px] text-ink">{b.evaluatorsPerImage}</Text>
                      </View>
                      <View className="flex-1 gap-1.5">
                        <Text className="font-sans-semibold text-[13px] text-ink-muted">Imagens</Text>
                        <Text className="font-sans-black text-[22px] text-ink">{count}</Text>
                      </View>
                    </View>
                    <View className="flex-row gap-4">
                      <View className="flex-1 gap-1.5">
                        <Text className="font-sans-semibold text-[13px] text-ink-muted">Criado em</Text>
                        <Text className="font-sans-bold text-[16px] text-ink">
                          {new Date(b.createdAt).toLocaleDateString('pt-BR')}
                        </Text>
                      </View>
                      <View className="flex-1 gap-1.5">
                        <Text className="font-sans-semibold text-[13px] text-ink-muted">Criado por</Text>
                        <Text numberOfLines={2} className="font-sans-bold text-[14px] text-ink">
                          {b.createdBy}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <Button label="Adicionar lâminas" variant="outline" className="min-h-[44px] w-full" onPress={() => openUpload(b.id)} />
              </Card>
            );
          })}
        </Grid>
      )}

      <Dialog
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Novo lote"
        subtitle="Defina o nome e quantos avaliadores independentes cada imagem recebe."
        footer={
          <>
            <Button label="Cancelar" variant="neutral" onPress={() => setCreateOpen(false)} />
            <Button label="Criar lote" onPress={submitBatch} loading={creatingBatch} disabled={!name.trim()} />
          </>
        }
      >
        <TextField label="Nome do lote" value={name} onChangeText={setName} placeholder="Lote #845 - Biópsias gástricas Ki-67" />
        <View className="gap-1.5">
          <TextField
            label="Avaliadores por imagem (N)"
            value={n}
            onChangeText={(v) => setN(v.replace(/\D/g, '').slice(0, 2))}
            keyboardType="number-pad"
          />
          <Text className="font-sans text-[13px] leading-[19.5px] text-ink-muted">
            Quantas análises independentes e cegas cada imagem precisa antes da validação (padrão 3).
          </Text>
        </View>
        <TextField
          label="Descrição"
          optional="opcional"
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Contexto clínico, ampliação, coloração (ex.: 40x DAB)"
        />
      </Dialog>

      <Dialog
        visible={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload de imagens"
        subtitle={`JPG, PNG ou TIFF de até ${env.uploadMaxMb} MB cada.`}
        maxWidth={580}
        footer={
          <>
            <Button label="Fechar" variant="neutral" onPress={() => setUploadOpen(false)} />
            <Button
              label={progress ? 'Enviando...' : 'Enviar imagens'}
              loading={!!progress}
              disabled={!picked.length || !batchId}
              onPress={upload}
            />
          </>
        }
      >
        <Select
          label="Lote de destino"
          value={batchId}
          onChange={setTargetBatch}
          options={batches.map((b) => ({ value: b.id, label: b.name, description: `N = ${b.evaluatorsPerImage}` }))}
        />

        <Pressable
          onPress={choose}
          accessibilityRole="button"
          accessibilityLabel="Selecionar arquivos de imagem"
          className="items-center gap-3.5 rounded-[12px] border border-dashed border-line-input bg-surface-subtle px-6 py-9 web:hover:bg-surface-alt/60"
        >
          <Upload size={28} color={colors.primary} />
          <Text className="text-center font-sans-semibold text-[15px] text-ink">
            {picked.length ? `${picked.length} arquivo(s) selecionado(s)` : 'Arraste as imagens aqui'}
          </Text>
          <View className="min-h-[44px] items-center justify-center rounded-[10px] border border-primary bg-white px-5">
            <Text className="font-sans-bold text-[14px] text-primary">Selecionar arquivos</Text>
          </View>
          <Text className="text-center font-sans text-[12px] text-ink-muted">
            Metadados de texto (EXIF, XMP, IPTC e TIFF) são removidos automaticamente antes do envio.
          </Text>
        </Pressable>

        {progress ? <Text className="font-sans text-[13px] text-ink-muted">{progress}</Text> : null}

        {withMetadata.length ? (
          <Callout tone="warning" icon={AlertTriangle} title={`${withMetadata.length} arquivo(s) com metadados de texto (serão higienizados)`}>
            <View className="gap-1">
              {withMetadata.map((r) => (
                <Text key={r.name} className="font-sans text-[12px] text-amber-900">
                  • {r.name}: {r.findings.map((f) => (f.preview ? `${f.kind} (“${f.preview}”)` : f.kind)).join(', ')}
                </Text>
              ))}
            </View>
          </Callout>
        ) : null}

        {reports
          .filter((r) => r.error)
          .map((r) => (
            <Text key={r.name} className="font-sans text-[12px] text-danger">
              • {r.name}: {r.error}
            </Text>
          ))}

        {summary ? (
          <View className="gap-3 rounded-[12px] border border-line bg-surface-subtle p-4">
            <View className="flex-row items-center gap-2">
              <CheckCircle2 size={16} color={colors.primary} />
              <Text className="font-sans-bold text-[14px] text-ink">Resumo do upload</Text>
            </View>
            <View className="flex-row gap-2.5">
              <SummaryBox value={summary.uploaded.length} label="Enviadas" />
              <SummaryBox value={summary.duplicates.length} label="Duplicadas" />
              <SummaryBox value={summary.rejected.length} label="Recusadas" />
            </View>
            {summary.sanitized ? (
              <Text className="font-sans text-[12px] text-ink-muted">{summary.sanitized} arquivo(s) tiveram metadados removidos.</Text>
            ) : null}
            {summary.uploaded.length ? (
              <Text className="font-sans text-[12px] text-ink">Códigos gerados: {summary.uploaded.join(', ')}</Text>
            ) : null}
            {summary.duplicates.length ? (
              <Text className="font-sans text-[12px] text-amber-800">SHA-256 já cadastrado: {summary.duplicates.join(', ')}</Text>
            ) : null}
            {summary.rejected.length ? (
              <View className="gap-1 border-t border-line pt-2">
                <Text className="font-sans-semibold text-[12px] text-danger">Motivos de recusa:</Text>
                {summary.rejected.map((r, i) => (
                  <Text key={i} className="font-sans text-[12px] text-danger">
                    • {r.filename}: {r.reason}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </Dialog>
    </Screen>
  );
}

function SummaryBox({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 items-center rounded-[10px] border border-line bg-white py-2.5">
      <Text className="font-sans-black text-[18px] text-ink">{value}</Text>
      <Text className="font-sans text-[12px] text-ink-muted">{label}</Text>
    </View>
  );
}
