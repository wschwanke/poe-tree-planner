import { useEffect, useState } from 'react'
import type { SpatialIndex } from '@/data/graph'
import { buildAdjacencyGraph, buildProcessedNodes, buildSpatialIndex } from '@/data/graph'
import { loadTreeData } from '@/data/skill-tree-loader'
import { SpriteManager } from '@/data/sprite-manager'
import type { ProcessedNode, SkillTreeData, TreeMode } from '@/types/skill-tree'

export interface SkillTreeContext {
  data: SkillTreeData
  processedNodes: Map<string, ProcessedNode>
  adjacency: Map<string, Set<string>>
  spatialIndex: SpatialIndex
  sprites: SpriteManager
  treeMode: TreeMode
}

export function useSkillTree(treeMode: TreeMode) {
  const [context, setContext] = useState<SkillTreeContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setContext(null)

    loadTreeData(treeMode)
      .then((data) => {
        if (cancelled) return

        const processedNodes = buildProcessedNodes(data)
        const adjacency = buildAdjacencyGraph(processedNodes)
        const spatialIndex = buildSpatialIndex(processedNodes)
        const assetBasePath =
          treeMode === 'atlas' ? '/assets/atlas-tree/' : '/assets/skill-tree/'
        const sprites = new SpriteManager(data, assetBasePath)

        // Preload sprites at default zoom
        sprites.preloadAllCategories(0.25)

        setContext({ data, processedNodes, adjacency, spatialIndex, sprites, treeMode })
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [treeMode])

  return { context, loading, error }
}
