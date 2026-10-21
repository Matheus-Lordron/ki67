import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, ArrowLeft, CheckCircle2, ZoomIn, ZoomOut } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Callout, KeyValue, Section } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { RadioRow, Segmented, TextField } from '@/components/ui/Field';
import { Grid } from '@/components/ui/Grid';
import { Screen } from '@/components/ui/Screen';
import { ClassSwatch } from '@/features/anotacao/QuantPanel';
import { SlideView } from '@/features/anotacao/SlideView';
import { useImageUrl } from '@/features/anotacao/useImageUrl';
import { useComparison } from '@/features/validacao/useValidation';
import { useAppStore } from '@/state/appStore';
import { colors } from '@/theme/colors';

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const avg = (list: number[]) => Math.round(list.reduce((s, n) => s + n, 0) / Math.max(1, list.length));

export default function ComparisonScreen() {
  const { imageId } = useLocalSearchParams<{ imageId: string }>();
  const { width } = useWindowDimensions();
  const user = useAppStore((s) => s.currentUser);
  const submitConsensus = useAppStore((s) => s.submitConsensus);
  const showToast = useAppStore((s) => s.showToast);

  const { data: cmp, loading, denied } = useComparison(imageId);
  const imageUri = useImageUrl(imageId, cmp?.image.imageUrl ?? '', cmp?.imageVersionId);
  const [mode, setMode] = useState<'sobreposicao' | 'lado'>('sobreposicao');
  const [layers, setLayers] = useState<Record<string, boolean>>({});
  const [zoom, setZoom] = useState(1);
  const [choice, setChoice] = useState('consenso');
  const [justification, setJustification] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (imageId) useAppStore.getState().setLastComparisonImage(imageId);
  }, [imageId]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center gap-2">
        <ActivityIndicator color={colors.ink} />
        <Text className="font-sans text-[13px] text-ink-subtle">Carregando as análises…</Text>
      </View>
    );
  }
  // RN-05 e RN-08: sem as N análises, ou se o validador anotou a imagem, a comparação não abre.
  if (denied || !cmp || !user || cmp.image.assignedEvaluatorIds.includes(user.id) || (!cmp.ready && cmp.image.status !== 'validada')) {
    return <Redirect href="/validador" />;
  }

  const { blind, metrics, spatialAgreementPct } = cmp;
  const image = { ...cmp.image, imageUrl: imageUri };
  const visible = (code: string) => layers[code] !== false;
  const result = cmp.result;
  const chosen = blind.find((b) => b.code === choice);
  const consensus = { reagents: avg(blind.map((b) => b.reagents)), nonReagents: avg(blind.map((b) => b.nonReagents)) };
  const decided = chosen ? { reagents: chosen.reagents, nonReagents: chosen.nonReagents } : consensus;

  const confirm = async () => {
    setBusy(true);
    // O banco ainda exige índice e métricas no fechamento (RF-32). A tela não os mostra,
    // mas eles seguem calculados como antes até a refatoração do backend.
    const res = await submitConsensus({
      imageId: image.id,
      adoptedAnalysisCode: chosen ? `Análise ${chosen.code} adotada` : 'Consenso (média das contagens)',
      adoptedBlindCode: chosen?.code,
      justification,
      consensusKi67: chosen ? (chosen.ki67 ?? 0) : metrics.median,
      reagentsCount: decided.reagents,
      nonReagentsCount: decided.nonReagents,
      iccScore: metrics.iccEstimate,
      divergenceDeltaPP: metrics.deltaPP,
      spatialAgreementPct,
    });
    setBusy(false);
    setConfirmOpen(false);
    if (res.ok) {
      showToast('Resultado registrado. Ele não pode mais ser alterado.');
      router.replace('/validador');
    } else {
      showToast(res.error);
    }
  };

  const openConfirm = () => {
    if (justification.trim().length < 15) {
      showToast('Escreva a justificativa (pelo menos 15 caracteres).');
      return;
    }
    setConfirmOpen(true);
  };

  const wide = width >= 1024;
  const narrow = width < 640;
  const numW = narrow ? 'w-16' : 'w-28';

  return (
    <Screen maxWidth={1440}>
      <View className="gap-3 border-b border-line pb-4">
        <Pressable onPress={() => router.replace('/validador')} className="min-h-9 flex-row items-center gap-1.5 self-start">
          <ArrowLeft size={16} color={colors.ink} />
          <Text className="font-sans text-[13px] text-ink">Fila de validação</Text>
        </Pressable>
        <View className="flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
          <Text accessibilityRole="header" className="font-mono text-xl text-ink">{image.code}</Text>
          <Text className="font-sans text-[13px] text-ink-muted">{image.organ} · {image.batchName}</Text>
        </View>
        <Text className="font-sans text-[13px] text-ink-muted">
          {blind.length} análises independentes. Os avaliadores aparecem só como letras.
        </Text>
      </View>

      <Section title="Contagem por análise">
        <View className="overflow-hidden rounded-xs border border-line bg-white">
          <View className="flex-row border-b border-line bg-surface px-3 py-2">
            <Text className="flex-1 font-sans-medium text-xs text-ink-muted">Análise</Text>
            <View className={`${numW} flex-row items-center justify-end gap-1.5`}>{narrow ? null : <ClassSwatch label="reagente" size={9} />}<Text className="font-sans-medium text-xs text-ink-muted">{narrow ? 'Reag.' : 'Reagentes'}</Text></View>
            <View className={`${numW} flex-row items-center justify-end gap-1.5`}>{narrow ? null : <ClassSwatch label="nao_reagente" size={9} />}<Text className="font-sans-medium text-xs text-ink-muted">Não reag.</Text></View>
            <Text className="w-14 text-right font-sans-medium text-xs text-ink-muted">Total</Text>
          </View>
          {blind.map((an) => (
            <View key={an.code} className="border-b border-line px-3 py-2.5">
              <View className="flex-row items-start">
                <View className="flex-1 flex-row flex-wrap items-baseline gap-x-2">
                  <View style={{ backgroundColor: an.color }} className="h-2.5 w-2.5 rounded-full" />
                  <Text className="font-sans-medium text-[13px] text-ink">Análise {an.code}</Text>
                  <Text className="font-sans text-xs text-ink-subtle">versão {an.version} · {fmt(an.finalizedAt)}</Text>
                </View>
                <Text className={`${numW} text-right font-mono text-[13px] text-ink`}>{an.reagents}</Text>
                <Text className={`${numW} text-right font-mono text-[13px] text-ink`}>{an.nonReagents}</Text>
                <Text className="w-14 text-right font-mono text-[13px] text-ink">{an.total}</Text>
              </View>
              {an.observation ? <Text numberOfLines={2} className="ml-[18px] mt-1 font-sans text-xs text-ink-subtle">{an.observation}</Text> : null}
            </View>
          ))}
        </View>
      </Section>

      <View className={`gap-8 ${wide ? 'flex-row items-start' : ''}`}>
        <Section
          title="Marcações sobre a imagem"
          className={wide ? 'flex-[7]' : ''}
          action={
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'sobreposicao', label: 'Sobrepostas' },
                { value: 'lado', label: 'Lado a lado' },
              ]}
            />
          }
        >
          <View className="flex-row flex-wrap items-center gap-2">
            {blind.map((b) => (
              <Pressable
                key={b.code}
                onPress={() => setLayers((l) => ({ ...l, [b.code]: !visible(b.code) }))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: visible(b.code) }}
                className={`min-h-8 flex-row items-center gap-1.5 rounded-xs border px-2.5 ${visible(b.code) ? 'border-ink-subtle bg-white' : 'border-line bg-surface'}`}
              >
                <View style={{ backgroundColor: visible(b.code) ? b.color : colors.line }} className="h-2.5 w-2.5 rounded-full" />
                <Text className={`font-sans text-xs ${visible(b.code) ? 'text-ink' : 'text-ink-subtle line-through'}`}>Análise {b.code}</Text>
              </Pressable>
            ))}
          </View>

          {mode === 'lado' ? (
            <Grid cols={{ base: 1, md: Math.min(3, blind.length) }} gap={8}>
              {blind.filter((b) => visible(b.code)).map((b) => (
                <View key={b.code} className="h-64 overflow-hidden rounded-xs border border-line bg-[#2a2b2e]">
                  <SlideView uri={image.imageUrl} imageWidth={image.width} imageHeight={image.height} layers={[{ marks: b.marks, tint: b.color }]} zoom={zoom} className="flex-1" pointRadius={5} />
                  <View className="absolute left-2 top-2 rounded-xs bg-black/70 px-1.5 py-0.5">
                    <Text className="font-sans text-xs text-white">Análise {b.code}</Text>
                  </View>
                </View>
              ))}
            </Grid>
          ) : (
            <View className="relative h-[380px] overflow-hidden rounded-xs border border-line bg-[#2a2b2e]">
              <SlideView
                uri={image.imageUrl}
                imageWidth={image.width}
                imageHeight={image.height}
                zoom={zoom}
                layers={blind.filter((b) => visible(b.code)).map((b) => ({ marks: b.marks, tint: b.color }))}
                className="flex-1"
                pointRadius={5}
              />
              <View className="absolute left-2 top-2 flex-row items-center rounded-xs bg-white">
                <Pressable onPress={() => setZoom((z) => Math.min(z + 0.25, 3))} accessibilityLabel="Aproximar" className="h-9 w-9 items-center justify-center">
                  <ZoomIn size={16} color={colors.ink} />
                </Pressable>
                <Pressable onPress={() => setZoom((z) => Math.max(z - 0.25, 0.75))} accessibilityLabel="Afastar" className="h-9 w-9 items-center justify-center border-l border-line">
                  <ZoomOut size={16} color={colors.ink} />
                </Pressable>
                <Pressable onPress={() => setZoom(1)} accessibilityLabel="Tamanho original" className="h-9 justify-center border-l border-line px-2">
                  <Text className="font-mono text-xs text-ink">1×</Text>
                </Pressable>
              </View>
            </View>
          )}
          <Text className="font-sans text-xs text-ink-subtle">Ponto cheio: reagente. Contorno: não reagente. A cor indica a análise.</Text>
        </Section>

        <Section title={result ? 'Resultado registrado' : 'Registrar resultado'} className={wide ? 'flex-[5]' : ''}>
          {result ? (
            <View className="gap-4 rounded-xs border border-line bg-white p-4">
              <Callout tone="success" icon={CheckCircle2}>
                {`Registrado por ${result.validatorName} em ${fmt(result.frozenAt)}. Não pode mais ser alterado.`}
              </Callout>
              <View className="gap-1.5">
                <KeyValue label="Decisão" value={result.adoptedAnalysisCode ?? '—'} />
                {result.reagentsCount !== undefined ? <KeyValue label="Reagentes" value={result.reagentsCount} /> : null}
                {result.nonReagentsCount !== undefined ? <KeyValue label="Não reagentes" value={result.nonReagentsCount} /> : null}
              </View>
              <View className="gap-1">
                <Text className="font-sans-medium text-[13px] text-ink">Justificativa</Text>
                <Text className="font-sans text-[13px] leading-5 text-ink-muted">{result.justification}</Text>
              </View>
            </View>
          ) : (
            <View className="gap-4 rounded-xs border border-line bg-white p-4">
              <View className="gap-1.5">
                <Text className="font-sans-medium text-[13px] text-ink">Qual contagem vale para esta imagem?</Text>
                <RadioRow selected={choice === 'consenso'} onPress={() => setChoice('consenso')} label="Média das análises" value={`${consensus.reagents} / ${consensus.nonReagents}`} />
                {blind.map((b) => (
                  <RadioRow key={b.code} selected={choice === b.code} onPress={() => setChoice(b.code)} label={`Análise ${b.code}`} value={`${b.reagents} / ${b.nonReagents}`} />
                ))}
                <Text className="font-sans text-xs text-ink-subtle">Valores: reagentes / não reagentes.</Text>
              </View>
              <TextField
                label="Justificativa"
                multiline
                value={justification}
                onChangeText={setJustification}
                placeholder="Por que esta contagem? Diferenças entre as análises, áreas excluídas…"
              />
              <View className="gap-1">
                <Check ok={blind.length >= image.requiredEvaluatorsCount} text={`${blind.length} de ${image.requiredEvaluatorsCount} análises finalizadas`} />
                <Check ok text="Você não anotou esta imagem" />
              </View>
              <Button label="Registrar resultado" size="lg" onPress={openConfirm} />
            </View>
          )}
        </Section>
      </View>

      <Dialog
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Registrar o resultado?"
        subtitle={image.code}
        footer={
          <>
            <Button label="Revisar" variant="outline" onPress={() => setConfirmOpen(false)} />
            <Button label="Registrar" loading={busy} onPress={confirm} />
          </>
        }
      >
        <Text className="font-sans text-[13px] leading-5 text-ink-muted">Depois de registrado, o resultado não pode ser alterado.</Text>
        <View className="gap-1.5 rounded-xs bg-surface p-3">
          <KeyValue label="Decisão" value={chosen ? `Análise ${chosen.code}` : 'Média das análises'} />
          <KeyValue label="Reagentes" value={decided.reagents} />
          <KeyValue label="Não reagentes" value={decided.nonReagents} />
        </View>
      </Dialog>
    </Screen>
  );
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      {ok ? <CheckCircle2 size={14} color={colors.success} /> : <AlertTriangle size={14} color={colors.warning} />}
      <Text className="font-sans text-xs text-ink-muted">{text}</Text>
    </View>
  );
}
