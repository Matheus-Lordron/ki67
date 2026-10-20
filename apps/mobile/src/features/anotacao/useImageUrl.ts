import { useQuery } from '@tanstack/react-query';

import { isDemo } from '@/data/mode';
import { getSignedImageUrl } from '@/services/cloudflare';
import { useAppStore } from '@/state/appStore';

/**
 * URL da imagem para exibir agora. No modo real pede uma URL assinada nova
 * (válida por 5 min, RNF-06) sempre que a tela abre; no demo usa a URL do mock.
 */
export function useImageUrl(imageId: string | undefined, fallback = '', versionId?: string | null) {
  const storedVersion = useAppStore((s) => (imageId ? s.imageVersions[imageId] : undefined));
  const id = versionId ?? storedVersion;
  const query = useQuery({
    queryKey: ['image-url', id],
    queryFn: () => getSignedImageUrl(id as string, 'preview'),
    enabled: !isDemo && !!id,
    staleTime: 4 * 60_000,
    gcTime: 0,
  });
  return isDemo ? fallback : (query.data ?? fallback);
}
