import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { toConsensus } from '@/data/mappers';
import { isDemo } from '@/data/mode';
import * as repo from '@/data/repo';
import { type BlindAnalysis, analyzeBlind, blindFromServer, buildComparison } from '@/features/validacao/comparison';
import { useAppStore } from '@/state/appStore';
import type { ConsensusResult, ImageItem } from '@/types';
import { calculateInterObserverMetrics } from '@/utils/ki67';

export interface QueueEntry {
  img: ImageItem;
  blindCodes: string[];
  finalized: number;
  metrics: ReturnType<typeof calculateInterObserverMetrics>;
}

/**
 * Fila do validador (RF-30). Demo: calcula a partir das análises em memória.
 * Real: a RPC validation_queue já filtra RN-05/RN-08 e traz só os índices finais.
 */
export function useValidationQueue(): QueueEntry[] {
  const user = useAppStore((s) => s.currentUser);
  const images = useAppStore((s) => s.images);
  const analyses = useAppStore((s) => s.analyses);
  const indices = useAppStore((s) => s.validationIndices);

  return useMemo(() => {
    if (!isDemo) {
      return images.map((img) => {
        const list = indices[img.id] ?? [];
        return {
          img,
          blindCodes: list.map((_, i) => String.fromCharCode(65 + i)),
          finalized: list.length,
          metrics: calculateInterObserverMetrics(list),
        };
      });
    }
    return images
      .filter((img) => !img.assignedEvaluatorIds.includes(user?.id ?? ''))
      .map((img) => ({ img, cmp: buildComparison(img, analyses) }))
      .filter(({ img, cmp }) => img.status === 'validada' || (img.requiredEvaluatorsCount >= 2 && cmp.ready))
      .map(({ img, cmp }) => ({ img, blindCodes: cmp.blind.map((b) => b.code), finalized: cmp.blind.length, metrics: cmp.metrics }));
  }, [images, analyses, indices, user]);
}

export interface ComparisonData {
  image: ImageItem;
  imageVersionId?: string;
  blind: BlindAnalysis[];
  metrics: ReturnType<typeof calculateInterObserverMetrics>;
  spatialAgreementPct: number;
  heat: { x: number; y: number }[];
  result: ConsensusResult | null;
  ready: boolean;
}

/** Comparação cega de uma imagem. Real: RPC get_comparison (grava COMPARACAO_ABERTA no log). */
export function useComparison(imageId: string | undefined) {
  const image = useAppStore((s) => s.images.find((i) => i.id === imageId));
  const analyses = useAppStore((s) => s.analyses);
  const users = useAppStore((s) => s.users);

  const query = useQuery({
    queryKey: ['comparison', imageId],
    queryFn: () => repo.loadComparison(imageId as string),
    enabled: !isDemo && !!imageId,
    staleTime: 0,
    gcTime: 0,
  });

  return useMemo((): { data: ComparisonData | null; loading: boolean; denied: boolean } => {
    if (isDemo) {
      if (!image) return { data: null, loading: false, denied: true };
      const cmp = buildComparison(image, analyses);
      return { data: { image, ...cmp, result: image.consensusResult ?? null }, loading: false, denied: false };
    }
    if (query.isPending) return { data: null, loading: true, denied: false };
    const res = query.data;
    if (!res || !res.ok) return { data: null, loading: false, denied: true };
    const blind = blindFromServer(res);
    const serverImage: ImageItem = image
      ? { ...image, width: res.image.width, height: res.image.height }
      : {
          id: res.image.id,
          code: res.image.code,
          batchId: '',
          batchName: res.image.batch_name,
          imageUrl: '',
          opticalMagnification: res.image.optical_magnification ?? '—',
          organ: res.image.organ ?? 'Não informado',
          uploadedAt: '',
          width: res.image.width,
          height: res.image.height,
          assignedEvaluatorIds: [],
          requiredEvaluatorsCount: res.image.n,
          status: res.image.status === 'validada' ? 'validada' : 'pronta_para_validacao',
        };
    return {
      data: {
        image: serverImage,
        imageVersionId: res.image.image_version_id,
        blind,
        ...analyzeBlind(blind),
        result: res.result ? toConsensus(res.result, users) : null,
        ready: true,
      },
      loading: false,
      denied: false,
    };
  }, [image, analyses, users, query.isPending, query.data]);
}
