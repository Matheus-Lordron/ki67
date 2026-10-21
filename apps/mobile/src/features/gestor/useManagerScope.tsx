import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { Select } from '@/components/ui/Select';
import { useAppStore } from '@/state/appStore';

/**
 * Recorte do gestor: só os projetos que ele gerencia (RF-09) e, dentro do
 * projeto em foco, seus lotes, imagens e análises. No banco, o RLS faz o mesmo.
 */
export function useManagerScope() {
  const user = useAppStore((s) => s.currentUser);
  const projects = useAppStore((s) => s.projects);
  const allBatches = useAppStore((s) => s.batches);
  const allImages = useAppStore((s) => s.images);
  const allAnalyses = useAppStore((s) => s.analyses);
  const activeProjectId = useAppStore((s) => s.activeProjectId);

  return useMemo(() => {
    const managed = projects.filter((p) => p.managerId === user?.id);
    const project = managed.find((p) => p.id === activeProjectId) ?? managed[0] ?? null;
    const batches = allBatches.filter((b) => b.projectId === project?.id);
    const batchIds = new Set(batches.map((b) => b.id));
    const images = allImages.filter((i) => batchIds.has(i.batchId));
    const imageIds = new Set(images.map((i) => i.id));
    const analyses = allAnalyses.filter((a) => imageIds.has(a.imageId));
    return { managed, project, batches, images, analyses };
  }, [user, projects, allBatches, allImages, allAnalyses, activeProjectId]);
}

/** Seletor do projeto em foco (aparece quando o gestor tem mais de um projeto). */
export function ProjectPicker() {
  const { managed, project } = useManagerScope();
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  if (!project) {
    return (
      <Text className="font-sans text-[13px] text-warn">Você ainda não é gestor de nenhum projeto. Peça ao administrador para incluir você.</Text>
    );
  }
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <Text className="font-sans text-[13px] text-ink-muted">Projeto</Text>
      {managed.length > 1 ? (
        <Select compact value={project.id} onChange={setActiveProjectId} options={managed.map((p) => ({ value: p.id, label: p.name, description: p.code }))} />
      ) : (
        <Text className="font-sans-medium text-[13px] text-ink">{project.name}</Text>
      )}
    </View>
  );
}
