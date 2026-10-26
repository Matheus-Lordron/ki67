import { router } from 'expo-router';
import { CheckCircle2, KeyRound, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AuthCard, AuthShell, BackLink } from '@/components/layout/AuthShell';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Field';
import { useAppStore } from '@/state/appStore';

export default function ForgotPasswordScreen() {
  const requestPasswordReset = useAppStore((s) => s.requestPasswordReset);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim()) return;
    setLoading(true);
    await requestPasswordReset(email);
    setLoading(false);
    setSent(true);
  };

  return (
    <AuthShell
      maxWidth={420}
      headerLeft={<BackLink label="Retornar ao Login" onPress={() => router.replace('/login')} />}
      headerRight={<Text className="hidden font-mono text-xs text-ink-subtle sm:flex">RECUPERAÇÃO DE ACESSO</Text>}
      footer={<Text className="text-center font-sans text-xs text-ink-subtle">Segmenta Studio · Segurança e rastreabilidade</Text>}
    >
      <AuthCard icon={KeyRound} title="Recuperar Senha" subtitle="Informe seu e-mail institucional para receber um link de uso único, válido por 30 minutos.">
        {sent ? (
          <Callout tone="success" icon={CheckCircle2} title="Link de recuperação enviado">
            <View className="gap-3">
              {/* Mesma resposta para e-mail cadastrado ou não (RF-03) */}
              <Text className="font-sans text-[11px] leading-4 text-emerald-700">
                Se o e-mail {email} estiver cadastrado, você receberá as instruções em instantes.
              </Text>
              <Button label="Simular clique no link recebido" size="sm" onPress={() => router.push('/redefinir-senha')} />
            </View>
          </Callout>
        ) : (
          <>
            <TextField
              label="E-mail institucional cadastrado"
              icon={Mail}
              value={email}
              onChangeText={setEmail}
              placeholder="patologista@instituto.org.br"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              onSubmitEditing={submit}
            />
            <Button label="Enviar Link de Redefinição" onPress={submit} loading={loading} disabled={!email.trim()} />
          </>
        )}
        <View className="items-center border-t border-surface-alt pt-4">
          <Pressable onPress={() => router.replace('/login')} accessibilityRole="link" className="min-h-11 justify-center">
            <Text className="font-sans-semibold text-xs text-primary">Lembrou sua senha? Voltar ao login</Text>
          </Pressable>
        </View>
      </AuthCard>
    </AuthShell>
  );
}
