import { createClient, type PostgrestError } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env, isSupabaseConfigured } from '@/config/env';
import { authStorage } from '@/storage/authStorage';
import type { RpcName } from '@/types/database';

// Cliente único do Supabase. A chave publicável só dá acesso ao que as
// políticas RLS de supabase/schema.sql liberam para o usuário logado.
export const supabase = createClient(
  // Valores fictícios só para o app abrir e mostrar como configurar o .env.
  isSupabaseConfigured ? env.supabaseUrl : 'http://localhost:54321',
  isSupabaseConfigured ? env.supabaseKey : 'chave-nao-configurada-chave-nao-configurada',
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web', // link de redefinição de senha (RF-03)
    },
  },
);

// No celular, só renova o token com o app em primeiro plano (recomendação do Supabase).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export class ApiError extends Error {
  constructor(
    message: string,
    /** SQLSTATE do Postgres ou código da RPC, ex.: '42501', 'PT409', 'NOT_FOUND'. */
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function toApiError(error: PostgrestError): ApiError {
  return new ApiError(error.message, error.code, error.details);
}

/** Erro de rede (sem conexão): o app guarda o rascunho e tenta de novo depois. */
export const isNetworkError = (e: unknown) =>
  e instanceof TypeError || (e instanceof Error && /network|fetch|Failed to fetch|Network request failed/i.test(e.message));

/**
 * Chama uma Edge Function e devolve o JSON. Em erro HTTP, usa a mensagem
 * { error } enviada pela função (ex.: "E-mail ou senha inválidos").
 */
export async function invokeFunction<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) {
    const response = (error as { context?: Response }).context;
    let message = error.message;
    let status = 'EDGE_FUNCTION';
    if (response && typeof response.json === 'function') {
      status = String(response.status);
      try {
        message = ((await response.json()) as { error?: string }).error ?? message;
      } catch {
        // corpo não era JSON
      }
    }
    throw new ApiError(message, status);
  }
  return data as T;
}

/**
 * Chama uma função RPC do banco. Lança ApiError em erro de banco; as respostas
 * do tipo { ok: false, error } (acesso negado, conflito de versão) voltam como
 * dado, para a tela decidir o que mostrar.
 */
export async function rpc<T>(name: RpcName, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw toApiError(error);
  return data as T;
}
