import { router } from 'expo-router';
import { AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AuthCard, AuthShell, BackLink, BrandMark } from '@/components/layout/AuthShell';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Field';
import { useAppStore } from '@/state/appStore';

export default function ResetPasswordScreen() {
  const resetPassword = useAppStore((s) => s.resetPassword);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    if (password !== confirm) {
      setError('As senhas informadas não coincidem.');
      return;
    }
    const result = await resetPassword(password);
    if (result.ok) setDone(true);
    else setError(result.error);
  };

  return (
    <AuthShell
      maxWidth={420}
      headerLeft={<BackLink label="Cancelar" onPress={() => router.replace('/login')} />}
      headerRight={<BrandMark showName={false} />}
      footer={<Text className="text-center font-sans text-xs text-ink-subtle">Ao trocar a senha, todas as sessões abertas são encerradas.</Text>}
    >
      <AuthCard title="Nova senha" subtitle="Escolha a senha que você vai usar para entrar.">
        {error ? (
          <Callout tone="danger" icon={AlertCircle}>
            {error}
          </Callout>
        ) : null}
        {done ? (
          <Callout tone="success" icon={CheckCircle2} title="Senha alterada">
            <View className="gap-3">
              <Text className="font-sans text-xs text-[#2f6b3a]">Entre de novo com a senha nova.</Text>
              <Button label="Ir para o login" size="sm" onPress={() => router.replace('/login')} />
            </View>
          </Callout>
        ) : (
          <>
            <TextField label="Nova senha" value={password} onChangeText={setPassword} placeholder="Mínimo 8 caracteres" secureTextEntry autoComplete="new-password" textContentType="newPassword" />
            <TextField label="Repita a senha" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" onSubmitEditing={submit} />
            <View className="gap-1 rounded-xs bg-surface-alt p-2.5">
              <Text className="font-sans-medium text-xs text-ink">A senha precisa ter:</Text>
              <Text className="font-sans text-xs text-ink-muted">• pelo menos 8 caracteres;</Text>
              <Text className="font-sans text-xs text-ink-muted">• uma letra maiúscula e um número.</Text>
            </View>
            <Button label="Salvar senha" onPress={submit} />
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}
