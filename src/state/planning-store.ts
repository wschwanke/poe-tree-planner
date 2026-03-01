import { create } from 'zustand'

export type PlanningFlag = 'required' | 'blocked'

export type SolverStatus = 'idle' | 'solved' | 'error'

interface PlanningState {
  active: boolean
  preferNotables: boolean

  requiredNodes: Set<string>
  blockedNodes: Set<string>

  solverPreview: Set<string>
  solverStatus: SolverStatus
  solverPointCost: number
  solverError: string | null

  togglePlanningMode: () => void
  setPlanningMode: (active: boolean) => void
  toggleFlag: (nodeId: string, flag: PlanningFlag) => void
  togglePreferNotables: () => void
  clearFlags: () => void
  setSolverResult: (nodes: Set<string>, cost: number) => void
  clearSolverPreview: () => void
  reset: () => void
}

export const usePlanningStore = create<PlanningState>((set, get) => ({
  active: false,
  preferNotables: false,

  requiredNodes: new Set<string>(),
  blockedNodes: new Set<string>(),

  solverPreview: new Set<string>(),
  solverStatus: 'idle',
  solverPointCost: 0,
  solverError: null,

  togglePlanningMode() {
    set((s) => ({ active: !s.active }))
  },

  setPlanningMode(active) {
    set({ active })
  },

  toggleFlag(nodeId, flag) {
    const { requiredNodes, blockedNodes } = get()

    const newRequired = new Set(requiredNodes)
    const newBlocked = new Set(blockedNodes)

    // Check if node already has this flag — toggle off
    const flagSets: Record<PlanningFlag, Set<string>> = {
      required: newRequired,
      blocked: newBlocked,
    }

    if (flagSets[flag].has(nodeId)) {
      // Same flag — remove it
      flagSets[flag].delete(nodeId)
    } else {
      // Remove from all other flags first
      newRequired.delete(nodeId)
      newBlocked.delete(nodeId)
      // Add to the requested flag
      flagSets[flag].add(nodeId)
    }

    set({
      requiredNodes: newRequired,
      blockedNodes: newBlocked,
      // Clear solver preview when flags change
      solverPreview: new Set<string>(),
      solverStatus: 'idle',
      solverPointCost: 0,
      solverError: null,
    })
  },

  togglePreferNotables() {
    set((s) => ({
      preferNotables: !s.preferNotables,
      solverPreview: new Set<string>(),
      solverStatus: 'idle' as const,
      solverPointCost: 0,
      solverError: null,
    }))
  },

  clearFlags() {
    set({
      requiredNodes: new Set<string>(),

      blockedNodes: new Set<string>(),
      solverPreview: new Set<string>(),
      solverStatus: 'idle',
      solverPointCost: 0,
      solverError: null,
    })
  },

  setSolverResult(nodes, cost) {
    set({
      solverPreview: nodes,
      solverStatus: 'solved',
      solverPointCost: cost,
      solverError: null,
    })
  },

  clearSolverPreview() {
    set({
      solverPreview: new Set<string>(),
      solverStatus: 'idle',
      solverPointCost: 0,
      solverError: null,
    })
  },

  reset() {
    set({
      active: false,
      preferNotables: false,
      requiredNodes: new Set<string>(),

      blockedNodes: new Set<string>(),
      solverPreview: new Set<string>(),
      solverStatus: 'idle',
      solverPointCost: 0,
      solverError: null,
    })
  },
}))
