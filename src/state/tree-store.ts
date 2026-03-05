import { create } from 'zustand'
import { findShortestPath, getConnectedComponent, type PathResult } from '@/data/graph'
import { getPref, savePreference } from '@/data/persistence'
import { useClusterStore } from '@/state/cluster-store'
import type { CharacterClass, ProcessedNode, TreeMode } from '@/types/skill-tree'

const SCION_CLASS_INDEX = 0
const SCION_BASE_POINTS = 127
const DEFAULT_BASE_POINTS = 122

export const ATLAS_START_NODE = '29045'
export const ATLAS_TOTAL_POINTS = 132

export type BanditChoice = 'none' | 'kill_all'

function getBasePoints(classIndex: number | null): number {
  if (classIndex === SCION_CLASS_INDEX) return SCION_BASE_POINTS
  return DEFAULT_BASE_POINTS
}

function computeTotalPoints(
  classIndex: number | null,
  banditChoice: BanditChoice,
  treeMode: TreeMode = 'skill',
): number {
  if (treeMode === 'atlas') return ATLAS_TOTAL_POINTS
  return getBasePoints(classIndex) + (banditChoice === 'kill_all' ? 1 : 0)
}

const TOTAL_ASCENDANCY_POINTS = 8

function computePoints(
  allocatedNodes: Set<string>,
  classStartNodeId: string | null,
  ascendancyStartNodeId: string | null,
  processedNodes: Map<string, ProcessedNode> | null,
): { pointsUsed: number; ascendancyPointsUsed: number } {
  let mainCount = 0
  let ascCount = 0
  for (const nodeId of allocatedNodes) {
    if (nodeId === classStartNodeId || nodeId === ascendancyStartNodeId) continue
    const pn = processedNodes?.get(nodeId)
    if (pn?.node.ascendancyName) {
      ascCount++
    } else {
      mainCount++
    }
  }
  return { pointsUsed: mainCount, ascendancyPointsUsed: ascCount }
}

const MAX_UNDO_HISTORY = 100

interface UndoSnapshot {
  allocatedNodes: Set<string>
  selectedMasteryEffects: Map<string, number>
}

interface TreeState {
  // Core state
  treeMode: TreeMode
  selectedClass: number | null
  classStartNodeId: string | null
  allocatedNodes: Set<string>
  hoveredNodeId: string | null
  selectedMasteryEffects: Map<string, number>
  masteryDialogNodeId: string | null
  banditChoice: BanditChoice

  // Ascendancy state
  selectedAscendancy: string | null
  selectedAscendancyClassId: number
  ascendancyStartNodeId: string | null
  ascendancyPointsUsed: number
  totalAscendancyPoints: number

  // Undo history
  undoStack: UndoSnapshot[]
  canUndo: boolean

  // Context refs (set once after data loads)
  processedNodes: Map<string, ProcessedNode> | null
  adjacency: Map<string, Set<string>> | null
  classesData: CharacterClass[]
  totalPoints: number

  // Derived state
  canAllocateNodes: Set<string>
  pointsUsed: number
  hoveredPath: string[]

  // Actions
  setContext: (
    processedNodes: Map<string, ProcessedNode>,
    adjacency: Map<string, Set<string>>,
    classesData?: CharacterClass[],
  ) => void
  selectClass: (classIndex: number, startNodeId: string) => void
  selectAscendancy: (name: string, classId: number) => void
  clearAscendancy: () => void
  setBanditChoice: (choice: BanditChoice) => void
  initAtlas: () => void
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
    treeMode?: TreeMode
    ascendClassId?: number
  }) => void
  undo: () => void
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
  treeMode: TreeMode = 'skill',
): string[] {
  if (!hoveredNodeId || !adjacency || !processedNodes) return []
  if (allocatedNodes.has(hoveredNodeId)) return []
  const pn = processedNodes.get(hoveredNodeId)
  if (!pn || pn.node.isProxy) return []

  // Atlas mastery nodes are decorative — no hover path
  if (pn.node.isMastery && treeMode === 'atlas') return []

  // For skill tree mastery nodes, find the path to the nearest group notable
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
      if (
        result &&
        (!bestResult || result.nodesToAllocate.length < bestResult.nodesToAllocate.length)
      )
        bestResult = result
    }
    return bestResult?.fullPath ?? []
  }

  if (canAllocateNodes.has(hoveredNodeId)) return [hoveredNodeId]
  const result = findShortestPath(hoveredNodeId, hoveredNodeId, adjacency, allocatedNodes)
  return result?.fullPath ?? []
}

function pushUndo(state: TreeState): UndoSnapshot[] {
  const snapshot: UndoSnapshot = {
    allocatedNodes: new Set(state.allocatedNodes),
    selectedMasteryEffects: new Map(state.selectedMasteryEffects),
  }
  const stack = [...state.undoStack, snapshot]
  if (stack.length > MAX_UNDO_HISTORY) stack.shift()
  return stack
}

export const useTreeStore = create<TreeState>((set, get) => ({
  // Core state
  treeMode: 'skill' as TreeMode,
  selectedClass: null,
  classStartNodeId: null,
  allocatedNodes: new Set<string>(),
  hoveredNodeId: null,
  selectedMasteryEffects: new Map<string, number>(),
  masteryDialogNodeId: null,
  banditChoice: getPref('bandit-choice', 'none') as BanditChoice,

  // Ascendancy state
  selectedAscendancy: null,
  selectedAscendancyClassId: 0,
  ascendancyStartNodeId: null,
  ascendancyPointsUsed: 0,
  totalAscendancyPoints: TOTAL_ASCENDANCY_POINTS,

  // Undo history
  undoStack: [],
  canUndo: false,

  // Context refs
  processedNodes: null,
  adjacency: null,
  classesData: [],
  totalPoints: computeTotalPoints(null, getPref('bandit-choice', 'none') as BanditChoice, 'skill'),

  // Derived state
  canAllocateNodes: new Set<string>(),
  pointsUsed: 0,
  hoveredPath: [],

  // Actions
  setContext(processedNodes, adjacency, classesData) {
    const updates: Partial<TreeState> = { processedNodes, adjacency }
    if (classesData) updates.classesData = classesData
    set(updates)
  },

  selectClass(classIndex, startNodeId) {
    const { adjacency, banditChoice } = get()
    const allocatedNodes = new Set<string>([startNodeId])
    const canAllocateNodes = computeCanAllocateNodes(allocatedNodes, adjacency)
    set({
      treeMode: 'skill' as TreeMode,
      selectedClass: classIndex,
      classStartNodeId: startNodeId,
      allocatedNodes,
      hoveredNodeId: null,
      selectedMasteryEffects: new Map(),
      masteryDialogNodeId: null,
      canAllocateNodes,
      pointsUsed: 0,
      hoveredPath: [],
      totalPoints: computeTotalPoints(classIndex, banditChoice, 'skill'),
      // Clear ascendancy when class changes
      selectedAscendancy: null,
      selectedAscendancyClassId: 0,
      ascendancyStartNodeId: null,
      ascendancyPointsUsed: 0,
    })
  },

  selectAscendancy(name, classId) {
    const state = get()
    const { allocatedNodes, processedNodes, classStartNodeId, adjacency } = state
    // Remove any previously allocated ascendancy nodes
    const newAllocated = new Set<string>()
    for (const nodeId of allocatedNodes) {
      const pn = processedNodes?.get(nodeId)
      if (!pn?.node.ascendancyName) {
        newAllocated.add(nodeId)
      }
    }
    const canAllocateNodes = computeCanAllocateNodes(newAllocated, adjacency)
    const pts = computePoints(newAllocated, classStartNodeId, null, processedNodes)
    set({
      selectedAscendancy: name,
      selectedAscendancyClassId: classId,
      ascendancyStartNodeId: null,
      ascendancyPointsUsed: 0,
      allocatedNodes: newAllocated,
      canAllocateNodes,
      pointsUsed: pts.pointsUsed,
    })
  },

  clearAscendancy() {
    const state = get()
    const { allocatedNodes, processedNodes, classStartNodeId, adjacency } = state
    const newAllocated = new Set<string>()
    for (const nodeId of allocatedNodes) {
      const pn = processedNodes?.get(nodeId)
      if (!pn?.node.ascendancyName) {
        newAllocated.add(nodeId)
      }
    }
    const canAllocateNodes = computeCanAllocateNodes(newAllocated, adjacency)
    const pts = computePoints(newAllocated, classStartNodeId, null, processedNodes)
    set({
      selectedAscendancy: null,
      selectedAscendancyClassId: 0,
      ascendancyStartNodeId: null,
      ascendancyPointsUsed: 0,
      allocatedNodes: newAllocated,
      canAllocateNodes,
      pointsUsed: pts.pointsUsed,
    })
  },

  initAtlas() {
    const { adjacency } = get()
    const allocatedNodes = new Set<string>([ATLAS_START_NODE])
    const canAllocateNodes = computeCanAllocateNodes(allocatedNodes, adjacency)
    set({
      treeMode: 'atlas' as TreeMode,
      selectedClass: null,
      classStartNodeId: ATLAS_START_NODE,
      allocatedNodes,
      hoveredNodeId: null,
      selectedMasteryEffects: new Map(),
      masteryDialogNodeId: null,
      canAllocateNodes,
      pointsUsed: 0,
      hoveredPath: [],
      undoStack: [],
      canUndo: false,
      totalPoints: ATLAS_TOTAL_POINTS,
    })
  },

  setBanditChoice(choice) {
    const { selectedClass, treeMode } = get()
    savePreference('bandit-choice', choice)
    set({
      banditChoice: choice,
      totalPoints: computeTotalPoints(selectedClass, choice, treeMode),
    })
  },

  handleNodeClick(nodeId) {
    const state = get()
    const { adjacency, processedNodes, allocatedNodes, classStartNodeId, ascendancyStartNodeId } =
      state
    if (!adjacency || !processedNodes) return

    const pn = processedNodes.get(nodeId)
    if (!pn) return

    // Proxy nodes are always blocked
    if (pn.node.isProxy) return

    // Block clicks on ascendancy nodes that don't belong to the selected ascendancy
    if (pn.node.ascendancyName && pn.node.ascendancyName !== state.selectedAscendancy) return

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
        if (!bestResult) return

        const undoStack = pushUndo(state)
        const newAllocated = new Set(allocatedNodes)
        for (const id of bestResult.nodesToAllocate) newAllocated.add(id)
        const pts = computePoints(
          newAllocated,
          classStartNodeId,
          ascendancyStartNodeId,
          processedNodes,
        )
        const canAllocateNodes = computeCanAllocateNodes(newAllocated, adjacency)
        set({
          undoStack,
          canUndo: true,
          allocatedNodes: newAllocated,
          masteryDialogNodeId: nodeId,
          canAllocateNodes,
          pointsUsed: pts.pointsUsed,
          ascendancyPointsUsed: pts.ascendancyPointsUsed,
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
      // Unallocate — protect class start and ascendancy start
      if (nodeId === classStartNodeId) return
      if (nodeId === ascendancyStartNodeId) return

      const undoStack = pushUndo(state)
      const newAllocated = new Set(allocatedNodes)
      newAllocated.delete(nodeId)

      let connected = newAllocated
      if (classStartNodeId) {
        connected = getConnectedComponent(classStartNodeId, adjacency, newAllocated)
        // Ascendancy is a separate component — include it too
        if (ascendancyStartNodeId && newAllocated.has(ascendancyStartNodeId)) {
          for (const id of getConnectedComponent(ascendancyStartNodeId, adjacency, newAllocated)) {
            connected.add(id)
          }
        }
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

      const pts = computePoints(connected, classStartNodeId, ascendancyStartNodeId, processedNodes)
      const canAllocateNodes = computeCanAllocateNodes(connected, adjacency)
      set({
        undoStack,
        canUndo: true,
        allocatedNodes: connected,
        selectedMasteryEffects: newMasteryEffects,
        canAllocateNodes,
        pointsUsed: pts.pointsUsed,
        ascendancyPointsUsed: pts.ascendancyPointsUsed,
        hoveredPath: computeHoveredPath(
          state.hoveredNodeId,
          connected,
          adjacency,
          processedNodes,
          canAllocateNodes,
        ),
      })
    } else {
      // Check point pool before allocating
      const isAscNode = !!pn.node.ascendancyName
      if (isAscNode && state.ascendancyPointsUsed >= state.totalAscendancyPoints) return
      if (!isAscNode && state.pointsUsed >= state.totalPoints) return

      const canAllocateNodes = computeCanAllocateNodes(allocatedNodes, adjacency)
      if (canAllocateNodes.has(nodeId)) {
        // Direct neighbor
        const undoStack = pushUndo(state)
        const newAllocated = new Set(allocatedNodes)
        newAllocated.add(nodeId)
        const pts = computePoints(
          newAllocated,
          classStartNodeId,
          ascendancyStartNodeId,
          processedNodes,
        )
        const newCanAllocate = computeCanAllocateNodes(newAllocated, adjacency)
        set({
          undoStack,
          canUndo: true,
          allocatedNodes: newAllocated,
          canAllocateNodes: newCanAllocate,
          pointsUsed: pts.pointsUsed,
          ascendancyPointsUsed: pts.ascendancyPointsUsed,
          hoveredPath: computeHoveredPath(
            state.hoveredNodeId,
            newAllocated,
            adjacency,
            processedNodes,
            newCanAllocate,
          ),
        })
      } else {
        // Find shortest path
        const result = findShortestPath(nodeId, nodeId, adjacency, allocatedNodes)
        if (result) {
          const undoStack = pushUndo(state)
          const newAllocated = new Set(allocatedNodes)
          for (const id of result.nodesToAllocate) newAllocated.add(id)
          const pts = computePoints(
            newAllocated,
            classStartNodeId,
            ascendancyStartNodeId,
            processedNodes,
          )
          const newCanAllocate = computeCanAllocateNodes(newAllocated, adjacency)
          set({
            undoStack,
            canUndo: true,
            allocatedNodes: newAllocated,
            canAllocateNodes: newCanAllocate,
            pointsUsed: pts.pointsUsed,
            ascendancyPointsUsed: pts.ascendancyPointsUsed,
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
    const undoStack = pushUndo(state)
    const { allocatedNodes, adjacency, processedNodes, classStartNodeId, ascendancyStartNodeId } =
      state
    const newAllocated = new Set(allocatedNodes)
    for (const id of nodeIds) {
      newAllocated.add(id)
    }
    const pts = computePoints(newAllocated, classStartNodeId, ascendancyStartNodeId, processedNodes)
    const canAllocateNodes = computeCanAllocateNodes(newAllocated, adjacency)
    set({
      undoStack,
      canUndo: true,
      allocatedNodes: newAllocated,
      canAllocateNodes,
      pointsUsed: pts.pointsUsed,
      ascendancyPointsUsed: pts.ascendancyPointsUsed,
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
    const undoStack = pushUndo(state)
    const { allocatedNodes, adjacency, processedNodes, classStartNodeId, ascendancyStartNodeId } =
      state
    const newAllocated = new Set(allocatedNodes)
    for (const id of nodeIds) {
      newAllocated.delete(id)
    }
    // Run connected component check to clean up orphans
    let connected = newAllocated
    if (classStartNodeId && adjacency) {
      connected = getConnectedComponent(classStartNodeId, adjacency, newAllocated)
      if (ascendancyStartNodeId && newAllocated.has(ascendancyStartNodeId)) {
        for (const id of getConnectedComponent(ascendancyStartNodeId, adjacency, newAllocated)) {
          connected.add(id)
        }
      }
    }
    const pts = computePoints(connected, classStartNodeId, ascendancyStartNodeId, processedNodes)
    const canAllocateNodes = computeCanAllocateNodes(connected, adjacency)
    set({
      undoStack,
      canUndo: true,
      allocatedNodes: connected,
      canAllocateNodes,
      pointsUsed: pts.pointsUsed,
      ascendancyPointsUsed: pts.ascendancyPointsUsed,
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
    const { allocatedNodes, adjacency, processedNodes, canAllocateNodes, treeMode } = get()
    set({
      hoveredNodeId: nodeId,
      hoveredPath: computeHoveredPath(
        nodeId,
        allocatedNodes,
        adjacency,
        processedNodes,
        canAllocateNodes,
        treeMode,
      ),
    })
  },

  closeMasteryDialog() {
    set({ masteryDialogNodeId: null })
  },

  handleMasterySelect(nodeId, effectIndex) {
    const state = get()
    const { allocatedNodes, classStartNodeId, ascendancyStartNodeId, adjacency, processedNodes } =
      state

    const undoStack = pushUndo(state)
    if (state.selectedMasteryEffects.has(nodeId)) {
      // Already allocated - change effect (no additional point cost)
      const newEffects = new Map(state.selectedMasteryEffects)
      newEffects.set(nodeId, effectIndex)
      set({
        undoStack,
        canUndo: true,
        selectedMasteryEffects: newEffects,
        masteryDialogNodeId: null,
      })
    } else {
      // New allocation - costs 1 point
      const newAllocated = new Set(allocatedNodes)
      newAllocated.add(nodeId)
      const newEffects = new Map(state.selectedMasteryEffects)
      newEffects.set(nodeId, effectIndex)
      const pts = computePoints(
        newAllocated,
        classStartNodeId,
        ascendancyStartNodeId,
        processedNodes,
      )
      const canAllocateNodes = computeCanAllocateNodes(newAllocated, adjacency)
      set({
        undoStack,
        canUndo: true,
        allocatedNodes: newAllocated,
        selectedMasteryEffects: newEffects,
        masteryDialogNodeId: null,
        canAllocateNodes,
        pointsUsed: pts.pointsUsed,
        ascendancyPointsUsed: pts.ascendancyPointsUsed,
        hoveredPath: computeHoveredPath(
          state.hoveredNodeId,
          newAllocated,
          adjacency,
          processedNodes,
          canAllocateNodes,
        ),
      })
    }
  },

  handleMasteryUnallocate(nodeId) {
    const state = get()
    const undoStack = pushUndo(state)
    const { allocatedNodes, classStartNodeId, ascendancyStartNodeId, adjacency, processedNodes } =
      state
    const newAllocated = new Set(allocatedNodes)
    newAllocated.delete(nodeId)
    const newEffects = new Map(state.selectedMasteryEffects)
    newEffects.delete(nodeId)
    const pts = computePoints(newAllocated, classStartNodeId, ascendancyStartNodeId, processedNodes)
    const canAllocateNodes = computeCanAllocateNodes(newAllocated, adjacency)
    set({
      undoStack,
      canUndo: true,
      allocatedNodes: newAllocated,
      selectedMasteryEffects: newEffects,
      masteryDialogNodeId: null,
      canAllocateNodes,
      pointsUsed: pts.pointsUsed,
      ascendancyPointsUsed: pts.ascendancyPointsUsed,
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
    const { adjacency, processedNodes, classesData } = get()
    const mode = snapshot.treeMode ?? 'skill'
    const allocatedNodes = new Set<string>(snapshot.allocatedNodeIds)
    const masteryEffects = new Map(Object.entries(snapshot.masteryEffects).map(([k, v]) => [k, v]))
    const canAllocateNodes = computeCanAllocateNodes(allocatedNodes, adjacency)
    if (mode !== 'atlas') {
      savePreference('selected-class', String(snapshot.classId))
      savePreference('bandit-choice', snapshot.banditChoice)
    }

    // Resolve ascendancy name from ascendClassId using classes data
    const ascendClassId = snapshot.ascendClassId ?? 0
    let ascendancyName: string | null = null
    if (ascendClassId > 0 && classesData.length > 0) {
      const cls = classesData[snapshot.classId]
      if (cls?.ascendancies?.[ascendClassId - 1]) {
        ascendancyName = cls.ascendancies[ascendClassId - 1].id
      }
    }

    // Find ascendancy start node if any ascendancy nodes are allocated
    let ascStartNodeId: string | null = null
    for (const nodeId of allocatedNodes) {
      const pn = processedNodes?.get(nodeId)
      if (pn?.node.isAscendancyStart) {
        ascStartNodeId = nodeId
        break
      }
    }

    const pts = computePoints(
      allocatedNodes,
      snapshot.classStartNodeId,
      ascStartNodeId,
      processedNodes,
    )
    set({
      selectedClass: snapshot.classId,
      classStartNodeId: snapshot.classStartNodeId,
      allocatedNodes,
      selectedMasteryEffects: masteryEffects,
      banditChoice: snapshot.banditChoice,
      totalPoints: computeTotalPoints(snapshot.classId, snapshot.banditChoice, mode),
      canAllocateNodes,
      pointsUsed: pts.pointsUsed,
      ascendancyPointsUsed: pts.ascendancyPointsUsed,
      ascendancyStartNodeId: ascStartNodeId,
      selectedAscendancyClassId: ascendClassId,
      selectedAscendancy: ascendancyName,
      hoveredNodeId: null,
      masteryDialogNodeId: null,
      hoveredPath: [],
    })
  },

  undo() {
    const state = get()
    const { undoStack, adjacency, classStartNodeId, ascendancyStartNodeId, processedNodes } = state
    if (undoStack.length === 0) return

    const newStack = [...undoStack]
    const snapshot = newStack.pop()!
    const canAllocateNodes = computeCanAllocateNodes(snapshot.allocatedNodes, adjacency)
    const pts = computePoints(
      snapshot.allocatedNodes,
      classStartNodeId,
      ascendancyStartNodeId,
      processedNodes,
    )
    set({
      undoStack: newStack,
      canUndo: newStack.length > 0,
      allocatedNodes: snapshot.allocatedNodes,
      selectedMasteryEffects: snapshot.selectedMasteryEffects,
      canAllocateNodes,
      pointsUsed: pts.pointsUsed,
      ascendancyPointsUsed: pts.ascendancyPointsUsed,
      hoveredNodeId: null,
      masteryDialogNodeId: null,
      hoveredPath: [],
    })
  },

  reset() {
    const { treeMode, adjacency, ascendancyStartNodeId } = get()
    useClusterStore.getState().reset()

    if (treeMode === 'atlas') {
      const allocatedNodes = new Set<string>([ATLAS_START_NODE])
      const canAllocateNodes = computeCanAllocateNodes(allocatedNodes, adjacency)
      set({
        undoStack: [],
        canUndo: false,
        allocatedNodes,
        hoveredNodeId: null,
        selectedMasteryEffects: new Map(),
        masteryDialogNodeId: null,
        canAllocateNodes,
        pointsUsed: 0,
        ascendancyPointsUsed: 0,
        hoveredPath: [],
      })
      return
    }

    const { classStartNodeId } = get()
    if (classStartNodeId) {
      // If there's an ascendancy start, auto-allocate it along with class start
      const startNodes = [classStartNodeId]
      if (ascendancyStartNodeId) startNodes.push(ascendancyStartNodeId)
      const allocatedNodes = new Set<string>(startNodes)
      const canAllocateNodes = computeCanAllocateNodes(allocatedNodes, adjacency)
      set({
        undoStack: [],
        canUndo: false,
        allocatedNodes,
        hoveredNodeId: null,
        selectedMasteryEffects: new Map(),
        masteryDialogNodeId: null,
        canAllocateNodes,
        pointsUsed: 0,
        ascendancyPointsUsed: 0,
        hoveredPath: [],
      })
    } else {
      set({
        undoStack: [],
        canUndo: false,
        selectedClass: null,
        classStartNodeId: null,
        allocatedNodes: new Set(),
        hoveredNodeId: null,
        selectedMasteryEffects: new Map(),
        masteryDialogNodeId: null,
        canAllocateNodes: new Set(),
        pointsUsed: 0,
        ascendancyPointsUsed: 0,
        hoveredPath: [],
        selectedAscendancy: null,
        selectedAscendancyClassId: 0,
        ascendancyStartNodeId: null,
      })
    }
  },
}))
