import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { render } from '@/canvas/renderer'
import { solveSteinerTree } from '@/data/solver'
import { type NodeClickEvent, useCanvasInteraction } from '@/hooks/useCanvasInteraction'
import { useSearch } from '@/hooks/useSearch'
import type { SkillTreeContext } from '@/hooks/useSkillTree'
import { useViewport } from '@/hooks/useViewport'
import { buildMergedData, generateClusterNodes, isClusterSocket } from '@/data/cluster-jewels'
import type { PlanningFlag } from '@/state/planning-store'
import { usePlanningStore } from '@/state/planning-store'
import { useClusterStore } from '@/state/cluster-store'
import { useSearchStore } from '@/state/search-store'
import { useTreeStore } from '@/state/tree-store'
import { EXPANSION_SIZE_MAP } from '@/types/cluster-jewel'
import type { TreeMode } from '@/types/skill-tree'
import { BuildManager } from './BuildManager'
import { BuildToolbar } from './BuildToolbar'
import { ClassSelector } from './ClassSelectionDialog'
import { ClusterJewelDialog } from './ClusterJewelDialog'
import { HelpMenu } from './HelpMenu'
import { CommandPalette } from './CommandPalette'
import { MasterySelectionDialog } from './MasterySelectionDialog'
import { NodeTooltip } from './NodeTooltip'
import { PlanningInfoPanel } from './PlanningInfoPanel'
import { PoBExportDialog } from './PoBExportDialog'
import { PointCounter } from './PointCounter'
import { QuickSearch } from './QuickSearch'
import { SettingsDialog } from './SettingsDialog'
import { StatSummaryPanel } from './StatSummaryPanel'

interface SkillTreeCanvasProps {
  context: SkillTreeContext
  treeMode: TreeMode
  onTreeModeChange: (mode: TreeMode) => void
}

export function SkillTreeCanvas({ context, treeMode, onTreeModeChange }: SkillTreeCanvasProps) {
  const { data, processedNodes, adjacency, spatialIndex, sprites } = context
  const isAtlas = treeMode === 'atlas'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { viewportRef, dirtyRef, viewportState, setViewportState, handlePan, handleCenterOn } =
    useViewport(canvasRef)

  // Cluster store
  const clusterJewels = useClusterStore((s) => s.clusterJewels)
  const clusterVersion = useClusterStore((s) => s.version)
  const clusterDialogSocketId = useClusterStore((s) => s.dialogSocketId)
  const openClusterDialog = useClusterStore((s) => s.openDialog)
  const closeClusterDialog = useClusterStore((s) => s.closeDialog)
  const setClusterJewel = useClusterStore((s) => s.setClusterJewel)
  const removeClusterJewel = useClusterStore((s) => s.removeClusterJewel)

  // Merge cluster virtual nodes with base tree data (skip for atlas — no cluster jewels)
  const merged = useMemo(() => {
    if (isAtlas || clusterJewels.size === 0) {
      return {
        processedNodes,
        adjacency,
        spatialIndex,
      }
    }

    // Generate virtual nodes for each cluster jewel, processing parents before children
    // so nested clusters can find their parent's virtual sub-sockets
    const clusterResults = new Map<string, ReturnType<typeof generateClusterNodes>>()

    // Sort: non-virtual sockets first (real tree nodes), then virtual sockets (nested)
    const sortedEntries = [...clusterJewels.entries()].sort((a, b) => {
      const aVirtual = a[0].startsWith('cv:') ? 1 : 0
      const bVirtual = b[0].startsWith('cv:') ? 1 : 0
      return aVirtual - bVirtual
    })

    // Build incrementally so child clusters can reference parent virtual nodes
    let currentNodes = processedNodes
    for (const [socketId, config] of sortedEntries) {
      const result = generateClusterNodes(socketId, config, data, currentNodes)
      clusterResults.set(socketId, result)
      // Merge this result into currentNodes for subsequent iterations
      if (result.virtualNodes.size > 0) {
        const next = new Map(currentNodes)
        for (const [id, pn] of result.virtualNodes) next.set(id, pn)
        currentNodes = next
      }
    }

    return buildMergedData(processedNodes, adjacency, clusterResults)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processedNodes, adjacency, spatialIndex, data, clusterJewels, clusterVersion, isAtlas])

  // Initialize store context with merged data
  useEffect(() => {
    useTreeStore.getState().setContext(merged.processedNodes, merged.adjacency)
  }, [merged.processedNodes, merged.adjacency])

  // Initialize atlas mode when context loads
  useEffect(() => {
    if (isAtlas) {
      useTreeStore.getState().initAtlas()
    }
  }, [isAtlas, merged.processedNodes])

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
  const deallocateNodes = useTreeStore((s) => s.deallocateNodes)
  const undo = useTreeStore((s) => s.undo)
  const canUndo = useTreeStore((s) => s.canUndo)

  const planningActive = usePlanningStore((s) => s.active)
  const togglePlanningMode = usePlanningStore((s) => s.togglePlanningMode)
  const toggleFlag = usePlanningStore((s) => s.toggleFlag)

  const handleCanvasNodeClick = useCallback(
    (event: NodeClickEvent) => {
      if (planningActive) {
        const flag: PlanningFlag = event.button === 2 ? 'blocked' : 'required'
        toggleFlag(event.nodeId, flag)
      } else {
        if (event.button === 2) return

        if (!isAtlas) {
          // Check for cluster socket click — open dialog instead of unallocating
          if (allocatedNodes.has(event.nodeId)) {
            const pn = merged.processedNodes.get(event.nodeId)
            if (pn?.node.isJewelSocket && isClusterSocket(pn.node)) {
              openClusterDialog(event.nodeId)
              return
            }
          }

          // For unallocated cluster sockets, allocate then open dialog
          const pn = merged.processedNodes.get(event.nodeId)
          if (pn?.node.isJewelSocket && isClusterSocket(pn.node) && canAllocateNodes.has(event.nodeId)) {
            handleNodeClick(event.nodeId)
            openClusterDialog(event.nodeId)
            return
          }
        }

        handleNodeClick(event.nodeId)
      }
    },
    [planningActive, toggleFlag, handleNodeClick, allocatedNodes, canAllocateNodes, merged.processedNodes, openClusterDialog, isAtlas],
  )

  // Clean up cluster configs when their sockets are unallocated (skill tree only)
  useEffect(() => {
    if (isAtlas) return
    const jewels = useClusterStore.getState().clusterJewels
    for (const socketId of jewels.keys()) {
      if (!allocatedNodes.has(socketId)) {
        // Socket was unallocated — collect all virtual node IDs for this cluster
        const virtualIds = new Set<string>()
        for (const id of allocatedNodes) {
          if (id.startsWith(`cv:${socketId}:`)) {
            virtualIds.add(id)
          }
        }
        if (virtualIds.size > 0) {
          deallocateNodes(virtualIds)
        }
        removeClusterJewel(socketId)
      }
    }
  }, [allocatedNodes, deallocateNodes, removeClusterJewel, isAtlas])

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
    processedNodes: merged.processedNodes,
    spatialIndex: merged.spatialIndex,
    viewportRef,
    onPan: handlePan,
    onNodeClick: handleCanvasNodeClick,
    onHover: setHovered,
  })

  const search = useSearch(merged.processedNodes)

  const handleSearchSelectResult = useCallback(
    (nodeId: string) => {
      const pn = merged.processedNodes.get(nodeId)
      if (pn) {
        handleCenterOn(pn.worldX, pn.worldY, 0.5)
      }
    },
    [merged.processedNodes, handleCenterOn],
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

  // Restore class selection from localStorage on mount (skill tree only)
  useEffect(() => {
    if (isAtlas) return
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
  }, [processedNodes, selectClass, selectedClass, isAtlas])

  // Keyboard shortcuts: P=planning, Escape=exit planning, Enter=solve/apply, Ctrl+Z=undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        useTreeStore.getState().undo()
        dirtyRef.current = true
        return
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        usePlanningStore.getState().togglePlanningMode()
        dirtyRef.current = true
      }
      if (e.key === 'Escape') {
        const ps = usePlanningStore.getState()
        if (ps.active) {
          e.preventDefault()
          ps.setPlanningMode(false)
          dirtyRef.current = true
        }
      }
      if (e.key === 'Enter') {
        const ps = usePlanningStore.getState()
        if (!ps.active) return
        e.preventDefault()
        if (ps.solverStatus === 'solved' && ps.solverPointCost > 0) {
          // Apply the solved result
          useTreeStore.getState().applyNodes(ps.solverPreview)
          ps.clearFlags()
          ps.setPlanningMode(false)
        } else if (ps.requiredNodes.size > 0) {
          // Solve
          const ts = useTreeStore.getState()
          if (!ts.classStartNodeId) return
          const result = solveSteinerTree(
            ts.classStartNodeId,
            ps.requiredNodes,
            ps.blockedNodes,
            merged.adjacency,
            ts.allocatedNodes,
            merged.processedNodes,
            ps.preferNotables,
          )
          if ('error' in result) {
            ps.clearSolverPreview()
            usePlanningStore.setState({ solverStatus: 'error', solverError: result.error })
          } else {
            ps.setSolverResult(result.nodes, result.cost)
          }
        }
        dirtyRef.current = true
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dirtyRef, merged.adjacency, merged.processedNodes])

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
    let lastClusterVersion = clusterVersion

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
        planningState.blockedNodes.size * 10000 +
        planningState.solverPreview.size * 1000000 +
        (planningState.active ? 1 : 0)
      if (planVer !== lastPlanningVersion) {
        lastPlanningVersion = planVer
        dirtyRef.current = true
      }

      // Check if cluster state changed
      const currentClusterVersion = useClusterStore.getState().version
      if (currentClusterVersion !== lastClusterVersion) {
        lastClusterVersion = currentClusterVersion
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
          processedNodes: merged.processedNodes,
          adjacency: merged.adjacency,
          spatialIndex: merged.spatialIndex,
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
    merged,
    sprites,
    allocatedNodes,
    canAllocateNodes,
    hoveredNodeId,
    hoveredPath,
    viewportRef,
    dirtyRef,
    setViewportState,
    clusterVersion,
  ])

  const hoveredNode = hoveredNodeId ? merged.processedNodes.get(hoveredNodeId) : null

  const masteryDialogNode = masteryDialogNodeId
    ? (merged.processedNodes.get(masteryDialogNodeId) ?? null)
    : null
  const currentMasteryEffect = masteryDialogNodeId
    ? (selectedMasteryEffects.get(masteryDialogNodeId) ?? null)
    : null

  // Cluster dialog data
  const clusterDialogNode = clusterDialogSocketId
    ? merged.processedNodes.get(clusterDialogSocketId)
    : null
  const clusterDialogSocketSize = clusterDialogNode?.node.expansionJewel
    ? (EXPANSION_SIZE_MAP[clusterDialogNode.node.expansionJewel.size] ?? null)
    : null
  const clusterDialogCurrentConfig = clusterDialogSocketId
    ? (clusterJewels.get(clusterDialogSocketId) ?? null)
    : null

  const handleClusterConfigure = useCallback(
    (config: Parameters<typeof setClusterJewel>[1]) => {
      if (!clusterDialogSocketId) return
      // If updating an existing jewel, deallocate old virtual nodes first
      if (clusterJewels.has(clusterDialogSocketId)) {
        const virtualIds = new Set<string>()
        for (const id of allocatedNodes) {
          if (id.startsWith(`cv:${clusterDialogSocketId}:`)) {
            virtualIds.add(id)
          }
        }
        if (virtualIds.size > 0) {
          deallocateNodes(virtualIds)
        }
      }
      setClusterJewel(clusterDialogSocketId, config)
      closeClusterDialog()
    },
    [clusterDialogSocketId, clusterJewels, allocatedNodes, setClusterJewel, closeClusterDialog, deallocateNodes],
  )

  const handleClusterRemove = useCallback(() => {
    if (!clusterDialogSocketId) return
    const virtualIds = new Set<string>()
    for (const id of allocatedNodes) {
      if (id.startsWith(`cv:${clusterDialogSocketId}:`)) {
        virtualIds.add(id)
      }
    }
    if (virtualIds.size > 0) {
      deallocateNodes(virtualIds)
    }
    removeClusterJewel(clusterDialogSocketId)
    closeClusterDialog()
  }, [clusterDialogSocketId, allocatedNodes, deallocateNodes, removeClusterJewel, closeClusterDialog])

  const handleClusterUnallocate = useCallback(() => {
    if (!clusterDialogSocketId) return
    // Deallocate all virtual nodes first
    const virtualIds = new Set<string>()
    for (const id of allocatedNodes) {
      if (id.startsWith(`cv:${clusterDialogSocketId}:`)) {
        virtualIds.add(id)
      }
    }
    if (virtualIds.size > 0) {
      deallocateNodes(virtualIds)
    }
    // Remove cluster jewel config if any
    if (clusterJewels.has(clusterDialogSocketId)) {
      removeClusterJewel(clusterDialogSocketId)
    }
    // Unallocate the socket node itself
    handleNodeClick(clusterDialogSocketId)
    closeClusterDialog()
  }, [clusterDialogSocketId, allocatedNodes, deallocateNodes, clusterJewels, removeClusterJewel, handleNodeClick, closeClusterDialog])

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

      {/* Top bar left: identity, actions, search */}
      <div className="absolute top-3 left-3 z-40 flex items-center gap-2">
        <Select value={treeMode} onValueChange={(v) => onTreeModeChange(v as TreeMode)}>
          <SelectTrigger
            size="sm"
            className="h-7 w-[120px] bg-stone-950/90 border-amber-900/50 text-stone-300 backdrop-blur-sm text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-stone-950 border-stone-700">
            <SelectItem value="skill" className="text-stone-300 text-xs">
              Skill Tree
            </SelectItem>
            <SelectItem value="atlas" className="text-stone-300 text-xs">
              Atlas Tree
            </SelectItem>
          </SelectContent>
        </Select>
        {!isAtlas && (
          <ClassSelector
            data={data}
            processedNodes={processedNodes}
            selectedClass={selectedClass}
            onSelect={handleClassSelect}
          />
        )}
        {(isAtlas || selectedClass !== null) && <PointCounter used={pointsUsed} total={totalPoints} />}
        {(isAtlas || selectedClass !== null) && (
          <>
            <div className="w-px h-5 bg-stone-700/60" />
            <Button
              variant="outline"
              size="sm"
              onClick={undo}
              disabled={!canUndo}
              className="h-7 px-2 bg-stone-950/90 border-amber-900/50 text-stone-400 backdrop-blur-sm hover:bg-stone-900/90 hover:text-stone-200 disabled:opacity-30"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span className="text-xs ml-1">Undo</span>
            </Button>
            <Button
              variant={planningActive ? 'default' : 'outline'}
              size="sm"
              onClick={togglePlanningMode}
              className={
                planningActive
                  ? 'h-7 bg-cyan-800 hover:bg-cyan-700 text-cyan-100 border-cyan-600 text-xs'
                  : 'h-7 bg-stone-950/90 border-amber-900/50 text-stone-300 backdrop-blur-sm text-xs hover:bg-stone-900/90'
              }
            >
              {planningActive ? 'Planning' : 'Plan'}
            </Button>
            {!isAtlas && <BuildToolbar />}
            <div className="w-px h-5 bg-stone-700/60" />
          </>
        )}
        <QuickSearch
          searchQuery={search.searchQuery}
          onSearchChange={search.setSearchQuery}
          onOpenCommandPalette={search.openCommandPalette}
          matchCount={search.matchCount}
        />
      </div>

      {/* Top bar right: settings, help — offset when side panel is visible */}
      <div className={`absolute top-3 z-40 flex items-center gap-2 ${isAtlas || selectedClass !== null ? 'right-[21.5rem]' : 'right-3'}`}>
        <SettingsDialog />
        <HelpMenu />
      </div>

      {/* Mastery selection dialog (skill tree only) */}
      {!isAtlas && (
        <MasterySelectionDialog
          open={masteryDialogNodeId !== null}
          node={masteryDialogNode}
          currentEffectIndex={currentMasteryEffect}
          canAffordPoint={pointsUsed < totalPoints || currentMasteryEffect !== null}
          onSelectEffect={handleMasterySelect}
          onUnallocate={handleMasteryUnallocate}
          onClose={closeMasteryDialog}
        />
      )}

      {/* Cluster jewel dialog (skill tree only) */}
      {!isAtlas && (
        <ClusterJewelDialog
          open={clusterDialogSocketId !== null}
          socketSize={clusterDialogSocketSize}
          currentConfig={clusterDialogCurrentConfig}
          onConfigure={handleClusterConfigure}
          onRemove={handleClusterRemove}
          onUnallocate={handleClusterUnallocate}
          onAllocateWithout={closeClusterDialog}
          onClose={closeClusterDialog}
        />
      )}

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
            classes={data.classes ?? []}
            clusterJewels={clusterJewels}
          />
        </div>
      )}

      {/* Right side panel: planning or stats */}
      {(isAtlas || selectedClass !== null) && (
        planningActive ? (
          <PlanningInfoPanel
            adjacency={merged.adjacency}
            processedNodes={merged.processedNodes}
          />
        ) : (
          <StatSummaryPanel
            allocatedNodes={allocatedNodes}
            processedNodes={merged.processedNodes}
            selectedMasteryEffects={selectedMasteryEffects}
            onReset={reset}
          />
        )
      )}

      {/* Build management (skill tree only) */}
      {!isAtlas && (
        <>
          <BuildManager />
          <PoBExportDialog />
        </>
      )}
    </div>
  )
}
