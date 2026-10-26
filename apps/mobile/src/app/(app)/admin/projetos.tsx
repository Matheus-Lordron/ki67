import { FolderKanban, Plus, UserCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Badge, Card, PageHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/Field';
import { Grid } from '@/components/ui/Grid';
import { Screen } from '@/components/ui/Screen';
import { Select } from '@/components/ui/Select';
import { useAppStore } from '@/state/appStore';
import { colors } from '@/theme/colors';

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
        title="Projetos & Estudos"
        badge="GOVERNANÇA"
        description="Crie os projetos de pesquisa e designe o gestor responsável por cada um."
        actions={<Button label="Criar novo projeto" icon={Plus} onPress={() => setOpen(true)} />}
      />
      <Grid cols={{ base: 1, md: 2 }}>
        {projects.map((p) => (
          <Card key={p.id} className="h-full justify-between">
            <View>
              <View className="mb-2 flex-row items-center justify-between">
                <Badge label={p.code} />
                <Badge label={p.status.toUpperCase()} tone={p.status === 'ativo' ? 'success' : 'neutral'} />
              </View>
              <Text className="mb-1 font-sans-bold text-base text-ink">{p.name}</Text>
              <Text className="mb-4 font-sans text-xs leading-5 text-ink-muted">{p.description || 'Sem descrição.'}</Text>
              <View className="mb-3 flex-row items-center justify-between rounded-xs border border-line bg-surface-alt p-3">
                <View className="flex-row items-center gap-2">
                  <UserCheck size={16} color={colors.primary} />
                  <Text className="font-sans text-xs text-ink-subtle">Gestor designado:</Text>
                </View>
                <Text className="font-sans-semibold text-xs text-primary">{users.find((u) => u.id === p.managerId)?.name ?? p.managerName}</Text>
              </View>
            </View>
            <View className="flex-row justify-between border-t border-surface-alt pt-3">
              <Text className="font-mono text-xs text-ink-subtle">{batches.filter((b) => b.projectId === p.id).length} lotes associados</Text>
              <Text className="font-mono text-xs text-ink-subtle">Criado em {new Date(p.createdAt).toLocaleDateString('pt-BR')}</Text>
            </View>
          </Card>
        ))}
      </Grid>

      <Dialog
        visible={open}
        onClose={() => setOpen(false)}
        title="Criar novo projeto"
        subtitle="Título do estudo e gestor responsável"
        icon={FolderKanban}
        footer={
          <>
            <Button label="Cancelar" variant="outline" onPress={() => setOpen(false)} />
            <Button label="Criar e designar" onPress={submit} disabled={!name.trim() || !chosen} />
          </>
        }
      >
        <TextField label="Nome do projeto *" value={name} onChangeText={setName} placeholder="Ex.: Estudo multicêntrico de câncer colorretal Ki-67" />
        <TextField label="Descrição e protocolo" value={description} onChangeText={setDescription} multiline placeholder="Objetivos, amostragem, critérios de hotspot..." />
        <View>
          <Select label="Designar gestor responsável *" value={chosen} onChange={setManagerId} options={managers.map((m) => ({ value: m.id, label: m.name, description: m.email }))} />
          <Text className="mt-1 font-sans text-[10px] text-ink-subtle">Só usuários ativos com o papel Gestor podem ser designados. O gestor não pode avaliar no próprio projeto (RN-07).</Text>
        </View>
      </Dialog>
    </Screen>
  );
}
