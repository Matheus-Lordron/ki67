import { randomUUID } from 'expo-crypto';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * Trava de envio: enquanto uma ação está em andamento, novos cliques são ignorados.
 * Com a internet lenta, o estado do React (loading) só desabilita o botão no próximo
 * render; a trava é síncrona e fecha a janela entre um clique e outro.
 */
export function createSubmitGuard(onChange?: (pending: boolean) => void) {
  let pending = false;
  return {
    isPending: () => pending,
    async run<T>(action: () => Promise<T>): Promise<T | undefined> {
      if (pending) return undefined;
      pending = true;
      onChange?.(true);
      try {
        return await action();
      } finally {
        pending = false;
        onChange?.(false);
      }
    },
  };
}

/** Versão para telas: devolve a ação travada e `pending` para o `loading` do botão. */
export function useSubmitOnce<A extends unknown[], T>(action: (...args: A) => Promise<T>) {
  const [pending, setPending] = useState(false);
  const [guard] = useState(() => createSubmitGuard(setPending));
  const latest = useRef(action);
  useLayoutEffect(() => {
    latest.current = action;
  });
  const submit = useCallback((...args: A) => guard.run(() => latest.current(...args)), [guard]);
  return { submit, pending };
}

/** Chave de idempotência de um formulário: gere ao abrir e reenvie a mesma em toda tentativa. */
export const newRequestId = () => randomUUID();
