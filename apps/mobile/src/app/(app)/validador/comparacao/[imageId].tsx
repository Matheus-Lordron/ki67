import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, CheckCircle2, ShieldCheck, ZoomIn, ZoomOut } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { BackLink } from '@/components/layout/AuthShell';
import { Button } from '@/components/ui/Button';
import { Card, KeyValue } from '@/components/ui/Card';
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
      <View className="flex-1 items-center justify-center gap-2 bg-white">
        <ActivityIndicator color={colors.primary} />
        <Text className="font-sans text-[14px] text-ink-muted">Carregando comparação cega...</Text>
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
  const desktop = width >= 900;

  const confirm = async () => {
    setBusy(true);
    const res = await submitConsensus({
      imageId: image.id,
      adoptedAnalysisCode: chosen ? `Análise ${chosen.code} adotada` : 'Consenso',
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
      showToast('Resultado congelado: Validação selada com SHA-256.');
      router.replace('/validador');
    } else {
      showToast(res.error);
    }
  };

  const openConfirm = () => {
    if (justification.trim().length < 15) {
      showToast('Parecer técnico obrigatório: informe ao menos 15 caracteres.');
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <Screen maxWidth={1160}>
      <View className="gap-4">
        <BackLink label="Voltar para a fila" onPress={() => router.replace('/validador')} />
        <View className="gap-2">
          <Text accessibilityRole="header" className="font-sans-black text-[34px] leading-[40px] tracking-[-1.2px] text-ink sm:text-[40px] sm:leading-[44px]">
            {image.code}
          </Text>
          <Text className="font-sans text-[15px] text-ink-muted">
            {image.batchName} · {image.organ} · {blind.length} análises independentes anonimizadas
          </Text>
        </View>
      </View>

      {/* Faixa de concordância (Section - Concordância no Figma) */}
      <View className={`rounded-[14px] border border-line-card bg-white py-6 ${desktop ? 'flex-row items-stretch' : 'gap-5'}`}>
        <ConcordanceCell
          label="Divergência máxima"
          value={`Δ ${String(metrics.deltaPP).replace('.', ',')} p.p.`}
          note={metrics.deltaPP < DELTA_LIMIT ? 'Dentro do limite' : 'Acima do limite'}
          first
          desktop={desktop}
        />
        <ConcordanceCell
          label="Concordância espacial"
          value={`${spatialAgreementPct}%`}
          note="Tolerância de 3,5%"
          desktop={desktop}
        />
        <ConcordanceCell
          label="ICC estimado"
          value={metrics.iccEstimate.toFixed(2).replace('.', ',')}
          note={iccLabel(metrics.iccEstimate)}
          desktop={desktop}
        />
      </View>

      {/* Seção 1: Análises anonimizadas */}
      <View className="gap-6">
        <StepHeading step="1" title="Análises anonimizadas" />
        <View className="gap-4">
          {blind.map((an) => (
            <Card key={an.code} className="flex-col gap-5 p-6 md:flex-row md:items-center">
              <View className="h-[120px] w-full overflow-hidden rounded-[12px] bg-surface-canvas md:w-[160px]">
                <SlideView
                  uri={image.imageUrl}
                  imageWidth={image.width}
                  imageHeight={image.height}
                  layers={[{ marks: an.marks, tint: an.color }]}
                  className="flex-1 bg-surface-canvas"
                  pointRadius={4}
                />
              </View>

              <View className="flex-1 gap-4">
                <View className="flex-row flex-wrap items-baseline justify-between gap-2">
                  <View className="flex-row items-center gap-2">
                    <View style={{ backgroundColor: an.color }} className="h-2.5 w-2.5 rounded-full" />
                    <Text className="font-sans-black text-[20px] text-ink">Análise {an.code}</Text>
                  </View>
                  <Text className="font-sans text-[13px] text-ink-muted">
                    Versão {an.version} final ·{' '}
                    {an.finalizedAt
                      ? `${new Date(an.finalizedAt).toLocaleDateString('pt-BR')}, ${new Date(an.finalizedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                      : '—'}
                  </Text>
                </View>

                <View className="flex-row flex-wrap gap-6">
                  <StatBlock label="Ki-67" value={formatKi67(an.ki67)} highlight />
                  <StatBlock label="Reagentes" value={an.reagents} />
                  <StatBlock label="Não reagentes" value={an.nonReagents} />
                  <StatBlock label="Núcleos marcados" value={an.total} />
                </View>

                {an.observation ? (
                  <Text numberOfLines={2} className="font-sans text-[13px] italic text-ink-muted">
                    “{an.observation}”
                  </Text>
                ) : null}
              </View>
            </Card>
          ))}
        </View>
      </View>

      {/* Seção 2: Sobreposição e mapa de calor */}
      <View className="gap-6">
        <StepHeading step="2" title="Sobreposição e mapa de calor" />
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <View className="flex-row flex-wrap items-center gap-2">
            {blind.map((b) => {
              const on = visible(b.code);
              return (
                <Pressable
                  key={b.code}
                  onPress={() => setLayers((l) => ({ ...l, [b.code]: !on }))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  className={`h-10 flex-row items-center gap-2 rounded-[8px] border px-4 ${
                    on ? 'border-primary bg-surface-alt' : 'border-line-button bg-white'
                  }`}
                >
                  <View style={{ backgroundColor: b.color }} className="h-2 w-2 rounded-full" />
                  <Text className={`font-sans-semibold text-[13px] ${on ? 'text-primary' : 'text-ink-muted'}`}>
                    Anotações {b.code}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setHeatmap((v) => !v)}
              className={`h-10 flex-row items-center justify-center rounded-[8px] border px-4 ${
                heatmap ? 'border-primary bg-primary' : 'border-line-button bg-white'
              }`}
            >
              <Text className={`font-sans-semibold text-[13px] ${heatmap ? 'text-white' : 'text-ink'}`}>
                Mapa de divergência
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSideBySide((v) => !v)}
              className={`h-10 flex-row items-center justify-center rounded-[8px] border px-4 ${
                sideBySide ? 'border-primary bg-surface-alt' : 'border-line-button bg-white'
              }`}
            >
              <Text className={`font-sans-semibold text-[13px] ${sideBySide ? 'text-primary' : 'text-ink-muted'}`}>
                {sideBySide ? 'Modo sobreposição' : 'Lado a lado'}
              </Text>
            </Pressable>
          </View>

          <Text className="font-sans-semibold text-[14px] text-ink-muted">
            {spatialAgreementPct}% de coincidência espacial
          </Text>
        </View>

        {sideBySide ? (
          <Grid cols={{ base: 1, md: Math.min(3, blind.length) }} gap={12}>
            {blind
              .filter((b) => visible(b.code))
              .map((b) => (
                <View key={b.code} className="h-[320px] overflow-hidden rounded-[16px] bg-surface-canvas">
                  <SlideView
                    uri={image.imageUrl}
                    imageWidth={image.width}
                    imageHeight={image.height}
                    layers={[{ marks: b.marks, tint: b.color }]}
                    zoom={zoom}
                    className="flex-1 bg-surface-canvas"
                    pointRadius={5}
                  />
                  <View style={{ backgroundColor: b.color }} className="absolute left-3 top-3 rounded-[8px] px-2.5 py-1">
                    <Text className="font-sans-bold text-[12px] text-white">Análise {b.code}</Text>
                  </View>
                </View>
              ))}
          </Grid>
        ) : (
          <View className="relative h-[460px] overflow-hidden rounded-[16px] bg-surface-canvas">
            <SlideView
              uri={image.imageUrl}
              imageWidth={image.width}
              imageHeight={image.height}
              zoom={zoom}
              heat={heatmap ? heat : undefined}
              layers={blind.filter((b) => visible(b.code)).map((b) => ({ marks: b.marks, tint: b.color }))}
              className="flex-1 bg-surface-canvas"
              pointRadius={5}
            />
            <View className="absolute left-4 top-4 flex-row items-center gap-1 rounded-[10px] border border-line bg-white/95 p-1 shadow-sm">
              <Pressable onPress={() => setZoom((z) => Math.min(z + 0.25, 3))} accessibilityLabel="Aumentar zoom" className="h-9 w-9 items-center justify-center rounded-[8px]">
                <ZoomIn size={16} color={colors.ink} />
              </Pressable>
              <Pressable onPress={() => setZoom((z) => Math.max(z - 0.25, 0.75))} accessibilityLabel="Diminuir zoom" className="h-9 w-9 items-center justify-center rounded-[8px]">
                <ZoomOut size={16} color={colors.ink} />
              </Pressable>
              <Pressable onPress={() => setZoom(1)} className="h-9 justify-center px-2">
                <Text className="font-sans-bold text-[12px] text-primary">1x</Text>
              </Pressable>
            </View>
            {heatmap ? (
              <View className="absolute bottom-4 left-4 rounded-[8px] bg-amber-100 px-3 py-1.5">
                <Text className="font-sans-semibold text-[12px] text-amber-950">{heat.length} região(ões) de divergência</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>

      {/* Seção 3: Resultado validado */}
      <View className="gap-6">
        <StepHeading step="3" title="Resultado validado" />
        {result ? (
          <Card className="gap-6 p-7">
            <View className="flex-row items-center gap-3.5">
              <CheckCircle2 size={24} color={colors.primary} />
              <View className="flex-1 gap-0.5">
                <Text className="font-sans-black text-[18px] text-ink">Resultado congelado</Text>
                <Text className="font-sans text-[13px] text-ink-muted">
                  Registrado por {result.validatorName} em {new Date(result.frozenAt).toLocaleString('pt-BR')}
                </Text>
              </View>
            </View>

            <View className="flex-row flex-wrap gap-8 border-t border-line pt-6">
              <StatBlock label="Decisão" value={result.adoptedAnalysisCode ?? 'Consenso'} />
              <StatBlock label="Ki-67 validado" value={formatKi67(result.consensusKi67)} highlight />
              <StatBlock label="ICC / Δ" value={`${String(result.iccScore).replace('.', ',')} / ${String(result.divergenceDeltaPP).replace('.', ',')} p.p.`} />
              <StatBlock label="Coincidência" value={`${result.spatialAgreementPct}%`} />
            </View>

            {result.justification ? (
              <Text className="font-sans text-[14px] italic text-ink-muted">“{result.justification}”</Text>
            ) : null}
            <Text numberOfLines={1} className="font-mono text-[11px] text-ink-subtle">
              SHA-256: {result.hashSHA256}
            </Text>
          </Card>
        ) : (
          <Card className="gap-5 p-7">
            <View className="flex-row flex-wrap items-baseline justify-between gap-2 rounded-[12px] bg-surface-subtle p-4">
              <View className="gap-0.5">
                <Text className="font-sans-semibold text-[13px] text-ink-muted">Ki-67 mediano sugerido</Text>
                <Text className="font-sans text-[13px] text-ink-muted">
                  Intervalo {formatKi67(metrics.min)} – {formatKi67(metrics.max)} (Δ {metrics.deltaPP} p.p.)
                </Text>
              </View>
              <Text className="font-sans-black text-[28px] text-primary">{formatKi67(metrics.median)}</Text>
            </View>

            <View className="gap-2">
              <Text className="font-sans-semibold text-[13px] text-ink">Decisão de consenso</Text>
              <RadioRow
                selected={choice === 'consenso'}
                onPress={() => setChoice('consenso')}
                label="Consenso (mediana das análises)"
                value={formatKi67(metrics.median)}
              />
              {blind.map((b) => (
                <RadioRow
                  key={b.code}
                  selected={choice === b.code}
                  onPress={() => setChoice(b.code)}
                  label={`Adotar a análise ${b.code}`}
                  value={formatKi67(b.ki67)}
                />
              ))}
            </View>

            <TextField
              label="Parecer técnico do validador"
              multiline
              value={justification}
              onChangeText={setJustification}
              placeholder="Justificativa sobre concordância, hotspot e critérios de exclusão..."
            />

            <View className="gap-1.5 rounded-[12px] bg-surface-subtle p-4">
              <CheckRow ok={blind.length >= image.requiredEvaluatorsCount} text={`Meta de ${image.requiredEvaluatorsCount} análises independentes cumprida`} />
              <CheckRow ok={metrics.deltaPP < DELTA_LIMIT} text={`Divergência entre avaliadores < ${DELTA_LIMIT} p.p.`} />
              <CheckRow ok text="Você não anotou esta imagem (RN-08)" />
            </View>

            <View className="flex-row justify-end pt-1">
              <Button label="Aprovar e congelar resultado" icon={ShieldCheck} size="lg" onPress={openConfirm} />
            </View>
          </Card>
        )}
      </View>

      <Dialog
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Congelar resultado validado?"
        subtitle={`${image.code} · selo SHA-256 irreversível`}
        footer={
          <>
            <Button label="Revisar" variant="neutral" onPress={() => setConfirmOpen(false)} />
            <Button label="Confirmar e congelar" loading={busy} onPress={confirm} />
          </>
        }
      >
        <Text className="font-sans text-[14px] leading-5 text-ink-muted">
          O resultado se tornará definitivo e imutável no banco de dados e no log de auditoria.
        </Text>
        <View className="rounded-[12px] border border-line bg-surface-subtle px-4 py-2">
          <KeyValue label="Decisão" value={chosen ? `Análise ${chosen.code}` : 'Consenso'} bordered />
          <KeyValue label="Ki-67 validado" value={formatKi67(chosenKi67)} />
        </View>
      </Dialog>
    </Screen>
  );
}

function ConcordanceCell({
  label,
  value,
  note,
  first,
  desktop,
}: {
  label: string;
  value: string;
  note: string;
  first?: boolean;
  desktop: boolean;
}) {
  return (
    <View
      className={`justify-center gap-1.5 px-7 ${
        first ? 'flex-1' : desktop ? 'flex-1 border-l border-line' : 'border-t border-line-soft pt-4'
      }`}
    >
      <Text className="font-sans-semibold text-[13px] text-ink-muted">{label}</Text>
      <Text className="font-sans-black text-[26px] leading-[30px] tracking-[-0.52px] text-ink">{value}</Text>
      <Text className="font-sans text-[13px] text-ink-muted">{note}</Text>
    </View>
  );
}

function StepHeading({ step, title }: { step: string; title: string }) {
  return (
    <View className="flex-row items-center gap-3.5">
      <View className="h-[34px] w-[34px] items-center justify-center rounded-full border border-line-card bg-white">
        <Text className="font-sans-bold text-[14px] text-ink">{step}</Text>
      </View>
      <Text className="font-sans-black text-[24px] leading-[29px] tracking-[-0.48px] text-ink">{title}</Text>
    </View>
  );
}

function StatBlock({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <View className="min-w-[110px] gap-1">
      <Text className="font-sans-semibold text-[13px] text-ink-muted">{label}</Text>
      <Text className={highlight ? 'font-sans-black text-[24px] leading-[28px] text-ink' : 'font-sans-bold text-[16px] text-ink'}>
        {value}
      </Text>
    </View>
  );
}

function CheckRow({ ok, text }: { ok: boolean; text: string }) {
  return (
    <View className="flex-row items-center gap-2">
      {ok ? <CheckCircle2 size={15} color="#047857" /> : <AlertTriangle size={15} color="#b45309" />}
      <Text className="font-sans text-[13px] text-ink">{text}</Text>
    </View>
  );
}
