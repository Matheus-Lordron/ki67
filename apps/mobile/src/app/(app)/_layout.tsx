import { Redirect, Stack, useSegments } from 'expo-router';
import { View } from 'react-native';

import { TopHeader } from '@/components/layout/TopHeader';
import { useIdleLogout } from '@/features/sessao/useIdleLogout';
import { roleHome, useAppStore } from '@/state/appStore';
import type { UserRole } from '@/types';

const SECTION_ROLE: Record<string, UserRole> = {
  avaliador: 'Avaliador',
  validador: 'Validador',
  gestor: 'Gestor',
  admin: 'Admin',
};

/**
 * Guarda das telas logadas. É conveniência de navegação: quem bloqueia de
 * verdade é o RLS do banco (RF-28).
 */
export default function AppLayout() {
  const user = useAppStore((s) => s.currentUser);
  const activeRole = useAppStore((s) => s.activeRole);
  const segments = useSegments() as string[];
  const markActivity = useIdleLogout();

  if (!user) return <Redirect href="/login" />;

  const sectionRole = SECTION_ROLE[segments[1] ?? ''];
  if (sectionRole && (!user.roles.includes(sectionRole) || sectionRole !== activeRole)) {
    return <Redirect href={roleHome(user.roles.includes(activeRole) ? activeRole : user.roles[0])} />;
  }

  return (
    <View className="flex-1 bg-surface" onTouchStart={markActivity}>
      <TopHeader />
      <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: '#f8f9ff' } }} />
    </View>
  );
}
