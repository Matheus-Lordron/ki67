import { router } from 'expo-router';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react-native';
import { type ComponentRef, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { AuthCard, AuthShell } from '@/components/layout/AuthShell';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Field';
import { isDemo } from '@/data/mode';
import { roleHome, useAppStore } from '@/state/appStore';
import { colors } from '@/theme/colors';

// Contas do modo demonstração (Fase 3). Somem quando o Supabase for ligado (Fase 4).
const DEMO_ACCOUNTS = [
  { email: 'dr.valadares@oncocentro.org.br', label: 'Avaliador' },
  { email: 'dra.lucia@oncocentro.org.br', label: 'Validadora' },
  { email: 'dr.marcos@oncocentro.org.br', label: 'Validador + Avaliador' },
  { email: 'mariana.gestora@oncocentro.org.br', label: 'Gestora' },
  { email: 'admin@oncocentro.org.br', label: 'Admin' },
];

export default function LoginScreen() {
  const login = useAppStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const submit = async () => {
    setError(null);
    if (!email || !password) {
      setError('E-mail ou senha inválidos');
      return;
    }
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.ok) setError(result.error);
    else if (!result.twoFactorRequired && result.role) router.replace(roleHome(result.role));
    else router.push('/verificacao');
  };

  return (
    <AuthShell>
      <AuthCard title="Entrar" subtitle="Use seu e-mail institucional.">
        {error ? (
          <Callout tone="danger" icon={ShieldAlert} title="Falha na validação de acesso">
            {`${error}. Tentativas consecutivas bloqueiam o acesso por 15 minutos.`}
          </Callout>
        ) : null}

        <TextField
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          placeholder="nome@instituto.org.br"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />

        <TextField
          ref={passwordRef}
          label="Senha"
          hint={
            <Pressable onPress={() => router.push('/esqueci-senha')} accessibilityRole="link" hitSlop={8}>
              <Text className="font-sans-semibold text-[13px] text-primary">Esqueci a senha</Text>
            </Pressable>
          }
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••••"
          secureTextEntry={!showPassword}
          autoComplete="password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          right={
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              accessibilityLabel="Alternar visibilidade da senha"
              className="h-10 w-10 items-center justify-center"
            >
              {showPassword ? <EyeOff size={16} color={colors.inkSubtle} /> : <Eye size={16} color={colors.inkSubtle} />}
            </Pressable>
          }
        />

        <View className="mt-2 gap-3.5">
          <Button label="Continuar" size="lg" className="w-full" onPress={submit} loading={loading} />
          <Text className="text-center font-sans text-[13px] leading-[19.5px] text-ink-muted">
            Você receberá um código de verificação por e-mail.
          </Text>
        </View>

        {isDemo ? (
          <View className="mt-2 gap-2 border-t border-line-soft pt-4">
            <Text className="text-center font-sans-semibold text-[12px] text-ink-subtle">
              Modo demonstração · preenchimento rápido
            </Text>
            <View className="flex-row flex-wrap justify-center gap-1.5">
              {DEMO_ACCOUNTS.map((a) => (
                <Pressable
                  key={a.email}
                  onPress={() => {
                    setEmail(a.email);
                    setPassword('demonstracao');
                    setError(null);
                  }}
                  className="min-h-8 justify-center rounded-[8px] bg-surface-alt px-2.5 py-1 web:hover:bg-primary-muted/50"
                >
                  <Text className="font-sans-semibold text-[12px] text-primary">{a.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </AuthCard>
    </AuthShell>
  );
}
