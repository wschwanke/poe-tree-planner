import type { SkillTreeData } from '@/types/skill-tree'
import skillTreeJson from '../../data/skill-tree.json'

export function loadSkillTreeData(): SkillTreeData {
  return skillTreeJson as unknown as SkillTreeData
}
