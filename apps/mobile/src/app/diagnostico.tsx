// Tela provisória da Fase 2: confirma que o app roda (web/Android/iOS), que o
// NativeWind e as fontes funcionam e que o Supabase está alcançável.
// Na Fase 3 ela dá lugar ao login.
import { useQuery } from '@tanstack/react-query';
import { Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isSupabaseConfigured } from '@/config/env';
import { deviceLabel } from '@/services/device';
import { supabase } from '@/services/supabase';
import { BrandMark } from '@/components/layout/AuthShell';

type Check = { status: 'ok' | 'warn' | 'error'; message: string };

async function checkSupabase(): Promise<Check> {
  if (!isSupabaseConfigured) {
    return { status: 'warn', message: 'Preencha apps/mobile/.env (veja .env.example) e reinicie o Expo.' };
  }
  // Sem login, o banco deve RECUSAR a chamada (anon não executa RPCs): isso
  // prova que o servidor responde e que o schema.sql foi aplicado.
  const { error } = await supabase.rpc('my_session');
  if (!error) return { status: 'ok', message: 'Conectado ao Supabase.' };
  if (error.code === '42501') return { status: 'ok', message: 'Conectado. Schema aplicado e acesso anônimo bloqueado, como esperado.' };
  if (error.code === 'PGRST202') return { status: 'error', message: 'Conectado, mas o schema.sql ainda não foi rodado no SQL Editor.' };
  return { status: 'error', message: `Sem conexão: ${error.message}` };
}

const badge: Record<Check['status'], string> = {
  ok: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  warn: 'bg-warn-soft border-amber-200 text-warn',
  error: 'bg-danger-soft border-red-200 text-danger-dark',
};

export default function SetupCheckScreen() {
  const supabaseCheck = useQuery({ queryKey: ['setup-check'], queryFn: checkSupabase });

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="items-center px-4 py-8">
        <View className="w-full max-w-xl gap-4">
          <View className="gap-1 border-b border-line pb-4">
            <BrandMark />
            <Text className="font-sans text-[13px] text-ink-muted">Diagnóstico da configuração</Text>
          </View>

          <View className="gap-2 rounded-xs border border-line bg-white p-5">
            <Text className="font-sans-semibold text-base text-ink">Supabase</Text>
            {supabaseCheck.isPending ? (
              <Text className="font-sans text-sm text-ink-subtle">Verificando conexão...</Text>
            ) : (
              <Text className={`rounded-xs border px-3 py-2 font-sans-medium text-sm ${badge[supabaseCheck.data?.status ?? 'error']}`}>
                {supabaseCheck.data?.message ?? String(supabaseCheck.error)}
              </Text>
            )}
          </View>

          <Text className="text-center font-mono text-xs text-ink-subtle">
            {Platform.OS} · {deviceLabel()}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
