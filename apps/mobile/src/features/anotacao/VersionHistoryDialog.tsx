import { AlertTriangle } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Badge, Callout, KeyValue } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import type { AnalysisVersion } from '@/types';
import { formatKi67 } from '@/utils/ki67';

/**
 * Histórico de versões (RF-34) no padrão do Dialog 14:4685 do Figma.
 * Restaurar a versão k cria uma versão NOVA igual a k e mantém as posteriores no histórico.
 */
export function VersionHistoryDialog({
  visible,
  onClose,
  history,
  canRestore,
  onRestore,
}: {
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
        title="Histórico de versões"
        subtitle="Cada versão salva fica registrada e não pode ser alterada."
        maxWidth={680}
        footer={<Button label="Fechar" variant="neutral" onPress={onClose} />}
      >
        {history.length === 0 ? (
          <Text className="py-8 text-center font-sans text-[14px] text-ink-muted">Nenhuma versão salva ainda.</Text>
        ) : (
          history.map((v, idx) => {
            const current = idx === 0;
            return (
              <View
                key={v.versionNumber}
                className={`gap-3.5 rounded-[14px] border p-5 ${
                  current ? 'border-primary bg-primary-subtle' : 'border-line-card bg-white'
                }`}
              >
                <View className="flex-row flex-wrap items-center justify-between gap-2">
                  <View className="flex-row items-center gap-2.5">
                    <Text className="font-sans-black text-[16px] text-ink">Versão {v.versionNumber}</Text>
                    {current ? <Badge label="Atual" tone="primary" /> : null}
                  </View>
                  <Text className="font-sans text-[13px] text-ink-muted">{new Date(v.createdAt).toLocaleString('pt-BR')}</Text>
                </View>

                <View className="flex-row flex-wrap gap-8">
                  <View className="gap-0.5">
                    <Text className="font-sans text-[12px] text-ink-muted">Ki-67</Text>
                    <Text className="font-sans-black text-[16px] text-ink">{formatKi67(v.ki67Index)}</Text>
                  </View>
                  <View className="gap-0.5">
                    <Text className="font-sans text-[12px] text-ink-muted">Reagentes</Text>
                    <Text className="font-sans-bold text-[15px] text-ink">{v.reagentsCount}</Text>
                  </View>
                  <View className="gap-0.5">
                    <Text className="font-sans text-[12px] text-ink-muted">Não reagentes</Text>
                    <Text className="font-sans-bold text-[15px] text-ink">{v.nonReagentsCount}</Text>
                  </View>
                </View>

                {v.observation ? (
                  <Text numberOfLines={1} className="font-sans text-[13px] italic text-ink-muted">
                    “{v.observation}”
                  </Text>
                ) : null}

                <View className="flex-row flex-wrap justify-end gap-2 border-t border-line-soft pt-3">
                  <Button label="Ver detalhes" variant="neutral" size="sm" onPress={() => setPreview(v)} />
                  {!current && canRestore ? (
                    <Button label="Restaurar" variant="outline" size="sm" onPress={() => setToRestore(v.versionNumber)} />
                  ) : null}
                </View>

                {toRestore === v.versionNumber ? (
                  <Callout tone="warning" icon={AlertTriangle} title={`Restaurar a versão ${v.versionNumber}?`}>
                    <View className="gap-3">
                      <Text className="font-sans text-[13px] leading-5 text-amber-900">
                        A restauração cria uma nova versão com os dados da versão {v.versionNumber}, mantendo todas as anteriores no histórico.
                      </Text>
                      <View className="flex-row justify-end gap-2">
                        <Button label="Cancelar" variant="neutral" size="sm" onPress={() => setToRestore(null)} />
                        <Button label={`Confirmar restauração`} size="sm" loading={busy} onPress={confirm} />
                      </View>
                    </View>
                  </Callout>
                ) : null}
              </View>
            );
          })
        )}
      </Dialog>

      <Dialog
        visible={!!preview}
        onClose={() => setPreview(null)}
        title={`Versão ${preview?.versionNumber ?? ''}`}
        subtitle={preview ? new Date(preview.createdAt).toLocaleString('pt-BR') : undefined}
        footer={<Button label="Fechar" variant="neutral" onPress={() => setPreview(null)} />}
      >
        {preview ? (
          <View className="gap-1">
            <KeyValue label="Ki-67" value={formatKi67(preview.ki67Index)} bordered />
            <KeyValue label="Reagentes" value={preview.reagentsCount} bordered />
            <KeyValue label="Não reagentes" value={preview.nonReagentsCount} bordered />
            <KeyValue label="Total de marcações" value={preview.marks.length} bordered />
            <KeyValue label="Dispositivo" value={preview.savedBy} />
            <Text className="mt-3 font-sans text-[13px] text-ink-muted">
              Observação: “{preview.observation || 'Sem observações'}”
            </Text>
          </View>
        ) : null}
      </Dialog>
    </>
  );
}
