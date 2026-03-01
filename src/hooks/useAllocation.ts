import { useCallback, useMemo, useReducer, useState } from 'react'
import { findShortestPath } from '@/data/graph'
import { computeCanAllocateNodes, initialTreeState, treeReducer } from '@/state/tree-state'
import type { ProcessedNode } from '@/types/skill-tree'

export function useAllocation(
  processedNodes: Map<string, ProcessedNode> | null,
  adjacency: Map<string, Set<string>> | null,
  totalPoints: number,
) {
  const [state, dispatch] = useReducer(treeReducer, initialTreeState)
  const [masteryDialogNodeId, setMasteryDialogNodeId] = useState<string | null>(null)

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

      // Proxy nodes are always blocked
      if (pn.node.isProxy) return

      // Mastery nodes: auto-path to group notable if needed, then open selection dialog
      if (pn.node.isMastery) {
        if (!pn.node.masteryEffects?.length) return

        // Check if at least one notable in the same group is allocated
        const groupId = pn.node.group
        let hasAllocatedNotable = false
        for (const allocId of state.allocatedNodes) {
          const allocPn = processedNodes.get(allocId)
          if (allocPn && allocPn.node.group === groupId && allocPn.node.isNotable) {
            hasAllocatedNotable = true
            break
          }
        }

        if (!hasAllocatedNotable) {
          // Find the shortest path to any notable in this group
          // by trying all notables and picking the shortest path
          const groupNotables: string[] = []
          for (const [nid, npn] of processedNodes) {
            if (npn.node.group === groupId && npn.node.isNotable) {
              groupNotables.push(nid)
            }
          }
          if (groupNotables.length === 0) return

          let bestPath: string[] | null = null
          for (const notableId of groupNotables) {
            const path = findShortestPath(notableId, notableId, adjacency, state.allocatedNodes)
            if (path && (!bestPath || path.length < bestPath.length)) {
              bestPath = path
            }
          }
          if (!bestPath || pointsUsed + bestPath.length > totalPoints) return
          dispatch({ type: 'ALLOCATE_PATH', nodeIds: bestPath })
        }

        setMasteryDialogNodeId(nodeId)
        return
      }

      if (state.allocatedNodes.has(nodeId)) {
        // Unallocate
        dispatch({ type: 'UNALLOCATE', nodeId, adjacency, processedNodes })
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

  const handleMasterySelect = useCallback(
    (nodeId: string, effectIndex: number) => {
      if (state.selectedMasteryEffects.has(nodeId)) {
        // Already allocated — change effect (no additional point cost)
        dispatch({ type: 'ALLOCATE_MASTERY', nodeId, effectIndex })
      } else {
        // New allocation — costs 1 point
        if (pointsUsed + 1 <= totalPoints) {
          dispatch({ type: 'ALLOCATE_MASTERY', nodeId, effectIndex })
        }
      }
      setMasteryDialogNodeId(null)
    },
    [state.selectedMasteryEffects, pointsUsed, totalPoints],
  )

  const handleMasteryUnallocate = useCallback((nodeId: string) => {
    dispatch({ type: 'UNALLOCATE_MASTERY', nodeId })
    setMasteryDialogNodeId(null)
  }, [])

  const closeMasteryDialog = useCallback(() => {
    setMasteryDialogNodeId(null)
  }, [])

  // Compute the path that would be allocated if the hovered node were clicked
  const hoveredPath = useMemo(() => {
    if (!state.hoveredNodeId || !adjacency || !processedNodes) return []
    if (state.allocatedNodes.has(state.hoveredNodeId)) return []
    const pn = processedNodes.get(state.hoveredNodeId)
    if (!pn || pn.node.isProxy) return []

    // For mastery nodes, find the path to the nearest group notable
    if (pn.node.isMastery) {
      const groupId = pn.node.group
      // Check if already has a notable allocated
      for (const allocId of state.allocatedNodes) {
        const allocPn = processedNodes.get(allocId)
        if (allocPn && allocPn.node.group === groupId && allocPn.node.isNotable) return []
      }
      const groupNotables: string[] = []
      for (const [nid, npn] of processedNodes) {
        if (npn.node.group === groupId && npn.node.isNotable) groupNotables.push(nid)
      }
      let bestPath: string[] | null = null
      for (const notableId of groupNotables) {
        const path = findShortestPath(notableId, notableId, adjacency, state.allocatedNodes)
        if (path && (!bestPath || path.length < bestPath.length)) bestPath = path
      }
      return bestPath ?? []
    }

    if (canAllocateNodes.has(state.hoveredNodeId)) return [state.hoveredNodeId]
    const path = findShortestPath(
      state.hoveredNodeId,
      state.hoveredNodeId,
      adjacency,
      state.allocatedNodes,
    )
    return path ?? []
  }, [state.hoveredNodeId, state.allocatedNodes, adjacency, processedNodes, canAllocateNodes])

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
    hoveredPath,
    selectClass,
    handleNodeClick,
    setHovered,
    reset,
    masteryDialogNodeId,
    handleMasterySelect,
    handleMasteryUnallocate,
    closeMasteryDialog,
  }
}
