import { Calendar } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Cell, DataTable, PaginationBar } from '@/components/ui/DataTable';
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
  user_management: 'Gestão de usuários',
  security: 'Segurança',
  export: 'Exportação',
};

function parseFilterDate(v: string): string | null {
  const trimmed = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

/**
 * Consulta do log somente-inclusão (RF-39): filtros por usuário, lâmina, período
 * e categoria, com paginação numerada no padrão do Figma.
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
    const fromIso = parseFilterDate(from);
    const toIso = parseFilterDate(to);
    return logs.filter((l) => {
      if (userId !== 'all' && l.userId !== userId) return false;
      if (imageId !== 'all' && l.imageId !== imageId) return false;
      if (category !== 'all' && l.category !== category) return false;
      if (fromIso && new Date(l.timestamp) < new Date(`${fromIso}T00:00:00`)) return false;
      if (toIso && new Date(l.timestamp) > new Date(`${toIso}T23:59:59`)) return false;
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

  const userEmailById = useMemo(() => new Map(users.map((u) => [u.id, u.email])), [users]);

  return (
    <View className="gap-8">
      <Grid cols={{ base: 1, sm: 2, lg: 3 }} gap={24}>
        <Select
          label="Usuário"
          value={userId}
          onChange={reset(setUserId)}
          options={[
            { value: 'all', label: 'Todos os usuários' },
            ...users.map((u) => ({ value: u.id, label: u.email, description: u.name })),
          ]}
        />
        <Select
          label="Lâmina"
          value={imageId}
          onChange={reset(setImageId)}
          options={[
            { value: 'all', label: 'Todas as lâminas' },
            ...images.map((i) => ({ value: i.id, label: i.code, description: i.organ })),
          ]}
        />
        <Select
          label="Categoria"
          value={category}
          onChange={reset(setCategory)}
          options={[
            { value: 'all', label: 'Todas as categorias' },
            ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label })),
          ]}
        />
        <TextField
          label="Data inicial"
          value={from}
          onChangeText={reset(setFrom)}
          placeholder="DD/MM/AAAA"
          right={
            <View className="pr-2.5" pointerEvents="none">
              <Calendar size={16} color={colors.ink} />
            </View>
          }
        />
        <TextField
          label="Data final"
          value={to}
          onChangeText={reset(setTo)}
          placeholder="DD/MM/AAAA"
          right={
            <View className="pr-2.5" pointerEvents="none">
              <Calendar size={16} color={colors.ink} />
            </View>
          }
        />
        <TextField
          label="Busca"
          value={search}
          onChangeText={reset(setSearch)}
          placeholder="Ação, usuário ou detalhe"
        />
      </Grid>

      <DataTable<AuditLog>
        rows={rows}
        keyOf={(l) => l.id}
        empty="Nenhum registro encontrado para os filtros selecionados."
        columns={[
          {
            key: 'dt',
            title: 'Data e hora',
            width: 110,
            render: (l) => {
              const dt = new Date(l.timestamp);
              return (
                <View className="gap-0.5">
                  <Text className="font-sans-semibold text-[14px] text-ink">{dt.toLocaleDateString('pt-BR')}</Text>
                  <Text className="font-sans text-[13px] text-ink-muted">{dt.toLocaleTimeString('pt-BR')}</Text>
                </View>
              );
            },
          },
          {
            key: 'u',
            title: 'Usuário',
            width: 280,
            render: (l) => (
              <Cell className="font-sans-semibold text-[14px] text-ink" lines={1}>
                {(l.userId ? userEmailById.get(l.userId) : undefined) ?? l.userName}
              </Cell>
            ),
          },
          {
            key: 'a',
            title: 'Ação',
            width: 190,
            render: (l) => (
              <View className="gap-0.5">
                <Cell className="font-sans-bold text-[14px] text-ink">{l.action}</Cell>
                {l.details ? (
                  <Cell className="font-sans text-[13px] text-ink-muted" lines={2}>
                    {l.details}
                  </Cell>
                ) : null}
              </View>
            ),
          },
          {
            key: 'c',
            title: 'Categoria',
            width: 160,
            render: (l) => <Cell className="font-sans text-[14px] text-ink">{CATEGORY_LABEL[l.category]}</Cell>,
          },
          {
            key: 'ip',
            title: 'IP e dispositivo',
            width: 190,
            render: (l) => (
              <View className="gap-0.5">
                <Cell className="font-sans-semibold text-[14px] text-ink">{l.ipAddress}</Cell>
                <Cell className="font-sans text-[13px] text-ink-muted" lines={1}>
                  {l.device}
                </Cell>
              </View>
            ),
          },
          {
            key: 'h',
            title: 'Hash',
            width: 120,
            render: (l) => (
              <Cell className="font-sans text-[13px] text-ink-muted" lines={1}>
                {l.hashSHA256.length > 12 ? `${l.hashSHA256.slice(0, 12)}…` : l.hashSHA256}
              </Cell>
            ),
          },
        ]}
      />

      <PaginationBar page={current} pages={pages} onPageChange={setPage} />
    </View>
  );
}
