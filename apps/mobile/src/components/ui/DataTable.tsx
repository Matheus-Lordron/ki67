import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

export interface Column<T> {
  key: string;
  title: string;
  width: number;
  render: (row: T) => ReactNode;
  align?: 'left' | 'center';
}

/**
 * Tabela com rolagem horizontal (substitui <table>). As colunas têm largura fixa
 * para alinhar cabeçalho e linhas em qualquer tela.
 */
export function DataTable<T>({ columns, rows, keyOf, empty = 'Nenhum registro encontrado.' }: {
  columns: Column<T>[];
  rows: T[];
  keyOf: (row: T) => string;
  empty?: string;
}) {
  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0);
  return (
    <View className="overflow-hidden rounded-xs border border-line bg-white shadow-xs">
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={{ minWidth: totalWidth }} className="w-full">
          <View className="flex-row border-b border-line bg-surface">
            {columns.map((c) => (
              <View key={c.key} style={{ width: c.width }} className={`px-3 py-2.5 ${c.align === 'center' ? 'items-center' : ''}`}>
                <Text className="font-mono text-[11px] text-ink-subtle">{c.title}</Text>
              </View>
            ))}
          </View>
          {rows.length === 0 ? (
            <View className="items-center py-8">
              <Text className="font-mono text-xs text-slate-500">{empty}</Text>
            </View>
          ) : (
            rows.map((row) => (
              <View key={keyOf(row)} className="flex-row border-b border-surface-alt web:hover:bg-surface">
                {columns.map((c) => (
                  <View key={c.key} style={{ width: c.width }} className={`justify-center px-3 py-3 ${c.align === 'center' ? 'items-center' : ''}`}>
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
export function Cell({ children, className = 'font-sans text-xs text-ink', lines = 2 }: { children: ReactNode; className?: string; lines?: number }) {
  return (
    <Text numberOfLines={lines} className={className}>
      {children}
    </Text>
  );
}
