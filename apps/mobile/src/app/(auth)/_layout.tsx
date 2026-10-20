import { Redirect, Stack } from 'expo-router';

import { roleHome, useAppStore } from '@/state/appStore';

export default function AuthLayout() {
  const user = useAppStore((s) => s.currentUser);
  const role = useAppStore((s) => s.activeRole);
  // Quem já entrou não volta para as telas públicas.
  if (user) return <Redirect href={roleHome(role)} />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f8f9ff' } }} />;
}
