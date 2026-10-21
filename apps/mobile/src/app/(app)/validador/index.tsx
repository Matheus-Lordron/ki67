import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Badge, EmptyState, PageHeader } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Field';
import { Grid } from '@/components/ui/Grid';
import { Screen } from '@/components/ui/Screen';
import { useValidationQueue } from '@/features/validacao/useValidation';
import { useRefreshOnFocus } from '@/features/sessao/useRefreshOnFocus';
import { useAppStore } from '@/state/appStore';

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
        title="Fila de validação"
        description={`${pendingCount} ${pendingCount === 1 ? 'imagem aguarda' : 'imagens aguardam'} resultado. Uma imagem só entra aqui quando todas as análises foram finalizadas, e as que você anotou não aparecem.`}
      />
      <View className="max-w-md">
        <TextField icon={Search} value={search} onChangeText={setSearch} placeholder="Buscar código, órgão ou lote" accessibilityLabel="Buscar" />
      </View>

      {shown.length === 0 ? (
        <EmptyState title="Nenhuma imagem para validar" description="As imagens aparecem aqui assim que todos os avaliadores atribuídos finalizarem as análises." />
      ) : (
        <Grid cols={{ base: 1, sm: 2, lg: 3 }}>
          {shown.map(({ img, finalized }) => {
            const validated = img.status === 'validada';
            return (
              <Pressable
                key={img.id}
                onPress={() => {
                  useAppStore.getState().setLastComparisonImage(img.id);
                  router.push(`/validador/comparacao/${img.id}`);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${img.code}, ${validated ? 'resultado registrado' : 'aguardando resultado'}`}
                className="h-full overflow-hidden rounded-xs border border-line bg-white web:hover:border-ink-subtle"
              >
                <View className="h-36 bg-[#2a2b2e]">
                  <Image source={{ uri: img.imageUrl }} contentFit="cover" cachePolicy="none" style={{ width: '100%', height: '100%' }} />
                </View>
                <View className="gap-2 p-4">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="font-mono text-[13px] text-ink">{img.code}</Text>
                    {validated ? <Badge label="Resultado registrado" tone="success" /> : <Badge label="Aguardando" tone="warning" />}
                  </View>
                  <View>
                    <Text numberOfLines={1} className="font-sans text-[13px] text-ink">{img.organ}</Text>
                    <Text numberOfLines={1} className="font-sans text-xs text-ink-subtle">{img.batchName}</Text>
                  </View>
                  <View className="flex-row items-center justify-between border-t border-line pt-2">
                    <Text className="font-sans text-xs text-ink-muted">
                      <Text className="font-mono text-ink">{finalized}</Text> de {img.requiredEvaluatorsCount} análises
                    </Text>
                    <Text className="font-sans-medium text-[13px] text-ink underline">{validated ? 'Ver resultado' : 'Comparar'}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </Grid>
      )}
    </Screen>
  );
}
