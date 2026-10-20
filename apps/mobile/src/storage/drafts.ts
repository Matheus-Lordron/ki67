/**
 * Rascunho local da análise aberta (RNF-05). Sem rede, as marcações continuam
 * editáveis e ficam guardadas no aparelho até o servidor confirmar o salvamento.
 * Só coordenadas, labels e observação: nenhuma imagem é gravada (seção 8).
 * O logout apaga todos os rascunhos.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AnnotationMark } from '@/types';

const PREFIX = 'ki67.draft.';

export interface Draft {
  baseVersion: number;
  marks: AnnotationMark[];
  observation: string;
  updatedAt: string;
}

const key = (userId: string, imageId: string) => `${PREFIX}${userId}.${imageId}`;

export async function readDraft(userId: string, imageId: string): Promise<Draft | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId, imageId));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export async function writeDraft(userId: string, imageId: string, draft: Omit<Draft, 'updatedAt'>): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId, imageId), JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }));
  } catch {
    // armazenamento cheio ou indisponível: o salvamento no servidor continua
  }
}

export async function clearDraft(userId: string, imageId: string): Promise<void> {
  await AsyncStorage.removeItem(key(userId, imageId)).catch(() => undefined);
}

export async function clearAllDrafts(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {
    // nada a limpar
  }
}
