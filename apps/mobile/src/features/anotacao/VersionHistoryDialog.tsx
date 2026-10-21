import { AlertTriangle } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Callout, KeyValue } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import type { AnalysisVersion } from '@/types';

const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Histórico de versões (RF-34). Restaurar a versão k cria uma versão NOVA igual
 * a k e mantém as posteriores no histórico.
 */
export function VersionHistoryDialog({ visible, onClose, history, canRestore, onRestore }: {
  visible: boolean;
  onClose: () => void;
  history: AnalysisVersion[];
  canRestore: boolean;
  onRestore: (versionNumber: number) => Promise<boolean>;
}) {
  const [preview, setPreview] = useState<AnalysisVersion | null>(null);
  const [toRestore, setToRestore] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (toRestore === null) return;
    setBusy(true);
    const ok = await onRestore(toRestore);
    setBusy(false);
    setToRestore(null);
    if (ok) onClose();
  };

  return (
    <>
      <Dialog
        visible={visible && !preview}
        onClose={onClose}
        title="Versões salvas"
        subtitle="Nenhuma versão é apagada. Restaurar uma versão cria uma versão nova."
        maxWidth={640}
        footer={<Button label="Fechar" variant="outline" onPress={onClose} />}
      >
        {history.length === 0 ? (
          <Text className="py-8 font-sans text-[13px] text-ink-subtle">Nenhuma versão salva ainda.</Text>
        ) : (
          <View className="overflow-hidden rounded-xs border border-line">
            {history.map((v, idx) => {
              const current = idx === 0;
              return (
                <View key={v.versionNumber} className={`gap-2 px-3 py-3 ${idx ? 'border-t border-line' : ''}`}>
                  <View className="flex-row flex-wrap items-baseline justify-between gap-2">
                    <View className="flex-row items-baseline gap-2">
                      <Text className="font-sans-medium text-[13px] text-ink">Versão {v.versionNumber}</Text>
                      {current ? <Text className="font-sans text-xs text-ink-subtle">atual</Text> : null}
                    </View>
                    <Text className="font-sans text-xs text-ink-subtle">{fmt(v.createdAt)}</Text>
                  </View>
                  <Text className="font-sans text-xs text-ink-muted">
                    <Text className="font-mono text-ink">{v.reagentsCount}</Text> reagentes · <Text className="font-mono text-ink">{v.nonReagentsCount}</Text> não reagentes · {v.savedBy}
                  </Text>
                  {v.observation ? <Text numberOfLines={1} className="font-sans text-xs text-ink-subtle">{v.observation}</Text> : null}
                  <View className="flex-row gap-4">
                    <Pressable onPress={() => setPreview(v)} className="min-h-8 justify-center">
                      <Text className="font-sans text-[13px] text-ink underline">Detalhes</Text>
                    </Pressable>
                    {!current && canRestore ? (
                      <Pressable onPress={() => setToRestore(v.versionNumber)} className="min-h-8 justify-center">
                        <Text className="font-sans text-[13px] text-ink underline">Restaurar</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {toRestore === v.versionNumber ? (
                    <Callout tone="warning" icon={AlertTriangle} title={`Restaurar a versão ${v.versionNumber}?`}>
                      <View className="gap-3">
                        <Text className="font-sans text-xs leading-5 text-warn">
                          As marcações da versão {v.versionNumber} viram uma versão nova. As versões posteriores continuam no histórico.
                        </Text>
                        <View className="flex-row justify-end gap-2">
                          <Button label="Cancelar" variant="outline" size="sm" onPress={() => setToRestore(null)} />
                          <Button label="Restaurar" size="sm" loading={busy} onPress={confirm} />
                        </View>
                      </View>
                    </Callout>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </Dialog>

      <Dialog visible={!!preview} onClose={() => setPreview(null)} title={`Versão ${preview?.versionNumber ?? ''}`} footer={<Button label="Voltar" variant="outline" onPress={() => setPreview(null)} />}>
        {preview ? (
          <View className="gap-2">
            <KeyValue label="Salva em" value={fmt(preview.createdAt)} />
            <KeyValue label="Reagentes" value={preview.reagentsCount} />
            <KeyValue label="Não reagentes" value={preview.nonReagentsCount} />
            <KeyValue label="Total de marcações" value={preview.marks.length} />
            <Text className="mt-2 font-sans text-[13px] leading-5 text-ink-muted">{preview.observation || 'Sem observação.'}</Text>
          </View>
        ) : null}
      </Dialog>
    </>
  );
}
