import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { colors } from '@/theme/colors';

/** Bloco com borda. Use para itens que a pessoa abre ou usa sozinhos (uma imagem, um lote). */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <View className={`rounded-xs border border-line bg-white p-5 ${className}`}>{children}</View>;
}

/** Cabeçalho de página: título, descrição e ações, sem moldura. */
export function PageHeader({ title, description, actions }: {
  title: string;
  /** Mantido por compatibilidade; o cabeçalho não mostra mais selos. */
  badge?: string;
  badgeTone?: 'primary' | 'success';
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <View className="flex-col items-start justify-between gap-3 border-b border-line pb-4 md:flex-row md:items-end">
      <View className="shrink gap-1">
        <Text accessibilityRole="header" className="font-sans-semibold text-xl text-ink">{title}</Text>
        {typeof description === 'string' ? <Text className="max-w-2xl font-sans text-[13px] leading-5 text-ink-muted">{description}</Text> : description}
      </View>
      {actions ? <View className="flex-row flex-wrap items-center gap-2">{actions}</View> : null}
    </View>
  );
}

/** Seção de página: título pequeno, ação opcional à direita e conteúdo sem moldura. */
export function Section({ title, action, children, className = '' }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <View className={`gap-3 ${className}`}>
      <View className="min-h-8 flex-row flex-wrap items-center justify-between gap-2">
        <Text accessibilityRole="header" className="font-sans-semibold text-sm text-ink">{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

const tones = {
  primary: 'bg-surface-alt text-ink-muted',
  success: 'bg-[#e8f1e9] text-[#2f6b3a]',
  warning: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-surface-alt text-ink-subtle',
  dab: 'bg-dab-soft text-dab',
  hema: 'bg-hema-soft text-hema',
};
export type BadgeTone = keyof typeof tones;

/** Rótulo de estado curto, em texto normal (sem caixa alta). */
export function Badge({ label, tone = 'primary', icon: Icon, className = '' }: { label: string; tone?: BadgeTone; icon?: LucideIcon; className?: string }) {
  const [bg, fg] = tones[tone].split(' ');
  return (
    <View className={`flex-row items-center gap-1 self-start rounded-xs px-1.5 py-0.5 ${bg} ${className}`}>
      {Icon ? <Icon size={12} color={iconTone[tone]} /> : null}
      <Text className={`font-sans-medium text-[11px] ${fg}`}>{label}</Text>
    </View>
  );
}

const iconTone: Record<BadgeTone, string> = {
  primary: colors.inkMuted,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  neutral: colors.inkSubtle,
  dab: colors.dab,
  hema: colors.hema,
};

/** Linha "rótulo — valor"; o valor usa números tabulares (mono). */
export function KeyValue({ label, value, valueClassName = 'text-ink' }: { label: string; value: ReactNode; valueClassName?: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="font-sans text-[13px] text-ink-muted">{label.replace(/:$/, '')}</Text>
      {typeof value === 'string' || typeof value === 'number' ? <Text className={`font-mono text-[13px] ${valueClassName}`}>{value}</Text> : value}
    </View>
  );
}

/** Estado vazio: diz o que falta e qual é o próximo passo. */
export function EmptyState({ title, description }: { icon?: LucideIcon; title: string; description: string }) {
  return (
    <View className="items-start gap-1 rounded-xs border border-dashed border-line px-5 py-10">
      <Text className="font-sans-semibold text-sm text-ink">{title}</Text>
      <Text className="max-w-xl font-sans text-[13px] leading-5 text-ink-muted">{description}</Text>
    </View>
  );
}

/** Aviso (erro, alerta, informação ou sucesso), em bloco com fundo suave. */
export function Callout({ tone, icon: Icon, title, children }: { tone: 'danger' | 'warning' | 'info' | 'success'; icon?: LucideIcon; title?: string; children: ReactNode }) {
  const style = {
    danger: { box: 'bg-danger-soft', fg: 'text-danger-dark', icon: colors.danger },
    warning: { box: 'bg-warn-soft', fg: 'text-warn', icon: colors.warning },
    info: { box: 'bg-surface-alt', fg: 'text-ink-muted', icon: colors.inkMuted },
    success: { box: 'bg-[#e8f1e9]', fg: 'text-[#2f6b3a]', icon: colors.success },
  }[tone];
  return (
    <View className={`flex-row items-start gap-2.5 rounded-xs p-3 ${style.box}`}>
      {Icon ? <Icon size={16} color={style.icon} /> : null}
      <View className="flex-1 gap-0.5">
        {title ? <Text className={`font-sans-semibold text-[13px] ${style.fg}`}>{title}</Text> : null}
        {typeof children === 'string' ? <Text className={`font-sans text-xs leading-5 ${style.fg}`}>{children}</Text> : children}
      </View>
    </View>
  );
}
