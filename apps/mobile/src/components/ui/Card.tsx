import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { colors } from '@/theme/colors';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <View className={`rounded-[16px] border border-line-card bg-white p-6 sm:p-7 ${className}`}>{children}</View>;
}

/** Cabeçalho de página no padrão editorial do Figma: título grande, selo opcional, subtítulo e ações. */
export function PageHeader({
  title,
  badge,
  badgeTone = 'primary',
  description,
  actions,
}: {
  title: string;
  badge?: string;
  badgeTone?: 'primary' | 'success';
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <View className="w-full flex-col items-start justify-between gap-5 md:flex-row md:items-end">
      <View className="shrink gap-2">
        <View className="flex-row flex-wrap items-center gap-3">
          <Text accessibilityRole="header" className="font-sans-black text-[34px] leading-[40px] tracking-[-1.2px] text-ink sm:text-[40px] sm:leading-[44px]">
            {title}
          </Text>
          {badge ? <Badge label={badge} tone={badgeTone === 'success' ? 'success' : 'primary'} /> : null}
        </View>
        {typeof description === 'string' ? (
          <Text className="font-sans text-[15px] leading-[22.5px] text-ink-muted">{description}</Text>
        ) : (
          description
        )}
      </View>
      {actions ? <View className="flex-row flex-wrap items-end gap-3">{actions}</View> : null}
    </View>
  );
}

const tones = {
  primary: 'bg-surface-alt border-transparent text-primary',
  success: 'bg-surface-alt border-transparent text-primary',
  warning: 'bg-white border-line-input text-ink',
  danger: 'bg-danger-soft border-red-200 text-danger',
  neutral: 'bg-surface-subtle border-line text-ink-muted',
  dab: 'bg-warn-soft border-amber-200 text-warn',
  hema: 'bg-hema-soft border-sky-200 text-sky-700',
};
export type BadgeTone = keyof typeof tones;

export function Badge({
  label,
  tone = 'primary',
  icon: Icon,
  dot,
  className = '',
}: {
  label: string;
  tone?: BadgeTone;
  icon?: LucideIcon;
  dot?: 'solid' | 'hollow';
  className?: string;
}) {
  const [bg, border, fg] = tones[tone].split(' ');
  return (
    <View className={`flex-row items-center gap-1.5 self-start rounded-full border px-3 py-1.5 ${bg} ${border} ${className}`}>
      {dot === 'solid' ? (
        <View className="h-2 w-2 rounded-full bg-primary" />
      ) : dot === 'hollow' ? (
        <View className="h-2 w-2 rounded-full border border-primary" />
      ) : Icon ? (
        <Icon size={12} color={iconTone[tone]} />
      ) : null}
      <Text className={`font-sans-bold text-[12px] ${fg}`}>{label}</Text>
    </View>
  );
}

const iconTone: Record<BadgeTone, string> = {
  primary: colors.primary,
  success: colors.primary,
  warning: colors.primary,
  danger: colors.danger,
  neutral: colors.inkMuted,
  dab: colors.dab,
  hema: colors.hema,
};

/** Indicador de status com ponto (usado nas tabelas e cartões do Figma). */
export function StatusDot({ label, active = true }: { label: string; active?: boolean }) {
  return (
    <View className="flex-row items-center gap-2">
      {active ? (
        <View className="h-2 w-2 rounded-full bg-primary" />
      ) : (
        <View className="h-2 w-2 rounded-full border border-ink-muted" />
      )}
      <Text className={`font-sans-semibold text-[14px] ${active ? 'text-ink' : 'text-ink-muted'}`}>{label}</Text>
    </View>
  );
}

/** Bloco "chave / valor" com divisor opcional no padrão dos cartões do Figma. */
export function KeyValue({
  label,
  value,
  valueClassName = 'text-ink',
  bordered = false,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  bordered?: boolean;
}) {
  return (
    <View className={`flex-row items-baseline justify-between gap-3 ${bordered ? 'border-b border-line-soft py-3.5' : 'py-1'}`}>
      <Text className="font-sans text-[14px] text-ink-muted">{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text className={`font-sans-black text-[16px] ${valueClassName}`}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <Card className="items-center gap-2.5 py-14">
      <View className="mb-1 h-14 w-14 items-center justify-center rounded-full bg-surface-alt">
        <Icon size={26} color={colors.primary} />
      </View>
      <Text className="text-center font-sans-bold text-[16px] text-ink">{title}</Text>
      <Text className="max-w-md text-center font-sans text-[14px] leading-5 text-ink-muted">{description}</Text>
    </Card>
  );
}

/** Aviso contextual (erro, alerta, informação ou sucesso). */
export function Callout({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: 'danger' | 'warning' | 'info' | 'success';
  icon?: LucideIcon;
  title?: string;
  children: ReactNode;
}) {
  const style = {
    danger: { box: 'bg-danger-soft border border-red-200', title: 'text-danger-dark', text: 'text-danger-dark', icon: colors.danger },
    warning: { box: 'bg-amber-50 border border-amber-200', title: 'text-amber-950', text: 'text-amber-900', icon: '#b45309' },
    info: { box: 'bg-surface-subtle border border-line', title: 'text-primary', text: 'text-ink-muted', icon: colors.primary },
    success: { box: 'bg-emerald-50 border border-emerald-200', title: 'text-emerald-900', text: 'text-emerald-800', icon: '#047857' },
  }[tone];
  return (
    <View className={`flex-row items-start gap-3 rounded-[12px] p-3.5 ${style.box}`}>
      {Icon ? <Icon size={18} color={style.icon} /> : null}
      <View className="flex-1 gap-1">
        {title ? <Text className={`font-sans-bold text-[13px] ${style.title}`}>{title}</Text> : null}
        {typeof children === 'string' ? <Text className={`font-sans text-[13px] leading-5 ${style.text}`}>{children}</Text> : children}
      </View>
    </View>
  );
}
