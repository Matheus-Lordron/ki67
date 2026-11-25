import { router } from 'expo-router';
import { AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AuthCard, AuthShell, BackLink } from '@/components/layout/AuthShell';
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
    <AuthShell headerRight={<BackLink label="Voltar ao login" onPress={() => router.replace('/login')} />}>
      <AuthCard title="Nova senha" subtitle="Crie uma senha forte para acessar o Segmenta Studio.">
        {error ? (
          <Callout tone="danger" icon={AlertCircle}>
            {error}
          </Callout>
        ) : null}
        {done ? (
          <Callout tone="success" icon={CheckCircle2} title="Senha atualizada com sucesso">
            <View className="gap-3">
              <Text className="font-sans text-[13px] text-emerald-800">Entre novamente com a nova senha.</Text>
              <Button label="Ir para o login" size="sm" onPress={() => router.replace('/login')} />
            </View>
          </Callout>
        ) : (
          <>
            <TextField
              label="Nova senha"
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 8 caracteres"
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <TextField
              label="Confirmar nova senha"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repita a nova senha"
              secureTextEntry
              autoComplete="new-password"
              onSubmitEditing={submit}
            />
            <View className="gap-1 rounded-[10px] bg-surface-subtle p-3.5">
              <Text className="font-sans-semibold text-[12px] text-ink">Requisitos da senha</Text>
              <Text className="font-sans text-[12px] text-ink-muted">• Mínimo de 8 caracteres</Text>
              <Text className="font-sans text-[12px] text-ink-muted">• Ao menos uma letra maiúscula e um número</Text>
            </View>
            <Button label="Salvar nova senha" size="lg" className="w-full" onPress={submit} />
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}
