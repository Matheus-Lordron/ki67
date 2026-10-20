import { Redirect } from 'expo-router';

import { roleHome, useAppStore } from '@/state/appStore';

// Abrir o app: sem sessão vai para o login; com sessão, para a tela do papel ativo.
export default function Index() {
  const user = useAppStore((s) => s.currentUser);
  const role = useAppStore((s) => s.activeRole);
  return <Redirect href={user ? roleHome(role) : '/login'} />;
}
