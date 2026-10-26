import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { colors } from '@/theme/colors';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <View className={`rounded-xs border border-line bg-white p-5 shadow-xs ${className}`}>{children}</View>;
}

/** Cabeçalho de página: título, selo, descrição e ações (padrão das telas do protótipo). */
export function PageHeader({ title, badge, badgeTone = 'primary', description, actions }: {
  title: string;
  badge?: string;
  badgeTone?: 'primary' | 'success';
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Card className="flex-col items-start justify-between gap-4 md:flex-row md:items-center">
      <View className="shrink gap-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="font-sans-bold text-xl text-primary">{title}</Text>
          {badge ? <Badge label={badge} tone={badgeTone === 'success' ? 'success' : 'primary'} /> : null}
        </View>
        {typeof description === 'string' ? <Text className="font-sans text-xs leading-5 text-ink-muted">{description}</Text> : description}
      </View>
      {actions ? <View className="flex-row flex-wrap items-center gap-2">{actions}</View> : null}
    </Card>
  );
}

const tones = {
  primary: 'bg-surface-alt border-line text-primary',
  success: 'bg-emerald-50 border-emerald-300 text-emerald-800',
  warning: 'bg-amber-100 border-amber-300 text-amber-900',
  danger: 'bg-rose-50 border-rose-300 text-rose-800',
  neutral: 'bg-slate-100 border-slate-300 text-slate-700',
  dab: 'bg-warn-soft border-amber-200 text-warn',
  hema: 'bg-hema-soft border-sky-200 text-sky-700',
};
export type BadgeTone = keyof typeof tones;

export function Badge({ label, tone = 'primary', icon: Icon, className = '' }: { label: string; tone?: BadgeTone; icon?: LucideIcon; className?: string }) {
  const [bg, border, fg] = tones[tone].split(' ');
  return (
    <View className={`flex-row items-center gap-1 self-start rounded-xs border px-2 py-0.5 ${bg} ${border} ${className}`}>
      {Icon ? <Icon size={12} color={iconTone[tone]} /> : null}
      <Text className={`font-mono-bold text-[10px] ${fg}`}>{label}</Text>
    </View>
  );
}

const iconTone: Record<BadgeTone, string> = {
  primary: colors.primary,
  success: '#047857',
  warning: '#b45309',
  danger: '#be123c',
  neutral: '#475569',
  dab: colors.dab,
  hema: colors.hema,
};

/** Bloco "chave: valor" em fonte mono, usado nos resumos. */
export function KeyValue({ label, value, valueClassName = 'text-ink' }: { label: string; value: ReactNode; valueClassName?: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="font-mono text-xs text-ink-subtle">{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? <Text className={`font-mono-bold text-xs ${valueClassName}`}>{value}</Text> : value}
    </View>
  );
}

export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <Card className="items-center gap-2 py-12">
      <View className="mb-1 h-14 w-14 items-center justify-center rounded-full bg-surface-alt">
        <Icon size={28} color={colors.primary} />
      </View>
      <Text className="text-center font-sans-bold text-base text-ink">{title}</Text>
      <Text className="max-w-md text-center font-sans text-xs leading-5 text-ink-subtle">{description}</Text>
    </Card>
  );
}

/** Aviso com barra lateral (erro, alerta ou informação). */
export function Callout({ tone, icon: Icon, title, children }: { tone: 'danger' | 'warning' | 'info' | 'success'; icon?: LucideIcon; title?: string; children: ReactNode }) {
  const style = {
    danger: { box: 'bg-danger-soft border-l-4 border-danger', title: 'text-danger-dark', text: 'text-danger-dark', icon: colors.danger },
    warning: { box: 'bg-amber-50 border-l-4 border-amber-600', title: 'text-amber-950', text: 'text-amber-900', icon: '#b45309' },
    info: { box: 'bg-surface-alt border border-line', title: 'text-primary', text: 'text-ink-muted', icon: colors.primary },
    success: { box: 'bg-emerald-50 border border-emerald-300', title: 'text-emerald-800', text: 'text-emerald-700', icon: '#047857' },
  }[tone];
  return (
    <View className={`flex-row items-start gap-2.5 rounded-xs p-3 ${style.box}`}>
      {Icon ? <Icon size={18} color={style.icon} /> : null}
      <View className="flex-1 gap-0.5">
        {title ? <Text className={`font-sans-semibold text-xs ${style.title}`}>{title}</Text> : null}
        {typeof children === 'string' ? <Text className={`font-sans text-[11px] leading-4 ${style.text}`}>{children}</Text> : children}
      </View>
    </View>
  );
}
