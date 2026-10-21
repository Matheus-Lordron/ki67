import { UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Badge, PageHeader } from '@/components/ui/Card';
import { Cell, DataTable } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { Checkbox, TextField } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { useRefreshOnFocus } from '@/features/sessao/useRefreshOnFocus';
import { ROLE_ORDER, useAppStore } from '@/state/appStore';
import type { User, UserRole } from '@/types';

const ROLE_HELP: Record<UserRole, string> = {
  Admin: 'Cadastra usuários e projetos; consulta o log global',
  Gestor: 'Conduz um projeto: lotes, upload, atribuição e exportação',
  Avaliador: 'Anota as imagens que recebeu, às cegas',
  Validador: 'Compara as análises e registra o resultado',
};

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

  const submit = async () => {
    const result = await createUser({ name, email, institution, roles });
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(`${name.trim()} cadastrado. O convite foi enviado por e-mail.`);
    setCreateOpen(false);
    setName('');
    setEmail('');
    setInstitution('');
    setRoles(['Avaliador']);
  };

  const saveRoles = async () => {
    if (!editing) return;
    const result = await updateUserRoles(editing.id, editRoles);
    showToast(result.ok ? 'Papéis atualizados.' : result.error);
    if (result.ok) setEditing(null);
  };

  const toggleActive = async (u: User) => {
    const result = await toggleUserActive(u.id);
    showToast(result.ok ? `${u.name} ${u.isActive ? 'desativado' : 'reativado'}.` : result.error);
  };

  return (
    <Screen>
      <PageHeader
        title="Usuários"
        description="Contas não são apagadas, só desativadas, para que o histórico continue completo."
        actions={<Button label="Novo usuário" icon={UserPlus} onPress={() => setCreateOpen(true)} />}
      />

      <DataTable<User>
        rows={users}
        keyOf={(u) => u.id}
        columns={[
          { key: 'n', title: 'Nome', width: 210, render: (u) => <Cell className="font-sans-medium text-[13px] text-ink">{u.name}{u.id === me?.id ? ' (você)' : ''}</Cell> },
          { key: 'e', title: 'E-mail', width: 250, render: (u) => <Cell className="font-sans text-[13px] text-ink-muted" lines={1}>{u.email}</Cell> },
          { key: 'i', title: 'Instituição', width: 220, render: (u) => <Cell className="font-sans text-[13px] text-ink-muted">{u.institution ?? '—'}</Cell> },
          {
            key: 'r',
            title: 'Papéis',
            width: 230,
            render: (u) => (
              <Cell className="font-sans text-[13px] text-ink">{u.roles.join(', ')}</Cell>
            ),
          },
          { key: 's', title: 'Conta', width: 110, render: (u) => (u.isActive ? <Cell className="font-sans text-[13px] text-ink-muted">Ativa</Cell> : <Badge label="Desativada" tone="neutral" />) },
          {
            key: 'a',
            title: 'Ações',
            width: 220,
            render: (u) => (
              <View className="flex-row gap-4">
                <Pressable onPress={() => { setEditing(u); setEditRoles(u.roles); }} className="min-h-9 justify-center">
                  <Text className="font-sans text-[13px] text-ink underline">Editar papéis</Text>
                </Pressable>
                {u.id !== me?.id ? (
                  <Pressable onPress={() => toggleActive(u)} className="min-h-9 justify-center">
                    <Text className={`font-sans text-[13px] underline ${u.isActive ? 'text-danger' : 'text-ink'}`}>{u.isActive ? 'Desativar' : 'Reativar'}</Text>
                  </Pressable>
                ) : null}
              </View>
            ),
          },
        ]}
      />

      <Dialog
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Novo usuário"
        subtitle="A pessoa recebe um e-mail para criar a própria senha."
        footer={
          <>
            <Button label="Cancelar" variant="outline" onPress={() => setCreateOpen(false)} />
            <Button label="Cadastrar" onPress={submit} disabled={!name.trim() || !email.trim() || !roles.length} />
          </>
        }
      >
        <TextField label="Nome" value={name} onChangeText={setName} />
        <TextField label="E-mail" value={email} onChangeText={setEmail} placeholder="nome@instituicao.org.br" keyboardType="email-address" autoCapitalize="none" />
        <TextField label="Instituição" hint="opcional" value={institution} onChangeText={setInstitution} />
        <View className="gap-1.5">
          <Text className="font-sans-medium text-[13px] text-ink">Papéis</Text>
          {ROLE_ORDER.map((r) => <Checkbox key={r} checked={roles.includes(r)} onChange={() => setRoles(toggleIn(roles, r))} label={r} description={ROLE_HELP[r]} />)}
        </View>
        <Text className="font-sans text-xs leading-5 text-ink-subtle">O administrador não vê nem escolhe a senha. Para entrar, a pessoa também precisa do código enviado por e-mail.</Text>
      </Dialog>

      <Dialog
        visible={!!editing}
        onClose={() => setEditing(null)}
        title="Papéis"
        subtitle={editing?.name}
        footer={
          <>
            <Button label="Cancelar" variant="outline" onPress={() => setEditing(null)} />
            <Button label="Salvar" onPress={saveRoles} disabled={!editRoles.length} />
          </>
        }
      >
        {ROLE_ORDER.map((r) => <Checkbox key={r} checked={editRoles.includes(r)} onChange={() => setEditRoles(toggleIn(editRoles, r))} label={r} description={ROLE_HELP[r]} />)}
        <Text className="font-sans text-xs text-ink-subtle">A mudança vale a partir da próxima ação da pessoa e fica no registro de atividades.</Text>
      </Dialog>
    </Screen>
  );
}
