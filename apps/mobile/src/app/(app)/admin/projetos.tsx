import { Folder } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card, PageHeader, StatusDot } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { Select } from '@/components/ui/Select';
import { useAppStore } from '@/state/appStore';
import { colors } from '@/theme/colors';
import { newRequestId, useSubmitOnce } from '@/utils/submitGuard';

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
  const [requestId, setRequestId] = useState(newRequestId);

  const managers = users.filter((u) => u.roles.includes('Gestor') && u.isActive);
  const chosen = managerId ?? managers[0]?.id ?? null;

  const openCreate = () => {
    setRequestId(newRequestId());
    setOpen(true);
  };

  const { submit, pending } = useSubmitOnce(async () => {
    if (!chosen) return;
    const result = await createProject(name, description, chosen, requestId);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(`Projeto criado: ${name.trim()} já está na lista.`);
    setOpen(false);
    setName('');
    setDescription('');
  });

  return (
    <Screen maxWidth={1024}>
      <PageHeader
        title="Projetos"
        description="Crie projetos e designe o gestor responsável por cada um."
        actions={<Button label="Novo projeto" onPress={openCreate} />}
      />

      <View className="gap-4">
        {projects.map((p) => {
          const manager = users.find((u) => u.id === p.managerId);
          const batchCount = batches.filter((b) => b.projectId === p.id).length;
          return (
            <Card key={p.id} className="flex-row flex-wrap items-center justify-between gap-x-10 gap-y-5 px-7 py-6">
              <View className="min-w-[240px] flex-1 flex-row items-center gap-4">
                <View className="h-10 w-10 items-center justify-center">
                  <Folder size={22} color={colors.primary} />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="font-sans-black text-[20px] leading-[24px] tracking-[-0.4px] text-ink">{p.name}</Text>
                  <Text className="font-sans-semibold text-[12px] tracking-[0.36px] text-ink-muted">{p.code}</Text>
                  <Text className="pt-0.5 font-sans text-[14px] leading-[21px] text-ink-muted">
                    {p.description || 'Sem descrição.'}
                  </Text>
                </View>
              </View>

              <View className="min-w-[220px] gap-1">
                <Text className="font-sans-semibold text-[12px] text-ink-muted">Gestor</Text>
                <Text numberOfLines={1} className="font-sans-semibold text-[14px] text-ink">
                  {manager?.email ?? p.managerName}
                </Text>
              </View>

              <View className="min-w-[48px] gap-1">
                <Text className="font-sans-semibold text-[12px] text-ink-muted">Lotes</Text>
                <Text className="font-sans-semibold text-[14px] text-ink">{batchCount}</Text>
              </View>

              <View className="min-w-[92px] gap-1">
                <Text className="font-sans-semibold text-[12px] text-ink-muted">Criado em</Text>
                <Text className="font-sans-semibold text-[14px] text-ink">
                  {new Date(p.createdAt).toLocaleDateString('pt-BR')}
                </Text>
              </View>

              <StatusDot label={p.status === 'ativo' ? 'Ativo' : 'Encerrado'} active={p.status === 'ativo'} />
            </Card>
          );
        })}
      </View>

      <Dialog
        visible={open}
        onClose={() => setOpen(false)}
        title="Novo projeto"
        subtitle="Título do estudo e gestor responsável."
        footer={
          <>
            <Button label="Cancelar" variant="neutral" onPress={() => setOpen(false)} />
            <Button label="Criar projeto" onPress={submit} loading={pending} disabled={!name.trim() || !chosen} />
          </>
        }
      >
        <TextField
          label="Nome do projeto"
          value={name}
          onChangeText={setName}
          placeholder="Estudo multicêntrico de câncer colorretal Ki-67"
        />
        <TextField
          label="Descrição e protocolo"
          optional="opcional"
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Objetivos, amostragem, critérios de hotspot"
        />
        <View className="gap-1.5">
          <Select
            label="Gestor responsável"
            value={chosen}
            onChange={setManagerId}
            options={managers.map((m) => ({ value: m.id, label: m.email, description: m.name }))}
          />
          <Text className="font-sans text-[13px] leading-[19.5px] text-ink-muted">
            Só gestores ativos. O gestor não avalia o próprio projeto.
          </Text>
        </View>
      </Dialog>
    </Screen>
  );
}
