import { router } from 'expo-router';
import { AlertCircle, CheckCircle2, KeyRound } from 'lucide-react-native';
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
    <AuthShell
      maxWidth={420}
      headerLeft={<BackLink label="Cancelar e Retornar" onPress={() => router.replace('/login')} />}
      headerRight={<Text className="hidden font-mono text-xs text-ink-subtle sm:flex">NOVA SENHA DE ACESSO</Text>}
      footer={<Text className="text-center font-sans text-xs text-ink-subtle">Segmenta Studio · Ao redefinir, todas as sessões abertas são encerradas</Text>}
    >
      <AuthCard icon={KeyRound} title="Definir Nova Senha" subtitle="Crie uma senha forte de acordo com os requisitos institucionais de segurança.">
        {error ? (
          <Callout tone="danger" icon={AlertCircle}>
            {error}
          </Callout>
        ) : null}
        {done ? (
          <Callout tone="success" icon={CheckCircle2} title="Senha atualizada com sucesso!">
            <View className="gap-3">
              <Text className="font-sans text-[11px] text-emerald-700">Entre novamente com a nova senha.</Text>
              <Button label="Ir para a Tela de Login" size="sm" onPress={() => router.replace('/login')} />
            </View>
          </Callout>
        ) : (
          <>
            <TextField label="Nova senha de acesso" value={password} onChangeText={setPassword} placeholder="Mínimo 8 caracteres" secureTextEntry autoComplete="new-password" textContentType="newPassword" />
            <TextField label="Confirmação da nova senha" value={confirm} onChangeText={setConfirm} placeholder="Repita a nova senha" secureTextEntry autoComplete="new-password" onSubmitEditing={submit} />
            <View className="gap-1 rounded-xs bg-surface-alt p-2.5">
              <Text className="font-sans-semibold text-[11px] text-primary">Requisitos da senha:</Text>
              <Text className="font-sans text-[11px] text-ink-muted">• Mínimo de 8 caracteres</Text>
              <Text className="font-sans text-[11px] text-ink-muted">• Ao menos uma letra maiúscula e um número</Text>
            </View>
            <Button label="Salvar Nova Senha & Concluir" onPress={submit} />
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}
