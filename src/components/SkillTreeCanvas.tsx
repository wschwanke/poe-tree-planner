import { useCallback, useEffect, useMemo, useRef } from 'react'
import { render } from '@/canvas/renderer'
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
import { BuildManager } from './BuildManager'
import { BuildToolbar } from './BuildToolbar'
import { ClassSelector } from './ClassSelectionDialog'
import { ClusterJewelDialog } from './ClusterJewelDialog'
import { HelpMenu } from './HelpMenu'
import { CommandPalette } from './CommandPalette'
import { MasterySelectionDialog } from './MasterySelectionDialog'
import { NodeTooltip } from './NodeTooltip'
import { PlanningToolbar } from './PlanningToolbar'
import { PoBExportDialog } from './PoBExportDialog'
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

  // Cluster store
  const clusterJewels = useClusterStore((s) => s.clusterJewels)
  const clusterVersion = useClusterStore((s) => s.version)
  const clusterDialogSocketId = useClusterStore((s) => s.dialogSocketId)
  const openClusterDialog = useClusterStore((s) => s.openDialog)
  const closeClusterDialog = useClusterStore((s) => s.closeDialog)
  const setClusterJewel = useClusterStore((s) => s.setClusterJewel)
  const removeClusterJewel = useClusterStore((s) => s.removeClusterJewel)

  // Merge cluster virtual nodes with base tree data
  const merged = useMemo(() => {
    if (clusterJewels.size === 0) {
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
  }, [processedNodes, adjacency, spatialIndex, data, clusterJewels, clusterVersion])

  // Initialize store context with merged data
  useEffect(() => {
    useTreeStore.getState().setContext(merged.processedNodes, merged.adjacency)
  }, [merged.processedNodes, merged.adjacency])

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

  const planningActive = usePlanningStore((s) => s.active)
  const toggleFlag = usePlanningStore((s) => s.toggleFlag)

  const handleCanvasNodeClick = useCallback(
    (event: NodeClickEvent) => {
      if (planningActive) {
        const flag: PlanningFlag = event.button === 2 ? 'blocked' : 'required'
        toggleFlag(event.nodeId, flag)
      } else {
        if (event.button === 2) return

        // Check for cluster socket click — open dialog instead of unallocating
        if (allocatedNodes.has(event.nodeId)) {
          const pn = merged.processedNodes.get(event.nodeId)
          if (pn?.node.isJewelSocket && isClusterSocket(pn.node)) {
            openClusterDialog(event.nodeId)
            return
          }
        }

        handleNodeClick(event.nodeId)
      }
    },
    [planningActive, toggleFlag, handleNodeClick, allocatedNodes, merged.processedNodes, openClusterDialog],
  )

  // Clean up cluster configs when their sockets are unallocated
  useEffect(() => {
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
  }, [allocatedNodes, deallocateNodes, removeClusterJewel])

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
        {selectedClass !== null && <BuildToolbar />}
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

      {/* Cluster jewel dialog */}
      <ClusterJewelDialog
        open={clusterDialogSocketId !== null}
        socketSize={clusterDialogSocketSize}
        currentConfig={clusterDialogCurrentConfig}
        onConfigure={handleClusterConfigure}
        onRemove={handleClusterRemove}
        onClose={closeClusterDialog}
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
            clusterJewels={clusterJewels}
          />
        </div>
      )}

      {/* Stat summary panel */}
      {selectedClass !== null && (
        <StatSummaryPanel
          allocatedNodes={allocatedNodes}
          processedNodes={merged.processedNodes}
          selectedMasteryEffects={selectedMasteryEffects}
          pointsUsed={pointsUsed}
          totalPoints={totalPoints}
          onReset={reset}
        />
      )}

      {/* Build management */}
      <BuildManager />
      <PoBExportDialog />
    </div>
  )
}
