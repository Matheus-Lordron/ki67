import { router } from 'expo-router';
import { CheckCircle2, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AuthCard, AuthShell, BackLink, BrandMark } from '@/components/layout/AuthShell';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Field';
import { isDemo } from '@/data/mode';
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
      headerLeft={<BackLink label="Voltar" onPress={() => router.replace('/login')} />}
      headerRight={<BrandMark showName={false} />}
      footer={<Text className="text-center font-sans text-xs text-ink-subtle">O link vale por 30 minutos e só pode ser usado uma vez.</Text>}
    >
      <AuthCard title="Redefinir senha" subtitle="Informe o e-mail da sua conta. Enviaremos um link para criar uma senha nova.">
        {sent ? (
          <Callout tone="success" icon={CheckCircle2} title="Verifique seu e-mail">
            <View className="gap-3">
              {/* Mesma resposta para e-mail cadastrado ou não (RF-03) */}
              <Text className="font-sans text-xs leading-5 text-[#2f6b3a]">
                Se houver uma conta com {email}, o link chega em instantes.
              </Text>
              {isDemo ? <Button label="Abrir o link (demonstração)" variant="outline" size="sm" onPress={() => router.push('/redefinir-senha')} /> : null}
            </View>
          </Callout>
        ) : (
          <>
            <TextField
              label="E-mail"
              icon={Mail}
              value={email}
              onChangeText={setEmail}
              placeholder="nome@instituicao.org.br"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              onSubmitEditing={submit}
            />
            <Button label="Enviar link" onPress={submit} loading={loading} disabled={!email.trim()} />
          </>
        )}
        <View className="border-t border-line pt-3">
          <Pressable onPress={() => router.replace('/login')} accessibilityRole="link" className="min-h-11 justify-center">
            <Text className="font-sans text-[13px] text-ink-muted underline">Voltar para o login</Text>
          </Pressable>
        </View>
      </AuthCard>
    </AuthShell>
  );
}
