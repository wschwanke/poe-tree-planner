import { create } from 'zustand'
import { type PathResult, findShortestPath, getConnectedComponent } from '@/data/graph'
import { useClusterStore } from '@/state/cluster-store'
import type { ProcessedNode } from '@/types/skill-tree'

const SCION_CLASS_INDEX = 0
const SCION_BASE_POINTS = 127
const DEFAULT_BASE_POINTS = 122

export type BanditChoice = 'none' | 'kill_all'

function getBasePoints(classIndex: number | null): number {
  if (classIndex === SCION_CLASS_INDEX) return SCION_BASE_POINTS
  return DEFAULT_BASE_POINTS
}

function computeTotalPoints(
  classIndex: number | null,
  banditChoice: BanditChoice,
): number {
  return getBasePoints(classIndex) + (banditChoice === 'kill_all' ? 1 : 0)
}

interface TreeState {
  // Core state
  selectedClass: number | null
  classStartNodeId: string | null
  allocatedNodes: Set<string>
  hoveredNodeId: string | null
  selectedMasteryEffects: Map<string, number>
  masteryDialogNodeId: string | null
  banditChoice: BanditChoice

  // Context refs (set once after data loads)
  processedNodes: Map<string, ProcessedNode> | null
  adjacency: Map<string, Set<string>> | null
  totalPoints: number

  // Derived state
  canAllocateNodes: Set<string>
  pointsUsed: number
  hoveredPath: string[]

  // Actions
  setContext: (
    processedNodes: Map<string, ProcessedNode>,
    adjacency: Map<string, Set<string>>,
  ) => void
  selectClass: (classIndex: number, startNodeId: string) => void
  setBanditChoice: (choice: BanditChoice) => void
  handleNodeClick: (nodeId: string) => void
  applyNodes: (nodeIds: Set<string>) => void
  deallocateNodes: (nodeIds: Set<string>) => void
  setHovered: (nodeId: string | null) => void
  closeMasteryDialog: () => void
  handleMasterySelect: (nodeId: string, effectIndex: number) => void
  handleMasteryUnallocate: (nodeId: string) => void
  loadSnapshot: (snapshot: {
    classId: number
    classStartNodeId: string
    allocatedNodeIds: string[]
    masteryEffects: Record<string, number>
    banditChoice: BanditChoice
  }) => void
  reset: () => void
}

function computeCanAllocateNodes(
  allocatedNodes: Set<string>,
  adjacency: Map<string, Set<string>> | null,
): Set<string> {
  const canAllocate = new Set<string>()
  if (!adjacency) return canAllocate

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

function computeHoveredPath(
  hoveredNodeId: string | null,
  allocatedNodes: Set<string>,
  adjacency: Map<string, Set<string>> | null,
  processedNodes: Map<string, ProcessedNode> | null,
  canAllocateNodes: Set<string>,
): string[] {
  if (!hoveredNodeId || !adjacency || !processedNodes) return []
  if (allocatedNodes.has(hoveredNodeId)) return []
  const pn = processedNodes.get(hoveredNodeId)
  if (!pn || pn.node.isProxy) return []

  // For mastery nodes, find the path to the nearest group notable
  if (pn.node.isMastery) {
    const groupId = pn.node.group
    for (const allocId of allocatedNodes) {
      const allocPn = processedNodes.get(allocId)
      if (allocPn && allocPn.node.group === groupId && allocPn.node.isNotable) return []
    }
    const groupNotables: string[] = []
    for (const [nid, npn] of processedNodes) {
      if (npn.node.group === groupId && npn.node.isNotable) groupNotables.push(nid)
    }
    let bestResult: PathResult | null = null
    for (const notableId of groupNotables) {
      const result = findShortestPath(notableId, notableId, adjacency, allocatedNodes)
      if (result && (!bestResult || result.nodesToAllocate.length < bestResult.nodesToAllocate.length))
        bestResult = result
    }
    return bestResult?.fullPath ?? []
  }

  if (canAllocateNodes.has(hoveredNodeId)) return [hoveredNodeId]
  const result = findShortestPath(hoveredNodeId, hoveredNodeId, adjacency, allocatedNodes)
  return result?.fullPath ?? []
}

export const useTreeStore = create<TreeState>((set, get) => ({
  // Core state
  selectedClass: null,
  classStartNodeId: null,
  allocatedNodes: new Set<string>(),
  hoveredNodeId: null,
  selectedMasteryEffects: new Map<string, number>(),
  masteryDialogNodeId: null,
  banditChoice: (localStorage.getItem('poe-tree-bandit-choice') as BanditChoice) || 'none',

  // Context refs
  processedNodes: null,
  adjacency: null,
  totalPoints: computeTotalPoints(
    null,
    (localStorage.getItem('poe-tree-bandit-choice') as BanditChoice) || 'none',
  ),

  // Derived state
  canAllocateNodes: new Set<string>(),
  pointsUsed: 0,
  hoveredPath: [],

  // Actions
  setContext(processedNodes, adjacency) {
    set({ processedNodes, adjacency })
  },

  selectClass(classIndex, startNodeId) {
    const { adjacency, banditChoice } = get()
    const allocatedNodes = new Set<string>([startNodeId])
    const canAllocateNodes = computeCanAllocateNodes(allocatedNodes, adjacency)
    set({
      selectedClass: classIndex,
      classStartNodeId: startNodeId,
      allocatedNodes,
      hoveredNodeId: null,
      selectedMasteryEffects: new Map(),
      masteryDialogNodeId: null,
      canAllocateNodes,
      pointsUsed: 0,
      hoveredPath: [],
      totalPoints: computeTotalPoints(classIndex, banditChoice),
    })
  },

  setBanditChoice(choice) {
    const { selectedClass } = get()
    localStorage.setItem('poe-tree-bandit-choice', choice)
    set({
      banditChoice: choice,
      totalPoints: computeTotalPoints(selectedClass, choice),
    })
  },

  handleNodeClick(nodeId) {
    const state = get()
    const { adjacency, processedNodes, allocatedNodes, totalPoints, classStartNodeId } = state
    if (!adjacency || !processedNodes) return

    const pn = processedNodes.get(nodeId)
    if (!pn) return

    // Proxy nodes are always blocked
    if (pn.node.isProxy) return

    const pointsUsed = allocatedNodes.size - (classStartNodeId ? 1 : 0)

    // Mastery nodes: auto-path to group notable if needed, then open selection dialog
    if (pn.node.isMastery) {
      if (!pn.node.masteryEffects?.length) return

      const groupId = pn.node.group
      let hasAllocatedNotable = false
      for (const allocId of allocatedNodes) {
        const allocPn = processedNodes.get(allocId)
        if (allocPn && allocPn.node.group === groupId && allocPn.node.isNotable) {
          hasAllocatedNotable = true
          break
        }
      }

      if (!hasAllocatedNotable) {
        const groupNotables: string[] = []
        for (const [nid, npn] of processedNodes) {
          if (npn.node.group === groupId && npn.node.isNotable) {
            groupNotables.push(nid)
          }
        }
        if (groupNotables.length === 0) return

        let bestResult: PathResult | null = null
        for (const notableId of groupNotables) {
          const result = findShortestPath(notableId, notableId, adjacency, allocatedNodes)
          if (
            result &&
            (!bestResult || result.nodesToAllocate.length < bestResult.nodesToAllocate.length)
          ) {
            bestResult = result
          }
        }
        if (!bestResult || pointsUsed + bestResult.nodesToAllocate.length > totalPoints) return

        const newAllocated = new Set(allocatedNodes)
        for (const id of bestResult.nodesToAllocate) newAllocated.add(id)
        const newPointsUsed = newAllocated.size - (classStartNodeId ? 1 : 0)
        const canAllocateNodes = computeCanAllocateNodes(newAllocated, adjacency)
        set({
          allocatedNodes: newAllocated,
          masteryDialogNodeId: nodeId,
          canAllocateNodes,
          pointsUsed: newPointsUsed,
          hoveredPath: computeHoveredPath(
            state.hoveredNodeId,
            newAllocated,
            adjacency,
            processedNodes,
            canAllocateNodes,
          ),
        })
        return
      }

      set({ masteryDialogNodeId: nodeId })
      return
    }

    if (allocatedNodes.has(nodeId)) {
      // Unallocate
      if (nodeId === classStartNodeId) return

      const newAllocated = new Set(allocatedNodes)
      newAllocated.delete(nodeId)

      let connected = newAllocated
      if (classStartNodeId) {
        connected = getConnectedComponent(classStartNodeId, adjacency, newAllocated)
      }

      // Auto-remove masteries whose group has no remaining allocated notables
      const newMasteryEffects = new Map(state.selectedMasteryEffects)
      for (const [masteryId] of state.selectedMasteryEffects) {
        const masteryNode = processedNodes.get(masteryId)
        if (!masteryNode) {
          newMasteryEffects.delete(masteryId)
          continue
        }
        const groupId = masteryNode.node.group
        let hasAllocatedNotable = false
        for (const nId of connected) {
          const npn = processedNodes.get(nId)
          if (npn && npn.node.group === groupId && npn.node.isNotable) {
            hasAllocatedNotable = true
            break
          }
        }
        if (!hasAllocatedNotable) {
          newMasteryEffects.delete(masteryId)
        }
      }

      // Re-add surviving mastery nodes
      for (const masteryId of newMasteryEffects.keys()) {
        connected.add(masteryId)
      }

      const newPointsUsed = connected.size - (classStartNodeId ? 1 : 0)
      const canAllocateNodes = computeCanAllocateNodes(connected, adjacency)
      set({
        allocatedNodes: connected,
        selectedMasteryEffects: newMasteryEffects,
        canAllocateNodes,
        pointsUsed: newPointsUsed,
        hoveredPath: computeHoveredPath(
          state.hoveredNodeId,
          connected,
          adjacency,
          processedNodes,
          canAllocateNodes,
        ),
      })
    } else {
      const canAllocateNodes = computeCanAllocateNodes(allocatedNodes, adjacency)
      if (canAllocateNodes.has(nodeId)) {
        // Direct neighbor
        if (pointsUsed + 1 <= totalPoints) {
          const newAllocated = new Set(allocatedNodes)
          newAllocated.add(nodeId)
          const newPointsUsed = newAllocated.size - (classStartNodeId ? 1 : 0)
          const newCanAllocate = computeCanAllocateNodes(newAllocated, adjacency)
          set({
            allocatedNodes: newAllocated,
            canAllocateNodes: newCanAllocate,
            pointsUsed: newPointsUsed,
            hoveredPath: computeHoveredPath(
              state.hoveredNodeId,
              newAllocated,
              adjacency,
              processedNodes,
              newCanAllocate,
            ),
          })
        }
      } else {
        // Find shortest path
        const result = findShortestPath(nodeId, nodeId, adjacency, allocatedNodes)
        if (result && pointsUsed + result.nodesToAllocate.length <= totalPoints) {
          const newAllocated = new Set(allocatedNodes)
          for (const id of result.nodesToAllocate) newAllocated.add(id)
          const newPointsUsed = newAllocated.size - (classStartNodeId ? 1 : 0)
          const newCanAllocate = computeCanAllocateNodes(newAllocated, adjacency)
          set({
            allocatedNodes: newAllocated,
            canAllocateNodes: newCanAllocate,
            pointsUsed: newPointsUsed,
            hoveredPath: computeHoveredPath(
              state.hoveredNodeId,
              newAllocated,
              adjacency,
              processedNodes,
              newCanAllocate,
            ),
          })
        }
      }
    }
  },

  applyNodes(nodeIds) {
    const state = get()
    const { allocatedNodes, adjacency, processedNodes, classStartNodeId } = state
    const newAllocated = new Set(allocatedNodes)
    for (const id of nodeIds) {
      newAllocated.add(id)
    }
    const newPointsUsed = newAllocated.size - (classStartNodeId ? 1 : 0)
    const canAllocateNodes = computeCanAllocateNodes(newAllocated, adjacency)
    set({
      allocatedNodes: newAllocated,
      canAllocateNodes,
      pointsUsed: newPointsUsed,
      hoveredPath: computeHoveredPath(
        state.hoveredNodeId,
        newAllocated,
        adjacency,
        processedNodes,
        canAllocateNodes,
      ),
    })
  },

  deallocateNodes(nodeIds) {
    const state = get()
    const { allocatedNodes, adjacency, processedNodes, classStartNodeId } = state
    const newAllocated = new Set(allocatedNodes)
    for (const id of nodeIds) {
      newAllocated.delete(id)
    }
    // Run connected component check to clean up orphans
    let connected = newAllocated
    if (classStartNodeId && adjacency) {
      connected = getConnectedComponent(classStartNodeId, adjacency, newAllocated)
    }
    const newPointsUsed = connected.size - (classStartNodeId ? 1 : 0)
    const canAllocateNodes = computeCanAllocateNodes(connected, adjacency)
    set({
      allocatedNodes: connected,
      canAllocateNodes,
      pointsUsed: newPointsUsed,
      hoveredPath: computeHoveredPath(
        state.hoveredNodeId,
        connected,
        adjacency,
        processedNodes,
        canAllocateNodes,
      ),
    })
  },

  setHovered(nodeId) {
    const { allocatedNodes, adjacency, processedNodes, canAllocateNodes } = get()
    set({
      hoveredNodeId: nodeId,
      hoveredPath: computeHoveredPath(
        nodeId,
        allocatedNodes,
        adjacency,
        processedNodes,
        canAllocateNodes,
      ),
    })
  },

  closeMasteryDialog() {
    set({ masteryDialogNodeId: null })
  },

  handleMasterySelect(nodeId, effectIndex) {
    const state = get()
    const { allocatedNodes, classStartNodeId, adjacency, totalPoints } = state
    const pointsUsed = allocatedNodes.size - (classStartNodeId ? 1 : 0)

    if (state.selectedMasteryEffects.has(nodeId)) {
      // Already allocated - change effect (no additional point cost)
      const newEffects = new Map(state.selectedMasteryEffects)
      newEffects.set(nodeId, effectIndex)
      set({ selectedMasteryEffects: newEffects, masteryDialogNodeId: null })
    } else {
      // New allocation - costs 1 point
      if (pointsUsed + 1 <= totalPoints) {
        const newAllocated = new Set(allocatedNodes)
        newAllocated.add(nodeId)
        const newEffects = new Map(state.selectedMasteryEffects)
        newEffects.set(nodeId, effectIndex)
        const newPointsUsed = newAllocated.size - (classStartNodeId ? 1 : 0)
        const canAllocateNodes = computeCanAllocateNodes(newAllocated, adjacency)
        set({
          allocatedNodes: newAllocated,
          selectedMasteryEffects: newEffects,
          masteryDialogNodeId: null,
          canAllocateNodes,
          pointsUsed: newPointsUsed,
          hoveredPath: computeHoveredPath(
            state.hoveredNodeId,
            newAllocated,
            adjacency,
            state.processedNodes,
            canAllocateNodes,
          ),
        })
      }
    }
  },

  handleMasteryUnallocate(nodeId) {
    const state = get()
    const { allocatedNodes, classStartNodeId, adjacency, processedNodes } = state
    const newAllocated = new Set(allocatedNodes)
    newAllocated.delete(nodeId)
    const newEffects = new Map(state.selectedMasteryEffects)
    newEffects.delete(nodeId)
    const newPointsUsed = newAllocated.size - (classStartNodeId ? 1 : 0)
    const canAllocateNodes = computeCanAllocateNodes(newAllocated, adjacency)
    set({
      allocatedNodes: newAllocated,
      selectedMasteryEffects: newEffects,
      masteryDialogNodeId: null,
      canAllocateNodes,
      pointsUsed: newPointsUsed,
      hoveredPath: computeHoveredPath(
        state.hoveredNodeId,
        newAllocated,
        adjacency,
        processedNodes,
        canAllocateNodes,
      ),
    })
  },

  loadSnapshot(snapshot) {
    const { adjacency } = get()
    const allocatedNodes = new Set<string>(snapshot.allocatedNodeIds)
    const masteryEffects = new Map(Object.entries(snapshot.masteryEffects).map(([k, v]) => [k, v]))
    const canAllocateNodes = computeCanAllocateNodes(allocatedNodes, adjacency)
    localStorage.setItem('poe-tree-selected-class', String(snapshot.classId))
    localStorage.setItem('poe-tree-bandit-choice', snapshot.banditChoice)
    set({
      selectedClass: snapshot.classId,
      classStartNodeId: snapshot.classStartNodeId,
      allocatedNodes,
      selectedMasteryEffects: masteryEffects,
      banditChoice: snapshot.banditChoice,
      totalPoints: computeTotalPoints(snapshot.classId, snapshot.banditChoice),
      canAllocateNodes,
      pointsUsed: allocatedNodes.size - 1,
      hoveredNodeId: null,
      masteryDialogNodeId: null,
      hoveredPath: [],
    })
  },

  reset() {
    const { classStartNodeId, adjacency } = get()
    useClusterStore.getState().reset()
    if (classStartNodeId) {
      const allocatedNodes = new Set<string>([classStartNodeId])
      const canAllocateNodes = computeCanAllocateNodes(allocatedNodes, adjacency)
      set({
        allocatedNodes,
        hoveredNodeId: null,
        selectedMasteryEffects: new Map(),
        masteryDialogNodeId: null,
        canAllocateNodes,
        pointsUsed: 0,
        hoveredPath: [],
      })
    } else {
      set({
        selectedClass: null,
        classStartNodeId: null,
        allocatedNodes: new Set(),
        hoveredNodeId: null,
        selectedMasteryEffects: new Map(),
        masteryDialogNodeId: null,
        canAllocateNodes: new Set(),
        pointsUsed: 0,
        hoveredPath: [],
      })
    }
  },
}))
