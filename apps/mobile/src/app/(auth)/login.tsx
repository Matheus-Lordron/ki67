import { router } from 'expo-router';
import { ArrowRight, BadgeCheck, Eye, EyeOff, Key, Lock, Mail, Microscope, ShieldAlert } from 'lucide-react-native';
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
  { email: 'dr.valadares@oncocentro.org.br', label: 'dr.valadares (Avaliador)' },
  { email: 'dra.lucia@oncocentro.org.br', label: 'dra.lucia (Validadora)' },
  { email: 'dr.marcos@oncocentro.org.br', label: 'dr.marcos (Validador + Avaliador)' },
  { email: 'mariana.gestora@oncocentro.org.br', label: 'mariana (Gestora)' },
  { email: 'admin@oncocentro.org.br', label: 'admin (Admin)' },
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
      headerLeft={
        <View className="flex-row items-center gap-3">
          <BrandMark />
          <View className="hidden flex-row items-center gap-2 border-l border-line pl-3 sm:flex">
            <View className="h-2 w-2 rounded-full bg-dab" />
            <Text className="font-sans-medium text-xs text-ink-muted">MÓDULO DE QUANTIFICAÇÃO NUCLEAR KI-67 IHC</Text>
          </View>
        </View>
      }
      headerRight={
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1.5 rounded-xs border border-line bg-surface-alt px-2.5 py-1">
            <Lock size={14} color={colors.primary} />
            <Text className="font-mono-bold text-[11px] text-primary">AMBIENTE PROTEGIDO</Text>
          </View>
          <View className="hidden flex-row items-center gap-1 md:flex">
            <BadgeCheck size={16} color="#059669" />
            <Text className="font-sans text-xs text-ink-muted">LGPD</Text>
          </View>
        </View>
      }
      footer={
        <View className="flex-col items-center justify-between gap-2 md:flex-row">
          <Text className="max-w-4xl text-center font-sans text-[11px] leading-4 text-ink-subtle md:text-left">
            <Text className="font-sans-semibold text-ink">Aviso regulatório obrigatório: </Text>
            Ferramenta destinada exclusivamente a pesquisa científica. Não substitui o laudo do patologista e não é dispositivo médico.
          </Text>
          <Text className="font-mono text-[10px] text-ink-subtle">ESTUDO KI-67 · v0.1</Text>
        </View>
      }
    >
      <AuthCard icon={Microscope} title="Acesso ao Workspace Clínico" subtitle="Insira suas credenciais institucionais autorizadas">
        {error ? (
          <Callout tone="danger" icon={ShieldAlert} title="Falha na validação de acesso">
            {`${error}. Tentativas consecutivas bloqueiam o acesso por 15 minutos.`}
          </Callout>
        ) : null}

        <TextField
          label="E-mail institucional"
          hint="Domínio hospitalar"
          icon={Mail}
          value={email}
          onChangeText={setEmail}
          placeholder="patologista@instituto.org.br"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <View>
          <View className="mb-1.5 flex-row items-center justify-between">
            <Text className="font-sans-semibold text-xs text-ink">Senha de acesso</Text>
            <Pressable onPress={() => router.push('/esqueci-senha')} accessibilityRole="link" hitSlop={8}>
              <Text className="font-sans-medium text-xs text-primary">Esqueci a senha</Text>
            </Pressable>
          </View>
          <TextField
            ref={passwordRef}
            icon={Key}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••••••"
            secureTextEntry={!showPassword}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            right={
              <Pressable onPress={() => setShowPassword((v) => !v)} accessibilityLabel="Alternar visibilidade da senha" className="h-10 w-10 items-center justify-center">
                {showPassword ? <EyeOff size={16} color={colors.inkSubtle} /> : <Eye size={16} color={colors.inkSubtle} />}
              </Pressable>
            }
          />
        </View>

        <View className="flex-row items-center justify-between rounded-xs border border-line bg-surface-alt px-2.5 py-1">
          <View className="flex-row items-center gap-1.5">
            <View className="h-1.5 w-1.5 rounded-full bg-dab" />
            <Text className="font-mono text-[11px] text-ink-muted">Sessão cega anonimizada</Text>
          </View>
          <Text className="font-mono-bold text-[11px] text-primary">2FA</Text>
        </View>

        <Button label="Avançar para Verificação 2FA" iconRight={ArrowRight} size="lg" variant="secondary" onPress={submit} loading={loading} />

        {isDemo ? (
        <View className="gap-1.5 border-t border-surface-alt pt-3">
          <Text className="text-center font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
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
                className="min-h-8 justify-center rounded-xs border border-line bg-surface-alt px-2 web:hover:bg-primary-soft"
              >
                <Text className="font-mono text-[10px] text-primary">{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        ) : null}

        <View className="border-t border-line pt-4">
          <Text className="text-center font-sans text-[11px] leading-4 text-ink-muted">
            <Text className="font-sans-semibold text-ink">Cadastro restrito: </Text>
            só o administrador do estudo cria contas. Não há autocadastro público.
          </Text>
        </View>
      </AuthCard>

      <View className="mt-3 flex-row flex-wrap items-center justify-between gap-2 px-1">
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <View className="h-2.5 w-2.5 rounded-full bg-dab" />
            <Text className="font-mono text-[11px] text-ink-muted">Reagente DAB (●)</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <View className="h-2.5 w-2.5 rounded-full border border-hema bg-hema-soft" />
            <Text className="font-mono text-[11px] text-ink-muted">Hematoxilina (○)</Text>
          </View>
        </View>
      </View>
    </AuthShell>
  );
}
