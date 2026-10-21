import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/Card';
import { Checkbox, Segmented } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { Select } from '@/components/ui/Select';
import { ProjectPicker, useManagerScope } from '@/features/gestor/useManagerScope';
import { useAppStore } from '@/state/appStore';

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
  const [busy, setBusy] = useState(false);

  const batch = batches.find((b) => b.id === batchId) ?? batches[0];
  const image = images.find((i) => i.id === imageId) ?? images[0];
  const limit = target === 'batch' ? (batch?.evaluatorsPerImage ?? 0) : (image?.requiredEvaluatorsCount ?? 0);
  const targetImages = target === 'batch' ? images.filter((i) => i.batchId === batch?.id && i.status !== 'validada') : image ? [image] : [];
  const alreadyAssigned = Array.from(new Set(targetImages.flatMap((i) => i.assignedEvaluatorIds)));
  const evaluators = users.filter((u) => u.roles.includes('Avaliador') && u.isActive);
  const managerId = project?.managerId;

  const toggle = (id: string) => {
    if (id === user?.id || id === managerId) {
      showToast('O gestor do projeto não pode anotar imagens do próprio projeto.');
      return;
    }
    if (selected.includes(id)) {
      setSelected((s) => s.filter((x) => x !== id));
      return;
    }
    if (new Set([...alreadyAssigned, ...selected, id]).size > limit) {
      showToast(`Este lote pede ${limit} avaliadores por imagem.`);
      return;
    }
    setSelected((s) => [...s, id]);
  };

  const save = async () => {
    if (!selected.length) {
      showToast('Escolha pelo menos um avaliador.');
      return;
    }
    setBusy(true);
    const result = await assignEvaluators(targetImages.map((i) => i.id), selected);
    setBusy(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(`Atribuição salva. ${result.created} análise(s) criada(s).`);
    setSelected([]);
  };

  return (
    <Screen maxWidth={900}>
      <PageHeader title="Atribuição" description={<ProjectPicker />} />

      <View className="gap-6">
        <View className="gap-2">
          <Text className="font-sans-medium text-[13px] text-ink">Atribuir</Text>
          <Segmented
            value={target}
            onChange={(v) => { setTarget(v); setSelected([]); }}
            options={[
              { value: 'batch', label: 'Um lote inteiro' },
              { value: 'image', label: 'Uma imagem' },
            ]}
          />
        </View>

        {target === 'batch' ? (
          <Select
            label="Lote"
            value={batch?.id ?? null}
            onChange={(v) => { setBatchId(v); setSelected([]); }}
            options={batches.map((b) => ({ value: b.id, label: b.name, description: `${b.evaluatorsPerImage} avaliadores por imagem · ${images.filter((i) => i.batchId === b.id).length} imagens` }))}
          />
        ) : (
          <Select
            label="Imagem"
            value={image?.id ?? null}
            onChange={(v) => { setImageId(v); setSelected([]); }}
            options={images.map((i) => ({ value: i.id, label: `${i.code} — ${i.organ}`, description: `${i.batchName} · ${i.assignedEvaluatorIds.length} de ${i.requiredEvaluatorsCount} avaliadores` }))}
          />
        )}

        <View className="gap-2">
          <View className="flex-row items-baseline justify-between">
            <Text className="font-sans-medium text-[13px] text-ink">Avaliadores</Text>
            <Text className="font-sans text-[13px] text-ink-muted">
              <Text className="font-mono text-ink">{new Set([...alreadyAssigned, ...selected]).size}</Text> de {limit} por imagem
            </Text>
          </View>
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
                    <Text className="font-sans text-xs text-ink-subtle">É o gestor do projeto: não pode anotar aqui.</Text>
                  </View>
                ) : assigned ? (
                  <View className="ml-2">
                    <Text className="font-sans text-xs text-ink-subtle">Já atribuído.</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <Text className="font-sans text-xs leading-5 text-ink-subtle">
          Os avaliadores veem só o código da imagem. Repetir uma atribuição não cria análises duplicadas.
        </Text>

        <View className="flex-row justify-end border-t border-line pt-4">
          <Button label="Salvar atribuição" loading={busy} disabled={!targetImages.length} onPress={save} />
        </View>
      </View>
    </Screen>
  );
}
