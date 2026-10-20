import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { isDemo } from '@/data/mode';
import { useAppStore } from '@/state/appStore';

/**
 * Modo real: recarrega os dados do papel sempre que a tela de lista ganha foco.
 * Isso também renova as URLs assinadas das miniaturas, que valem só 5 min.
 */
export function useRefreshOnFocus() {
  useFocusEffect(
    useCallback(() => {
      if (!isDemo) void useAppStore.getState().refresh();
    }, []),
  );
}
