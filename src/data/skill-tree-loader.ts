import type { SkillTreeData } from '@/types/skill-tree'

let cachedData: SkillTreeData | null = null

export async function loadSkillTreeData(): Promise<SkillTreeData> {
  if (cachedData) return cachedData
  const response = await fetch('/skill-tree.json')
  if (!response.ok) throw new Error(`Failed to load skill tree data: ${response.status}`)
  cachedData = (await response.json()) as SkillTreeData
  return cachedData
}
