import { create } from 'zustand'
import type { Build, BuildStep } from '@/types/build'
import type { BanditChoice } from '@/state/tree-store'
import { useTreeStore } from '@/state/tree-store'

const STORAGE_KEY = 'poe-tree-builds'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function createStep(
  name: string,
  classId: number,
  allocatedNodeIds: string[] = [],
  masteryEffects: Record<string, number> = {},
): BuildStep {
  return {
    id: generateId(),
    name,
    description: '',
    classId,
    ascendClassId: 0,
    allocatedNodeIds,
    masteryEffects,
  }
}

interface BuildStore {
  builds: Build[]
  activeBuildId: string | null
  activeStepId: string | null
  buildManagerOpen: boolean
  pobExportOpen: boolean

  // UI
  openBuildManager: () => void
  closeBuildManager: () => void
  openPoBExport: () => void
  closePoBExport: () => void

  // Build CRUD
  createBuild: (name: string) => void
  deleteBuild: (buildId: string) => void
  renameBuild: (buildId: string, name: string) => void
  duplicateBuild: (buildId: string) => void
  setActiveBuild: (buildId: string | null) => void

  // Step CRUD
  addStep: (buildId: string, name?: string) => void
  deleteStep: (buildId: string, stepId: string) => void
  renameStep: (buildId: string, stepId: string, name: string) => void
  updateStepDescription: (buildId: string, stepId: string, description: string) => void
  reorderSteps: (buildId: string, fromIndex: number, toIndex: number) => void
  duplicateStep: (buildId: string, stepId: string) => void

  // Snapshot bridge
  saveCurrentToStep: (buildId: string, stepId: string) => void
  loadStepToTree: (buildId: string, stepId: string) => void
}

function persist(builds: Build[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(builds))
  } catch {
    // Storage full or unavailable
  }
}

function hydrate(): Build[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // Corrupt data
  }
  return []
}

function findBuild(builds: Build[], buildId: string): Build | undefined {
  return builds.find((b) => b.id === buildId)
}

function updateBuild(builds: Build[], buildId: string, updater: (b: Build) => Build): Build[] {
  return builds.map((b) => (b.id === buildId ? updater(b) : b))
}

export const useBuildStore = create<BuildStore>((set, get) => ({
  builds: hydrate(),
  activeBuildId: null,
  activeStepId: null,
  buildManagerOpen: false,
  pobExportOpen: false,

  openBuildManager() {
    set({ buildManagerOpen: true })
  },
  closeBuildManager() {
    set({ buildManagerOpen: false })
  },
  openPoBExport() {
    set({ pobExportOpen: true })
  },
  closePoBExport() {
    set({ pobExportOpen: false })
  },

  createBuild(name) {
    const tree = useTreeStore.getState()
    const classId = tree.selectedClass ?? 0
    const banditChoice = tree.banditChoice
    const allocatedNodeIds = [...tree.allocatedNodes]
    const masteryEffects: Record<string, number> = {}
    for (const [k, v] of tree.selectedMasteryEffects) {
      masteryEffects[k] = v
    }

    const step = createStep('Step 1', classId, allocatedNodeIds, masteryEffects)
    const build: Build = {
      id: generateId(),
      name,
      classId,
      banditChoice,
      activeStepId: step.id,
      steps: [step],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const builds = [...get().builds, build]
    persist(builds)
    set({ builds, activeBuildId: build.id, activeStepId: step.id })
  },

  deleteBuild(buildId) {
    const state = get()
    const builds = state.builds.filter((b) => b.id !== buildId)
    persist(builds)
    const updates: Partial<BuildStore> = { builds }
    if (state.activeBuildId === buildId) {
      updates.activeBuildId = null
      updates.activeStepId = null
    }
    set(updates)
  },

  renameBuild(buildId, name) {
    const builds = updateBuild(get().builds, buildId, (b) => ({
      ...b,
      name,
      updatedAt: Date.now(),
    }))
    persist(builds)
    set({ builds })
  },

  duplicateBuild(buildId) {
    const original = findBuild(get().builds, buildId)
    if (!original) return
    const newId = generateId()
    const newSteps = original.steps.map((s) => ({ ...s, id: generateId() }))
    const build: Build = {
      ...original,
      id: newId,
      name: `${original.name} (copy)`,
      activeStepId: newSteps[0]?.id ?? '',
      steps: newSteps,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const builds = [...get().builds, build]
    persist(builds)
    set({ builds })
  },

  setActiveBuild(buildId) {
    if (buildId === null) {
      set({ activeBuildId: null, activeStepId: null })
      return
    }
    const build = findBuild(get().builds, buildId)
    if (!build) return
    set({ activeBuildId: buildId, activeStepId: build.activeStepId })
    // Load the active step into the tree
    const step = build.steps.find((s) => s.id === build.activeStepId)
    if (step) {
      useTreeStore.getState().loadSnapshot({
        classId: step.classId,
        classStartNodeId: findClassStartNode(step.classId),
        allocatedNodeIds: step.allocatedNodeIds,
        masteryEffects: step.masteryEffects,
        banditChoice: build.banditChoice,
      })
    }
  },

  addStep(buildId, name) {
    const builds = updateBuild(get().builds, buildId, (b) => {
      const stepName = name ?? `Step ${b.steps.length + 1}`
      const lastStep = b.steps[b.steps.length - 1]
      const step = createStep(
        stepName,
        lastStep?.classId ?? b.classId,
        lastStep ? [...lastStep.allocatedNodeIds] : [],
        lastStep ? { ...lastStep.masteryEffects } : {},
      )
      return { ...b, steps: [...b.steps, step], updatedAt: Date.now() }
    })
    persist(builds)
    set({ builds })
  },

  deleteStep(buildId, stepId) {
    const state = get()
    const builds = updateBuild(state.builds, buildId, (b) => {
      const steps = b.steps.filter((s) => s.id !== stepId)
      const activeStepId = b.activeStepId === stepId ? (steps[0]?.id ?? '') : b.activeStepId
      return { ...b, steps, activeStepId, updatedAt: Date.now() }
    })
    persist(builds)
    const updates: Partial<BuildStore> = { builds }
    if (state.activeStepId === stepId) {
      const build = findBuild(builds, buildId)
      updates.activeStepId = build?.activeStepId ?? null
    }
    set(updates)
  },

  renameStep(buildId, stepId, name) {
    const builds = updateBuild(get().builds, buildId, (b) => ({
      ...b,
      steps: b.steps.map((s) => (s.id === stepId ? { ...s, name } : s)),
      updatedAt: Date.now(),
    }))
    persist(builds)
    set({ builds })
  },

  updateStepDescription(buildId, stepId, description) {
    const builds = updateBuild(get().builds, buildId, (b) => ({
      ...b,
      steps: b.steps.map((s) => (s.id === stepId ? { ...s, description } : s)),
      updatedAt: Date.now(),
    }))
    persist(builds)
    set({ builds })
  },

  reorderSteps(buildId, fromIndex, toIndex) {
    const builds = updateBuild(get().builds, buildId, (b) => {
      const steps = [...b.steps]
      const [moved] = steps.splice(fromIndex, 1)
      steps.splice(toIndex, 0, moved)
      return { ...b, steps, updatedAt: Date.now() }
    })
    persist(builds)
    set({ builds })
  },

  duplicateStep(buildId, stepId) {
    const builds = updateBuild(get().builds, buildId, (b) => {
      const original = b.steps.find((s) => s.id === stepId)
      if (!original) return b
      const idx = b.steps.indexOf(original)
      const dup: BuildStep = {
        ...original,
        id: generateId(),
        name: `${original.name} (copy)`,
      }
      const steps = [...b.steps]
      steps.splice(idx + 1, 0, dup)
      return { ...b, steps, updatedAt: Date.now() }
    })
    persist(builds)
    set({ builds })
  },

  saveCurrentToStep(buildId, stepId) {
    const tree = useTreeStore.getState()
    const allocatedNodeIds = [...tree.allocatedNodes]
    const masteryEffects: Record<string, number> = {}
    for (const [k, v] of tree.selectedMasteryEffects) {
      masteryEffects[k] = v
    }
    const classId = tree.selectedClass ?? 0

    const builds = updateBuild(get().builds, buildId, (b) => ({
      ...b,
      classId,
      banditChoice: tree.banditChoice,
      steps: b.steps.map((s) =>
        s.id === stepId
          ? { ...s, classId, allocatedNodeIds, masteryEffects }
          : s,
      ),
      updatedAt: Date.now(),
    }))
    persist(builds)
    set({ builds })
  },

  loadStepToTree(buildId, stepId) {
    const build = findBuild(get().builds, buildId)
    if (!build) return
    const step = build.steps.find((s) => s.id === stepId)
    if (!step) return

    // Update active step in the build
    const builds = updateBuild(get().builds, buildId, (b) => ({
      ...b,
      activeStepId: stepId,
    }))
    persist(builds)
    set({ builds, activeStepId: stepId })

    useTreeStore.getState().loadSnapshot({
      classId: step.classId,
      classStartNodeId: findClassStartNode(step.classId),
      allocatedNodeIds: step.allocatedNodeIds,
      masteryEffects: step.masteryEffects,
      banditChoice: build.banditChoice,
    })
  },
}))

function findClassStartNode(classId: number): string {
  const processedNodes = useTreeStore.getState().processedNodes
  if (!processedNodes) return ''
  for (const [id, pn] of processedNodes) {
    if (pn.node.classStartIndex === classId) return id
  }
  return ''
}
