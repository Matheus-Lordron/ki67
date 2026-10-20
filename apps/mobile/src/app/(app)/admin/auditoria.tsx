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
    <Screen>
      <PageHeader
        title="Log de Auditoria Global do Sistema"
        badge="SOMENTE-INCLUSÃO"
        badgeTone="success"
        description="Registro contínuo de autenticações, anotações, validações, uploads, atribuições e mudanças de usuário."
      />
      <AuditLogView logs={logs} users={users} images={images} />
    </Screen>
  );
}
