import { getConnectedComponent } from '@/data/graph'

export interface TreeState {
  selectedClass: number | null
  classStartNodeId: string | null
  allocatedNodes: Set<string>
  hoveredNodeId: string | null
}

export type TreeAction =
  | { type: 'SELECT_CLASS'; classIndex: number; startNodeId: string }
  | { type: 'ALLOCATE_PATH'; nodeIds: string[] }
  | { type: 'UNALLOCATE'; nodeId: string; adjacency: Map<string, Set<string>> }
  | { type: 'SET_HOVERED'; nodeId: string | null }
  | { type: 'RESET' }

export const initialTreeState: TreeState = {
  selectedClass: null,
  classStartNodeId: null,
  allocatedNodes: new Set(),
  hoveredNodeId: null,
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

      // Find connected component from class start
      if (state.classStartNodeId) {
        const connected = getConnectedComponent(
          state.classStartNodeId,
          action.adjacency,
          newAllocated,
        )
        return { ...state, allocatedNodes: connected }
      }

      return { ...state, allocatedNodes: newAllocated }
    }

    case 'SET_HOVERED':
      return { ...state, hoveredNodeId: action.nodeId }

    case 'RESET':
      return { ...initialTreeState }

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
