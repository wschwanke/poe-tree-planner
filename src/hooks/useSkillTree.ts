import { useEffect, useState } from 'react'
import type { SpatialIndex } from '@/data/graph'
import { buildAdjacencyGraph, buildProcessedNodes, buildSpatialIndex } from '@/data/graph'
import { loadSkillTreeData } from '@/data/skill-tree-loader'
import { SpriteManager } from '@/data/sprite-manager'
import type { ProcessedNode, SkillTreeData } from '@/types/skill-tree'

export interface SkillTreeContext {
  data: SkillTreeData
  processedNodes: Map<string, ProcessedNode>
  adjacency: Map<string, Set<string>>
  spatialIndex: SpatialIndex
  sprites: SpriteManager
}

export function useSkillTree() {
  const [context, setContext] = useState<SkillTreeContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSkillTreeData()
      .then((data) => {
        const processedNodes = buildProcessedNodes(data)
        const adjacency = buildAdjacencyGraph(processedNodes)
        const spatialIndex = buildSpatialIndex(processedNodes)
        const sprites = new SpriteManager(data)

        // Preload sprites at default zoom
        sprites.preloadAllCategories(0.25)

        setContext({ data, processedNodes, adjacency, spatialIndex, sprites })
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return { context, loading, error }
}
