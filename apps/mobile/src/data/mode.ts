import { isSupabaseConfigured } from '@/config/env';

/**
 * 'supabase': dados reais (Fase 4), ligado quando apps/mobile/.env tem a URL e a
 *             chave publicável do Supabase.
 * 'demo':     dados de demonstração em memória (src/data/mockData.ts), útil para
 *             apresentar o app e desenvolver telas sem backend.
 */
export const DATA_MODE: 'supabase' | 'demo' = isSupabaseConfigured ? 'supabase' : 'demo';
export const isDemo = DATA_MODE === 'demo';
