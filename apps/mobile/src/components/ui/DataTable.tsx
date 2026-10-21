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
  // A última coluna cresce para a tabela ocupar a largura disponível.
  const cellStyle = (c: Column<T>, i: number) => ({ width: c.width, flexGrow: i === columns.length - 1 ? 1 : 0 });
  return (
    <View className="overflow-hidden rounded-xs border border-line bg-white">
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ minWidth: totalWidth }} className="w-full">
          <View className="flex-row border-b border-line bg-surface">
            {columns.map((c, i) => (
              <View key={c.key} style={cellStyle(c, i)} className={`px-3 py-2.5 ${c.align === 'center' ? 'items-center' : ''}`}>
                <Text className="font-sans-medium text-xs text-ink-muted">{c.title}</Text>
              </View>
            ))}
          </View>
          {rows.length === 0 ? (
            <View className="items-center py-8">
              <Text className="font-sans text-[13px] text-ink-subtle">{empty}</Text>
            </View>
          ) : (
            rows.map((row) => (
              <View key={keyOf(row)} className="flex-row border-b border-surface-alt web:hover:bg-surface">
                {columns.map((c, i) => (
                  <View key={c.key} style={cellStyle(c, i)} className={`justify-center px-3 py-3 ${c.align === 'center' ? 'items-center' : ''}`}>
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
export function Cell({ children, className = 'font-sans text-[13px] text-ink', lines = 2 }: { children: ReactNode; className?: string; lines?: number }) {
  return (
    <Text numberOfLines={lines} className={className}>
      {children}
    </Text>
  );
}
