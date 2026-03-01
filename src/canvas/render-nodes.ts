import type { SpriteManager } from '@/data/sprite-manager'
import type { NodeType, ProcessedNode, ViewportState } from '@/types/skill-tree'
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

export function renderNodes(
  ctx: CanvasRenderingContext2D,
  processedNodes: Map<string, ProcessedNode>,
  viewport: ViewportState,
  sprites: SpriteManager,
  allocatedNodes: Set<string>,
  canAllocateNodes: Set<string>,
  hoveredNodeId: string | null,
): void {
  // Render class start decorations first
  for (const [, pn] of processedNodes) {
    if (pn.type !== 'classStart') continue
    if (!isInView(pn.worldX, pn.worldY, viewport, 200)) continue

    const [sx, sy] = worldToScreen(pn.worldX, pn.worldY, viewport)
    const className = pn.node.name?.toLowerCase() ?? ''

    // Try class-specific center sprite
    const centerKey = `center${className}`
    sprites.drawSprite(ctx, 'startNode', centerKey, sx, sy, viewport.zoom)
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

  // Render in order: normal, jewels, mastery, notable, keystone
  const renderOrder = [...normalNodes, ...masteryNodes, ...notableNodes, ...keystoneNodes]

  for (const [id, pn] of renderOrder) {
    const [sx, sy] = worldToScreen(pn.worldX, pn.worldY, viewport)
    const isAllocated = allocatedNodes.has(id)
    const isCanAllocate = canAllocateNodes.has(id)
    const isHovered = id === hoveredNodeId

    // Draw icon first (behind the frame)
    // Mastery nodes use different icon paths per state:
    //   allocated:   node.activeIcon → 'masteryActiveSelected' (bright)
    //   unallocated: node.icon → 'mastery' (muted via reduced alpha)
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
      } else if (pn.node.icon) {
        ctx.save()
        ctx.globalAlpha = 0.4
        sprites.drawSprite(ctx, 'mastery', pn.node.icon, sx, sy, viewport.zoom, iconScale)
        ctx.restore()
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
    if (isHovered && !isAllocated) {
      ctx.save()
      ctx.globalAlpha = 0.33
      if (pn.type === 'mastery') {
        if (pn.node.activeIcon) {
          const iconScale = sprites.getScaleFactor(viewport.zoom) * ICON_SCALE[pn.type]
          sprites.drawSprite(ctx, 'masteryActiveSelected', pn.node.activeIcon, sx, sy, viewport.zoom, iconScale)
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
