import { useCallback, useState } from 'react'
import { FolderOpen, Plus, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

  const [dialogOpen, setDialogOpen] = useState(false)
  const [stepName, setStepName] = useState('')

  const handleSave = useCallback(() => {
    if (activeBuildId && activeStepId) {
      saveCurrentToStep(activeBuildId, activeStepId)
    }
  }, [activeBuildId, activeStepId, saveCurrentToStep])

  const handleOpenDialog = useCallback(() => {
    setStepName('')
    setDialogOpen(true)
  }, [])

  const handleSubmitStep = useCallback(() => {
    if (!activeBuildId || !activeBuild) return
    const defaultName = `Step ${activeBuild.steps.length + 1}`
    addStep(activeBuildId, stepName.trim() || defaultName)
    setDialogOpen(false)
    setStepName('')
  }, [activeBuildId, activeBuild, addStep, stepName])

  const handleStepChange = useCallback(
    (stepId: string) => {
      if (activeBuild) {
        loadStepToTree(activeBuild.id, stepId)
      }
    },
    [activeBuild, loadStepToTree],
  )

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

      <Select value={activeStepId ?? undefined} onValueChange={handleStepChange}>
        <SelectTrigger
          size="sm"
          className="h-6 min-w-[80px] max-w-[140px] px-2 text-xs bg-transparent border-stone-700 text-stone-300"
        >
          <SelectValue placeholder="Step..." />
        </SelectTrigger>
        <SelectContent className="bg-stone-950 border-stone-700">
          {activeBuild.steps.map((step) => (
            <SelectItem key={step.id} value={step.id} className="text-xs">
              {step.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="xs"
        onClick={handleOpenDialog}
        className="h-5 w-5 p-0 text-stone-500 hover:text-stone-200"
        title="Add step"
      >
        <Plus className="w-3 h-3" />
      </Button>

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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-stone-950/95 border-stone-700 backdrop-blur-sm sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-stone-100">Add Step</DialogTitle>
            <DialogDescription className="text-stone-500">
              Name the new step for your build
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSubmitStep()
            }}
            className="flex flex-col gap-3"
          >
            <Input
              autoFocus
              value={stepName}
              onChange={(e) => setStepName(e.target.value)}
              placeholder={`Step ${activeBuild ? activeBuild.steps.length + 1 : 1}`}
              className="bg-stone-900 border-stone-700 text-stone-200 focus-visible:ring-amber-500/30 focus-visible:border-amber-500/50"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDialogOpen(false)}
                className="text-stone-400 hover:text-stone-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-amber-600 hover:bg-amber-500 text-stone-950"
              >
                Add
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
