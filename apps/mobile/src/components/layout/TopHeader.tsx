import { type Href, router, usePathname } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  Activity,
  CheckCircle2,
  FileSpreadsheet,
  FolderKanban,
  HelpCircle,
  History,
  Layers,
  Lock,
  LogOut,
  Microscope,
  Save,
  ShieldCheck,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react-native';
import { type ComponentRef, useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ROLE_ORDER, roleHome, useAppStore } from '@/state/appStore';
import { useEditorStore } from '@/state/editorStore';
import { colors } from '@/theme/colors';
import type { UserRole } from '@/types';

interface NavItem {
  label: string;
  icon: LucideIcon;
  href: Href;
  /** Prefixo da rota que deixa o item ativo. */
  match: string;
}

function navFor(role: UserRole, lastImage: string | null, lastComparison: string | null): NavItem[] {
  switch (role) {
    case 'Avaliador':
      return [
        { label: 'Minha Fila de Imagens', icon: Layers, href: '/avaliador', match: '/avaliador' },
        ...(lastImage
          ? [
              { label: 'Tela de Anotação Ki-67', icon: Microscope, href: `/avaliador/anotacao/${lastImage}` as Href, match: '/avaliador/anotacao' },
              { label: 'Histórico de Versões', icon: History, href: `/avaliador/anotacao/${lastImage}?historico=1` as Href, match: '/avaliador/historico' },
              { label: 'Análise Finalizada', icon: CheckCircle2, href: `/avaliador/finalizada/${lastImage}` as Href, match: '/avaliador/finalizada' },
            ]
          : []),
      ];
    case 'Validador':
      return [
        { label: 'Fila de Validação', icon: ShieldCheck, href: '/validador', match: '/validador' },
        ...(lastComparison
          ? [{ label: 'Comparação Cega & Métricas', icon: Activity, href: `/validador/comparacao/${lastComparison}` as Href, match: '/validador/comparacao' }]
          : []),
      ];
    case 'Gestor':
      return [
        { label: 'Dashboard de Progresso', icon: Activity, href: '/gestor', match: '/gestor' },
        { label: 'Lotes & Upload (até 50 MB)', icon: FolderKanban, href: '/gestor/lotes', match: '/gestor/lotes' },
        { label: 'Atribuição a Avaliadores', icon: Users, href: '/gestor/atribuicao', match: '/gestor/atribuicao' },
        { label: 'Análises & Exportação', icon: FileSpreadsheet, href: '/gestor/exportacao', match: '/gestor/exportacao' },
        { label: 'Auditoria do Projeto', icon: History, href: '/gestor/auditoria', match: '/gestor/auditoria' },
      ];
    case 'Admin':
      return [
        { label: 'Usuários & Papéis', icon: Users, href: '/admin/usuarios', match: '/admin/usuarios' },
        { label: 'Projetos & Gestores', icon: FolderKanban, href: '/admin/projetos', match: '/admin/projetos' },
        { label: 'Log Global Imutável', icon: ShieldCheck, href: '/admin/auditoria', match: '/admin/auditoria' },
      ];
  }
}

export function TopHeader() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const user = useAppStore((s) => s.currentUser);
  const activeRole = useAppStore((s) => s.activeRole);
  const isOnline = useAppStore((s) => s.isOnline);
  const lastImage = useAppStore((s) => s.lastAnnotationImageId);
  const lastComparison = useAppStore((s) => s.lastComparisonImageId);
  const setActiveRole = useAppStore((s) => s.setActiveRole);
  const showToast = useAppStore((s) => s.showToast);
  const logout = useAppStore((s) => s.logout);
  const activeVersion = useEditorStore((s) => s.activeVersion);
  const editorReadOnly = useEditorStore((s) => s.readOnly);
  const saveVersion = useEditorStore((s) => s.save);

  if (!user) return null;
  const compact = width < 768;
  const roles = ROLE_ORDER.filter((r) => user.roles.includes(r));
  const items = navFor(activeRole, lastImage, lastComparison);
  const onAnnotation = pathname.startsWith('/avaliador/anotacao');
  // O item mais específico que casa com a rota atual fica ativo.
  const activeItem = items.filter((i) => pathname === i.match || pathname.startsWith(`${i.match}/`)).sort((a, b) => b.match.length - a.match.length)[0];

  const changeRole = (role: UserRole) => {
    if (role === activeRole) return;
    setActiveRole(role);
    showToast(`Papel alterado para: ${role}`);
    router.replace(roleHome(role));
  };

  return (
    <View style={{ paddingTop: insets.top }} className="z-40 border-b border-line bg-white shadow-xs">
      <View className="min-h-14 flex-row flex-wrap items-center justify-between gap-2 px-4 py-2 lg:px-6">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.replace(roleHome(activeRole))} accessibilityRole="link" accessibilityLabel="Início" className="flex-row items-center gap-2.5">
            <View className="h-9 w-9 items-center justify-center rounded-xs bg-primary">
              <Microscope size={20} color={colors.white} />
            </View>
            {!compact ? (
              <View>
                <View className="flex-row items-center gap-1.5">
                  <Text className="font-sans-bold text-base tracking-tight text-primary">Segmenta Studio</Text>
                  <Text className="rounded-xs bg-primary-soft px-1.5 font-mono-bold text-[10px] text-primary">IHC Ki-67</Text>
                </View>
                <Text className="font-mono text-[10px] text-ink-subtle">MÓDULO DE QUANTIFICAÇÃO NUCLEAR</Text>
              </View>
            ) : null}
          </Pressable>

          {roles.length > 1 ? (
            <View className="flex-row items-center rounded-xs border border-line bg-surface-alt p-0.5">
              {!compact ? <Text className="px-2 font-sans-medium text-[11px] text-ink-muted">Papel:</Text> : null}
              {roles.map((role) => (
                <Pressable
                  key={role}
                  onPress={() => changeRole(role)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeRole === role }}
                  className={`min-h-8 justify-center rounded-xs px-2.5 ${activeRole === role ? 'bg-primary' : 'web:hover:bg-primary-soft'}`}
                >
                  <Text className={`text-[11px] ${activeRole === role ? 'font-sans-semibold text-white' : 'font-sans-medium text-ink-muted'}`}>{role}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {width >= 1280 ? (
            <View className="flex-row items-center gap-1.5 rounded-xs border border-line bg-surface-alt px-2.5 py-1">
              <Lock size={14} color={colors.primary} />
              <Text className="font-mono-bold text-[11px] text-primary">Sessão cega · {activeRole}</Text>
            </View>
          ) : null}
        </View>

        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => showToast(isOnline ? 'Conectado ao servidor.' : 'Sem conexão: o rascunho fica salvo no aparelho até a rede voltar.')}
            accessibilityLabel={isOnline ? 'Online' : 'Offline'}
            className={`flex-row items-center gap-1.5 rounded-xs border px-2.5 py-1 ${isOnline ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-100'}`}
          >
            {isOnline ? <Wifi size={14} color="#059669" /> : <WifiOff size={14} color="#b45309" />}
            {!compact || !isOnline ? (
              <Text className={`font-mono text-[11px] ${isOnline ? 'text-emerald-800' : 'font-mono-bold text-amber-900'}`}>{isOnline ? 'Online' : 'Offline (Local)'}</Text>
            ) : null}
          </Pressable>

          {activeRole === 'Avaliador' && onAnnotation && !editorReadOnly && !compact ? (
            <Pressable onPress={() => saveVersion()} className="min-h-9 flex-row items-center gap-1.5 rounded-xs border border-line bg-white px-3 web:hover:bg-surface-alt">
              <Save size={14} color={colors.primary} />
              <Text className="font-sans-semibold text-xs text-ink">Salvar Versão (v{activeVersion + 1})</Text>
            </Pressable>
          ) : null}

          <View className="flex-row items-center gap-1 border-l border-line pl-2">
            <Pressable onPress={() => showToast('Protocolo duplo-cego ativo: nenhum avaliador vê o trabalho de outro.')} accessibilityLabel="Ajuda" className="h-11 w-11 items-center justify-center rounded-xs web:hover:bg-surface-alt">
              <HelpCircle size={16} color={colors.inkSubtle} />
            </Pressable>
            <View className="h-8 w-8 items-center justify-center rounded-full bg-primary-dark">
              <Text className="font-sans-bold text-xs text-white">{user.name.replace(/^(Dra?\.)\s*/, '').substring(0, 2).toUpperCase()}</Text>
            </View>
            {width >= 900 ? (
              <View className="ml-1">
                <Text numberOfLines={1} className="max-w-[130px] font-sans-semibold text-xs text-ink">{user.name}</Text>
                <Text className="font-mono text-[10px] text-ink-subtle">{activeRole}</Text>
              </View>
            ) : null}
            <Pressable
              onPress={async () => {
                await logout();
                router.replace('/login');
              }}
              accessibilityLabel="Sair da plataforma"
              className="h-11 w-11 items-center justify-center rounded-xs web:hover:bg-rose-50"
            >
              <LogOut size={16} color={colors.danger} />
            </Pressable>
          </View>
        </View>
      </View>

      <NavTabs items={items} activeLabel={activeItem?.label} />
    </View>
  );
}

/** Faixa de abas do papel. No celular ela rola de lado e mantém a aba ativa à vista. */
function NavTabs({ items, activeLabel }: { items: NavItem[]; activeLabel?: string }) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const tabX = useRef<Record<string, number>>({});
  const scrollToActive = (label?: string) => {
    const x = label ? tabX.current[label] : undefined;
    if (x !== undefined) scrollRef.current?.scrollTo({ x: Math.max(0, x - 16), animated: false });
  };

  useEffect(() => {
    scrollToActive(activeLabel);
  }, [activeLabel]);

  return (
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} className="border-t border-surface-alt bg-surface" contentContainerClassName="h-10 items-center gap-5 px-4 lg:px-6">
      {items.map((item) => {
        const active = item.label === activeLabel;
        const Icon = item.icon;
        return (
          <Pressable
            key={item.label}
            onPress={() => router.push(item.href)}
            onLayout={(e) => {
              tabX.current[item.label] = e.nativeEvent.layout.x;
              if (active) scrollToActive(item.label);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={`h-10 flex-row items-center gap-1.5 border-b-2 ${active ? 'border-primary' : 'border-transparent'}`}
          >
            <Icon size={14} color={active ? colors.primary : colors.inkMuted} />
            <Text className={`text-xs ${active ? 'font-sans-semibold text-primary' : 'font-sans-medium text-ink-muted'}`}>{item.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
