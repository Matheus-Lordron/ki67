import { AlertTriangle, CheckCircle2, FileImage, FolderKanban, ShieldAlert, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Badge, Callout, Card, PageHeader } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { Select } from '@/components/ui/Select';
import { ProjectPicker, useManagerScope } from '@/features/gestor/useManagerScope';
import { useAppStore } from '@/state/appStore';
import { colors } from '@/theme/colors';
import { useSubmitOnce } from '@/utils/submitGuard';

// Atribuição de avaliadores (RF-10, RF-29, RN-07).
export default function AssignmentScreen() {
  const { project, batches, images } = useManagerScope();
  const user = useAppStore((s) => s.currentUser);
  const users = useAppStore((s) => s.users);
  const assignEvaluators = useAppStore((s) => s.assignEvaluators);
  const showToast = useAppStore((s) => s.showToast);

  const [target, setTarget] = useState<'batch' | 'image'>('batch');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const batch = batches.find((b) => b.id === batchId) ?? batches[0];
  const image = images.find((i) => i.id === imageId) ?? images[0];
  const limit = target === 'batch' ? (batch?.evaluatorsPerImage ?? 0) : (image?.requiredEvaluatorsCount ?? 0);
  const targetImages = target === 'batch' ? images.filter((i) => i.batchId === batch?.id && i.status !== 'validada') : image ? [image] : [];
  const alreadyAssigned = Array.from(new Set(targetImages.flatMap((i) => i.assignedEvaluatorIds)));
  const evaluators = users.filter((u) => u.roles.includes('Avaliador') && u.isActive);
  const managerId = project?.managerId;

  const toggle = (id: string) => {
    if (id === user?.id || id === managerId) {
      showToast('Bloqueado: o gestor não pode se autoatribuir análises (RN-07).');
      return;
    }
    if (selected.includes(id)) {
      setSelected((s) => s.filter((x) => x !== id));
      return;
    }
    if (new Set([...alreadyAssigned, ...selected, id]).size > limit) {
      showToast(`Limite N=${limit} avaliadores por imagem atingido.`);
      return;
    }
    setSelected((s) => [...s, id]);
  };

  const { submit: save, pending: busy } = useSubmitOnce(async () => {
    if (!selected.length) {
      showToast('Selecione ao menos 1 avaliador.');
      return;
    }
    const result = await assignEvaluators(targetImages.map((i) => i.id), selected);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(`Atribuição salva: ${result.created} análise(s) criada(s).`);
    setSelected([]);
  });

  return (
    <Screen maxWidth={900}>
      <PageHeader title="Atribuição de Avaliadores aos Lotes & Imagens" description={<ProjectPicker />} />

      <Card className="gap-6 p-6">
        <View className="gap-2">
          <Text className="font-sans-semibold text-xs text-ink">Nível de atribuição:</Text>
          <View className="flex-row gap-3">
            <Button label="Todo o lote" icon={FolderKanban} variant={target === 'batch' ? 'primary' : 'outline'} className="flex-1" onPress={() => { setTarget('batch'); setSelected([]); }} />
            <Button label="Imagem específica" icon={FileImage} variant={target === 'image' ? 'primary' : 'outline'} className="flex-1" onPress={() => { setTarget('image'); setSelected([]); }} />
          </View>
        </View>

        {target === 'batch' ? (
          <Select
            label="Selecione o lote:"
            value={batch?.id ?? null}
            onChange={(v) => { setBatchId(v); setSelected([]); }}
            options={batches.map((b) => ({ value: b.id, label: b.name, description: `Requer N=${b.evaluatorsPerImage} avaliadores · ${images.filter((i) => i.batchId === b.id).length} imagens` }))}
          />
        ) : (
          <Select
            label="Selecione a imagem:"
            value={image?.id ?? null}
            onChange={(v) => { setImageId(v); setSelected([]); }}
            options={images.map((i) => ({ value: i.id, label: `${i.code} — ${i.organ}`, description: `${i.batchName} · ${i.assignedEvaluatorIds.length}/${i.requiredEvaluatorsCount} atribuídos` }))}
          />
        )}

        <View className="flex-row items-center justify-between rounded-xs border border-primary bg-surface-alt p-3">
          <View className="flex-row items-center gap-2">
            <Users size={16} color={colors.primary} />
            <Text className="font-mono-bold text-xs text-primary">Avaliadores por imagem:</Text>
          </View>
          <Text className="font-mono-bold text-base text-primary">
            {new Set([...alreadyAssigned, ...selected]).size} / {limit} <Text className="font-mono text-[11px] text-ink-subtle">selecionados</Text>
          </Text>
        </View>

        <View className="gap-2">
          <Text className="font-sans-semibold text-xs text-ink">Selecione os avaliadores (multisseleção):</Text>
          {evaluators.map((ev) => {
            const isManager = ev.id === user?.id || ev.id === managerId;
            const assigned = alreadyAssigned.includes(ev.id);
            return (
              <View key={ev.id} className="gap-1">
                <Checkbox
                  checked={assigned || selected.includes(ev.id)}
                  disabled={isManager || assigned}
                  onChange={() => toggle(ev.id)}
                  label={ev.name}
                  description={`${ev.email}${ev.institution ? ` · ${ev.institution}` : ''}`}
                />
                {isManager ? (
                  <View className="ml-2">
                    <Badge label="Autoatribuição bloqueada (protocolo cego)" tone="warning" icon={ShieldAlert} />
                  </View>
                ) : assigned ? (
                  <View className="ml-2">
                    <Badge label="Já atribuído" tone="success" icon={CheckCircle2} />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <Callout tone="info" icon={AlertTriangle}>
          O gestor não pode avaliar o próprio projeto (RN-07). Repetir uma atribuição não duplica análises, e passar de N é recusado (RF-29). Os avaliadores recebem só o código anonimizado da imagem.
        </Callout>

        <View className="flex-row justify-end border-t border-surface-alt pt-3">
          <Button label="Salvar atribuições" icon={CheckCircle2} loading={busy} disabled={!targetImages.length} onPress={save} />
        </View>
      </Card>
    </Screen>
  );
}
