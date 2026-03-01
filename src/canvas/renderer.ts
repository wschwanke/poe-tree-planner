import type { SpatialIndex } from '@/data/graph'
import type { SpriteManager } from '@/data/sprite-manager'
import type { ProcessedNode, SkillTreeData, ViewportState } from '@/types/skill-tree'
import { renderGroupBackgrounds } from './render-backgrounds'
import { renderConnections } from './render-connections'
import { renderNodes } from './render-nodes'

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
  )
}
