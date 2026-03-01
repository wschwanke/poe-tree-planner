import type { BanditChoice } from '@/state/tree-store'

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
  classId: number
  banditChoice: BanditChoice
  activeStepId: string
  steps: BuildStep[]
  createdAt: number
  updatedAt: number
}
