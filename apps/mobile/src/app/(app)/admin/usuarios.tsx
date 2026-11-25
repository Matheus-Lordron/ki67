import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { PageHeader, StatusDot } from '@/components/ui/Card';
import { Cell, DataTable } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { Checkbox, Label, TextField } from '@/components/ui/Field';
import { Grid } from '@/components/ui/Grid';
import { Screen } from '@/components/ui/Screen';
import { useRefreshOnFocus } from '@/features/sessao/useRefreshOnFocus';
import { ROLE_ORDER, useAppStore } from '@/state/appStore';
import type { User, UserRole } from '@/types';
import { useSubmitOnce } from '@/utils/submitGuard';

// Usuários e papéis (RF-04, RF-06, RF-07). Não existe botão de excluir: só desativar.
export default function UsersScreen() {
  useRefreshOnFocus();
  const users = useAppStore((s) => s.users);
  const me = useAppStore((s) => s.currentUser);
  const createUser = useAppStore((s) => s.createUser);
  const toggleUserActive = useAppStore((s) => s.toggleUserActive);
  const updateUserRoles = useAppStore((s) => s.updateUserRoles);
  const showToast = useAppStore((s) => s.showToast);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');
  const [roles, setRoles] = useState<UserRole[]>(['Avaliador']);
  const [editing, setEditing] = useState<User | null>(null);
  const [editRoles, setEditRoles] = useState<UserRole[]>([]);

  const toggleIn = (list: UserRole[], role: UserRole) => (list.includes(role) ? list.filter((r) => r !== role) : [...list, role]);

  const { submit, pending } = useSubmitOnce(async () => {
    const result = await createUser({ name, email, institution, roles });
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(`Usuário cadastrado: Convite enviado para ${email.trim()}.`);
    setCreateOpen(false);
    setName('');
    setEmail('');
    setInstitution('');
    setRoles(['Avaliador']);
  });

  const saveRoles = async () => {
    if (!editing) return;
    const result = await updateUserRoles(editing.id, editRoles);
    showToast(result.ok ? `Papéis atualizados: ${editing.name}.` : result.error);
    if (result.ok) setEditing(null);
  };

  const toggleActive = async (u: User) => {
    const result = await toggleUserActive(u.id);
    showToast(result.ok ? `${u.name}: Conta ${u.isActive ? 'desativada' : 'reativada'}.` : result.error);
  };

  return (
    <Screen maxWidth={1024}>
      <PageHeader
        title="Usuários"
        description="Contas são desativadas, nunca excluídas, para preservar o histórico."
        actions={<Button label="Novo usuário" onPress={() => setCreateOpen(true)} />}
      />

      <DataTable<User>
        rows={users}
        keyOf={(u) => u.id}
        columns={[
          {
            key: 'u',
            title: 'Usuário',
            width: 360,
            render: (u) => (
              <View className="gap-0.5">
                <Text numberOfLines={1} className="font-sans-bold text-[14px] text-ink">
                  {u.name}
                  {u.id === me?.id ? <Text className="font-sans-medium text-ink-muted"> (você)</Text> : null}
                </Text>
                <Text numberOfLines={1} className="font-sans text-[13px] text-ink-muted">
                  {u.email}
                </Text>
              </View>
            ),
          },
          {
            key: 'i',
            title: 'Instituição',
            width: 140,
            render: (u) => <Cell className="font-sans text-[14px] text-ink-muted">{u.institution || '—'}</Cell>,
          },
          {
            key: 'r',
            title: 'Papel',
            width: 150,
            render: (u) => <Cell className="font-sans-semibold text-[14px] text-ink">{u.roles.join(', ')}</Cell>,
          },
          {
            key: 's',
            title: 'Status',
            width: 110,
            render: (u) => <StatusDot label={u.isActive ? 'Ativo' : 'Inativo'} active={u.isActive} />,
          },
          {
            key: 'a',
            title: 'Ações',
            width: 260,
            align: 'right',
            render: (u) => (
              <View className="flex-row items-center justify-end gap-2">
                {u.id !== me?.id ? (
                  <Pressable
                    onPress={() => toggleActive(u)}
                    accessibilityRole="button"
                    className="h-9 items-center justify-center rounded-[8px] px-3.5 web:hover:bg-danger-soft"
                  >
                    <Text className={`font-sans-semibold text-[13px] ${u.isActive ? 'text-danger' : 'text-primary'}`}>
                      {u.isActive ? 'Desativar' : 'Reativar'}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => {
                    setEditing(u);
                    setEditRoles(u.roles);
                  }}
                  accessibilityRole="button"
                  className="h-9 items-center justify-center rounded-[8px] border border-primary bg-white px-3.5 web:hover:bg-surface-alt"
                >
                  <Text className="font-sans-semibold text-[13px] text-primary">Editar papéis</Text>
                </Pressable>
              </View>
            ),
          },
        ]}
      />

      <Dialog
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Novo usuário"
        subtitle="Um convite será enviado por e-mail."
        footer={
          <>
            <Button label="Cancelar" variant="neutral" onPress={() => setCreateOpen(false)} />
            <Button label="Cadastrar e convidar" onPress={submit} loading={pending} disabled={!name.trim() || !email.trim() || !roles.length} />
          </>
        }
      >
        <TextField label="Nome completo" value={name} onChangeText={setName} placeholder="Dra. Mariana Vasconcelos" />
        <TextField
          label="E-mail institucional"
          value={email}
          onChangeText={setEmail}
          placeholder="mariana@hospital.org.br"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextField label="Instituição" optional="opcional" value={institution} onChangeText={setInstitution} placeholder="Instituto do Câncer - SP" />
        <View>
          <Label optional="um ou mais">Papéis</Label>
          <Grid cols={{ base: 1, sm: 2 }} gap={10}>
            {ROLE_ORDER.map((r) => (
              <Checkbox key={r} checked={roles.includes(r)} onChange={() => setRoles(toggleIn(roles, r))} label={r} />
            ))}
          </Grid>
        </View>
      </Dialog>

      <Dialog
        visible={!!editing}
        onClose={() => setEditing(null)}
        title="Editar papéis"
        subtitle={editing?.name}
        footer={
          <>
            <Button label="Cancelar" variant="neutral" onPress={() => setEditing(null)} />
            <Button label="Salvar papéis" onPress={saveRoles} disabled={!editRoles.length} />
          </>
        }
      >
        <View>
          <Label optional="um ou mais">Papéis</Label>
          <Grid cols={{ base: 1, sm: 2 }} gap={10}>
            {ROLE_ORDER.map((r) => (
              <Checkbox key={r} checked={editRoles.includes(r)} onChange={() => setEditRoles(toggleIn(editRoles, r))} label={r} />
            ))}
          </Grid>
        </View>
        <Text className="font-sans text-[13px] text-ink-muted">
          A mudança vale na próxima ação do usuário e fica registrada no log.
        </Text>
      </Dialog>
    </Screen>
  );
}
