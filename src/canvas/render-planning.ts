import type { ProcessedNode, ViewportState } from '@/types/skill-tree'
import { getNodeRadius } from './render-nodes'
import { isInView, worldToScreen } from './viewport'

export interface PlanningFlags {
  required: Set<string>
  blocked: Set<string>
}

export function renderPlanningOverlays(
  ctx: CanvasRenderingContext2D,
  processedNodes: Map<string, ProcessedNode>,
  viewport: ViewportState,
  flags: PlanningFlags,
  solverPreview: Set<string>,
  allocatedNodes: Set<string>,
): void {
  const hasFlags = flags.required.size > 0 || flags.blocked.size > 0
  const hasPreview = solverPreview.size > 0

  if (!hasFlags && !hasPreview) return

  ctx.save()

  for (const [id, pn] of processedNodes) {
    if (pn.node.isProxy) continue
    if (!isInView(pn.worldX, pn.worldY, viewport, 200)) continue

    const [sx, sy] = worldToScreen(pn.worldX, pn.worldY, viewport)
    const nodeRadius = getNodeRadius(pn.type) * viewport.zoom

    // Solver preview — cyan ring for nodes that would be allocated
    if (
      solverPreview.has(id) &&
      !allocatedNodes.has(id) &&
      !flags.required.has(id) &&
      !flags.blocked.has(id)
    ) {
      const spread = Math.max(3, 6 * viewport.zoom)
      const lineW = Math.max(1.5, 2.5 * viewport.zoom)

      ctx.beginPath()
      ctx.arc(sx, sy, nodeRadius + spread, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)'
      ctx.lineWidth = lineW
      ctx.shadowColor = 'rgba(6, 182, 212, 0.3)'
      ctx.shadowBlur = Math.max(6, 10 * viewport.zoom)
      ctx.stroke()
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
    }

    // Required — green ring + glow + checkmark
    if (flags.required.has(id)) {
      const spread = Math.max(4, 8 * viewport.zoom)
      const lineW = Math.max(3, 4 * viewport.zoom)

      // Solid glow ring
      ctx.beginPath()
      ctx.arc(sx, sy, nodeRadius + spread, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)'
      ctx.lineWidth = Math.max(6, 10 * viewport.zoom)
      ctx.stroke()

      // Main ring
      ctx.beginPath()
      ctx.arc(sx, sy, nodeRadius + spread, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(34, 197, 94, 1)'
      ctx.lineWidth = lineW
      ctx.shadowColor = 'rgba(34, 197, 94, 0.6)'
      ctx.shadowBlur = Math.max(10, 16 * viewport.zoom)
      ctx.stroke()
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0

      // Checkmark centered on node
      const iconSize = nodeRadius * 0.6
      ctx.beginPath()
      ctx.moveTo(sx - iconSize * 0.5, sy)
      ctx.lineTo(sx - iconSize * 0.1, sy + iconSize * 0.45)
      ctx.lineTo(sx + iconSize * 0.55, sy - iconSize * 0.4)
      ctx.strokeStyle = 'rgba(34, 197, 94, 1)'
      ctx.lineWidth = Math.max(3, 5 * viewport.zoom)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()
    }

    // Blocked — red ring + glow + X
    if (flags.blocked.has(id)) {
      const spread = Math.max(4, 8 * viewport.zoom)
      const lineW = Math.max(3, 4 * viewport.zoom)

      // Solid glow ring
      ctx.beginPath()
      ctx.arc(sx, sy, nodeRadius + spread, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)'
      ctx.lineWidth = Math.max(6, 10 * viewport.zoom)
      ctx.stroke()

      // Main ring
      ctx.beginPath()
      ctx.arc(sx, sy, nodeRadius + spread, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(239, 68, 68, 1)'
      ctx.lineWidth = lineW
      ctx.shadowColor = 'rgba(239, 68, 68, 0.6)'
      ctx.shadowBlur = Math.max(10, 16 * viewport.zoom)
      ctx.stroke()
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0

      // X centered on node
      const xOff = nodeRadius * 0.35
      ctx.beginPath()
      ctx.moveTo(sx - xOff, sy - xOff)
      ctx.lineTo(sx + xOff, sy + xOff)
      ctx.moveTo(sx + xOff, sy - xOff)
      ctx.lineTo(sx - xOff, sy + xOff)
      ctx.strokeStyle = 'rgba(239, 68, 68, 1)'
      ctx.lineWidth = Math.max(3, 5 * viewport.zoom)
      ctx.lineCap = 'round'
      ctx.stroke()
    }
  }

  ctx.restore()
}
