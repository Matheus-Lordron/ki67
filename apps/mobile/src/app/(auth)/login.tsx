import { router } from 'expo-router';
import { Eye, EyeOff, Key, Mail, ShieldAlert } from 'lucide-react-native';
import { type ComponentRef, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { AuthCard, AuthShell, BrandMark } from '@/components/layout/AuthShell';
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
  { email: 'dr.marcos@oncocentro.org.br', label: 'Validador e avaliador' },
  { email: 'mariana.gestora@oncocentro.org.br', label: 'Gestora' },
  { email: 'admin@oncocentro.org.br', label: 'Administrador' },
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
    <AuthShell
      headerLeft={<BrandMark />}
      footer={
        <Text className="text-center font-sans text-xs leading-5 text-ink-subtle md:text-left">
          Ferramenta de pesquisa. Não substitui o laudo do patologista e não é dispositivo médico.
        </Text>
      }
    >
      <AuthCard title="Entrar" subtitle="Use o e-mail cadastrado pelo administrador do estudo. Depois da senha, enviamos um código para o seu e-mail.">
        {error ? (
          <Callout tone="danger" icon={ShieldAlert}>
            {`${error}. Depois de 5 tentativas erradas, o acesso fica bloqueado por 15 minutos.`}
          </Callout>
        ) : null}

        <TextField
          label="E-mail"
          icon={Mail}
          value={email}
          onChangeText={setEmail}
          placeholder="nome@instituicao.org.br"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <View>
          <View className="mb-1.5 flex-row items-center justify-between">
            <Text className="font-sans-medium text-[13px] text-ink">Senha</Text>
            <Pressable onPress={() => router.push('/esqueci-senha')} accessibilityRole="link" hitSlop={8}>
              <Text className="font-sans text-[13px] text-ink-muted underline">Esqueci a senha</Text>
            </Pressable>
          </View>
          <TextField
            ref={passwordRef}
            icon={Key}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            right={
              <Pressable onPress={() => setShowPassword((v) => !v)} accessibilityLabel={showPassword ? 'Esconder senha' : 'Mostrar senha'} className="h-10 w-10 items-center justify-center">
                {showPassword ? <EyeOff size={16} color={colors.inkSubtle} /> : <Eye size={16} color={colors.inkSubtle} />}
              </Pressable>
            }
          />
        </View>

        <Button label="Continuar" size="lg" onPress={submit} loading={loading} />

        <Text className="font-sans text-xs leading-5 text-ink-subtle">Não há cadastro aberto: as contas são criadas pelo administrador do estudo.</Text>

        {isDemo ? (
          <View className="gap-2 border-t border-line pt-4">
            <Text className="font-sans-medium text-xs text-ink-muted">Modo demonstração: entrar como</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {DEMO_ACCOUNTS.map((a) => (
                <Pressable
                  key={a.email}
                  onPress={() => {
                    setEmail(a.email);
                    setPassword('demonstracao');
                    setError(null);
                  }}
                  className="min-h-8 justify-center rounded-xs border border-line px-2.5 web:hover:bg-surface"
                >
                  <Text className="font-sans text-xs text-ink">{a.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </AuthCard>
    </AuthShell>
  );
}
