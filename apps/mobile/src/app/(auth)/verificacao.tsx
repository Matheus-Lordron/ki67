import { Redirect, router } from 'expo-router';
import { AlertCircle, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react-native';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { AuthCard, AuthShell, BackLink } from '@/components/layout/AuthShell';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Card';
import { isDemo } from '@/data/mode';
import { roleHome, useAppStore } from '@/state/appStore';
import { colors } from '@/theme/colors';

const CODE_TTL = 600; // 10 min (RF-02)

const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function TwoFactorScreen() {
  const pendingUserId = useAppStore((s) => s.pendingUserId);
  const verify2FA = useAppStore((s) => s.verify2FA);
  const resend2FA = useAppStore((s) => s.resend2FA);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(CODE_TTL);
  const [loading, setLoading] = useState(false);
  const inputs = useRef<(ComponentRef<typeof TextInput> | null)[]>([]);
  const expired = timeLeft <= 0;

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!pendingUserId) return <Redirect href="/login" />;

  const setDigit = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    const next = [...digits];
    if (clean.length > 1) {
      // colar o código inteiro
      clean.slice(0, 6 - index).split('').forEach((c, i) => (next[index + i] = c));
      setDigits(next);
      inputs.current[Math.min(5, index + clean.length)]?.focus();
      return;
    }
    next[index] = clean;
    setDigits(next);
    if (clean && index < 5) inputs.current[index + 1]?.focus();
  };

  const submit = async () => {
    setError(null);
    if (expired) {
      setError('O código expirou. Toque em "Reenviar código" para receber um novo.');
      return;
    }
    const code = digits.join('');
    if (code.length < 6) {
      setError('Digite os 6 dígitos do código de verificação enviado ao seu e-mail.');
      return;
    }
    setLoading(true);
    const result = await verify2FA(code);
    setLoading(false);
    if (result.ok) router.replace(roleHome(result.role));
    else setError(result.error);
  };

  const resend = async () => {
    await resend2FA();
    setTimeLeft(CODE_TTL);
    setDigits(Array(6).fill(''));
    setError(null);
    inputs.current[0]?.focus();
  };

  return (
    <AuthShell
      maxWidth={420}
      headerLeft={<BackLink label="Retornar ao Login" onPress={() => router.replace('/login')} />}
      headerRight={<Text className="hidden font-mono text-xs text-ink-subtle sm:flex">FATOR DUPLO DE AUTENTICAÇÃO (2FA)</Text>}
      footer={<Text className="text-center font-sans text-xs text-ink-subtle">Segmenta Studio · Protocolo de anonimização duplo-cego</Text>}
    >
      <AuthCard icon={KeyRound} title="Autenticação em Duas Etapas" subtitle="Um código de 6 dígitos foi enviado para o seu e-mail institucional cadastrado.">
        <View className="flex-row items-center justify-between rounded-xs border border-line bg-surface-alt px-3 py-2">
          <Text className="font-mono text-xs text-ink-muted">Validade do código:</Text>
          <Text className={`font-mono-bold text-xs ${expired ? 'text-danger' : timeLeft < 60 ? 'text-amber-700' : 'text-primary'}`}>
            {expired ? 'EXPIRADO' : `${formatTime(timeLeft)} min`}
          </Text>
        </View>

        {error ? (
          <Callout tone="danger" icon={AlertCircle}>
            {error}
          </Callout>
        ) : null}

        <View className="flex-row justify-between gap-2" accessibilityLabel="Código de verificação de 6 dígitos">
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={d}
              onChangeText={(v) => setDigit(i, v)}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
              }}
              keyboardType="number-pad"
              textContentType={i === 0 ? 'oneTimeCode' : 'none'}
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={i === 0 ? 6 : 1}
              autoFocus={i === 0}
              accessibilityLabel={`Dígito ${i + 1}`}
              selectTextOnFocus
              onSubmitEditing={submit}
              className="h-14 w-11 min-w-0 rounded-xs border-2 border-line bg-surface text-center font-mono-bold text-xl text-ink focus:border-primary web:outline-none"
            />
          ))}
        </View>
        {isDemo ? <Text className="text-center font-mono text-[10px] text-ink-subtle">Modo demonstração: qualquer código de 6 dígitos é aceito.</Text> : null}

        <Button label="Confirmar Código & Acessar" icon={ShieldCheck} size="lg" onPress={submit} loading={loading} />

        <View className="flex-row items-center justify-between border-t border-surface-alt pt-4">
          <Text className="font-sans text-xs text-ink-subtle">Não recebeu o e-mail?</Text>
          <Pressable onPress={resend} className="min-h-11 flex-row items-center gap-1" accessibilityRole="button">
            <RefreshCw size={14} color={colors.primary} />
            <Text className="font-sans-semibold text-xs text-primary">Reenviar código</Text>
          </Pressable>
        </View>
      </AuthCard>
    </AuthShell>
  );
}
