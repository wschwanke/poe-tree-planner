import { useCallback, useMemo, useReducer } from 'react'
import { findShortestPath } from '@/data/graph'
import { computeCanAllocateNodes, initialTreeState, treeReducer } from '@/state/tree-state'
import type { ProcessedNode } from '@/types/skill-tree'

export function useAllocation(
  processedNodes: Map<string, ProcessedNode> | null,
  adjacency: Map<string, Set<string>> | null,
  totalPoints: number,
) {
  const [state, dispatch] = useReducer(treeReducer, initialTreeState)

  const canAllocateNodes = useMemo(() => {
    if (!adjacency) return new Set<string>()
    return computeCanAllocateNodes(state.allocatedNodes, adjacency)
  }, [state.allocatedNodes, adjacency])

  const pointsUsed = state.allocatedNodes.size - (state.classStartNodeId ? 1 : 0)

  const selectClass = useCallback((classIndex: number, startNodeId: string) => {
    dispatch({ type: 'SELECT_CLASS', classIndex, startNodeId })
  }, [])

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (!adjacency || !processedNodes) return

      const pn = processedNodes.get(nodeId)
      if (!pn) return

      // Don't allow clicking mastery or proxy nodes
      if (pn.node.isMastery || pn.node.isProxy) return

      if (state.allocatedNodes.has(nodeId)) {
        // Unallocate
        dispatch({ type: 'UNALLOCATE', nodeId, adjacency })
      } else if (canAllocateNodes.has(nodeId)) {
        // Direct neighbor - just allocate it
        if (pointsUsed + 1 <= totalPoints) {
          dispatch({ type: 'ALLOCATE_PATH', nodeIds: [nodeId] })
        }
      } else {
        // Find shortest path to allocated set
        const path = findShortestPath(nodeId, nodeId, adjacency, state.allocatedNodes)
        if (path && pointsUsed + path.length <= totalPoints) {
          dispatch({ type: 'ALLOCATE_PATH', nodeIds: path })
        }
      }
    },
    [adjacency, processedNodes, state.allocatedNodes, canAllocateNodes, pointsUsed, totalPoints],
  )

  const setHovered = useCallback((nodeId: string | null) => {
    dispatch({ type: 'SET_HOVERED', nodeId })
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  return {
    state,
    canAllocateNodes,
    pointsUsed,
    selectClass,
    handleNodeClick,
    setHovered,
    reset,
  }
}
