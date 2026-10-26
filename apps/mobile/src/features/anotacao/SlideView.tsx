import { Image } from 'expo-image';
import { useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';

import { type Frame, imageRect, type Viewport } from '@/features/anotacao/geometry';
import { MarksLayer } from '@/features/anotacao/MarksLayer';
import type { AnnotationMark } from '@/types';

export interface SlideLayer {
  marks: AnnotationMark[];
  tint?: string;
}

/**
 * Lâmina somente leitura (análise finalizada, comparação, miniaturas):
 * imagem encaixada inteira + uma ou mais camadas de marcações.
 */
export function SlideView({ uri, imageWidth, imageHeight, layers, zoom = 1, heat, showGrid, className = '', pointRadius }: {
  uri: string;
  imageWidth: number;
  imageHeight: number;
  layers: SlideLayer[];
  zoom?: number;
  heat?: { x: number; y: number }[];
  showGrid?: boolean;
  className?: string;
  pointRadius?: number;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const frame: Frame = { viewW: size.w, viewH: size.h, imageW: imageWidth, imageH: imageHeight };
  const viewport: Viewport = { zoom, panX: 0, panY: 0 };
  const rect = imageRect(frame, viewport);
  return (
    <View
      className={`overflow-hidden bg-slate-900 ${className}`}
      onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size.w > 0 ? (
        <>
          <Image
            source={{ uri }}
            contentFit="fill"
            cachePolicy="none" // RNF-06: imagem de paciente não fica em cache no aparelho
            style={{ position: 'absolute', left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
            accessibilityIgnoresInvertColors
          />
          {layers.map((layer, i) => (
            <MarksLayer key={i} frame={frame} viewport={viewport} marks={layer.marks} tint={layer.tint} heat={i === 0 ? heat : undefined} showGrid={showGrid && i === 0} darkBackground pointRadius={pointRadius} />
          ))}
        </>
      ) : null}
    </View>
  );
}
