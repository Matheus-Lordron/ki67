import { CheckCircle2, Info, ShieldCheck, UserPlus, XCircle } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Badge, Callout, PageHeader } from '@/components/ui/Card';
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
    showToast(`${name.trim()} cadastrado. Convite enviado por e-mail.`);
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
        title="Gerenciamento de Usuários Institucionais"
        badge="RBAC MULTIPAPÉIS"
        description="Cadastre avaliadores, validadores e gestores. Para preservar o histórico, contas não são excluídas, apenas desativadas."
        actions={<Button label="Cadastrar novo usuário" icon={UserPlus} onPress={() => setCreateOpen(true)} />}
      />

      <DataTable<User>
        rows={users}
        keyOf={(u) => u.id}
        columns={[
          { key: 'n', title: 'Nome', width: 210, render: (u) => <Cell className="font-sans-semibold text-xs text-primary">{u.name}{u.id === me?.id ? ' (você)' : ''}</Cell> },
          { key: 'e', title: 'E-mail institucional', width: 250, render: (u) => <Cell className="font-mono text-xs text-ink-muted" lines={1}>{u.email}</Cell> },
          { key: 'i', title: 'Instituição', width: 220, render: (u) => <Cell className="font-sans text-xs text-ink-subtle">{u.institution ?? '—'}</Cell> },
          {
            key: 'r',
            title: 'Papéis',
            width: 230,
            render: (u) => (
              <View className="flex-row flex-wrap gap-1">
                {u.roles.map((r) => <Badge key={r} label={r} />)}
              </View>
            ),
          },
          { key: 's', title: 'Status', width: 100, render: (u) => (u.isActive ? <Badge label="Ativo" tone="success" icon={CheckCircle2} /> : <Badge label="Inativo" tone="neutral" icon={XCircle} />) },
          {
            key: 'a',
            title: 'Ações',
            width: 220,
            render: (u) => (
              <View className="flex-row gap-2">
                <Pressable onPress={() => { setEditing(u); setEditRoles(u.roles); }} className="min-h-9 justify-center rounded-xs border border-line bg-white px-3 web:hover:bg-surface-alt">
                  <Text className="font-mono-bold text-[11px] text-primary">Papéis</Text>
                </Pressable>
                <Pressable
                  onPress={() => toggleActive(u)}
                  disabled={u.id === me?.id}
                  className={`min-h-9 justify-center rounded-xs border px-3 ${u.isActive ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'} ${u.id === me?.id ? 'opacity-40' : ''}`}
                >
                  <Text className={`font-mono-bold text-[11px] ${u.isActive ? 'text-amber-900' : 'text-emerald-900'}`}>{u.isActive ? 'Desativar' : 'Reativar'}</Text>
                </Pressable>
              </View>
            ),
          },
        ]}
      />

      <Dialog
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Cadastrar usuário institucional"
        subtitle="Dados e papéis de acesso"
        icon={UserPlus}
        footer={
          <>
            <Button label="Cancelar" variant="outline" onPress={() => setCreateOpen(false)} />
            <Button label="Cadastrar e enviar convite" onPress={submit} disabled={!name.trim() || !email.trim() || !roles.length} />
          </>
        }
      >
        <TextField label="Nome completo *" value={name} onChangeText={setName} placeholder="Ex.: Dra. Mariana Vasconcelos" />
        <TextField label="E-mail institucional *" value={email} onChangeText={setEmail} placeholder="mariana@hospital.org.br" keyboardType="email-address" autoCapitalize="none" />
        <TextField label="Instituição / hospital" value={institution} onChangeText={setInstitution} placeholder="Ex.: Instituto do Câncer - SP" />
        <View className="gap-1.5">
          <Text className="font-sans-semibold text-xs text-ink">Papéis de acesso (um ou mais):</Text>
          {ROLE_ORDER.map((r) => <Checkbox key={r} checked={roles.includes(r)} onChange={() => setRoles(toggleIn(roles, r))} label={r} description={ROLE_HELP[r]} />)}
        </View>
        <Callout tone="info" icon={Info} title="O administrador nunca vê nem escolhe a senha">
          O novo usuário recebe um e-mail com um link temporário para criar a própria senha. O acesso exige o código 2FA enviado por e-mail.
        </Callout>
      </Dialog>

      <Dialog
        visible={!!editing}
        onClose={() => setEditing(null)}
        title="Papéis de acesso"
        subtitle={editing?.name}
        icon={ShieldCheck}
        footer={
          <>
            <Button label="Cancelar" variant="outline" onPress={() => setEditing(null)} />
            <Button label="Salvar papéis" onPress={saveRoles} disabled={!editRoles.length} />
          </>
        }
      >
        {ROLE_ORDER.map((r) => <Checkbox key={r} checked={editRoles.includes(r)} onChange={() => setEditRoles(toggleIn(editRoles, r))} label={r} description={ROLE_HELP[r]} />)}
        <Text className="font-sans text-[11px] text-ink-subtle">A mudança vale na próxima ação do usuário e fica registrada no log (RF-07).</Text>
      </Dialog>
    </Screen>
  );
}
