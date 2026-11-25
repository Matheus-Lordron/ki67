import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Badge, Callout, Card, PageHeader } from '@/components/ui/Card';
import { Checkbox, Label, Segmented } from '@/components/ui/Field';
import { Grid } from '@/components/ui/Grid';
import { Screen } from '@/components/ui/Screen';
import { Select } from '@/components/ui/Select';
import { ProjectPicker, useManagerScope } from '@/features/gestor/useManagerScope';
import { useAppStore } from '@/state/appStore';
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

  const totalSelected = new Set([...alreadyAssigned, ...selected]).size;

  return (
    <Screen maxWidth={1024}>
      <PageHeader
        title="Atribuição"
        description="Distribua lotes ou lâminas aos avaliadores independentes, respeitando o protocolo cego."
        actions={<ProjectPicker />}
      />

      <Card className="gap-6 p-7">
        <View className="flex-row flex-wrap items-center justify-between gap-4">
          <View className="gap-2">
            <Label>Escopo da atribuição</Label>
            <Segmented
              value={target}
              onChange={(v) => {
                setTarget(v);
                setSelected([]);
              }}
              options={[
                { value: 'batch', label: 'Todo o lote' },
                { value: 'image', label: 'Lâmina específica' },
              ]}
            />
          </View>

          <View className="items-end rounded-[12px] bg-surface-alt px-4 py-2.5">
            <Text className="font-sans-semibold text-[12px] text-ink-muted">Avaliadores por imagem</Text>
            <Text className="font-sans-black text-[20px] text-primary">
              {totalSelected} de {limit}
            </Text>
          </View>
        </View>

        {target === 'batch' ? (
          <Select
            label="Lote"
            value={batch?.id ?? null}
            onChange={(v) => {
              setBatchId(v);
              setSelected([]);
            }}
            options={batches.map((b) => ({
              value: b.id,
              label: b.name,
              description: `N = ${b.evaluatorsPerImage} avaliadores · ${images.filter((i) => i.batchId === b.id).length} imagens`,
            }))}
          />
        ) : (
          <Select
            label="Lâmina"
            value={image?.id ?? null}
            onChange={(v) => {
              setImageId(v);
              setSelected([]);
            }}
            options={images.map((i) => ({
              value: i.id,
              label: `${i.code} — ${i.organ}`,
              description: `${i.batchName} · ${i.assignedEvaluatorIds.length}/${i.requiredEvaluatorsCount} atribuídos`,
            }))}
          />
        )}

        <View className="gap-2">
          <Label optional="um ou mais">Avaliadores ativos</Label>
          <Grid cols={{ base: 1, md: 2 }} gap={12}>
            {evaluators.map((ev) => {
              const isManager = ev.id === user?.id || ev.id === managerId;
              const assigned = alreadyAssigned.includes(ev.id);
              return (
                <View key={ev.id} className="gap-1.5">
                  <Checkbox
                    checked={assigned || selected.includes(ev.id)}
                    disabled={isManager || assigned}
                    onChange={() => toggle(ev.id)}
                    label={ev.name}
                    description={`${ev.email}${ev.institution ? ` · ${ev.institution}` : ''}`}
                  />
                  {isManager ? (
                    <Badge label="Gestor do projeto (bloqueado RN-07)" tone="warning" icon={ShieldAlert} />
                  ) : assigned ? (
                    <Badge label="Já atribuído" tone="primary" icon={CheckCircle2} />
                  ) : null}
                </View>
              );
            })}
          </Grid>
        </View>

        <Callout tone="info" icon={AlertTriangle}>
          O gestor não avalia o próprio projeto (RN-07). Repetir uma atribuição não duplica análises e ultrapassar N é recusado (RF-29).
        </Callout>

        <View className="flex-row justify-end border-t border-line-soft pt-4">
          <Button label="Salvar atribuições" loading={busy} disabled={!targetImages.length} onPress={save} />
        </View>
      </Card>
    </Screen>
  );
}
