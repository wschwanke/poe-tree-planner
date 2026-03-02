import type { SkillTreeData, TreeMode } from '@/types/skill-tree'

export async function loadTreeData(mode: TreeMode): Promise<SkillTreeData> {
  if (mode === 'atlas') {
    const m = await import('../../data/atlas-tree.json')
    return m.default as unknown as SkillTreeData
  }
  const m = await import('../../data/skill-tree.json')
  return m.default as unknown as SkillTreeData
}
