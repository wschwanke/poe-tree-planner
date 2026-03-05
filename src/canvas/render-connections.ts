import { getOrbitAngle } from '@/data/graph'
import type { ProcessedNode, SkillTreeData, ViewportState } from '@/types/skill-tree'
import { isInView, worldToScreen } from './viewport'

export type ConnectionState = 'normal' | 'active' | 'intermediate'

function getConnectionState(
  nodeA: string,
  nodeB: string,
  allocatedNodes: Set<string>,
): ConnectionState {
  const aAlloc = allocatedNodes.has(nodeA)
  const bAlloc = allocatedNodes.has(nodeB)
  if (aAlloc && bAlloc) return 'active'
  if (aAlloc || bAlloc) return 'intermediate'
  return 'normal'
}

interface ConnectionStyle {
  color: string
  widthMultiplier: number
  minWidth: number
  alpha: number
  glow: { widthMultiplier: number; alpha: number } | null
}

const CONNECTION_STYLES: Record<ConnectionState, ConnectionStyle> = {
  normal: { color: '#3d372a', widthMultiplier: 3, minWidth: 1.5, alpha: 0.7, glow: null },
  intermediate: { color: '#3d372a', widthMultiplier: 3, minWidth: 1.5, alpha: 0.7, glow: null },
  active: {
    color: '#c8b074',
    widthMultiplier: 3.5,
    minWidth: 2,
    alpha: 1.0,
    glow: { widthMultiplier: 8, alpha: 0.3 },
  },
}

interface LineSegment {
  type: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
}

interface ArcSegment {
  type: 'arc'
  cx: number
  cy: number
  radius: number
  startAngle: number
  endAngle: number
  counterclockwise: boolean
}

type Segment = LineSegment | ArcSegment

export function renderConnections(
  ctx: CanvasRenderingContext2D,
  processedNodes: Map<string, ProcessedNode>,
  adjacency: Map<string, Set<string>>,
  viewport: ViewportState,
  allocatedNodes: Set<string>,
  data: SkillTreeData,
  hoveredPath: string[] = [],
  solverPreview: Set<string> = new Set(),
  hoveredNodeId: string | null = null,
): void {
  const rendered = new Set<string>()

  // Group connections by state for batch rendering
  const batches: Record<ConnectionState, Segment[]> = {
    normal: [],
    active: [],
    intermediate: [],
  }

  for (const [nodeId, neighbors] of adjacency) {
    const nodeA = processedNodes.get(nodeId)
    if (!nodeA) continue
    // Skip proxy nodes and mastery nodes for connections
    if (nodeA.node.isProxy || nodeA.node.isMastery) continue

    for (const neighborId of neighbors) {
      const edgeKey = nodeId < neighborId ? `${nodeId}-${neighborId}` : `${neighborId}-${nodeId}`
      if (rendered.has(edgeKey)) continue
      rendered.add(edgeKey)

      const nodeB = processedNodes.get(neighborId)
      if (!nodeB) continue
      if (nodeB.node.isProxy || nodeB.node.isMastery) continue

      // Skip wormhole-to-wormhole connections (cross-map teleport links)
      if (nodeA.node.isWormhole && nodeB.node.isWormhole) continue

      // Skip connections between ascendancy and non-ascendancy nodes
      // (the link from class start to ascendancy start)
      const aAsc = !!nodeA.node.ascendancyName
      const bAsc = !!nodeB.node.ascendancyName
      if (aAsc !== bAsc) continue

      // Cull off-screen connections
      const midX = (nodeA.worldX + nodeB.worldX) / 2
      const midY = (nodeA.worldY + nodeB.worldY) / 2
      if (!isInView(midX, midY, viewport, 1000)) continue

      const state = getConnectionState(nodeId, neighborId, allocatedNodes)

      // Check if this is a same-orbit connection (should be drawn as an arc)
      if (
        nodeA.node.group === nodeB.node.group &&
        nodeA.node.orbit === nodeB.node.orbit &&
        nodeA.node.orbit > 0
      ) {
        const group = data.groups[String(nodeA.node.group)]
        if (group) {
          const orbit = nodeA.node.orbit
          const orbitRadius = data.constants.orbitRadii[orbit] ?? 0
          const totalInOrbit = data.constants.skillsPerOrbit[orbit] ?? 1

          // Get PoE angles (0=north, clockwise) for each node
          const angleA = getOrbitAngle(nodeA.node.orbitIndex, totalInOrbit)
          const angleB = getOrbitAngle(nodeB.node.orbitIndex, totalInOrbit)

          // Convert PoE angles to canvas arc angles (0=east, clockwise)
          const canvasAngleA = angleA - Math.PI / 2
          const canvasAngleB = angleB - Math.PI / 2

          // Determine shortest arc direction
          let diff = canvasAngleB - canvasAngleA
          // Normalize to [-PI, PI]
          while (diff > Math.PI) diff -= 2 * Math.PI
          while (diff < -Math.PI) diff += 2 * Math.PI
          const counterclockwise = diff < 0

          // Convert group center to screen coords
          const [gcx, gcy] = worldToScreen(group.x, group.y, viewport)
          const screenRadius = orbitRadius * viewport.zoom

          batches[state].push({
            type: 'arc',
            cx: gcx,
            cy: gcy,
            radius: screenRadius,
            startAngle: canvasAngleA,
            endAngle: canvasAngleB,
            counterclockwise,
          })
          continue
        }
      }

      // Default: straight line
      const [sx1, sy1] = worldToScreen(nodeA.worldX, nodeA.worldY, viewport)
      const [sx2, sy2] = worldToScreen(nodeB.worldX, nodeB.worldY, viewport)
      batches[state].push({ type: 'line', x1: sx1, y1: sy1, x2: sx2, y2: sy2 })
    }
  }

  // Draw in order: normal first, then intermediate, then active (on top)
  for (const state of ['normal', 'intermediate', 'active'] as ConnectionState[]) {
    const segments = batches[state]
    if (segments.length === 0) continue

    const style = CONNECTION_STYLES[state]
    const lineWidth = Math.max(style.minWidth, style.widthMultiplier * viewport.zoom)

    // Draw glow pass for active connections
    if (style.glow) {
      const glowWidth = Math.max(style.minWidth * 2, style.glow.widthMultiplier * viewport.zoom)
      ctx.save()
      ctx.strokeStyle = style.color
      ctx.globalAlpha = style.glow.alpha
      ctx.lineWidth = glowWidth
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (const seg of segments) {
        if (seg.type === 'line') {
          ctx.moveTo(seg.x1, seg.y1)
          ctx.lineTo(seg.x2, seg.y2)
        } else {
          const { cx, cy, radius, startAngle, endAngle, counterclockwise } = seg
          ctx.moveTo(cx + radius * Math.cos(startAngle), cy + radius * Math.sin(startAngle))
          ctx.arc(cx, cy, radius, startAngle, endAngle, counterclockwise)
        }
      }
      ctx.stroke()
      ctx.restore()
    }

    // Draw main line pass
    ctx.save()
    ctx.strokeStyle = style.color
    ctx.globalAlpha = style.alpha
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.beginPath()
    for (const seg of segments) {
      if (seg.type === 'line') {
        ctx.moveTo(seg.x1, seg.y1)
        ctx.lineTo(seg.x2, seg.y2)
      } else {
        const { cx, cy, radius, startAngle, endAngle, counterclockwise } = seg
        ctx.moveTo(cx + radius * Math.cos(startAngle), cy + radius * Math.sin(startAngle))
        ctx.arc(cx, cy, radius, startAngle, endAngle, counterclockwise)
      }
    }
    ctx.stroke()
    ctx.restore()
  }

  // Draw hovered path preview: show the path that would be allocated
  if (hoveredPath.length >= 2) {
    // Build set of edges from consecutive nodes in the hovered path
    const pathEdges = new Set<string>()
    for (let i = 0; i < hoveredPath.length - 1; i++) {
      const a = hoveredPath[i]
      const b = hoveredPath[i + 1]
      pathEdges.add(a < b ? `${a}-${b}` : `${b}-${a}`)
    }

    const previewSegments: Segment[] = []
    for (const edgeKey of pathEdges) {
      const [idA, idB] = edgeKey.split('-')
      const nodeA = processedNodes.get(idA)
      const nodeB = processedNodes.get(idB)
      if (!nodeA || !nodeB) continue

      // Check for same-orbit arc
      if (
        nodeA.node.group === nodeB.node.group &&
        nodeA.node.orbit === nodeB.node.orbit &&
        nodeA.node.orbit > 0
      ) {
        const group = data.groups[String(nodeA.node.group)]
        if (group) {
          const orbit = nodeA.node.orbit
          const orbitRadius = data.constants.orbitRadii[orbit] ?? 0
          const totalInOrbit = data.constants.skillsPerOrbit[orbit] ?? 1
          const angleA = getOrbitAngle(nodeA.node.orbitIndex, totalInOrbit)
          const angleB = getOrbitAngle(nodeB.node.orbitIndex, totalInOrbit)
          const canvasAngleA = angleA - Math.PI / 2
          const canvasAngleB = angleB - Math.PI / 2
          let diff = canvasAngleB - canvasAngleA
          while (diff > Math.PI) diff -= 2 * Math.PI
          while (diff < -Math.PI) diff += 2 * Math.PI
          const [gcx, gcy] = worldToScreen(group.x, group.y, viewport)
          previewSegments.push({
            type: 'arc',
            cx: gcx,
            cy: gcy,
            radius: orbitRadius * viewport.zoom,
            startAngle: canvasAngleA,
            endAngle: canvasAngleB,
            counterclockwise: diff < 0,
          })
          continue
        }
      }

      const [sx1, sy1] = worldToScreen(nodeA.worldX, nodeA.worldY, viewport)
      const [sx2, sy2] = worldToScreen(nodeB.worldX, nodeB.worldY, viewport)
      previewSegments.push({ type: 'line', x1: sx1, y1: sy1, x2: sx2, y2: sy2 })
    }

    if (previewSegments.length > 0) {
      const activeStyle = CONNECTION_STYLES.active
      const previewWidth = Math.max(
        activeStyle.minWidth,
        activeStyle.widthMultiplier * viewport.zoom,
      )

      ctx.save()
      ctx.strokeStyle = activeStyle.color
      ctx.globalAlpha = 0.33
      ctx.lineWidth = previewWidth
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (const seg of previewSegments) {
        if (seg.type === 'line') {
          ctx.moveTo(seg.x1, seg.y1)
          ctx.lineTo(seg.x2, seg.y2)
        } else {
          const { cx, cy, radius, startAngle, endAngle, counterclockwise } = seg
          ctx.moveTo(cx + radius * Math.cos(startAngle), cy + radius * Math.sin(startAngle))
          ctx.arc(cx, cy, radius, startAngle, endAngle, counterclockwise)
        }
      }
      ctx.stroke()
      ctx.restore()
    }
  } // end hoveredPath.length >= 2

  // Draw solver preview connections
  if (solverPreview.size < 2) return

  const solverEdges = new Set<string>()
  for (const nodeId of solverPreview) {
    const neighbors = adjacency.get(nodeId)
    if (!neighbors) continue
    for (const neighborId of neighbors) {
      if (solverPreview.has(neighborId)) {
        solverEdges.add(nodeId < neighborId ? `${nodeId}-${neighborId}` : `${neighborId}-${nodeId}`)
      }
    }
  }

  const solverSegments: Segment[] = []
  for (const edgeKey of solverEdges) {
    const [idA, idB] = edgeKey.split('-')
    const nodeA = processedNodes.get(idA)
    const nodeB = processedNodes.get(idB)
    if (!nodeA || !nodeB) continue

    if (
      nodeA.node.group === nodeB.node.group &&
      nodeA.node.orbit === nodeB.node.orbit &&
      nodeA.node.orbit > 0
    ) {
      const group = data.groups[String(nodeA.node.group)]
      if (group) {
        const orbit = nodeA.node.orbit
        const orbitRadius = data.constants.orbitRadii[orbit] ?? 0
        const totalInOrbit = data.constants.skillsPerOrbit[orbit] ?? 1
        const angleA = getOrbitAngle(nodeA.node.orbitIndex, totalInOrbit)
        const angleB = getOrbitAngle(nodeB.node.orbitIndex, totalInOrbit)
        const canvasAngleA = angleA - Math.PI / 2
        const canvasAngleB = angleB - Math.PI / 2
        let diff = canvasAngleB - canvasAngleA
        while (diff > Math.PI) diff -= 2 * Math.PI
        while (diff < -Math.PI) diff += 2 * Math.PI
        const [gcx, gcy] = worldToScreen(group.x, group.y, viewport)
        solverSegments.push({
          type: 'arc',
          cx: gcx,
          cy: gcy,
          radius: orbitRadius * viewport.zoom,
          startAngle: canvasAngleA,
          endAngle: canvasAngleB,
          counterclockwise: diff < 0,
        })
        continue
      }
    }

    const [sx1, sy1] = worldToScreen(nodeA.worldX, nodeA.worldY, viewport)
    const [sx2, sy2] = worldToScreen(nodeB.worldX, nodeB.worldY, viewport)
    solverSegments.push({ type: 'line', x1: sx1, y1: sy1, x2: sx2, y2: sy2 })
  }

  if (solverSegments.length === 0) return

  const solverLineStyle = CONNECTION_STYLES.active
  const solverWidth = Math.max(
    solverLineStyle.minWidth,
    solverLineStyle.widthMultiplier * viewport.zoom,
  )

  // Glow pass
  ctx.save()
  ctx.strokeStyle = '#06b6d4'
  ctx.globalAlpha = 0.3
  ctx.lineWidth = Math.max(solverLineStyle.minWidth * 2, 8 * viewport.zoom)
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (const seg of solverSegments) {
    if (seg.type === 'line') {
      ctx.moveTo(seg.x1, seg.y1)
      ctx.lineTo(seg.x2, seg.y2)
    } else {
      const { cx, cy, radius, startAngle, endAngle, counterclockwise } = seg
      ctx.moveTo(cx + radius * Math.cos(startAngle), cy + radius * Math.sin(startAngle))
      ctx.arc(cx, cy, radius, startAngle, endAngle, counterclockwise)
    }
  }
  ctx.stroke()
  ctx.restore()

  // Main line pass
  ctx.save()
  ctx.strokeStyle = '#06b6d4'
  ctx.globalAlpha = 0.7
  ctx.lineWidth = solverWidth
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (const seg of solverSegments) {
    if (seg.type === 'line') {
      ctx.moveTo(seg.x1, seg.y1)
      ctx.lineTo(seg.x2, seg.y2)
    } else {
      const { cx, cy, radius, startAngle, endAngle, counterclockwise } = seg
      ctx.moveTo(cx + radius * Math.cos(startAngle), cy + radius * Math.sin(startAngle))
      ctx.arc(cx, cy, radius, startAngle, endAngle, counterclockwise)
    }
  }
  ctx.stroke()
  ctx.restore()

  // Draw wormhole hover link — dotted glowing line between wormhole pairs
  renderWormholeHoverLink(ctx, processedNodes, adjacency, viewport, hoveredNodeId)
}

function renderWormholeHoverLink(
  ctx: CanvasRenderingContext2D,
  processedNodes: Map<string, ProcessedNode>,
  adjacency: Map<string, Set<string>>,
  viewport: ViewportState,
  hoveredNodeId: string | null,
): void {
  if (!hoveredNodeId) return
  const hovered = processedNodes.get(hoveredNodeId)
  if (!hovered?.node.isWormhole) return

  // Find wormhole partner
  const neighbors = adjacency.get(hoveredNodeId)
  if (!neighbors) return
  let partnerId: string | null = null
  for (const nid of neighbors) {
    const pn = processedNodes.get(nid)
    if (pn?.node.isWormhole) {
      partnerId = nid
      break
    }
  }
  if (!partnerId) return
  const partner = processedNodes.get(partnerId)
  if (!partner) return

  const [sx1, sy1] = worldToScreen(hovered.worldX, hovered.worldY, viewport)
  const [sx2, sy2] = worldToScreen(partner.worldX, partner.worldY, viewport)

  const dashLen = Math.max(4, 8 * viewport.zoom)

  // Glow pass
  ctx.save()
  ctx.strokeStyle = '#a78bfa'
  ctx.globalAlpha = 0.3
  ctx.lineWidth = Math.max(4, 10 * viewport.zoom)
  ctx.lineCap = 'round'
  ctx.setLineDash([dashLen, dashLen])
  ctx.beginPath()
  ctx.moveTo(sx1, sy1)
  ctx.lineTo(sx2, sy2)
  ctx.stroke()

  // Main line pass
  ctx.strokeStyle = '#a78bfa'
  ctx.globalAlpha = 0.7
  ctx.lineWidth = Math.max(2, 3.5 * viewport.zoom)
  ctx.beginPath()
  ctx.moveTo(sx1, sy1)
  ctx.lineTo(sx2, sy2)
  ctx.stroke()
  ctx.restore()
}
