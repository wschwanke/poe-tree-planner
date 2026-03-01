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
}

const ICON_SCALE: Record<NodeType, number> = {
  normal: 1.0,
  notable: 1.0,
  keystone: 1.0,
  mastery: 1.0,
  jewelSocket: 1.0,
  classStart: 1.0,
}

function getIconCategory(type: NodeType, allocated: boolean): string {
  switch (type) {
    case 'keystone':
      return allocated ? 'keystoneActive' : 'keystoneInactive'
    case 'notable':
      return allocated ? 'notableActive' : 'notableInactive'
    case 'mastery':
      return allocated ? 'masteryConnected' : 'mastery'
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
): void {
  const useLOD = viewport.zoom < LOD_ZOOM_THRESHOLD

  // Render class start decorations first
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
      ctx.fillStyle = group.color
      ctx.beginPath()
      for (const [, pn] of group.nodes) {
        const [sx, sy] = worldToScreen(pn.worldX, pn.worldY, viewport)
        ctx.moveTo(sx + nodeRadius, sy)
        ctx.arc(sx, sy, nodeRadius, 0, Math.PI * 2)
      }
      ctx.fill()
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

    // Draw icon first (behind the frame)
    if (pn.type === 'mastery') {
      const iconScale = sprites.getScaleFactor(viewport.zoom) * ICON_SCALE[pn.type]
      if (isAllocated && pn.node.activeIcon) {
        sprites.drawSprite(
          ctx,
          'masteryActiveSelected',
          pn.node.activeIcon,
          sx,
          sy,
          viewport.zoom,
          iconScale,
        )
      } else if (pn.node.inactiveIcon) {
        sprites.drawSprite(
          ctx,
          'masteryInactive',
          pn.node.inactiveIcon,
          sx,
          sy,
          viewport.zoom,
          iconScale,
        )
      }
    } else {
      const iconPath = pn.node.icon
      if (iconPath) {
        const category = getIconCategory(pn.type, isAllocated)
        const iconScale = sprites.getScaleFactor(viewport.zoom) * ICON_SCALE[pn.type]
        sprites.drawSprite(ctx, category, iconPath, sx, sy, viewport.zoom, iconScale)
      }
    }

    // Draw frame on top to mask square icon edges
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
          const iconScale = sprites.getScaleFactor(viewport.zoom) * ICON_SCALE[pn.type]
          sprites.drawSprite(
            ctx,
            'masteryActiveSelected',
            pn.node.activeIcon,
            sx,
            sy,
            viewport.zoom,
            iconScale,
          )
        }
      } else {
        const iconPath = pn.node.icon
        if (iconPath) {
          const activeCategory = getIconCategory(pn.type, true)
          const iconScale = sprites.getScaleFactor(viewport.zoom) * ICON_SCALE[pn.type]
          sprites.drawSprite(ctx, activeCategory, iconPath, sx, sy, viewport.zoom, iconScale)
        }
        const activeFrame = FRAME_MAP[pn.type]
        if (activeFrame) {
          sprites.drawSprite(ctx, 'frame', activeFrame.allocated, sx, sy, viewport.zoom)
        }
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
    case 'jewelSocket':
      return 40
    case 'classStart':
      return 80
    default:
      return 34
  }
}
