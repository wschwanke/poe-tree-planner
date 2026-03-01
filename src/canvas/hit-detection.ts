import type { SpatialIndex } from '@/data/graph'
import { queryNearbyNodes } from '@/data/graph'
import type { ProcessedNode, ViewportState } from '@/types/skill-tree'
import { getNodeRadius } from './render-nodes'
import { screenToWorld } from './viewport'

export function hitTest(
  screenX: number,
  screenY: number,
  viewport: ViewportState,
  processedNodes: Map<string, ProcessedNode>,
  spatialIndex: SpatialIndex,
): string | null {
  const [worldX, worldY] = screenToWorld(screenX, screenY, viewport)

  // Query spatial index for nearby nodes
  const searchRadius = 100 / viewport.zoom
  const candidates = queryNearbyNodes(spatialIndex, worldX, worldY, searchRadius)

  let closest: string | null = null
  let closestDist = Infinity

  for (const id of candidates) {
    const pn = processedNodes.get(id)
    if (!pn) continue
    if (pn.node.isProxy) continue

    const dx = worldX - pn.worldX
    const dy = worldY - pn.worldY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const hitRadius = getNodeRadius(pn.type)

    if (dist <= hitRadius && dist < closestDist) {
      closest = id
      closestDist = dist
    }
  }

  return closest
}
