import { PageHeader } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { AuditLogView } from '@/features/auditoria/AuditLogView';
import { useAppStore } from '@/state/appStore';

// Log global do sistema (RF-39): só o administrador.
export default function SystemAuditScreen() {
  const logs = useAppStore((s) => s.auditLogs);
  const users = useAppStore((s) => s.users);
  const images = useAppStore((s) => s.images);
  return (
    <Screen maxWidth={1024}>
      <PageHeader
        title="Log"
        description="Registro de acessos, anotações, validações, uploads e mudanças de usuário."
      />
      <AuditLogView logs={logs} users={users} images={images} />
    </Screen>
  );
}
