import { AlertTriangle, Eye, History, RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Callout, KeyValue } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import type { AnalysisVersion } from '@/types';
import { formatKi67 } from '@/utils/ki67';

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
        title="Histórico de Versões Salvas"
        subtitle="Registro cronológico e imutável de edições"
        icon={History}
        maxWidth={680}
        footer={<Button label="Fechar" variant="outline" onPress={onClose} />}
      >
        {history.length === 0 ? (
          <Text className="py-8 text-center font-sans text-xs text-ink-subtle">Nenhuma versão salva ainda.</Text>
        ) : (
          history.map((v, idx) => {
            const current = idx === 0;
            return (
              <View key={v.versionNumber} className={`gap-2 rounded-xs border p-3.5 ${current ? 'border-primary bg-surface-alt' : 'border-line bg-white'}`}>
                <View className="flex-row flex-wrap items-center justify-between gap-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="rounded-xs border border-line bg-white px-2 py-0.5 font-mono-bold text-xs text-primary">
                      v{v.versionNumber} {current ? '(Atual)' : ''}
                    </Text>
                    <Text className="font-sans text-xs text-ink-muted">{new Date(v.createdAt).toLocaleString('pt-BR')}</Text>
                  </View>
                  <View className="flex-row items-center gap-3">
                    <Text className="font-mono-bold text-xs text-primary">Ki-67: {formatKi67(v.ki67Index)}</Text>
                    <Text className="font-mono text-[11px] text-ink-subtle">{v.marks.length} marcações</Text>
                  </View>
                </View>
                <View className="flex-row flex-wrap gap-x-4 gap-y-1 rounded-xs border border-surface-alt bg-white p-2">
                  <Text className="font-mono text-[11px] text-warn">● Reagentes: {v.reagentsCount}</Text>
                  <Text className="font-mono text-[11px] text-sky-700">○ Não reagentes: {v.nonReagentsCount}</Text>
                  <Text className="font-mono text-[10px] text-ink-muted">Dispositivo: {v.savedBy}</Text>
                </View>
                {v.observation ? (
                  <Text numberOfLines={1} className="font-sans text-[11px] italic text-ink-subtle">
                    “{v.observation}”
                  </Text>
                ) : null}
                <View className="flex-row justify-end gap-2 border-t border-surface-alt pt-2">
                  <Button label="Visualizar detalhes" icon={Eye} variant="outline" size="sm" onPress={() => setPreview(v)} />
                  {!current && canRestore ? <Button label="Restaurar esta versão" icon={RotateCcw} size="sm" onPress={() => setToRestore(v.versionNumber)} /> : null}
                </View>
                {toRestore === v.versionNumber ? (
                  <Callout tone="warning" icon={AlertTriangle} title={`Confirmar restauração da versão v${v.versionNumber}?`}>
                    <View className="gap-3">
                      <Text className="font-sans text-[11px] leading-4 text-amber-900">
                        A restauração não apaga versões posteriores: ela cria uma nova versão com os dados da v{v.versionNumber}, e todas as versões continuam no histórico para auditoria.
                      </Text>
                      <View className="flex-row justify-end gap-2">
                        <Button label="Cancelar" variant="outline" size="sm" onPress={() => setToRestore(null)} />
                        <Button label={`Criar nova versão a partir da v${v.versionNumber}`} size="sm" loading={busy} onPress={confirm} />
                      </View>
                    </View>
                  </Callout>
                ) : null}
              </View>
            );
          })
        )}
      </Dialog>

      <Dialog visible={!!preview} onClose={() => setPreview(null)} title={`Pré-visualização da versão v${preview?.versionNumber ?? ''}`} footer={<Button label="Fechar pré-visualização" onPress={() => setPreview(null)} />}>
        {preview ? (
          <View className="gap-2">
            <KeyValue label="Data/hora:" value={new Date(preview.createdAt).toLocaleString('pt-BR')} />
            <KeyValue label="Ki-67:" value={formatKi67(preview.ki67Index)} valueClassName="text-primary" />
            <KeyValue label="Reagentes (DAB ●):" value={preview.reagentsCount} valueClassName="text-dab" />
            <KeyValue label="Não reagentes (HEM ○):" value={preview.nonReagentsCount} valueClassName="text-hema" />
            <KeyValue label="Total de marcações:" value={preview.marks.length} />
            <Text className="mt-2 font-sans text-[11px] text-ink-subtle">Observação: “{preview.observation || 'Sem observações'}”</Text>
          </View>
        ) : null}
      </Dialog>
    </>
  );
}
