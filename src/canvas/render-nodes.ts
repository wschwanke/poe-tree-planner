import type { SpriteManager } from '@/data/sprite-manager'
import type { CharacterClass, NodeType, ProcessedNode, ViewportState } from '@/types/skill-tree'
import { isInView, worldToScreen } from './viewport'

const FRAME_MAP: Record<string, { unallocated: string; canAllocate: string; allocated: string }> = {
  normal: {
    unallocated: 'PSSkillFrame',
    canAllocate: 'PSSkillFrameHighlighted',
    allocated: 'PSSkillFrameActive',
  },
  notable: {
    unallocated: 'NotableFrameUnallocated',
    canAllocate: 'NotableFrameCanAllocate',
    allocated: 'NotableFrameAllocated',
  },
  keystone: {
    unallocated: 'KeystoneFrameUnallocated',
    canAllocate: 'KeystoneFrameCanAllocate',
    allocated: 'KeystoneFrameAllocated',
  },
  jewelSocket: {
    unallocated: 'JewelFrameUnallocated',
    canAllocate: 'JewelFrameCanAllocate',
    allocated: 'JewelFrameAllocated',
  },
  wormhole: {
    unallocated: 'WormholeFrameUnallocated',
    canAllocate: 'WormholeFrameHighlight',
    allocated: 'WormholeFrameAllocated',
  },
}

function getIconCategory(type: NodeType, allocated: boolean): string {
  switch (type) {
    case 'keystone':
      return allocated ? 'keystoneActive' : 'keystoneInactive'
    case 'notable':
      return allocated ? 'notableActive' : 'notableInactive'
    case 'mastery':
      return allocated ? 'masteryConnected' : 'mastery'
    case 'wormhole':
      return allocated ? 'wormholeActive' : 'wormholeInactive'
    default:
      return allocated ? 'normalActive' : 'normalInactive'
  }
}

// Zoom threshold below which normal nodes render as simple dots instead of sprites.
const LOD_ZOOM_THRESHOLD = 0.15

const LOD_COLORS = {
  unallocated: '#3d372a',
  canAllocate: '#6b5c3e',
  allocated: '#c8b074',
}

export function renderNodes(
  ctx: CanvasRenderingContext2D,
  processedNodes: Map<string, ProcessedNode>,
  viewport: ViewportState,
  sprites: SpriteManager,
  allocatedNodes: Set<string>,
  canAllocateNodes: Set<string>,
  hoveredNodeId: string | null,
  hoveredPath: string[] = [],
  classes: CharacterClass[] = [],
  searchMatchNodeIds: Set<string> = new Set(),
  animationTime = 0,
  isAtlas = false,
): void {
  const useLOD = viewport.zoom < LOD_ZOOM_THRESHOLD

  // Render start node decorations
  if (isAtlas) {
    // Atlas start node: root is at the origin but has no group, so draw manually
    if (isInView(0, 0, viewport, 300)) {
      const [sx, sy] = worldToScreen(0, 0, viewport)
      sprites.drawSprite(ctx, 'startNode', 'AtlasPassiveSkillScreenStart', sx, sy, viewport.zoom)
    }
  } else {
    // Skill tree: draw class start backgrounds and class-specific center art
    for (const [, pn] of processedNodes) {
      if (pn.type !== 'classStart') continue
      if (!isInView(pn.worldX, pn.worldY, viewport, 200)) continue

      const [sx, sy] = worldToScreen(pn.worldX, pn.worldY, viewport)

      // Draw the circular shadow/background behind each class start node
      sprites.drawSprite(ctx, 'startNode', 'PSStartNodeBackgroundInactive', sx, sy, viewport.zoom)

      // Use class name from data.classes (node names like "SIX"/"Seven" don't match sprite keys)
      const classIndex = pn.node.classStartIndex
      const className =
        classIndex !== undefined
          ? classes[classIndex]?.name?.toLowerCase()
          : pn.node.name?.toLowerCase()
      if (className) {
        sprites.drawSprite(ctx, 'startNode', `center${className}`, sx, sy, viewport.zoom)
      }
    }
  }

  // Collect nodes by render priority (normal < notable < keystone)
  const normalNodes: [string, ProcessedNode][] = []
  const notableNodes: [string, ProcessedNode][] = []
  const keystoneNodes: [string, ProcessedNode][] = []
  const masteryNodes: [string, ProcessedNode][] = []

  for (const entry of processedNodes) {
    const [, pn] = entry
    if (pn.type === 'classStart') continue
    if (pn.node.isProxy) continue
    if (!isInView(pn.worldX, pn.worldY, viewport, 100)) continue

    switch (pn.type) {
      case 'keystone':
        keystoneNodes.push(entry)
        break
      case 'notable':
      case 'wormhole':
        notableNodes.push(entry)
        break
      case 'mastery':
        masteryNodes.push(entry)
        break
      default:
        normalNodes.push(entry)
        break
    }
  }

  // LOD: batch-render normal nodes as simple circles when zoomed out
  if (useLOD && normalNodes.length > 0) {
    const nodeRadius = Math.max(2, 34 * viewport.zoom)

    // Group by color to minimize state changes
    const groups: { color: string; nodes: [string, ProcessedNode][] }[] = [
      { color: LOD_COLORS.allocated, nodes: [] },
      { color: LOD_COLORS.canAllocate, nodes: [] },
      { color: LOD_COLORS.unallocated, nodes: [] },
    ]
    for (const entry of normalNodes) {
      const [id] = entry
      if (allocatedNodes.has(id)) groups[0].nodes.push(entry)
      else if (canAllocateNodes.has(id)) groups[1].nodes.push(entry)
      else groups[2].nodes.push(entry)
    }

    for (const group of groups) {
      if (group.nodes.length === 0) continue
      ctx.save()
      ctx.fillStyle = group.color
      ctx.beginPath()
      for (const [, pn] of group.nodes) {
        const [sx, sy] = worldToScreen(pn.worldX, pn.worldY, viewport)
        ctx.moveTo(sx + nodeRadius, sy)
        ctx.arc(sx, sy, nodeRadius, 0, Math.PI * 2)
      }
      ctx.fill()
      ctx.restore()
    }
  }

  // Render in order: normal (if not LOD), mastery, notable, keystone
  const hoveredPathSet = new Set(hoveredPath)
  const spriteNodes = useLOD
    ? [...masteryNodes, ...notableNodes, ...keystoneNodes]
    : [...normalNodes, ...masteryNodes, ...notableNodes, ...keystoneNodes]
  // Full render order for search highlights (includes LOD nodes)
  const renderOrder = [...normalNodes, ...masteryNodes, ...notableNodes, ...keystoneNodes]

  for (const [id, pn] of spriteNodes) {
    const [sx, sy] = worldToScreen(pn.worldX, pn.worldY, viewport)
    const isAllocated = allocatedNodes.has(id)
    const isCanAllocate = canAllocateNodes.has(id)
    const isHovered = id === hoveredNodeId

    // Draw icon first (behind the frame) — always use max zoom sprites for sharpness
    if (pn.type === 'mastery') {
      if (isAllocated && pn.node.activeIcon) {
        sprites.drawSprite(
          ctx,
          'masteryActiveSelected',
          pn.node.activeIcon,
          sx,
          sy,
          viewport.zoom,
          undefined,
          true,
        )
      } else if (pn.node.inactiveIcon) {
        sprites.drawSprite(
          ctx,
          'masteryInactive',
          pn.node.inactiveIcon,
          sx,
          sy,
          viewport.zoom,
          undefined,
          true,
        )
      } else if (pn.node.icon) {
        // Atlas mastery: decorative icon, use 'mastery' sprite category
        sprites.drawSprite(ctx, 'mastery', pn.node.icon, sx, sy, viewport.zoom, undefined, true)
      }
    } else if (pn.type === 'wormhole') {
      // Wormhole nodes use a fixed coord key, not the node's icon path
      const category = getIconCategory(pn.type, isAllocated)
      sprites.drawSprite(ctx, category, 'Wormhole', sx, sy, viewport.zoom, undefined, true)
    } else {
      const iconPath = pn.node.icon
      if (iconPath) {
        const category = getIconCategory(pn.type, isAllocated)
        sprites.drawSprite(ctx, category, iconPath, sx, sy, viewport.zoom, undefined, true)
      } else if (id.startsWith('cv:')) {
        // Virtual cluster node — draw a colored circle fill as the icon
        const fillRadius = (pn.type === 'jewelSocket' ? 24 : 18) * viewport.zoom
        ctx.save()
        ctx.beginPath()
        ctx.arc(sx, sy, fillRadius, 0, Math.PI * 2)
        ctx.fillStyle = isAllocated
          ? '#c8b074'
          : isCanAllocate
            ? '#6b5c3e'
            : '#2a2520'
        ctx.fill()
        ctx.restore()
      }
    }

    // Draw frame on top to mask square icon edges — always at full opacity
    const frameInfo = FRAME_MAP[pn.type]
    if (frameInfo) {
      const frameKey = isAllocated
        ? frameInfo.allocated
        : isCanAllocate
          ? frameInfo.canAllocate
          : frameInfo.unallocated
      sprites.drawSprite(ctx, 'frame', frameKey, sx, sy, viewport.zoom)
    }


    // Hover preview: draw the allocated appearance at 33% opacity
    if ((isHovered || hoveredPathSet.has(id)) && !isAllocated) {
      ctx.save()
      ctx.globalAlpha = 0.33
      if (pn.type === 'mastery') {
        if (pn.node.activeIcon) {
          sprites.drawSprite(
            ctx,
            'masteryActiveSelected',
            pn.node.activeIcon,
            sx,
            sy,
            viewport.zoom,
            undefined,
            true,
          )
        }
      } else {
        const iconPath = pn.type === 'wormhole' ? 'Wormhole' : pn.node.icon
        if (iconPath) {
          const activeCategory = getIconCategory(pn.type, true)
          sprites.drawSprite(ctx, activeCategory, iconPath, sx, sy, viewport.zoom, undefined, true)
        }
        const activeFrame = FRAME_MAP[pn.type]
        if (activeFrame) {
          sprites.drawSprite(ctx, 'frame', activeFrame.allocated, sx, sy, viewport.zoom)
        }
      }
      ctx.restore()
    }
  }

  // Mastery sibling pulse — highlight other masteries of the same type when hovering one
  if (hoveredNodeId) {
    const hoveredPn = processedNodes.get(hoveredNodeId)
    const hoveredMasteryIcon = hoveredPn?.type === 'mastery'
      ? (hoveredPn.node.inactiveIcon ?? hoveredPn.node.icon)
      : undefined
    if (hoveredPn?.type === 'mastery' && hoveredMasteryIcon) {
      const pulsePhase = (Math.sin(animationTime * 0.004) + 1) / 2
      const pulseAlpha = 0.3 + pulsePhase * 0.7

      ctx.save()
      for (const [, pn] of masteryNodes) {
        const siblingIcon = pn.node.inactiveIcon ?? pn.node.icon
        if (siblingIcon !== hoveredMasteryIcon) continue

        const [sx, sy] = worldToScreen(pn.worldX, pn.worldY, viewport)
        const nodeRadius = getNodeRadius('mastery') * viewport.zoom
        const spread = Math.max(3, 6 * viewport.zoom)
        const lineW = Math.max(2, 3 * viewport.zoom)

        ctx.beginPath()
        ctx.arc(sx, sy, nodeRadius + spread, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(200, 176, 116, ${pulseAlpha})`
        ctx.lineWidth = lineW
        ctx.shadowColor = `rgba(200, 176, 116, ${0.4 + pulsePhase * 0.4})`
        ctx.shadowBlur = Math.max(6, spread * 2)
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  // Search highlight glow pass — renders on top of all nodes
  renderSearchHighlights(ctx, renderOrder, viewport, searchMatchNodeIds, animationTime)
}

function renderSearchHighlights(
  ctx: CanvasRenderingContext2D,
  renderOrder: [string, ProcessedNode][],
  viewport: ViewportState,
  searchMatchNodeIds: Set<string>,
  animationTime: number,
): void {
  if (searchMatchNodeIds.size === 0) return

  const pulsePhase = (Math.sin(animationTime * 0.003) + 1) / 2
  const glowAlpha = 0.5 + pulsePhase * 0.5

  ctx.save()
  for (const [id, pn] of renderOrder) {
    if (!searchMatchNodeIds.has(id)) continue

    const [sx, sy] = worldToScreen(pn.worldX, pn.worldY, viewport)
    const nodeRadius = getNodeRadius(pn.type) * viewport.zoom

    // Use minimum pixel sizes so glow stays visible at any zoom
    const spread = Math.max(4, (10 + pulsePhase * 6) * viewport.zoom)
    const lineW = Math.max(2, 4 * viewport.zoom)
    const blur = Math.max(8, spread * 3)

    ctx.beginPath()
    ctx.arc(sx, sy, nodeRadius + spread, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255, 40, 40, ${glowAlpha})`
    ctx.lineWidth = lineW
    ctx.shadowColor = `rgba(255, 30, 30, ${0.6 + pulsePhase * 0.4})`
    ctx.shadowBlur = blur
    ctx.stroke()
  }
  ctx.restore()
}

export function getNodeRadius(type: NodeType): number {
  switch (type) {
    case 'keystone':
      return 68
    case 'notable':
      return 48
    case 'mastery':
      return 48
    case 'wormhole':
      return 48
    case 'jewelSocket':
      return 40
    case 'classStart':
      return 80
    default:
      return 34
  }
}
