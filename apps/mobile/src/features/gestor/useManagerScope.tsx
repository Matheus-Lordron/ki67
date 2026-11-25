import { FolderKanban } from 'lucide-react-native';
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

/** Seletor do projeto em foco no formato do Figma (campo "Projeto" com dropdown). */
export function ProjectPicker({ label = 'Projeto' }: { label?: string }) {
  const { managed, project } = useManagerScope();
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  if (!project) {
    return (
      <View className="flex-row items-center gap-2 rounded-[10px] border border-amber-300 bg-amber-50 px-3.5 py-2.5">
        <FolderKanban size={16} color="#b45309" />
        <Text className="font-sans text-[13px] text-amber-900">
          Você ainda não é gestor de nenhum projeto. Peça ao administrador para designá-lo.
        </Text>
      </View>
    );
  }
  return (
    <View className="min-w-[240px]">
      <Select
        label={label}
        value={project.id}
        onChange={setActiveProjectId}
        options={managed.map((p) => ({ value: p.id, label: p.name, description: p.code }))}
      />
    </View>
  );
}
