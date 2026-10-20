import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Activity, ArrowRight, Lock, Search, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Badge, Card, EmptyState, KeyValue, PageHeader } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Field';
import { Grid } from '@/components/ui/Grid';
import { Screen } from '@/components/ui/Screen';
import { iccLabel } from '@/features/validacao/comparison';
import { useValidationQueue } from '@/features/validacao/useValidation';
import { useRefreshOnFocus } from '@/features/sessao/useRefreshOnFocus';
import { useAppStore } from '@/state/appStore';
import { colors } from '@/theme/colors';
import { formatKi67 } from '@/utils/ki67';

/**
 * Fila de validação (RF-30): só imagens com as N análises finalizadas (RN-05)
 * e que o validador NÃO anotou (RN-08).
 */
export default function ValidationQueue() {
  useRefreshOnFocus();
  const ready = useValidationQueue();
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const shown = ready.filter(({ img }) => !term || [img.code, img.organ, img.batchName].some((t) => t.toLowerCase().includes(term)));
  const pendingCount = ready.filter(({ img }) => img.status !== 'validada').length;

  return (
    <Screen>
      <PageHeader
        title="Fila de Validação e Consenso Ki-67"
        badge="SÓ COM AS N ANÁLISES FINALIZADAS"
        badgeTone="success"
        description="Lâminas liberadas depois que todos os N avaliadores independentes finalizaram. Imagens que você anotou não aparecem aqui (RN-08)."
        actions={
          <View className="rounded-xs border border-line bg-surface-alt px-3 py-1.5">
            <Text className="font-mono text-xs text-ink-subtle">
              Aguardando validação: <Text className="font-mono-bold text-primary">{pendingCount}</Text>
            </Text>
          </View>
        }
      />
      <View className="max-w-md border-b border-line pb-3">
        <TextField icon={Search} value={search} onChangeText={setSearch} placeholder="Buscar por código (ex.: LT01-0044) ou patologia..." />
      </View>

      {shown.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nenhuma imagem pronta para validação no momento"
          description="As lâminas só entram nesta fila depois que todos os N avaliadores independentes finalizam e selam suas análises."
        />
      ) : (
        <Grid>
          {shown.map(({ img, blindCodes, finalized, metrics }) => {
            const validated = img.status === 'validada';
            return (
              <Card key={img.id} className="h-full justify-between">
                <View>
                  <View className="mb-2 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-1.5">
                      <ShieldCheck size={16} color={colors.primary} />
                      <Text className="font-mono-bold text-sm text-primary">{img.code}</Text>
                    </View>
                    {validated ? <Badge label="Laudo congelado" tone="success" /> : <Badge label={`${finalized}/${img.requiredEvaluatorsCount} finalizadas`} />}
                  </View>
                  <Text className="font-sans-semibold text-xs text-ink">{img.batchName}</Text>
                  <Text className="mb-3 font-sans text-[11px] text-ink-subtle">{img.organ}</Text>
                  <View className="relative mb-3 h-32 overflow-hidden rounded-xs border border-line bg-slate-800">
                    <Image source={{ uri: img.imageUrl }} contentFit="cover" cachePolicy="none" style={{ width: '100%', height: '100%', opacity: 0.9 }} />
                    <View className="absolute left-1.5 top-1.5 flex-row items-center gap-1 rounded-xs bg-black/70 px-1.5 py-0.5">
                      <Lock size={12} color="#34d399" />
                      <Text className="font-mono text-[10px] text-white">Anonimizada {blindCodes.join(' / ')}</Text>
                    </View>
                  </View>
                  <View className="mb-4 gap-1.5 rounded-xs border border-line bg-surface-alt p-3">
                    <KeyValue label="Divergência máxima:" value={`Δ ${metrics.deltaPP} p.p.`} valueClassName="text-sky-700" />
                    <KeyValue label="ICC estimado:" value={`${metrics.iccEstimate.toFixed(2)} (${iccLabel(metrics.iccEstimate)})`} valueClassName="text-emerald-700" />
                    <View className="border-t border-line pt-1">
                      <KeyValue label="Ki-67 mediano:" value={validated && img.consensusResult ? formatKi67(img.consensusResult.consensusKi67) : formatKi67(metrics.median)} valueClassName="text-primary" />
                    </View>
                  </View>
                </View>
                <Button
                  label={validated ? 'Ver Laudo e Comparação' : 'Comparar Análises & Consenso'}
                  icon={Activity}
                  iconRight={ArrowRight}
                  onPress={() => {
                    useAppStore.getState().setLastComparisonImage(img.id);
                    router.push(`/validador/comparacao/${img.id}`);
                  }}
                />
              </Card>
            );
          })}
        </Grid>
      )}
    </Screen>
  );
}
