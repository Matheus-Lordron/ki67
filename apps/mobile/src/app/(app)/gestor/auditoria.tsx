import { PageHeader } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { AuditLogView } from '@/features/auditoria/AuditLogView';
import { ProjectPicker, useManagerScope } from '@/features/gestor/useManagerScope';
import { useAppStore } from '@/state/appStore';

// Log do projeto (RF-39): o gestor vê só os eventos dos lotes e imagens do próprio projeto.
export default function ProjectAuditScreen() {
  const { batches, images } = useManagerScope();
  const logs = useAppStore((s) => s.auditLogs);
  const users = useAppStore((s) => s.users);
  const batchIds = new Set(batches.map((b) => b.id));
  const imageIds = new Set(images.map((i) => i.id));
  const projectLogs = logs.filter((l) => (l.batchId && batchIds.has(l.batchId)) || (l.imageId && imageIds.has(l.imageId)));
  const involved = users.filter((u) => projectLogs.some((l) => l.userId === u.id));

  return (
    <Screen>
      <PageHeader title="Registro de atividades" description={<ProjectPicker />} />
      <AuditLogView logs={projectLogs} users={involved} images={images} />
    </Screen>
  );
}
