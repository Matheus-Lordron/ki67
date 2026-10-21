import { ChevronLeft, ChevronRight, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Cell, DataTable } from '@/components/ui/DataTable';
import { TextField } from '@/components/ui/Field';
import { Grid } from '@/components/ui/Grid';
import { Select } from '@/components/ui/Select';
import { colors } from '@/theme/colors';
import type { AuditLog, ImageItem, User } from '@/types';

const PAGE_SIZE = 10;
const CATEGORY_LABEL: Record<AuditLog['category'], string> = {
  auth: 'Autenticação',
  annotation: 'Anotação e versões',
  validation: 'Validação',
  batch: 'Lotes e imagens',
  user_management: 'Usuários',
  security: 'Segurança',
  export: 'Exportação',
};

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Consulta do log somente-inclusão (RF-39): filtros por usuário, imagem, período
 * e categoria, com paginação. A tela não oferece editar nem excluir nada.
 */
export function AuditLogView({ logs, users, images }: { logs: AuditLog[]; users: User[]; images: ImageItem[] }) {
  const [userId, setUserId] = useState('all');
  const [imageId, setImageId] = useState('all');
  const [category, setCategory] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (userId !== 'all' && l.userId !== userId) return false;
      if (imageId !== 'all' && l.imageId !== imageId) return false;
      if (category !== 'all' && l.category !== category) return false;
      if (isDate(from) && new Date(l.timestamp) < new Date(`${from}T00:00:00`)) return false;
      if (isDate(to) && new Date(l.timestamp) > new Date(`${to}T23:59:59`)) return false;
      return !term || [l.action, l.userName, l.details ?? ''].some((t) => t.toLowerCase().includes(term));
    });
  }, [logs, userId, imageId, category, from, to, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <View className="gap-6">
      <Text className="font-sans text-[13px] leading-5 text-ink-muted">
        Nenhum registro pode ser alterado ou apagado, nem pelo administrador. Cada um guarda o resumo criptográfico do anterior, então uma alteração quebraria a sequência.
      </Text>

      <View className="gap-3">
        <Grid cols={{ base: 1, sm: 2, lg: 3 }} gap={12}>
          <Select label="Usuário" value={userId} onChange={reset(setUserId)} options={[{ value: 'all', label: 'Todos os usuários' }, ...users.map((u) => ({ value: u.id, label: u.name, description: u.roles.join(', ') }))]} />
          <Select label="Imagem" value={imageId} onChange={reset(setImageId)} options={[{ value: 'all', label: 'Todas as imagens' }, ...images.map((i) => ({ value: i.id, label: i.code, description: i.organ }))]} />
          <Select label="Categoria" value={category} onChange={reset(setCategory)} options={[{ value: 'all', label: 'Todas as categorias' }, ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))]} />
          <TextField label="De" hint="AAAA-MM-DD" value={from} onChangeText={reset(setFrom)} placeholder="2026-10-01" mono />
          <TextField label="Até" hint="AAAA-MM-DD" value={to} onChangeText={reset(setTo)} placeholder="2026-10-31" mono />
          <TextField label="Busca" icon={Search} value={search} onChangeText={reset(setSearch)} placeholder="Ação, usuário ou detalhe" />
        </Grid>
      </View>

      <View className="gap-0">
        <DataTable<AuditLog>
          rows={rows}
          keyOf={(l) => l.id}
          empty="Nenhum registro encontrado para os filtros selecionados."
          columns={[
            { key: 'dt', title: 'Quando', width: 140, render: (l) => <Cell className="font-sans text-xs text-ink-muted">{new Date(l.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</Cell> },
            { key: 'u', title: 'Usuário', width: 180, render: (l) => <Cell className="font-sans text-[13px] text-ink">{l.userName}</Cell> },
            {
              key: 'a',
              title: 'Ação',
              width: 300,
              render: (l) => (
                <View>
                  <Cell className="font-mono text-xs text-ink">{l.action}</Cell>
                  {l.details ? <Cell className="font-sans text-xs text-ink-muted" lines={2}>{l.details}</Cell> : null}
                </View>
              ),
            },
            { key: 'c', title: 'Categoria', width: 140, render: (l) => <Cell className="font-sans text-xs text-ink-muted">{CATEGORY_LABEL[l.category]}</Cell> },
            {
              key: 'ip',
              title: 'IP e dispositivo',
              width: 220,
              render: (l) => (
                <View>
                  <Cell className="font-mono text-xs text-ink-muted">{l.ipAddress}</Cell>
                  <Cell className="font-sans text-xs text-ink-subtle" lines={1}>{l.device}</Cell>
                </View>
              ),
            },
            { key: 'h', title: 'Resumo (SHA-256)', width: 150, render: (l) => <Cell className="font-mono text-[11px] text-ink-subtle" lines={1}>{l.hashSHA256}</Cell> },
          ]}
        />
        <View className="flex-row flex-wrap items-center justify-between gap-2 pt-3">
          <Text className="font-sans text-xs text-ink-muted">
            {filtered.length ? `${(current - 1) * PAGE_SIZE + 1}–${Math.min(current * PAGE_SIZE, filtered.length)} de ${filtered.length}` : 'Nenhum registro'}
          </Text>
          <View className="flex-row items-center gap-2">
            <Pressable disabled={current <= 1} onPress={() => setPage(current - 1)} accessibilityLabel="Página anterior" className={`h-9 w-9 items-center justify-center rounded-xs border border-line ${current <= 1 ? 'opacity-40' : 'web:hover:bg-white'}`}>
              <ChevronLeft size={16} color={colors.ink} />
            </Pressable>
            <Text className="px-2 font-sans text-xs text-ink-muted">Página {current} de {pages}</Text>
            <Pressable disabled={current >= pages} onPress={() => setPage(current + 1)} accessibilityLabel="Próxima página" className={`h-9 w-9 items-center justify-center rounded-xs border border-line ${current >= pages ? 'opacity-40' : 'web:hover:bg-white'}`}>
              <ChevronRight size={16} color={colors.ink} />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
