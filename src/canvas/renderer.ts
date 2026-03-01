import type { SpatialIndex } from '@/data/graph'
import type { SpriteManager } from '@/data/sprite-manager'
import type { ProcessedNode, SkillTreeData, ViewportState } from '@/types/skill-tree'
import { renderGroupBackgrounds } from './render-backgrounds'
import { renderConnections } from './render-connections'
import { renderNodes } from './render-nodes'
import { type PlanningFlags, renderPlanningOverlays } from './render-planning'

export interface RenderContext {
  data: SkillTreeData
  processedNodes: Map<string, ProcessedNode>
  adjacency: Map<string, Set<string>>
  spatialIndex: SpatialIndex
  sprites: SpriteManager
  allocatedNodes: Set<string>
  canAllocateNodes: Set<string>
  hoveredNodeId: string | null
  hoveredPath: string[]
  searchMatchNodeIds: Set<string>
  animationTime: number
  planningFlags: PlanningFlags | null
  solverPreview: Set<string>
}

export function render(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportState,
  rc: RenderContext,
): void {
  const { width, height } = viewport

  // Clear
  ctx.fillStyle = '#08070a'
  ctx.fillRect(0, 0, width, height)

  // 1. Group backgrounds
  renderGroupBackgrounds(ctx, rc.data, rc.processedNodes, viewport, rc.sprites)

  // 2. Connections
  renderConnections(
    ctx,
    rc.processedNodes,
    rc.adjacency,
    viewport,
    rc.allocatedNodes,
    rc.data,
    rc.hoveredPath,
  )

  // 3. Nodes (frames + icons + class starts)
  renderNodes(
    ctx,
    rc.processedNodes,
    viewport,
    rc.sprites,
    rc.allocatedNodes,
    rc.canAllocateNodes,
    rc.hoveredNodeId,
    rc.hoveredPath,
    rc.data.classes,
    rc.searchMatchNodeIds,
    rc.animationTime,
  )

  // 4. Planning overlays (flags + solver preview)
  if (rc.planningFlags) {
    renderPlanningOverlays(
      ctx,
      rc.processedNodes,
      viewport,
      rc.planningFlags,
      rc.solverPreview,
      rc.allocatedNodes,
    )
  }
}
