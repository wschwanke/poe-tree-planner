import { useCallback, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Copy,
  FileDown,
  Pencil,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useBuildStore } from '@/state/build-store'
import type { Build } from '@/types/build'

export function BuildManager() {
  const open = useBuildStore((s) => s.buildManagerOpen)
  const closeBuildManager = useBuildStore((s) => s.closeBuildManager)
  const builds = useBuildStore((s) => s.builds)
  const activeBuildId = useBuildStore((s) => s.activeBuildId)
  const activeStepId = useBuildStore((s) => s.activeStepId)

  const createBuild = useBuildStore((s) => s.createBuild)
  const deleteBuild = useBuildStore((s) => s.deleteBuild)
  const renameBuild = useBuildStore((s) => s.renameBuild)
  const duplicateBuild = useBuildStore((s) => s.duplicateBuild)
  const setActiveBuild = useBuildStore((s) => s.setActiveBuild)

  const addStep = useBuildStore((s) => s.addStep)
  const deleteStep = useBuildStore((s) => s.deleteStep)
  const renameStep = useBuildStore((s) => s.renameStep)
  const updateStepDescription = useBuildStore((s) => s.updateStepDescription)
  const reorderSteps = useBuildStore((s) => s.reorderSteps)
  const duplicateStep = useBuildStore((s) => s.duplicateStep)
  const saveCurrentToStep = useBuildStore((s) => s.saveCurrentToStep)
  const loadStepToTree = useBuildStore((s) => s.loadStepToTree)
  const openPoBExport = useBuildStore((s) => s.openPoBExport)

  const [selectedBuildId, setSelectedBuildId] = useState<string | null>(activeBuildId)

  const selectedBuild = builds.find((b) => b.id === selectedBuildId) ?? null

  const handleCreateBuild = useCallback(() => {
    const name = prompt('Build name:')
    if (!name?.trim()) return
    createBuild(name.trim())
  }, [createBuild])

  const handleRenameBuild = useCallback(
    (buildId: string, currentName: string) => {
      const name = prompt('Rename build:', currentName)
      if (!name?.trim()) return
      renameBuild(buildId, name.trim())
    },
    [renameBuild],
  )

  const handleDeleteBuild = useCallback(
    (buildId: string) => {
      if (!confirm('Delete this build?')) return
      deleteBuild(buildId)
      if (selectedBuildId === buildId) {
        setSelectedBuildId(null)
      }
    },
    [deleteBuild, selectedBuildId],
  )

  const handleAddStep = useCallback(
    (buildId: string) => {
      const name = prompt('Step name:')
      if (!name?.trim()) return
      addStep(buildId, name.trim())
    },
    [addStep],
  )

  const handleRenameStep = useCallback(
    (buildId: string, stepId: string, currentName: string) => {
      const name = prompt('Rename step:', currentName)
      if (!name?.trim()) return
      renameStep(buildId, stepId, name.trim())
    },
    [renameStep],
  )

  const handleExport = useCallback(
    (buildId: string) => {
      setActiveBuild(buildId)
      closeBuildManager()
      openPoBExport()
    },
    [setActiveBuild, closeBuildManager, openPoBExport],
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeBuildManager()}>
      <DialogContent className="bg-stone-950/95 border-stone-700 backdrop-blur-sm sm:max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-stone-100">Build Manager</DialogTitle>
          <DialogDescription className="text-stone-500">
            Create and manage builds with multiple leveling steps
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Left: Builds list */}
          <div className="w-56 flex flex-col gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateBuild}
              className="w-full border-stone-700 hover:bg-stone-800 hover:text-stone-200"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New Build
            </Button>
            <ScrollArea className="flex-1 min-h-0 max-h-[50vh]">
              <div className="space-y-1 pr-2">
                {builds.length === 0 && (
                  <p className="text-xs text-stone-600 text-center py-4">
                    No builds yet
                  </p>
                )}
                {builds.map((build) => (
                  <BuildListItem
                    key={build.id}
                    build={build}
                    isSelected={build.id === selectedBuildId}
                    isActive={build.id === activeBuildId}
                    onSelect={() => setSelectedBuildId(build.id)}
                    onRename={() => handleRenameBuild(build.id, build.name)}
                    onDuplicate={() => duplicateBuild(build.id)}
                    onDelete={() => handleDeleteBuild(build.id)}
                    onActivate={() => {
                      setActiveBuild(build.id)
                      closeBuildManager()
                    }}
                    onExport={() => handleExport(build.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>

          <Separator orientation="vertical" className="bg-stone-800" />

          {/* Right: Steps for selected build */}
          <div className="flex-1 flex flex-col gap-2 min-h-0">
            {selectedBuild ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-stone-200 truncate">
                    {selectedBuild.name}
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddStep(selectedBuild.id)}
                    className="h-7 border-stone-700 hover:bg-stone-800 hover:text-stone-200"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Step
                  </Button>
                </div>
                <ScrollArea className="flex-1 min-h-0 max-h-[50vh]">
                  <div className="space-y-2 pr-2">
                    {selectedBuild.steps.map((step, index) => (
                      <StepCard
                        key={step.id}
                        buildId={selectedBuild.id}
                        step={step}
                        index={index}
                        totalSteps={selectedBuild.steps.length}
                        isActiveStep={
                          selectedBuild.id === activeBuildId && step.id === activeStepId
                        }
                        onRename={() =>
                          handleRenameStep(selectedBuild.id, step.id, step.name)
                        }
                        onDelete={() => deleteStep(selectedBuild.id, step.id)}
                        onDuplicate={() => duplicateStep(selectedBuild.id, step.id)}
                        onMoveUp={() =>
                          reorderSteps(selectedBuild.id, index, index - 1)
                        }
                        onMoveDown={() =>
                          reorderSteps(selectedBuild.id, index, index + 1)
                        }
                        onSaveCurrent={() =>
                          saveCurrentToStep(selectedBuild.id, step.id)
                        }
                        onLoad={() => {
                          loadStepToTree(selectedBuild.id, step.id)
                          setActiveBuild(selectedBuild.id)
                          closeBuildManager()
                        }}
                        onDescriptionChange={(desc) =>
                          updateStepDescription(selectedBuild.id, step.id, desc)
                        }
                      />
                    ))}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-stone-600">Select a build to manage its steps</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface BuildListItemProps {
  build: Build
  isSelected: boolean
  isActive: boolean
  onSelect: () => void
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
  onActivate: () => void
  onExport: () => void
}

function BuildListItem({
  build,
  isSelected,
  isActive,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onActivate,
  onExport,
}: BuildListItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      className={`p-2 rounded border transition-colors cursor-pointer ${
        isSelected
          ? 'border-amber-500/50 bg-amber-500/5'
          : 'border-stone-800 hover:border-stone-600 hover:bg-stone-900/50'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm text-stone-200 truncate flex-1">{build.name}</span>
        {isActive && (
          <Badge className="bg-green-700/50 text-green-300 text-[10px] px-1.5 py-0">
            Active
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1 text-[10px] text-stone-500 mb-1.5">
        <span>
          {build.steps.length} step{build.steps.length !== 1 ? 's' : ''}
        </span>
      </div>
      {isSelected && (
        <div className="flex items-center gap-1 mt-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={(e) => {
              e.stopPropagation()
              onActivate()
            }}
            className="h-6 px-1.5 text-[10px] text-stone-400 hover:text-stone-200"
            title="Load build"
          >
            Load
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={(e) => {
              e.stopPropagation()
              onExport()
            }}
            className="h-6 px-1.5 text-[10px] text-stone-400 hover:text-stone-200"
            title="Export to PoB"
          >
            <FileDown className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={(e) => {
              e.stopPropagation()
              onRename()
            }}
            className="h-6 w-6 p-0 text-stone-400 hover:text-stone-200"
            title="Rename"
          >
            <Pencil className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={(e) => {
              e.stopPropagation()
              onDuplicate()
            }}
            className="h-6 w-6 p-0 text-stone-400 hover:text-stone-200"
            title="Duplicate"
          >
            <Copy className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="h-6 w-6 p-0 text-stone-400 hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  )
}

interface StepCardProps {
  buildId: string
  step: { id: string; name: string; description: string; allocatedNodeIds: string[] }
  index: number
  totalSteps: number
  isActiveStep: boolean
  onRename: () => void
  onDelete: () => void
  onDuplicate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onSaveCurrent: () => void
  onLoad: () => void
  onDescriptionChange: (desc: string) => void
}

function StepCard({
  step,
  index,
  totalSteps,
  isActiveStep,
  onRename,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onSaveCurrent,
  onLoad,
  onDescriptionChange,
}: StepCardProps) {
  const [editing, setEditing] = useState(false)
  const descRef = useRef<HTMLTextAreaElement>(null)

  const nodeCount = step.allocatedNodeIds.length
  const pointCount = nodeCount > 0 ? nodeCount - 1 : 0

  return (
    <div
      className={`p-3 rounded border ${
        isActiveStep
          ? 'border-amber-500/50 bg-amber-500/5'
          : 'border-stone-800 bg-stone-900/30'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-stone-700 text-stone-500">
          {index + 1}
        </Badge>
        <span className="text-sm font-medium text-stone-200 flex-1 truncate">{step.name}</span>
        {isActiveStep && (
          <Badge className="bg-green-700/50 text-green-300 text-[10px] px-1.5 py-0">
            Active
          </Badge>
        )}
        <span className="text-xs text-stone-500">{pointCount} pts</span>
      </div>

      {/* Description */}
      {editing ? (
        <textarea
          ref={descRef}
          defaultValue={step.description}
          onBlur={(e) => {
            onDescriptionChange(e.target.value)
            setEditing(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false)
          }}
          autoFocus
          rows={2}
          className="w-full text-xs bg-stone-900 border border-stone-700 rounded px-2 py-1 text-stone-300 resize-none focus:outline-none focus:border-amber-500/50 mb-2"
          placeholder="Add notes..."
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full text-left text-xs text-stone-500 hover:text-stone-400 mb-2 min-h-[20px]"
        >
          {step.description || 'Click to add notes...'}
        </button>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="xs"
          onClick={onLoad}
          className="h-6 px-2 text-[10px] border-stone-700 hover:bg-stone-800 hover:text-stone-200"
        >
          Load
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={onSaveCurrent}
          className="h-6 px-2 text-[10px] border-stone-700 hover:bg-stone-800 hover:text-stone-200"
          title="Save current tree to this step"
        >
          <Save className="w-3 h-3" />
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="xs"
          onClick={onMoveUp}
          disabled={index === 0}
          className="h-6 w-6 p-0 text-stone-500 hover:text-stone-200 disabled:opacity-30"
        >
          <ArrowUp className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={onMoveDown}
          disabled={index === totalSteps - 1}
          className="h-6 w-6 p-0 text-stone-500 hover:text-stone-200 disabled:opacity-30"
        >
          <ArrowDown className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={onRename}
          className="h-6 w-6 p-0 text-stone-500 hover:text-stone-200"
        >
          <Pencil className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={onDuplicate}
          className="h-6 w-6 p-0 text-stone-500 hover:text-stone-200"
        >
          <Copy className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={onDelete}
          disabled={totalSteps <= 1}
          className="h-6 w-6 p-0 text-stone-500 hover:text-red-400 disabled:opacity-30"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}
