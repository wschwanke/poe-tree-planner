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
import { HelpMenu } from './HelpMenu'
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
  const { viewportRef, dirtyRef, viewportState, setViewportState, handlePan, handleCenterOn } =
    useViewport(canvasRef)

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
        const flag: PlanningFlag = event.ctrlKey
          ? 'blocked'
          : event.button === 2
            ? 'wouldLike'
            : 'required'
        toggleFlag(event.nodeId, flag)
      } else {
        if (event.button === 2) return
        handleNodeClick(event.nodeId)
      }
    },
    [planningActive, toggleFlag, handleNodeClick],
  )

  // Mark dirty when store state changes that affect rendering
  const prevAllocatedRef = useRef(allocatedNodes)
  const prevCanAllocateRef = useRef(canAllocateNodes)
  const prevHoveredRef = useRef(hoveredNodeId)
  const prevHoveredPathRef = useRef(hoveredPath)
  if (
    allocatedNodes !== prevAllocatedRef.current ||
    canAllocateNodes !== prevCanAllocateRef.current ||
    hoveredNodeId !== prevHoveredRef.current ||
    hoveredPath !== prevHoveredPathRef.current
  ) {
    dirtyRef.current = true
    prevAllocatedRef.current = allocatedNodes
    prevCanAllocateRef.current = canAllocateNodes
    prevHoveredRef.current = hoveredNodeId
    prevHoveredPathRef.current = hoveredPath
  }

  const interaction = useCanvasInteraction({
    processedNodes,
    spatialIndex,
    viewportRef,
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
        dirtyRef.current = true
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dirtyRef])

  // Preload sprites when zoom level changes (not on every fractional zoom)
  const lastPreloadZoomRef = useRef<string>('')
  useEffect(() => {
    const checkZoom = () => {
      const zoomLevel = sprites.getZoomLevel(viewportRef.current.zoom)
      if (zoomLevel !== lastPreloadZoomRef.current) {
        lastPreloadZoomRef.current = zoomLevel
        sprites.preloadAllCategories(viewportRef.current.zoom)
      }
    }
    checkZoom()
    // Re-check periodically in case zoom changed
    const interval = setInterval(checkZoom, 200)
    return () => clearInterval(interval)
  }, [sprites, viewportRef])

  // Render loop — reads from refs, only renders when dirty
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    // Track last known search state to detect changes
    let lastSearchSize = useSearchStore.getState().matchingNodeIds.size
    let lastPlanningVersion = 0

    const frame = (timestamp: number) => {
      const vp = viewportRef.current

      // Set canvas size for DPR (only when dimensions change)
      const dpr = window.devicePixelRatio || 1
      const targetW = vp.width * dpr
      const targetH = vp.height * dpr
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW
        canvas.height = targetH
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        dirtyRef.current = true
      }

      // Check if search state changed
      const searchState = useSearchStore.getState()
      if (searchState.matchingNodeIds.size !== lastSearchSize) {
        lastSearchSize = searchState.matchingNodeIds.size
        dirtyRef.current = true
      }

      // Check if planning state changed
      const planningState = usePlanningStore.getState()
      const planVer =
        planningState.requiredNodes.size +
        planningState.wouldLikeNodes.size * 100 +
        planningState.blockedNodes.size * 10000 +
        planningState.solverPreview.size * 1000000 +
        (planningState.active ? 1 : 0)
      if (planVer !== lastPlanningVersion) {
        lastPlanningVersion = planVer
        dirtyRef.current = true
      }

      // Animate search highlights — only dirty if there's an active search
      if (searchState.matchingNodeIds.size > 0) {
        dirtyRef.current = true
      }

      if (dirtyRef.current) {
        dirtyRef.current = false

        // Sync throttled state for React components (tooltip, etc.)
        setViewportState(vp)

        render(ctx, vp, {
          data,
          processedNodes,
          adjacency,
          spatialIndex,
          sprites,
          allocatedNodes,
          canAllocateNodes,
          hoveredNodeId,
          hoveredPath,
          searchMatchNodeIds: searchState.matchingNodeIds,
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
      }

      animId = requestAnimationFrame(frame)
    }
    animId = requestAnimationFrame(frame)

    return () => cancelAnimationFrame(animId)
  }, [
    data,
    processedNodes,
    adjacency,
    spatialIndex,
    sprites,
    allocatedNodes,
    canAllocateNodes,
    hoveredNodeId,
    hoveredPath,
    viewportRef,
    dirtyRef,
    setViewportState,
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
        style={{ width: viewportState.width, height: viewportState.height }}
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
        <HelpMenu />
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
            viewport={viewportState}
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
