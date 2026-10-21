import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Badge, Card, KeyValue, PageHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/Field';
import { Grid } from '@/components/ui/Grid';
import { Screen } from '@/components/ui/Screen';
import { Select } from '@/components/ui/Select';
import { useAppStore } from '@/state/appStore';

// Projetos e gestores (RF-09): só o admin cria projetos e designa o gestor.
export default function ProjectsScreen() {
  const projects = useAppStore((s) => s.projects);
  const users = useAppStore((s) => s.users);
  const batches = useAppStore((s) => s.batches);
  const createProject = useAppStore((s) => s.createProject);
  const showToast = useAppStore((s) => s.showToast);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [managerId, setManagerId] = useState<string | null>(null);

  const managers = users.filter((u) => u.roles.includes('Gestor') && u.isActive);
  const chosen = managerId ?? managers[0]?.id ?? null;

  const submit = async () => {
    if (!chosen) return;
    const result = await createProject(name, description, chosen);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(`Projeto "${name.trim()}" criado.`);
    setOpen(false);
    setName('');
    setDescription('');
  };

  return (
    <Screen>
      <PageHeader
        title="Projetos"
        description="Cada projeto tem o nome que você escolher e um gestor responsável."
        actions={<Button label="Novo projeto" icon={Plus} onPress={() => setOpen(true)} />}
      />
      <Grid cols={{ base: 1, md: 2 }}>
        {projects.map((p) => (
          <Card key={p.id} className="h-full gap-4 p-4">
            <View className="gap-1">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="font-sans-semibold text-[15px] text-ink">{p.name}</Text>
                {p.status !== 'ativo' ? <Badge label="Encerrado" tone="neutral" /> : null}
              </View>
              <Text className="font-sans text-[13px] leading-5 text-ink-muted">{p.description || 'Sem descrição.'}</Text>
            </View>
            <View className="gap-1.5 border-t border-line pt-3">
              <KeyValue label="Gestor" value={<Text className="font-sans text-[13px] text-ink">{users.find((u) => u.id === p.managerId)?.name ?? p.managerName}</Text>} />
              <KeyValue label="Lotes" value={batches.filter((b) => b.projectId === p.id).length} />
              <KeyValue label="Código" value={p.code} />
              <KeyValue label="Criado em" value={new Date(p.createdAt).toLocaleDateString('pt-BR')} />
            </View>
          </Card>
        ))}
      </Grid>

      <Dialog
        visible={open}
        onClose={() => setOpen(false)}
        title="Novo projeto"
        footer={
          <>
            <Button label="Cancelar" variant="outline" onPress={() => setOpen(false)} />
            <Button label="Criar projeto" onPress={submit} disabled={!name.trim() || !chosen} />
          </>
        }
      >
        <TextField label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Ki67" />
        <TextField label="Descrição" hint="opcional" value={description} onChangeText={setDescription} multiline placeholder="Objetivo, material, critérios de contagem…" />
        <View>
          <Select label="Gestor" value={chosen} onChange={setManagerId} options={managers.map((m) => ({ value: m.id, label: m.name, description: m.email }))} />
          <Text className="mt-1 font-sans text-xs text-ink-subtle">Aparecem só usuários ativos com o papel Gestor. O gestor não anota imagens do próprio projeto.</Text>
        </View>
      </Dialog>
    </Screen>
  );
}
