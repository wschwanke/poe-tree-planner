import { useEffect, useMemo, useState } from 'react'
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

interface RawTreeData {
  data: SkillTreeData
  sprites: SpriteManager
}

export function useSkillTree(treeMode: TreeMode) {
  const [rawData, setRawData] = useState<RawTreeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Phase 1: Load raw data (depends on treeMode only)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setRawData(null)

    loadTreeData(treeMode)
      .then((data) => {
        if (cancelled) return

        const sprites = new SpriteManager(
          data,
          treeMode === 'atlas' ? '/assets/atlas-tree/' : '/assets/',
        )

        // Preload sprites at default zoom
        sprites.preloadAllCategories(0.25)

        setRawData({ data, sprites })
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

  // Phase 2: Build processed data (depends on rawData only)
  const context = useMemo<SkillTreeContext | null>(() => {
    if (!rawData) return null

    const { data, sprites } = rawData
    const processedNodes = buildProcessedNodes(data)
    const adjacency = buildAdjacencyGraph(processedNodes)
    const spatialIndex = buildSpatialIndex(processedNodes)

    return { data, processedNodes, adjacency, spatialIndex, sprites, treeMode }
  }, [rawData, treeMode])

  return { context, loading, error }
}
