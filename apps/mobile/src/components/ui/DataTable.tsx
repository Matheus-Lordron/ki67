import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

export interface Column<T> {
  key: string;
  title: string;
  width: number;
  render: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
}

/**
 * Tabela limpa no padrão do Figma (sem moldura externa; cabeçalho leve e linhas
 * separadas por #eef0f4, com rolagem horizontal em telas menores).
 */
export function DataTable<T>({
  columns,
  rows,
  keyOf,
  empty = 'Nenhum registro encontrado.',
}: {
  columns: Column<T>[];
  rows: T[];
  keyOf: (row: T) => string;
  empty?: string;
}) {
  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0);
  const alignClass = (align?: Column<T>['align']) =>
    align === 'center' ? 'items-center' : align === 'right' ? 'items-end' : 'items-start';

  return (
    <View className="w-full bg-white">
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={{ minWidth: totalWidth }} className="w-full">
          <View className="flex-row border-b border-line pb-4 pt-1">
            {columns.map((c, idx) => (
              <View
                key={c.key}
                style={{ flexGrow: 1, flexBasis: c.width, minWidth: c.width }}
                className={`${idx < columns.length - 1 ? 'pr-4' : ''} ${alignClass(c.align)}`}
              >
                <Text className={`font-sans-semibold text-[12px] text-ink-muted ${c.align === 'right' ? 'text-right' : ''}`}>
                  {c.title}
                </Text>
              </View>
            ))}
          </View>
          {rows.length === 0 ? (
            <View className="items-center border-b border-line-soft py-10">
              <Text className="font-sans text-[14px] text-ink-muted">{empty}</Text>
            </View>
          ) : (
            rows.map((row) => (
              <View key={keyOf(row)} className="flex-row border-b border-line-soft web:hover:bg-surface-subtle/60">
                {columns.map((c, idx) => (
                  <View
                    key={c.key}
                    style={{ flexGrow: 1, flexBasis: c.width, minWidth: c.width }}
                    className={`justify-center py-5 ${idx < columns.length - 1 ? 'pr-4' : ''} ${alignClass(c.align)}`}
                  >
                    {c.render(row)}
                  </View>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/** Célula de texto padrão. */
export function Cell({
  children,
  className = 'font-sans text-[14px] text-ink',
  lines = 2,
}: {
  children: ReactNode;
  className?: string;
  lines?: number;
}) {
  return (
    <Text numberOfLines={lines} className={className}>
      {children}
    </Text>
  );
}

/** Barra de paginação numerada (padrão de Log e Análises no Figma). */
export function PaginationBar({
  page,
  pages,
  onPageChange,
}: {
  page: number;
  pages: number;
  onPageChange: (next: number) => void;
}) {
  const current = Math.min(Math.max(1, page), Math.max(1, pages));

  const buildItems = (): (number | 'ellipsis')[] => {
    if (pages <= 5) return Array.from({ length: pages }, (_, i) => i + 1);
    if (current <= 3) return [1, 2, 3, 'ellipsis', pages];
    if (current >= pages - 2) return [1, 'ellipsis', pages - 2, pages - 1, pages];
    return [1, 'ellipsis', current, 'ellipsis', pages];
  };

  return (
    <View className="flex-row flex-wrap items-center justify-between gap-4 pt-2">
      <Text className="font-sans-semibold text-[13px] text-ink-muted">
        Página {current} de {Math.max(1, pages)}
      </Text>
      <View className="flex-row flex-wrap items-center gap-2">
        <Pressable
          disabled={current <= 1}
          onPress={() => onPageChange(current - 1)}
          accessibilityRole="button"
          accessibilityLabel="Página anterior"
          className={`h-10 items-center justify-center rounded-[8px] border px-4 ${
            current <= 1 ? 'border-line-button bg-white opacity-60' : 'border-primary bg-white web:hover:bg-surface-alt'
          }`}
        >
          <Text className={`font-sans-semibold text-[13px] ${current <= 1 ? 'text-ink-subtle' : 'text-primary'}`}>Anterior</Text>
        </Pressable>

        {buildItems().map((item, idx) =>
          item === 'ellipsis' ? (
            <View key={`e-${idx}`} className="w-6 items-center justify-center">
              <Text className="font-sans-semibold text-[13px] text-ink-muted">…</Text>
            </View>
          ) : (
            <Pressable
              key={item}
              onPress={() => onPageChange(item)}
              accessibilityRole="button"
              accessibilityLabel={`Página ${item}`}
              accessibilityState={{ selected: item === current }}
              className={`h-10 w-10 items-center justify-center rounded-[8px] ${
                item === current ? 'bg-primary' : 'border border-line-button bg-white web:hover:bg-surface-subtle'
              }`}
            >
              <Text className={`text-[13px] ${item === current ? 'font-sans-bold text-white' : 'font-sans-semibold text-ink'}`}>
                {item}
              </Text>
            </Pressable>
          ),
        )}

        <Pressable
          disabled={current >= pages}
          onPress={() => onPageChange(current + 1)}
          accessibilityRole="button"
          accessibilityLabel="Próxima página"
          className={`h-10 items-center justify-center rounded-[8px] border px-4 ${
            current >= pages ? 'border-line-button bg-white opacity-60' : 'border-primary bg-white web:hover:bg-surface-alt'
          }`}
        >
          <Text className={`font-sans-semibold text-[13px] ${current >= pages ? 'text-ink-subtle' : 'text-primary'}`}>Próxima</Text>
        </Pressable>
      </View>
    </View>
  );
}
