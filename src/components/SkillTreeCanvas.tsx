import { useCallback, useEffect, useRef } from 'react'
import { render } from '@/canvas/renderer'
import { type NodeClickEvent, useCanvasInteraction } from '@/hooks/useCanvasInteraction'
import { useSearch } from '@/hooks/useSearch'
import type { SkillTreeContext } from '@/hooks/useSkillTree'
import { useViewport } from '@/hooks/useViewport'
import type { PlanningFlag } from '@/state/planning-store'
import { usePlanningStore } from '@/state/planning-store'
import { useSearchStore } from '@/state/search-store'
import { useTreeStore } from '@/state/tree-store'
import { ClassSelector } from './ClassSelectionDialog'
import { CommandPalette } from './CommandPalette'
import { MasterySelectionDialog } from './MasterySelectionDialog'
import { NodeTooltip } from './NodeTooltip'
import { PlanningToolbar } from './PlanningToolbar'
import { PointCounter } from './PointCounter'
import { QuickSearch } from './QuickSearch'
import { StatSummaryPanel } from './StatSummaryPanel'

interface SkillTreeCanvasProps {
  context: SkillTreeContext
}

export function SkillTreeCanvas({ context }: SkillTreeCanvasProps) {
  const { data, processedNodes, adjacency, spatialIndex, sprites } = context
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { viewport, handlePan, handleCenterOn } = useViewport(canvasRef)

  // Initialize store context
  useEffect(() => {
    useTreeStore.getState().setContext(processedNodes, adjacency)
  }, [processedNodes, adjacency])

  const selectedClass = useTreeStore((s) => s.selectedClass)
  const allocatedNodes = useTreeStore((s) => s.allocatedNodes)
  const hoveredNodeId = useTreeStore((s) => s.hoveredNodeId)
  const selectedMasteryEffects = useTreeStore((s) => s.selectedMasteryEffects)
  const masteryDialogNodeId = useTreeStore((s) => s.masteryDialogNodeId)
  const canAllocateNodes = useTreeStore((s) => s.canAllocateNodes)
  const pointsUsed = useTreeStore((s) => s.pointsUsed)
  const totalPoints = useTreeStore((s) => s.totalPoints)
  const hoveredPath = useTreeStore((s) => s.hoveredPath)

  const selectClass = useTreeStore((s) => s.selectClass)
  const handleNodeClick = useTreeStore((s) => s.handleNodeClick)
  const setHovered = useTreeStore((s) => s.setHovered)
  const reset = useTreeStore((s) => s.reset)
  const handleMasterySelect = useTreeStore((s) => s.handleMasterySelect)
  const handleMasteryUnallocate = useTreeStore((s) => s.handleMasteryUnallocate)
  const closeMasteryDialog = useTreeStore((s) => s.closeMasteryDialog)

  const planningActive = usePlanningStore((s) => s.active)
  const toggleFlag = usePlanningStore((s) => s.toggleFlag)

  const handleCanvasNodeClick = useCallback(
    (event: NodeClickEvent) => {
      if (planningActive) {
        const flag: PlanningFlag =
          event.button === 2
            ? 'required'
            : event.altKey
              ? 'blocked'
              : 'wouldLike'
        toggleFlag(event.nodeId, flag)
      } else {
        if (event.button === 2) return
        handleNodeClick(event.nodeId)
      }
    },
    [planningActive, toggleFlag, handleNodeClick],
  )

  const interaction = useCanvasInteraction({
    processedNodes,
    spatialIndex,
    viewport,
    onPan: handlePan,
    onNodeClick: handleCanvasNodeClick,
    onHover: setHovered,
  })

  const search = useSearch(processedNodes)

  const handleSearchSelectResult = useCallback(
    (nodeId: string) => {
      const pn = processedNodes.get(nodeId)
      if (pn) {
        handleCenterOn(pn.worldX, pn.worldY, 0.5)
      }
    },
    [processedNodes, handleCenterOn],
  )

  const handleClassSelect = useCallback(
    (classIndex: number, startNodeId: string) => {
      selectClass(classIndex, startNodeId)
      localStorage.setItem('poe-tree-selected-class', String(classIndex))
      const pn = processedNodes.get(startNodeId)
      if (pn) {
        handleCenterOn(pn.worldX, pn.worldY, 0.35)
      }
    },
    [selectClass, processedNodes, handleCenterOn],
  )

  // Restore class selection from localStorage on mount
  useEffect(() => {
    if (selectedClass !== null) return
    const saved = localStorage.getItem('poe-tree-selected-class')
    if (saved === null) return
    const classIndex = Number(saved)
    for (const [id, pn] of processedNodes) {
      if (pn.node.classStartIndex === classIndex) {
        selectClass(classIndex, id)
        return
      }
    }
  }, [processedNodes, selectClass, selectedClass])

  // Toggle planning mode with P key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        usePlanningStore.getState().togglePlanningMode()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Preload sprites when zoom changes
  useEffect(() => {
    sprites.preloadAllCategories(viewport.zoom)
  }, [sprites, viewport.zoom])

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size for DPR
    const dpr = window.devicePixelRatio || 1
    canvas.width = viewport.width * dpr
    canvas.height = viewport.height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    let animId: number
    const frame = (timestamp: number) => {
      const planningState = usePlanningStore.getState()
      render(ctx, viewport, {
        data,
        processedNodes,
        adjacency,
        spatialIndex,
        sprites,
        allocatedNodes,
        canAllocateNodes,
        hoveredNodeId,
        hoveredPath,
        searchMatchNodeIds: useSearchStore.getState().matchingNodeIds,
        animationTime: timestamp,
        planningFlags: planningState.active
          ? {
              required: planningState.requiredNodes,
              wouldLike: planningState.wouldLikeNodes,
              blocked: planningState.blockedNodes,
            }
          : null,
        solverPreview: planningState.solverPreview,
      })
      animId = requestAnimationFrame(frame)
    }
    animId = requestAnimationFrame(frame)

    return () => cancelAnimationFrame(animId)
  }, [
    viewport,
    data,
    processedNodes,
    adjacency,
    spatialIndex,
    sprites,
    allocatedNodes,
    canAllocateNodes,
    hoveredNodeId,
    hoveredPath,
  ])

  const hoveredNode = hoveredNodeId ? processedNodes.get(hoveredNodeId) : null

  const masteryDialogNode = masteryDialogNodeId
    ? (processedNodes.get(masteryDialogNodeId) ?? null)
    : null
  const currentMasteryEffect = masteryDialogNodeId
    ? (selectedMasteryEffects.get(masteryDialogNodeId) ?? null)
    : null

  return (
    <div className="relative w-full h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 ${hoveredNodeId ? 'cursor-pointer' : planningActive ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
        style={{ width: viewport.width, height: viewport.height }}
        onMouseDown={interaction.handleMouseDown}
        onMouseMove={interaction.handleMouseMove}
        onMouseUp={interaction.handleMouseUp}
        onMouseLeave={interaction.handleMouseLeave}
        onContextMenu={interaction.handleContextMenu}
      />

      {/* Top bar: class selector + point counter + search */}
      <div className="absolute top-3 left-3 z-40 flex items-center gap-3">
        <ClassSelector
          data={data}
          processedNodes={processedNodes}
          selectedClass={selectedClass}
          onSelect={handleClassSelect}
        />
        {selectedClass !== null && <PointCounter used={pointsUsed} total={totalPoints} />}
        <QuickSearch
          searchQuery={search.searchQuery}
          onSearchChange={search.setSearchQuery}
          onOpenCommandPalette={search.openCommandPalette}
          matchCount={search.matchCount}
        />
        {selectedClass !== null && (
          <PlanningToolbar
            adjacency={adjacency}
            processedNodes={processedNodes}
          />
        )}
      </div>

      {/* Mastery selection dialog */}
      <MasterySelectionDialog
        open={masteryDialogNodeId !== null}
        node={masteryDialogNode}
        currentEffectIndex={currentMasteryEffect}
        canAffordPoint={pointsUsed < totalPoints || currentMasteryEffect !== null}
        onSelectEffect={handleMasterySelect}
        onUnallocate={handleMasteryUnallocate}
        onClose={closeMasteryDialog}
      />

      {/* Command palette (Ctrl+K) */}
      <CommandPalette
        open={search.commandPaletteOpen}
        onClose={search.closeCommandPalette}
        searchQuery={search.searchQuery}
        onSearchChange={search.setSearchQuery}
        results={search.results}
        onSelectResult={handleSearchSelectResult}
      />

      {/* Node tooltip */}
      {hoveredNode?.node.name && (
        <div className="absolute inset-0 pointer-events-none">
          <NodeTooltip
            node={hoveredNode}
            viewport={viewport}
            allocated={allocatedNodes.has(hoveredNode.id)}
            selectedMasteryEffects={selectedMasteryEffects}
            classes={data.classes}
          />
        </div>
      )}

      {/* Stat summary panel */}
      {selectedClass !== null && (
        <StatSummaryPanel
          allocatedNodes={allocatedNodes}
          processedNodes={processedNodes}
          selectedMasteryEffects={selectedMasteryEffects}
          pointsUsed={pointsUsed}
          totalPoints={totalPoints}
          onReset={reset}
        />
      )}
    </div>
  )
}
