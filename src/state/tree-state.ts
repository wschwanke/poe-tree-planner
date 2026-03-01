import { getConnectedComponent } from '@/data/graph'
import type { ProcessedNode } from '@/types/skill-tree'

export interface TreeState {
  selectedClass: number | null
  classStartNodeId: string | null
  allocatedNodes: Set<string>
  hoveredNodeId: string | null
  selectedMasteryEffects: Map<string, number>
}

export type TreeAction =
  | { type: 'SELECT_CLASS'; classIndex: number; startNodeId: string }
  | { type: 'ALLOCATE_PATH'; nodeIds: string[] }
  | {
      type: 'UNALLOCATE'
      nodeId: string
      adjacency: Map<string, Set<string>>
      processedNodes: Map<string, ProcessedNode>
    }
  | { type: 'ALLOCATE_MASTERY'; nodeId: string; effectIndex: number }
  | { type: 'UNALLOCATE_MASTERY'; nodeId: string }
  | { type: 'SET_HOVERED'; nodeId: string | null }
  | { type: 'RESET' }

export const initialTreeState: TreeState = {
  selectedClass: null,
  classStartNodeId: null,
  allocatedNodes: new Set(),
  hoveredNodeId: null,
  selectedMasteryEffects: new Map(),
}

export function treeReducer(state: TreeState, action: TreeAction): TreeState {
  switch (action.type) {
    case 'SELECT_CLASS': {
      const allocated = new Set<string>()
      allocated.add(action.startNodeId)
      return {
        ...state,
        selectedClass: action.classIndex,
        classStartNodeId: action.startNodeId,
        allocatedNodes: allocated,
        hoveredNodeId: null,
        selectedMasteryEffects: new Map(),
      }
    }

    case 'ALLOCATE_PATH': {
      const newAllocated = new Set(state.allocatedNodes)
      for (const id of action.nodeIds) {
        newAllocated.add(id)
      }
      return { ...state, allocatedNodes: newAllocated }
    }

    case 'UNALLOCATE': {
      if (action.nodeId === state.classStartNodeId) return state

      const newAllocated = new Set(state.allocatedNodes)
      newAllocated.delete(action.nodeId)

      let connected = newAllocated
      if (state.classStartNodeId) {
        connected = getConnectedComponent(state.classStartNodeId, action.adjacency, newAllocated)
      }

      // Auto-remove masteries whose group has no remaining allocated notables.
      // Mastery nodes are not in the adjacency graph, so they won't appear in
      // `connected`. Instead, check if any notable in the same group survived.
      const newMasteryEffects = new Map(state.selectedMasteryEffects)
      for (const [masteryId] of state.selectedMasteryEffects) {
        const masteryNode = action.processedNodes.get(masteryId)
        if (!masteryNode) {
          newMasteryEffects.delete(masteryId)
          continue
        }
        const groupId = masteryNode.node.group
        let hasAllocatedNotable = false
        for (const nodeId of connected) {
          const pn = action.processedNodes.get(nodeId)
          if (pn && pn.node.group === groupId && pn.node.isNotable) {
            hasAllocatedNotable = true
            break
          }
        }
        if (!hasAllocatedNotable) {
          newMasteryEffects.delete(masteryId)
        }
      }

      // Re-add surviving mastery nodes to allocatedNodes since they
      // aren't in the adjacency graph and won't appear in `connected`
      for (const masteryId of newMasteryEffects.keys()) {
        connected.add(masteryId)
      }

      return {
        ...state,
        allocatedNodes: connected,
        selectedMasteryEffects: newMasteryEffects,
      }
    }

    case 'ALLOCATE_MASTERY': {
      const newAllocated = new Set(state.allocatedNodes)
      newAllocated.add(action.nodeId)
      const newEffects = new Map(state.selectedMasteryEffects)
      newEffects.set(action.nodeId, action.effectIndex)
      return {
        ...state,
        allocatedNodes: newAllocated,
        selectedMasteryEffects: newEffects,
      }
    }

    case 'UNALLOCATE_MASTERY': {
      const newAllocated = new Set(state.allocatedNodes)
      newAllocated.delete(action.nodeId)
      const newEffects = new Map(state.selectedMasteryEffects)
      newEffects.delete(action.nodeId)
      return {
        ...state,
        allocatedNodes: newAllocated,
        selectedMasteryEffects: newEffects,
      }
    }

    case 'SET_HOVERED':
      return { ...state, hoveredNodeId: action.nodeId }

    case 'RESET': {
      if (state.classStartNodeId) {
        const allocated = new Set<string>()
        allocated.add(state.classStartNodeId)
        return {
          ...initialTreeState,
          selectedClass: state.selectedClass,
          classStartNodeId: state.classStartNodeId,
          allocatedNodes: allocated,
        }
      }
      return { ...initialTreeState }
    }

    default:
      return state
  }
}

export function computeCanAllocateNodes(
  allocatedNodes: Set<string>,
  adjacency: Map<string, Set<string>>,
): Set<string> {
  const canAllocate = new Set<string>()

  for (const nodeId of allocatedNodes) {
    const neighbors = adjacency.get(nodeId)
    if (!neighbors) continue
    for (const neighbor of neighbors) {
      if (!allocatedNodes.has(neighbor)) {
        canAllocate.add(neighbor)
      }
    }
  }

  return canAllocate
}
