import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, ArrowLeft, CheckCircle2, FileCheck, Flame, Layers, ShieldCheck, ZoomIn, ZoomOut } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Badge, Card, Callout, KeyValue } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { RadioRow, TextField } from '@/components/ui/Field';
import { Grid } from '@/components/ui/Grid';
import { Screen } from '@/components/ui/Screen';
import { SlideView } from '@/features/anotacao/SlideView';
import { useImageUrl } from '@/features/anotacao/useImageUrl';
import { iccLabel } from '@/features/validacao/comparison';
import { useComparison } from '@/features/validacao/useValidation';
import { useAppStore } from '@/state/appStore';
import { colors } from '@/theme/colors';
import { formatKi67 } from '@/utils/ki67';

const DELTA_LIMIT = 5; // p.p. — referência para o checklist

export default function ComparisonScreen() {
  const { imageId } = useLocalSearchParams<{ imageId: string }>();
  const { width } = useWindowDimensions();
  const user = useAppStore((s) => s.currentUser);
  const submitConsensus = useAppStore((s) => s.submitConsensus);
  const showToast = useAppStore((s) => s.showToast);

  const { data: cmp, loading, denied } = useComparison(imageId);
  const imageUri = useImageUrl(imageId, cmp?.image.imageUrl ?? '', cmp?.imageVersionId);
  const [sideBySide, setSideBySide] = useState(false);
  const [layers, setLayers] = useState<Record<string, boolean>>({});
  const [heatmap, setHeatmap] = useState(false);
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
        <ActivityIndicator color={colors.primary} />
        <Text className="font-mono text-xs text-ink-subtle">Carregando a comparação cega...</Text>
      </View>
    );
  }
  // RN-05 e RN-08: sem as N análises, ou se o validador anotou a imagem, a comparação não abre.
  if (denied || !cmp || !user || cmp.image.assignedEvaluatorIds.includes(user.id) || (!cmp.ready && cmp.image.status !== 'validada')) {
    return <Redirect href="/validador" />;
  }

  const { blind, metrics, spatialAgreementPct, heat } = cmp;
  const image = { ...cmp.image, imageUrl: imageUri };
  const visible = (code: string) => layers[code] !== false;
  const result = cmp.result;
  const chosen = blind.find((b) => b.code === choice);
  const chosenKi67 = chosen ? (chosen.ki67 ?? 0) : metrics.median;

  const confirm = async () => {
    setBusy(true);
    const res = await submitConsensus({
      imageId: image.id,
      adoptedAnalysisCode: chosen ? `Análise ${chosen.code} adotada` : 'Consenso mediano',
      adoptedBlindCode: chosen?.code,
      justification,
      consensusKi67: chosenKi67,
      reagentsCount: chosen ? chosen.reagents : Math.round(blind.reduce((s, b) => s + b.reagents, 0) / blind.length),
      nonReagentsCount: chosen ? chosen.nonReagents : Math.round(blind.reduce((s, b) => s + b.nonReagents, 0) / blind.length),
      iccScore: metrics.iccEstimate,
      divergenceDeltaPP: metrics.deltaPP,
      spatialAgreementPct,
    });
    setBusy(false);
    setConfirmOpen(false);
    if (res.ok) {
      showToast('Resultado validado, selado e tornado imutável.');
      router.replace('/validador');
    } else {
      showToast(res.error);
    }
  };

  const openConfirm = () => {
    if (justification.trim().length < 15) {
      showToast('O parecer técnico é obrigatório (mínimo de 15 caracteres).');
      return;
    }
    setConfirmOpen(true);
  };

  const wide = width >= 1024;

  return (
    <Screen maxWidth={1600}>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Pressable onPress={() => router.replace('/validador')} className="min-h-11 flex-row items-center gap-1.5">
          <ArrowLeft size={16} color={colors.primary} />
          <Text className="font-sans-semibold text-xs text-primary">Voltar para a fila de validação</Text>
        </Pressable>
        <Text className="font-mono text-xs text-ink-subtle">Lâmina: {image.code} · Amostragem {blind.length}x cega</Text>
      </View>

      <Card className="flex-row flex-wrap items-center justify-between gap-4 p-4 lg:p-5">
        <View className="shrink gap-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="font-sans-bold text-xl text-primary">Comparação cega · Ki-67 nuclear</Text>
            <Badge label={`Meta N=${image.requiredEvaluatorsCount} atingida`} />
          </View>
          <Text className="font-sans text-xs text-ink-muted">{image.batchName} — {image.organ}. Nomes dos avaliadores omitidos (protocolo cego).</Text>
        </View>
        <View className="flex-row flex-wrap gap-6">
          <Metric label="Divergência máxima" value={`Δ ${metrics.deltaPP} p.p.`} tag={metrics.deltaPP < DELTA_LIMIT ? 'Dentro do limite' : 'Acima do limite'} ok={metrics.deltaPP < DELTA_LIMIT} />
          <Metric label="Concordância espacial" value={`${spatialAgreementPct}%`} tag="tolerância 3,5%" ok={spatialAgreementPct >= 80} />
          <Metric label="ICC estimado" value={metrics.iccEstimate.toFixed(2)} tag={iccLabel(metrics.iccEstimate)} ok={metrics.iccEstimate >= 0.75} />
        </View>
      </Card>

      <View className="gap-2">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <View className="flex-row items-center gap-2">
            <Layers size={16} color={colors.primary} />
            <Text className="font-sans-bold text-sm text-ink">Análises anonimizadas (sessões fechadas)</Text>
          </View>
          <Text className="font-mono text-xs text-ink-subtle">Cada análise selada com SHA-256</Text>
        </View>
        <Grid cols={{ base: 1, md: Math.min(3, blind.length), lg: Math.min(4, blind.length) }}>
          {blind.map((an) => (
            <Card key={an.code} className="h-full gap-2 p-4">
              <View className="flex-row items-center justify-between border-b border-surface-alt pb-2">
                <View className="flex-row items-center gap-2">
                  <View style={{ backgroundColor: an.color }} className="h-6 w-6 items-center justify-center rounded-xs">
                    <Text className="font-mono-bold text-xs text-white">{an.code}</Text>
                  </View>
                  <Text className="font-sans-bold text-xs text-ink">Análise {an.code} (anonimizada)</Text>
                </View>
                <Text className="rounded-xs bg-surface-alt px-1.5 py-0.5 font-mono text-[11px] text-primary">v{an.version} final</Text>
              </View>
              <View className="flex-row items-baseline justify-between">
                <Text className="font-sans text-xs text-ink-subtle">Índice Ki-67:</Text>
                <Text className="font-mono-bold text-2xl text-primary">{formatKi67(an.ki67)}</Text>
              </View>
              <View className="flex-row gap-2">
                <View className="flex-1 flex-row items-center justify-between rounded-xs border border-amber-200 bg-warn-soft p-2">
                  <Text className="font-sans-semibold text-[11px] text-warn">● Reagentes</Text>
                  <Text className="font-mono-bold text-xs text-warn">{an.reagents}</Text>
                </View>
                <View className="flex-1 flex-row items-center justify-between rounded-xs border border-sky-200 bg-hema-soft p-2">
                  <Text className="font-sans-semibold text-[11px] text-sky-700">○ Não reag.</Text>
                  <Text className="font-mono-bold text-xs text-sky-700">{an.nonReagents}</Text>
                </View>
              </View>
              <View className="relative h-28 overflow-hidden rounded-xs border border-line">
                <SlideView uri={image.imageUrl} imageWidth={image.width} imageHeight={image.height} layers={[{ marks: an.marks }]} className="flex-1" pointRadius={4} />
                <View className="absolute bottom-1 right-1 rounded-xs bg-black/75 px-1.5 py-0.5">
                  <Text className="font-mono text-[10px] text-white">{an.total} núcleos marcados</Text>
                </View>
              </View>
              {an.observation ? <Text numberOfLines={2} className="font-sans text-[11px] italic text-ink-subtle">“{an.observation}”</Text> : null}
              <View className="flex-row justify-between border-t border-surface-alt pt-2">
                <Text className="font-mono text-[10px] text-ink-subtle">{an.finalizedAt ? new Date(an.finalizedAt).toLocaleString('pt-BR') : '—'}</Text>
                <Text numberOfLines={1} className="max-w-[140px] font-mono text-[10px] text-ink-subtle">HASH: {an.hash}</Text>
              </View>
            </Card>
          ))}
        </Grid>
      </View>

      <View className={`gap-5 ${wide ? 'flex-row items-start' : ''}`}>
        <Card className={`gap-3 p-4 ${wide ? 'flex-[7]' : ''}`}>
          <View className="flex-row flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
            <View className="flex-row items-center gap-2">
              <Layers size={16} color={colors.primary} />
              <Text className="font-sans-bold text-sm text-ink">Sobreposição e mapa de calor</Text>
            </View>
            <Pressable onPress={() => setSideBySide((v) => !v)} className="min-h-9 justify-center rounded-xs border border-line bg-surface-alt px-2">
              <Text className="font-mono-bold text-xs text-primary">Modo: {sideBySide ? 'Lado a lado' : 'Sobreposição'}</Text>
            </Pressable>
          </View>
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="font-sans text-xs text-ink-subtle">Camadas:</Text>
            {blind.map((b) => (
              <Pressable
                key={b.code}
                onPress={() => setLayers((l) => ({ ...l, [b.code]: !visible(b.code) }))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: visible(b.code) }}
                style={visible(b.code) ? { borderColor: b.color } : undefined}
                className={`min-h-9 flex-row items-center gap-1.5 rounded-xs border px-2 ${visible(b.code) ? 'bg-surface-alt' : 'border-line bg-white'}`}
              >
                <View style={{ backgroundColor: b.color }} className="h-2 w-2 rounded-full" />
                <Text style={{ color: visible(b.code) ? b.color : colors.inkSubtle }} className="font-mono-bold text-xs">[Anotações {b.code}]</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setHeatmap((v) => !v)} className={`min-h-9 flex-row items-center gap-1.5 rounded-xs border px-2.5 ${heatmap ? 'border-amber-300 bg-amber-100' : 'border-line bg-white'}`}>
              <Flame size={14} color="#d97706" />
              <Text className={`text-xs ${heatmap ? 'font-sans-bold text-amber-900' : 'font-sans-semibold text-ink-muted'}`}>[Mapa de calor de divergência]</Text>
            </Pressable>
          </View>

          {sideBySide ? (
            <Grid cols={{ base: 1, md: Math.min(3, blind.length) }} gap={8}>
              {blind.filter((b) => visible(b.code)).map((b) => (
                <View key={b.code} className="h-64 overflow-hidden rounded-xs border border-line">
                  <SlideView uri={image.imageUrl} imageWidth={image.width} imageHeight={image.height} layers={[{ marks: b.marks, tint: b.color }]} zoom={zoom} className="flex-1" pointRadius={5} />
                  <View style={{ backgroundColor: b.color }} className="absolute left-2 top-2 rounded-xs px-1.5 py-0.5">
                    <Text className="font-mono-bold text-[10px] text-white">{b.code}</Text>
                  </View>
                </View>
              ))}
            </Grid>
          ) : (
            <View className="relative h-[360px] overflow-hidden rounded-xs border border-line">
              <SlideView
                uri={image.imageUrl}
                imageWidth={image.width}
                imageHeight={image.height}
                zoom={zoom}
                heat={heatmap ? heat : undefined}
                layers={blind.filter((b) => visible(b.code)).map((b) => ({ marks: b.marks, tint: b.color }))}
                className="flex-1"
                pointRadius={5}
              />
              <View className="absolute left-2 top-2 flex-row items-center gap-1 rounded-xs border border-line bg-white/90 p-1">
                <Pressable onPress={() => setZoom((z) => Math.min(z + 0.25, 3))} accessibilityLabel="Aumentar zoom" className="h-9 w-9 items-center justify-center">
                  <ZoomIn size={16} color={colors.ink} />
                </Pressable>
                <Pressable onPress={() => setZoom((z) => Math.max(z - 0.25, 0.75))} accessibilityLabel="Diminuir zoom" className="h-9 w-9 items-center justify-center">
                  <ZoomOut size={16} color={colors.ink} />
                </Pressable>
                <Pressable onPress={() => setZoom(1)} className="h-9 justify-center px-1.5">
                  <Text className="font-mono-bold text-xs text-primary">1x</Text>
                </Pressable>
              </View>
              <View className="absolute right-2 top-2 flex-row items-center gap-1.5 rounded-xs border border-line bg-white/95 px-2.5 py-1">
                <View className="h-2 w-2 rounded-full bg-emerald-600" />
                <Text className="font-mono-bold text-xs text-ink">{spatialAgreementPct}% coincidência espacial</Text>
              </View>
              {heatmap ? (
                <View className="absolute bottom-2 left-2 rounded-xs bg-amber-200/90 px-1.5 py-0.5">
                  <Text className="font-mono text-[10px] text-amber-950">{heat.length} região(ões) de divergência</Text>
                </View>
              ) : null}
            </View>
          )}
          <View className="flex-row flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
            <View className="flex-row gap-3">
              <Text className="font-sans text-xs text-ink-subtle">● DAB reagente</Text>
              <Text className="font-sans text-xs text-ink-subtle">○ HEM não reagente</Text>
            </View>
            <Text className="font-mono text-[11px] text-ink-subtle">Contorno colorido = análise (A, B, C...)</Text>
          </View>
        </Card>

        <Card className={`gap-3 p-4 ${wide ? 'flex-[5]' : ''}`}>
          <View className="flex-row items-center justify-between border-b border-line pb-2.5">
            <View className="flex-row items-center gap-2">
              <FileCheck size={16} color={colors.primary} />
              <Text className="font-sans-bold text-sm text-ink">Fechamento do resultado validado</Text>
            </View>
            <Badge label="Papel: Validador" />
          </View>

          {result ? (
            <View className="gap-3">
              <Callout tone="success" icon={ShieldCheck} title="Resultado congelado e imutável">
                {`Registrado por ${result.validatorName} em ${new Date(result.frozenAt).toLocaleString('pt-BR')}.`}
              </Callout>
              <View className="gap-1 rounded-xs border border-line bg-surface-alt p-3">
                <KeyValue label="Decisão:" value={result.adoptedAnalysisCode ?? '—'} valueClassName="text-primary" />
                <KeyValue label="Ki-67 validado:" value={formatKi67(result.consensusKi67)} valueClassName="text-primary" />
                <KeyValue label="ICC / Δ / coincidência:" value={`${result.iccScore} / ${result.divergenceDeltaPP} p.p. / ${result.spatialAgreementPct}%`} />
              </View>
              <Text className="font-sans text-xs italic text-ink-muted">“{result.justification}”</Text>
              <Text numberOfLines={1} className="font-mono text-[10px] text-ink-subtle">SHA-256: {result.hashSHA256}</Text>
            </View>
          ) : (
            <>
              <View className="gap-1 rounded-xs border border-line bg-surface-alt p-3">
                <View className="flex-row items-baseline justify-between">
                  <Text className="font-mono text-xs text-ink-subtle">Ki-67 mediano:</Text>
                  <Text className="font-mono-bold text-2xl text-primary">{formatKi67(metrics.median)}</Text>
                </View>
                <KeyValue label="Intervalo:" value={`${formatKi67(metrics.min)} – ${formatKi67(metrics.max)} (Δ ${metrics.deltaPP} p.p.)`} />
              </View>
              <View className="gap-1.5">
                <Text className="font-sans-semibold text-xs text-ink">Escolha a decisão:</Text>
                <RadioRow selected={choice === 'consenso'} onPress={() => setChoice('consenso')} label="Consenso (mediana das análises)" value={formatKi67(metrics.median)} />
                {blind.map((b) => (
                  <RadioRow key={b.code} selected={choice === b.code} onPress={() => setChoice(b.code)} label={`Adotar a análise ${b.code}`} value={formatKi67(b.ki67)} />
                ))}
              </View>
              <TextField
                label="Parecer técnico do validador (obrigatório)"
                multiline
                value={justification}
                onChangeText={setJustification}
                placeholder="Justificativa sobre concordância, hotspot e critérios de exclusão..."
              />
              <Text className="-mt-2 font-sans text-[10px] text-ink-subtle">O resultado será selado com hash SHA-256 e não poderá ser alterado.</Text>
              <View className="gap-1 rounded-xs border border-line bg-surface-alt p-2">
                <Check ok={blind.length >= image.requiredEvaluatorsCount} text={`Meta de ${image.requiredEvaluatorsCount} análises independentes cumprida`} />
                <Check ok={metrics.deltaPP < DELTA_LIMIT} text={`Divergência entre avaliadores < ${DELTA_LIMIT} p.p.`} />
                <Check ok text="Você não anotou esta imagem (RN-08)" />
              </View>
              <Button label="Aprovar e congelar resultado" icon={ShieldCheck} size="lg" onPress={openConfirm} />
            </>
          )}
        </Card>
      </View>

      <Dialog
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Congelar resultado validado?"
        subtitle={image.code}
        icon={ShieldCheck}
        iconTone="success"
        footer={
          <>
            <Button label="Revisar" variant="outline" onPress={() => setConfirmOpen(false)} />
            <Button label="Confirmar e selar resultado" icon={CheckCircle2} loading={busy} onPress={confirm} />
          </>
        }
      >
        <Text className="font-sans text-xs leading-5 text-ink-muted">
          O resultado se tornará <Text className="font-sans-semibold text-ink">definitivo e imutável</Text>, com hash SHA-256 para auditoria.
        </Text>
        <View className="gap-1 rounded-xs border border-line bg-surface-alt p-3">
          <KeyValue label="Decisão:" value={chosen ? `Análise ${chosen.code}` : 'Consenso (mediana)'} valueClassName="text-primary" />
          <KeyValue label="Ki-67 selecionado:" value={formatKi67(chosenKi67)} valueClassName="text-primary" />
        </View>
      </Dialog>
    </Screen>
  );
}

function Metric({ label, value, tag, ok }: { label: string; value: string; tag: string; ok: boolean }) {
  return (
    <View className="items-end">
      <Text className="font-mono text-[10px] uppercase text-ink-subtle">{label}</Text>
      <View className="flex-row items-center gap-1">
        <Text className={`font-mono-bold text-lg ${ok ? 'text-primary' : 'text-amber-700'}`}>{value}</Text>
        <Text className={`rounded-xs px-1 font-mono text-[10px] ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{tag}</Text>
      </View>
    </View>
  );
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      {ok ? <CheckCircle2 size={14} color="#047857" /> : <AlertTriangle size={14} color="#b45309" />}
      <Text className="font-sans text-[11px] text-ink">{text}</Text>
    </View>
  );
}
