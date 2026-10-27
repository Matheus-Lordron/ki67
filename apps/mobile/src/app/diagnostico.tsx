// Tela provisória da Fase 2: confirma que o app roda (web/Android/iOS), que o
// NativeWind e as fontes funcionam e que o Supabase está alcançável.
// Na Fase 3 ela dá lugar ao login.
import { useQuery } from '@tanstack/react-query';
import { Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isSupabaseConfigured } from '@/config/env';
import { deviceLabel } from '@/services/device';
import { supabase } from '@/services/supabase';
import { calculateKi67Index, formatKi67, getKi67Stratification } from '@/utils/ki67';

type Check = { status: 'ok' | 'warn' | 'error'; message: string };

async function checkSupabase(): Promise<Check> {
  if (!isSupabaseConfigured) {
    return { status: 'warn', message: 'Preencha apps/mobile/.env (veja .env.example) e reinicie o Expo.' };
  }
  // Sem login, o banco deve RECUSAR a chamada (anon não executa RPCs): isso
  // prova que o servidor responde e que as migrações do banco foram aplicadas.
  const { error } = await supabase.rpc('my_session');
  if (!error) return { status: 'ok', message: 'Conectado ao Supabase.' };
  if (error.code === '42501') return { status: 'ok', message: 'Conectado. Schema aplicado e acesso anônimo bloqueado, como esperado.' };
  if (error.code === 'PGRST202') return { status: 'error', message: 'Conectado, mas as migrações do banco ainda não foram aplicadas (docs/04, seção 1).' };
  return { status: 'error', message: `Sem conexão: ${error.message}` };
}

const badge: Record<Check['status'], string> = {
  ok: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  warn: 'bg-warn-soft border-amber-200 text-warn',
  error: 'bg-danger-soft border-red-200 text-danger-dark',
};

export default function SetupCheckScreen() {
  const supabaseCheck = useQuery({ queryKey: ['setup-check'], queryFn: checkSupabase });
  const sample = calculateKi67Index(142, 358);
  const stratum = getKi67Stratification(sample);

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="items-center px-4 py-8">
        <View className="w-full max-w-xl gap-4">
          <View className="rounded-2xl bg-primary px-6 py-5">
            <Text className="font-mono-medium text-xs uppercase tracking-widest text-primary-soft">Segmenta Studio</Text>
            <Text className="mt-1 font-sans-bold text-2xl text-white">Ki-67 IHC</Text>
            <Text className="mt-1 font-sans text-sm text-primary-soft">Fase 2 · fundação do app</Text>
          </View>

          <View className="gap-2 rounded-2xl border border-line bg-white p-5">
            <Text className="font-sans-semibold text-base text-ink">Supabase</Text>
            {supabaseCheck.isPending ? (
              <Text className="font-sans text-sm text-ink-subtle">Verificando conexão...</Text>
            ) : (
              <Text className={`rounded-lg border px-3 py-2 font-sans-medium text-sm ${badge[supabaseCheck.data?.status ?? 'error']}`}>
                {supabaseCheck.data?.message ?? String(supabaseCheck.error)}
              </Text>
            )}
          </View>

          <View className="gap-3 rounded-2xl border border-line bg-white p-5">
            <Text className="font-sans-semibold text-base text-ink">Regras do índice (src/utils/ki67.ts)</Text>
            <View className="flex-row items-center gap-3">
              <View className="h-4 w-4 rounded-full border-2 border-white bg-dab" />
              <Text className="font-sans text-sm text-ink-muted">142 reagentes (DAB)</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <View className="h-4 w-4 rounded-full border-2 border-hema bg-white" />
              <Text className="font-sans text-sm text-ink-muted">358 não reagentes (Hematoxilina)</Text>
            </View>
            <Text className="font-mono-bold text-3xl text-primary">{formatKi67(sample)}</Text>
            <Text className={`self-start rounded-full border px-3 py-1 font-sans-medium text-xs ${stratum.badgeClass}`}>
              {stratum.label}
            </Text>
          </View>

          <Text className="text-center font-mono text-xs text-ink-subtle">
            {Platform.OS} · {deviceLabel()}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
