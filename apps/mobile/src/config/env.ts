// Variáveis públicas do app, lidas de apps/mobile/.env (veja .env.example).
// O Expo só embute no bundle as variáveis EXPO_PUBLIC_*, e só quando escritas
// por extenso como abaixo (process.env.EXPO_PUBLIC_X), nunca por índice dinâmico.
// Tudo aqui é público: nunca coloque a chave service_role nem chaves do R2.

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  /** Tamanho máximo de upload em MB (RF-08). O banco também confere. */
  uploadMaxMb: Number(process.env.EXPO_PUBLIC_UPLOAD_MAX_MB ?? 50),
};

export const isSupabaseConfigured = /^https?:\/\/.+/.test(env.supabaseUrl) && env.supabaseKey.length > 20;
