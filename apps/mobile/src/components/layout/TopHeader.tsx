import { type Href, router, useGlobalSearchParams, usePathname } from 'expo-router';
import { WifiOff } from 'lucide-react-native';
import { type ComponentRef, useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/layout/AuthShell';
import { ROLE_ORDER, roleHome, useAppStore } from '@/state/appStore';
import type { UserRole } from '@/types';

interface NavItem {
  label: string;
  href: Href;
  active: boolean;
}

const ROLE_AVATAR: Record<UserRole, string> = {
  Admin: 'AD',
  Gestor: 'GE',
  Validador: 'VA',
  Avaliador: 'AV',
};

const ROLE_DISPLAY: Record<UserRole, string> = {
  Admin: 'Administrador',
  Gestor: 'Gestor',
  Validador: 'Validador',
  Avaliador: 'Avaliador',
};

function navFor(
  role: UserRole,
  pathname: string,
  historicoParam: string | undefined,
  targetAnnotationImage: string | null,
  targetComparisonImage: string | null,
): NavItem[] {
  switch (role) {
    case 'Avaliador': {
      const onAnnotation = pathname.startsWith('/avaliador/anotacao') || pathname.startsWith('/avaliador/finalizada');
      const onHistory = pathname.startsWith('/avaliador/anotacao') && historicoParam === '1';
      return [
        { label: 'Minha fila', href: '/avaliador', active: pathname === '/avaliador' },
        {
          label: 'Anotação',
          href: (targetAnnotationImage ? `/avaliador/anotacao/${targetAnnotationImage}` : '/avaliador') as Href,
          active: onAnnotation && !onHistory,
        },
        {
          label: 'Histórico',
          href: (targetAnnotationImage ? `/avaliador/anotacao/${targetAnnotationImage}?historico=1` : '/avaliador') as Href,
          active: onHistory,
        },
      ];
    }
    case 'Validador':
      return [
        { label: 'Fila de validação', href: '/validador', active: pathname === '/validador' },
        {
          label: 'Comparação',
          href: (targetComparisonImage ? `/validador/comparacao/${targetComparisonImage}` : '/validador') as Href,
          active: pathname.startsWith('/validador/comparacao'),
        },
      ];
    case 'Gestor':
      return [
        { label: 'Progresso', href: '/gestor', active: pathname === '/gestor' },
        { label: 'Lotes', href: '/gestor/lotes', active: pathname.startsWith('/gestor/lotes') },
        { label: 'Atribuição', href: '/gestor/atribuicao', active: pathname.startsWith('/gestor/atribuicao') },
        { label: 'Análises', href: '/gestor/exportacao', active: pathname.startsWith('/gestor/exportacao') },
        { label: 'Auditoria', href: '/gestor/auditoria', active: pathname.startsWith('/gestor/auditoria') },
      ];
    case 'Admin':
      return [
        { label: 'Usuários', href: '/admin/usuarios', active: pathname.startsWith('/admin/usuarios') },
        { label: 'Projetos', href: '/admin/projetos', active: pathname.startsWith('/admin/projetos') },
        { label: 'Log', href: '/admin/auditoria', active: pathname.startsWith('/admin/auditoria') },
      ];
  }
}

export function TopHeader() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ historico?: string }>();
  const user = useAppStore((s) => s.currentUser);
  const activeRole = useAppStore((s) => s.activeRole);
  const isOnline = useAppStore((s) => s.isOnline);
  const images = useAppStore((s) => s.images);
  const lastImage = useAppStore((s) => s.lastAnnotationImageId);
  const lastComparison = useAppStore((s) => s.lastComparisonImageId);
  const setActiveRole = useAppStore((s) => s.setActiveRole);
  const showToast = useAppStore((s) => s.showToast);
  const logout = useAppStore((s) => s.logout);

  if (!user) return null;

  const compact = width < 640;
  const roles = ROLE_ORDER.filter((r) => user.roles.includes(r));
  const fallbackAssigned = images.find((i) => i.assignedEvaluatorIds.includes(user.id))?.id ?? null;
  const fallbackReady = images.find((i) => (i.status === 'pronta_para_validacao' || i.status === 'validada') && !i.assignedEvaluatorIds.includes(user.id))?.id ?? null;
  const items = navFor(activeRole, pathname, params.historico, lastImage ?? fallbackAssigned, lastComparison ?? fallbackReady);

  const changeRole = (role: UserRole) => {
    if (role === activeRole) return;
    setActiveRole(role);
    showToast(`Papel alterado: ${role}`);
    router.replace(roleHome(role));
  };

  return (
    <View style={{ paddingTop: insets.top }} className="z-40 border-b border-line bg-white shadow-xs">
      <View className="min-h-[69px] flex-row flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-12">
        <View className="flex-1 flex-row flex-wrap items-center gap-4 lg:gap-10">
          <Pressable
            onPress={() => router.replace(roleHome(activeRole))}
            accessibilityRole="link"
            accessibilityLabel="Início"
            className="min-h-10 flex-row items-center"
          >
            <BrandLogo compact={width < 400} />
          </Pressable>

          <NavTabs items={items} />
        </View>

        <View className="flex-row items-center gap-3">
          {!isOnline ? (
            <Pressable
              onPress={() => showToast('Sem conexão: o rascunho fica salvo no aparelho até a rede voltar.')}
              accessibilityLabel="Offline"
              className="flex-row items-center gap-1.5 rounded-[8px] border border-amber-300 bg-amber-50 px-2.5 py-1.5"
            >
              <WifiOff size={14} color="#b45309" />
              <Text className="font-sans-semibold text-[12px] text-amber-900">Offline</Text>
            </Pressable>
          ) : null}

          {roles.length > 1 ? (
            <View className="flex-row items-center rounded-[10px] bg-surface-alt p-1">
              {roles.map((role) => (
                <Pressable
                  key={role}
                  onPress={() => changeRole(role)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeRole === role }}
                  className={`min-h-8 justify-center rounded-[7px] px-2.5 ${activeRole === role ? 'bg-primary' : 'web:hover:bg-white/60'}`}
                >
                  <Text className={`text-[12px] ${activeRole === role ? 'font-sans-bold text-white' : 'font-sans-semibold text-ink-muted'}`}>
                    {role}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View className="flex-row items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-primary">
              <Text className="font-sans-bold text-[13px] text-white">{ROLE_AVATAR[activeRole]}</Text>
            </View>
            {!compact ? (
              <Text numberOfLines={1} className="font-sans-semibold text-[14px] text-ink">
                {ROLE_DISPLAY[activeRole]}
              </Text>
            ) : null}
            <Pressable
              onPress={async () => {
                await logout();
                router.replace('/login');
              }}
              accessibilityRole="button"
              accessibilityLabel="Sair"
              className="h-9 items-center justify-center rounded-[8px] px-3 web:hover:bg-surface-alt"
            >
              <Text className="font-sans-semibold text-[14px] text-ink-muted">Sair</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function NavTabs({ items }: { items: NavItem[] }) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const tabX = useRef<Record<string, number>>({});
  const activeLabel = items.find((i) => i.active)?.label;

  const scrollToActive = (label?: string) => {
    const x = label ? tabX.current[label] : undefined;
    if (x !== undefined) scrollRef.current?.scrollTo({ x: Math.max(0, x - 16), animated: false });
  };

  useEffect(() => {
    scrollToActive(activeLabel);
  }, [activeLabel]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="items-center gap-1"
    >
      {items.map((item) => (
        <Pressable
          key={item.label}
          onPress={() => router.push(item.href)}
          onLayout={(e) => {
            tabX.current[item.label] = e.nativeEvent.layout.x;
            if (item.active) scrollToActive(item.label);
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: item.active }}
          className={`h-10 items-center justify-center rounded-[8px] px-3.5 ${
            item.active ? 'bg-surface-alt' : 'web:hover:bg-surface-subtle'
          }`}
        >
          <Text className={`text-[14px] ${item.active ? 'font-sans-bold text-primary' : 'font-sans-semibold text-ink-muted'}`}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
