// Sessão do Supabase na web.
//
// A documentação previa cookie httpOnly, que exige um servidor próprio. Sem
// ele, usamos o sessionStorage: a sessão vale só para a aba aberta e some ao
// fechá-la, o que reduz a exposição em relação ao localStorage (RNF-06).
// Cada nova aba pede login e código 2FA de novo.

const storage = (): Storage | null => (typeof window !== 'undefined' ? window.sessionStorage : null);

export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    return storage()?.getItem(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    storage()?.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    storage()?.removeItem(key);
  },
};
