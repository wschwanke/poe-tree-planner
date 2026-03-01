import type { ProcessedNode } from './skill-tree'

export type ClusterJewelSize = 'small' | 'medium' | 'large'

export interface ClusterJewelConfig {
  size: ClusterJewelSize
  passiveCount: number
}

export interface ClusterGenerationResult {
  virtualNodes: Map<string, ProcessedNode>
  virtualAdjacency: Map<string, Set<string>>
  subSocketIds: string[]
}

export const PASSIVE_RANGES: Record<ClusterJewelSize, { min: number; max: number }> = {
  small: { min: 2, max: 3 },
  medium: { min: 4, max: 6 },
  large: { min: 8, max: 12 },
}

export const SUB_SOCKET_COUNTS: Record<ClusterJewelSize, number> = {
  small: 0,
  medium: 1,
  large: 2,
}

export const TOTAL_INDICES: Record<ClusterJewelSize, number> = {
  small: 6,
  medium: 12,
  large: 12,
}

export const CLUSTER_INDICES: Record<
  ClusterJewelSize,
  {
    smallIndicies: number[]
    socketIndicies: number[]
  }
> = {
  small: { smallIndicies: [0, 4, 2], socketIndicies: [] },
  medium: { smallIndicies: [0, 6, 8, 4, 10, 2], socketIndicies: [6] },
  large: {
    smallIndicies: [0, 4, 6, 8, 10, 2, 7, 5, 9, 3, 11, 1],
    socketIndicies: [4, 8, 6],
  },
}

export const EXPANSION_SIZE_MAP: Record<number, ClusterJewelSize> = {
  0: 'small',
  1: 'medium',
  2: 'large',
}
