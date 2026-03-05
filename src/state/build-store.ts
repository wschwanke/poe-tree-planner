import { create } from 'zustand'
import { decodeBuild, encodeBuild } from '@/data/build-codec'
import { loadBuilds as fetchBuilds, saveBuilds } from '@/data/persistence'
import { ATLAS_START_NODE, useTreeStore } from '@/state/tree-store'
import type { Build, BuildStep, ExportedBuild } from '@/types/build'
import type { TreeMode } from '@/types/skill-tree'

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
  isLoading: boolean
  activeBuildId: string | null
  activeStepId: string | null
  buildManagerOpen: boolean
  pobExportOpen: boolean

  // Async init
  loadBuilds: () => Promise<void>

  // UI
  openBuildManager: () => void
  closeBuildManager: () => void
  openPoBExport: () => void
  closePoBExport: () => void

  // Build CRUD
  createBuild: (name: string, treeMode: TreeMode) => void
  deleteBuild: (buildId: string) => void
  renameBuild: (buildId: string, name: string) => void
  duplicateBuild: (buildId: string) => void
  setActiveBuild: (buildId: string | null) => void

  // Step CRUD
  addStep: (buildId: string, name?: string) => string | undefined
  deleteStep: (buildId: string, stepId: string) => void
  renameStep: (buildId: string, stepId: string, name: string) => void
  updateStepDescription: (buildId: string, stepId: string, description: string) => void
  reorderSteps: (buildId: string, fromIndex: number, toIndex: number) => void
  duplicateStep: (buildId: string, stepId: string) => void

  // Snapshot bridge
  saveCurrentToStep: (buildId: string, stepId: string) => void
  loadStepToTree: (buildId: string, stepId: string) => void

  // Export/Import
  exportBuild: (buildId: string) => string | null
  importBuild: (encoded: string, treeMode: TreeMode) => { success: boolean; error?: string }
}

let _suppressAutoSave = false

function persist(builds: Build[]) {
  saveBuilds(builds)
}

function findBuild(builds: Build[], buildId: string): Build | undefined {
  return builds.find((b) => b.id === buildId)
}

function updateBuild(builds: Build[], buildId: string, updater: (b: Build) => Build): Build[] {
  return builds.map((b) => (b.id === buildId ? updater(b) : b))
}

function resolveStartNode(build: Build, classId: number): string {
  if (build.treeMode === 'atlas') return ATLAS_START_NODE
  return findClassStartNode(classId)
}

export const useBuildStore = create<BuildStore>((set, get) => ({
  builds: [],
  isLoading: true,
  activeBuildId: null,
  activeStepId: null,
  buildManagerOpen: false,
  pobExportOpen: false,

  async loadBuilds() {
    let builds = await fetchBuilds()
    // One-time migration: if SQLite is empty but localStorage has data, migrate it
    if (builds.length === 0) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const legacy = JSON.parse(raw) as Build[]
          if (legacy.length > 0) {
            builds = legacy.map((b) => (b.treeMode ? b : { ...b, treeMode: 'skill' as TreeMode }))
            persist(builds)
            localStorage.removeItem(STORAGE_KEY)
          }
        }
      } catch {
        // Corrupt localStorage data — ignore
      }
    }
    set({ builds, isLoading: false })
  },

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

  createBuild(name, treeMode) {
    const tree = useTreeStore.getState()
    const isAtlas = treeMode === 'atlas'
    const classId = isAtlas ? 0 : (tree.selectedClass ?? 0)
    const banditChoice = isAtlas ? 'none' : tree.banditChoice
    const allocatedNodeIds = [...tree.allocatedNodes]
    const masteryEffects: Record<string, number> = {}
    if (!isAtlas) {
      for (const [k, v] of tree.selectedMasteryEffects) {
        masteryEffects[k] = v
      }
    }

    const step = createStep('Step 1', classId, allocatedNodeIds, masteryEffects)
    step.ascendClassId = isAtlas ? 0 : tree.selectedAscendancyClassId
    const build: Build = {
      id: generateId(),
      name,
      treeMode,
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
      _suppressAutoSave = true
      useTreeStore.getState().loadSnapshot({
        classId: step.classId,
        classStartNodeId: resolveStartNode(build, step.classId),
        allocatedNodeIds: step.allocatedNodeIds,
        masteryEffects: step.masteryEffects,
        banditChoice: build.banditChoice,
        treeMode: build.treeMode,
        ascendClassId: step.ascendClassId,
      })
      _suppressAutoSave = false
    }
  },

  addStep(buildId, name) {
    const build = findBuild(get().builds, buildId)
    if (!build) return undefined
    const stepName = name ?? `Step ${build.steps.length + 1}`
    const lastStep = build.steps[build.steps.length - 1]
    const stepId = generateId()
    const step: BuildStep = {
      id: stepId,
      name: stepName,
      description: '',
      classId: lastStep?.classId ?? build.classId,
      ascendClassId: lastStep?.ascendClassId ?? 0,
      allocatedNodeIds: lastStep ? [...lastStep.allocatedNodeIds] : [],
      masteryEffects: lastStep ? { ...lastStep.masteryEffects } : {},
    }
    const builds = updateBuild(get().builds, buildId, (b) => ({
      ...b,
      steps: [...b.steps, step],
      activeStepId: stepId,
      updatedAt: Date.now(),
    }))
    persist(builds)
    set({ builds, activeStepId: stepId })

    // Load the new step into the tree
    _suppressAutoSave = true
    useTreeStore.getState().loadSnapshot({
      classId: step.classId,
      classStartNodeId: resolveStartNode(build, step.classId),
      allocatedNodeIds: step.allocatedNodeIds,
      masteryEffects: step.masteryEffects,
      banditChoice: build.banditChoice,
      treeMode: build.treeMode,
      ascendClassId: step.ascendClassId,
    })
    _suppressAutoSave = false

    return stepId
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
    const build = findBuild(get().builds, buildId)
    const isAtlas = build?.treeMode === 'atlas'
    const allocatedNodeIds = [...tree.allocatedNodes]
    const masteryEffects: Record<string, number> = {}
    if (!isAtlas) {
      for (const [k, v] of tree.selectedMasteryEffects) {
        masteryEffects[k] = v
      }
    }
    const classId = isAtlas ? 0 : (tree.selectedClass ?? 0)
    const ascendClassId = isAtlas ? 0 : tree.selectedAscendancyClassId

    const builds = updateBuild(get().builds, buildId, (b) => ({
      ...b,
      classId,
      banditChoice: isAtlas ? 'none' : tree.banditChoice,
      steps: b.steps.map((s) =>
        s.id === stepId ? { ...s, classId, ascendClassId, allocatedNodeIds, masteryEffects } : s,
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

    _suppressAutoSave = true
    useTreeStore.getState().loadSnapshot({
      classId: step.classId,
      classStartNodeId: resolveStartNode(build, step.classId),
      allocatedNodeIds: step.allocatedNodeIds,
      masteryEffects: step.masteryEffects,
      banditChoice: build.banditChoice,
      treeMode: build.treeMode,
      ascendClassId: step.ascendClassId,
    })
    _suppressAutoSave = false
  },

  exportBuild(buildId) {
    const build = findBuild(get().builds, buildId)
    if (!build) return null
    return encodeBuild(build)
  },

  importBuild(encoded, treeMode) {
    const result = decodeBuild(encoded)
    if ('error' in result) return { success: false, error: result.error }

    const data = result as ExportedBuild
    if (data.treeMode !== treeMode) {
      return {
        success: false,
        error: `This is a ${data.treeMode} build but you're in ${treeMode} mode`,
      }
    }

    const steps = data.steps.map((s, i) =>
      createStep(s.name || `Step ${i + 1}`, s.classId, s.allocatedNodeIds, s.masteryEffects),
    )
    // Preserve descriptions and ascendClassIds from import
    for (let i = 0; i < steps.length; i++) {
      steps[i].description = data.steps[i].description ?? ''
      steps[i].ascendClassId = data.steps[i].ascendClassId ?? 0
    }

    const build: Build = {
      id: generateId(),
      name: data.name,
      treeMode: data.treeMode,
      classId: data.classId,
      banditChoice: data.banditChoice,
      activeStepId: steps[0].id,
      steps,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const builds = [...get().builds, build]
    persist(builds)
    set({ builds })
    return { success: true }
  },
}))

// Auto-save tree changes to the active step
useTreeStore.subscribe((state, prev) => {
  if (_suppressAutoSave) return
  if (
    state.allocatedNodes === prev.allocatedNodes &&
    state.selectedMasteryEffects === prev.selectedMasteryEffects
  )
    return
  const { activeBuildId, activeStepId } = useBuildStore.getState()
  if (activeBuildId && activeStepId) {
    useBuildStore.getState().saveCurrentToStep(activeBuildId, activeStepId)
  }
})

function findClassStartNode(classId: number): string {
  const processedNodes = useTreeStore.getState().processedNodes
  if (!processedNodes) return ''
  for (const [id, pn] of processedNodes) {
    if (pn.node.classStartIndex === classId) return id
  }
  return ''
}
