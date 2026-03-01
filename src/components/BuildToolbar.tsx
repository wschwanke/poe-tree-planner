import { useCallback } from 'react'
import { FolderOpen, Plus, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBuildStore } from '@/state/build-store'

export function BuildToolbar() {
  const activeBuildId = useBuildStore((s) => s.activeBuildId)
  const activeStepId = useBuildStore((s) => s.activeStepId)
  const builds = useBuildStore((s) => s.builds)
  const openBuildManager = useBuildStore((s) => s.openBuildManager)
  const saveCurrentToStep = useBuildStore((s) => s.saveCurrentToStep)
  const loadStepToTree = useBuildStore((s) => s.loadStepToTree)
  const addStep = useBuildStore((s) => s.addStep)

  const activeBuild = builds.find((b) => b.id === activeBuildId)

  const handleSave = useCallback(() => {
    if (activeBuildId && activeStepId) {
      saveCurrentToStep(activeBuildId, activeStepId)
    }
  }, [activeBuildId, activeStepId, saveCurrentToStep])

  const handleAddStep = useCallback(() => {
    if (activeBuildId) {
      addStep(activeBuildId)
    }
  }, [activeBuildId, addStep])

  if (!activeBuild) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={openBuildManager}
        className="h-7 px-2.5 bg-stone-950/90 border-amber-900/50 text-stone-400 backdrop-blur-sm hover:bg-stone-900/90 hover:text-stone-200"
      >
        <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
        Builds
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-1.5 bg-stone-950/90 border border-amber-900/50 rounded-md backdrop-blur-sm px-2 py-1">
      <button
        type="button"
        onClick={openBuildManager}
        className="text-xs font-medium text-amber-400 hover:text-amber-300 truncate max-w-[120px]"
        title={activeBuild.name}
      >
        {activeBuild.name}
      </button>

      <div className="w-px h-4 bg-stone-700" />

      {/* Step tabs */}
      <div className="flex items-center gap-0.5">
        {activeBuild.steps.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => loadStepToTree(activeBuild.id, step.id)}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              step.id === activeStepId
                ? 'bg-amber-500/20 text-amber-300 font-medium'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
            title={step.name}
          >
            {step.name}
          </button>
        ))}
        <button
          type="button"
          onClick={handleAddStep}
          className="text-stone-500 hover:text-stone-300 px-1 py-0.5 rounded hover:bg-stone-800/50"
          title="Add step"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      <div className="w-px h-4 bg-stone-700" />

      <Button
        variant="ghost"
        size="xs"
        onClick={handleSave}
        className="h-5 w-5 p-0 text-stone-400 hover:text-stone-200"
        title="Save current tree to step"
      >
        <Save className="w-3 h-3" />
      </Button>
    </div>
  )
}
