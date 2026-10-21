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
  LogOut,
  Microscope,
  Save,
  ShieldCheck,
  Users,
  WifiOff,
} from 'lucide-react-native';
import { type ComponentRef, useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/layout/AuthShell';
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
        { label: 'Minhas imagens', icon: Layers, href: '/avaliador', match: '/avaliador' },
        ...(lastImage
          ? [
              { label: 'Anotação', icon: Microscope, href: `/avaliador/anotacao/${lastImage}` as Href, match: '/avaliador/anotacao' },
              { label: 'Versões', icon: History, href: `/avaliador/anotacao/${lastImage}?historico=1` as Href, match: '/avaliador/historico' },
              { label: 'Análise finalizada', icon: CheckCircle2, href: `/avaliador/finalizada/${lastImage}` as Href, match: '/avaliador/finalizada' },
            ]
          : []),
      ];
    case 'Validador':
      return [
        { label: 'Fila de validação', icon: ShieldCheck, href: '/validador', match: '/validador' },
        ...(lastComparison
          ? [{ label: 'Comparação', icon: Activity, href: `/validador/comparacao/${lastComparison}` as Href, match: '/validador/comparacao' }]
          : []),
      ];
    case 'Gestor':
      return [
        { label: 'Progresso', icon: Activity, href: '/gestor', match: '/gestor' },
        { label: 'Lotes', icon: FolderKanban, href: '/gestor/lotes', match: '/gestor/lotes' },
        { label: 'Atribuição', icon: Users, href: '/gestor/atribuicao', match: '/gestor/atribuicao' },
        { label: 'Análises', icon: FileSpreadsheet, href: '/gestor/exportacao', match: '/gestor/exportacao' },
        { label: 'Registro de atividades', icon: History, href: '/gestor/auditoria', match: '/gestor/auditoria' },
      ];
    case 'Admin':
      return [
        { label: 'Usuários', icon: Users, href: '/admin/usuarios', match: '/admin/usuarios' },
        { label: 'Projetos', icon: FolderKanban, href: '/admin/projetos', match: '/admin/projetos' },
        { label: 'Registro de atividades', icon: ShieldCheck, href: '/admin/auditoria', match: '/admin/auditoria' },
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
    <View style={{ paddingTop: insets.top }} className="z-40 border-b border-line bg-white">
      <View className="min-h-14 flex-row flex-wrap items-center justify-between gap-2 px-4 py-2 lg:px-6">
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.replace(roleHome(activeRole))} accessibilityRole="link" accessibilityLabel="Início" className="min-h-11 justify-center">
            <BrandMark showName={!compact} />
          </Pressable>

          {roles.length > 1 ? (
            <View className="flex-row items-center rounded-xs border border-line p-0.5">
              {roles.map((role) => (
                <Pressable
                  key={role}
                  onPress={() => changeRole(role)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeRole === role }}
                  className={`min-h-8 justify-center rounded-xs px-2.5 ${activeRole === role ? 'bg-surface-alt' : 'web:hover:bg-surface'}`}
                >
                  <Text className={`text-xs ${activeRole === role ? 'font-sans-medium text-ink' : 'font-sans text-ink-muted'}`}>{role}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View className="flex-row items-center gap-2">
          {!isOnline ? (
            <Pressable
              onPress={() => showToast('Sem conexão: o rascunho fica salvo no aparelho até a rede voltar.')}
              accessibilityLabel="Sem conexão"
              className="min-h-9 flex-row items-center gap-1.5 rounded-xs bg-warn-soft px-2.5"
            >
              <WifiOff size={14} color={colors.warning} />
              <Text className="font-sans-medium text-xs text-warn">Sem conexão</Text>
            </Pressable>
          ) : null}

          {activeRole === 'Avaliador' && onAnnotation && !editorReadOnly && !compact ? (
            <Pressable onPress={() => saveVersion()} className="min-h-9 flex-row items-center gap-1.5 rounded-xs border border-line bg-white px-3 web:hover:bg-surface">
              <Save size={14} color={colors.ink} />
              <Text className="font-sans-medium text-xs text-ink">Salvar versão {activeVersion + 1}</Text>
            </Pressable>
          ) : null}

          <View className="flex-row items-center gap-1 border-l border-line pl-2">
            <Pressable onPress={() => showToast('Cada avaliador anota sem ver o trabalho dos outros. As análises só se encontram na validação.')} accessibilityLabel="Ajuda" className="h-11 w-11 items-center justify-center rounded-xs web:hover:bg-surface">
              <HelpCircle size={16} color={colors.inkMuted} />
            </Pressable>
            <View className="h-8 w-8 items-center justify-center rounded-full bg-surface-alt">
              <Text className="font-sans-medium text-xs text-ink">{user.name.replace(/^(Dra?\.)\s*/, '').substring(0, 2).toUpperCase()}</Text>
            </View>
            {width >= 900 ? (
              <View className="ml-1">
                <Text numberOfLines={1} className="max-w-[160px] font-sans-medium text-xs text-ink">{user.name}</Text>
                <Text className="font-sans text-[11px] text-ink-subtle">{activeRole}</Text>
              </View>
            ) : null}
            <Pressable
              onPress={async () => {
                await logout();
                router.replace('/login');
              }}
              accessibilityLabel="Sair"
              className="h-11 w-11 items-center justify-center rounded-xs web:hover:bg-surface"
            >
              <LogOut size={16} color={colors.inkMuted} />
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
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} className="bg-white" contentContainerClassName="h-10 items-center gap-6 px-4 lg:px-6">
      {items.map((item) => {
        const active = item.label === activeLabel;
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
            className={`h-10 justify-center border-b-2 ${active ? 'border-ink' : 'border-transparent'}`}
          >
            <Text className={`text-[13px] ${active ? 'font-sans-medium text-ink' : 'font-sans text-ink-muted'}`}>{item.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
