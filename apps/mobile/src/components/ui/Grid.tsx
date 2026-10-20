import { Children, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';

/** Grade responsiva (substitui grid-cols-* do Tailwind, que não existe no React Native). */
export function Grid({ children, cols = { base: 1, md: 2, lg: 3 }, gap = 16 }: {
  children: ReactNode;
  cols?: { base: number; sm?: number; md?: number; lg?: number };
  gap?: number;
}) {
  const { width } = useWindowDimensions();
  const n = width >= 1024 ? (cols.lg ?? cols.md ?? cols.sm ?? cols.base) : width >= 768 ? (cols.md ?? cols.sm ?? cols.base) : width >= 640 ? (cols.sm ?? cols.base) : cols.base;
  return (
    <View style={{ marginHorizontal: -gap / 2, marginVertical: -gap / 2 }} className="flex-row flex-wrap">
      {Children.toArray(children).map((child, i) => (
        <View key={i} style={{ width: `${100 / n}%`, padding: gap / 2 }}>
          {child}
        </View>
      ))}
    </View>
  );
}
