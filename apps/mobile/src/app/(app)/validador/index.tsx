import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Search, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Badge, Card, EmptyState, KeyValue, PageHeader } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Field';
import { Grid } from '@/components/ui/Grid';
import { Screen } from '@/components/ui/Screen';
import { useRefreshOnFocus } from '@/features/sessao/useRefreshOnFocus';
import { iccLabel } from '@/features/validacao/comparison';
import { useValidationQueue } from '@/features/validacao/useValidation';
import { useAppStore } from '@/state/appStore';
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
    <Screen maxWidth={1160}>
      <PageHeader
        title="Fila de validação"
        badge={`${pendingCount} aguardando`}
        description="Lâminas com todas as análises finalizadas, prontas para o consenso."
      />

      <View className="max-w-[480px]">
        <TextField
          label="Buscar"
          icon={Search}
          value={search}
          onChangeText={setSearch}
          placeholder="Código da lâmina (ex.: LT01-0044)"
        />
      </View>

      {shown.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nenhuma lâmina pronta para validação no momento"
          description="As lâminas entram nesta fila quando todos os avaliadores independentes finalizam suas análises."
        />
      ) : (
        <Grid cols={{ base: 1, md: 2 }} gap={20}>
          {shown.map(({ img, finalized, metrics }) => {
            const validated = img.status === 'validada';
            const medianValue =
              validated && img.consensusResult ? formatKi67(img.consensusResult.consensusKi67) : formatKi67(metrics.median);
            const deltaText = `Δ ${String(metrics.deltaPP).replace('.', ',')} p.p.`;
            const iccText = `${metrics.iccEstimate.toFixed(2).replace('.', ',')} · ${iccLabel(metrics.iccEstimate)}`;

            return (
              <Card key={img.id} className="h-full justify-between overflow-hidden p-0">
                <View>
                  <View className="h-[180px] w-full items-center justify-center overflow-hidden bg-surface-canvas">
                    <Image
                      source={{ uri: img.imageUrl }}
                      contentFit="cover"
                      cachePolicy="none"
                      style={{ width: '100%', height: '100%' }}
                      accessibilityIgnoresInvertColors
                    />
                  </View>

                  <View className="gap-5 px-7 pb-7 pt-6">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1 gap-1">
                        <Text className="font-sans-black text-[22px] leading-[26.4px] tracking-[-0.44px] text-ink">
                          {img.code}
                        </Text>
                        <Text numberOfLines={1} className="font-sans text-[14px] text-ink-muted">
                          {img.batchName}
                        </Text>
                      </View>
                      <Badge
                        label={validated ? 'Resultado congelado' : `${finalized} de ${img.requiredEvaluatorsCount} finalizadas`}
                        tone="primary"
                      />
                    </View>

                    <View>
                      <KeyValue label="Ki-67 mediano" value={medianValue} bordered />
                      <KeyValue label="Divergência máxima" value={deltaText} bordered />
                      <KeyValue label="ICC estimado" value={iccText} />
                    </View>

                    <Button
                      label={validated ? 'Ver resultado validado' : 'Comparar análises'}
                      className="w-full"
                      onPress={() => {
                        useAppStore.getState().setLastComparisonImage(img.id);
                        router.push(`/validador/comparacao/${img.id}`);
                      }}
                    />
                  </View>
                </View>
              </Card>
            );
          })}
        </Grid>
      )}
    </Screen>
  );
}
