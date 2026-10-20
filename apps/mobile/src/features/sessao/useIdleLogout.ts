import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useEditorStore } from '@/state/editorStore';
import { useAppStore } from '@/state/appStore';

const IDLE_MS = 30 * 60_000; // RF-05: 30 min sem atividade

/**
 * Encerra a sessão depois de 30 min sem toque, clique ou tecla (RF-05).
 * O rascunho da análise aberta é salvo no aparelho antes de sair.
 * Devolve a função que marca atividade (para o onTouchStart do layout).
 */
export function useIdleLogout() {
  const last = useRef(0);
  const touch = useCallback(() => {
    last.current = Date.now();
  }, []);

  useEffect(() => {
    touch(); // a sessão começa ativa
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const events = ['pointerdown', 'keydown', 'wheel'] as const;
      events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
      return () => events.forEach((e) => window.removeEventListener(e, touch));
    }
  }, [touch]);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (Date.now() - last.current < IDLE_MS || !useAppStore.getState().currentUser) return;
      const editor = useEditorStore.getState();
      if (editor.dirty && !editor.readOnly) await editor.save().catch(() => false);
      useAppStore.getState().addAuditLog('SESSAO_EXPIRADA', 'auth', 'Sessão encerrada por inatividade (30 min).');
      await useAppStore.getState().logout();
      useAppStore.getState().showToast('Sessão encerrada após 30 minutos sem atividade. Entre novamente.');
      router.replace('/login');
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  return touch;
}
