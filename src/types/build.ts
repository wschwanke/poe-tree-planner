import type { BanditChoice } from '@/state/tree-store'
import type { TreeMode } from '@/types/skill-tree'

export interface BuildStep {
  id: string
  name: string
  description: string
  classId: number
  ascendClassId: number
  allocatedNodeIds: string[]
  masteryEffects: Record<string, number>
}

export interface Build {
  id: string
  name: string
  treeMode: TreeMode
  classId: number
  banditChoice: BanditChoice
  activeStepId: string
  steps: BuildStep[]
  createdAt: number
  updatedAt: number
}

export interface ExportedBuild {
  version: 1
  treeMode: TreeMode
  name: string
  classId: number
  banditChoice: BanditChoice
  steps: {
    name: string
    description: string
    classId: number
    ascendClassId: number
    allocatedNodeIds: string[]
    masteryEffects: Record<string, number>
  }[]
}
