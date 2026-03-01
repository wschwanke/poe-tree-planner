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
  normal: 0.85,
  notable: 0.85,
  keystone: 0.84,
  mastery: 1.0,
  jewelSocket: 0.85,
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

    // Draw frame
    const frameInfo = FRAME_MAP[pn.type]
    if (frameInfo) {
      const frameKey = isAllocated
        ? frameInfo.allocated
        : isCanAllocate
          ? frameInfo.canAllocate
          : frameInfo.unallocated
      sprites.drawSprite(ctx, 'frame', frameKey, sx, sy, viewport.zoom)
    }

    // Draw icon (scaled down to fit inside the frame border)
    const iconPath = pn.node.icon
    if (iconPath) {
      const category = getIconCategory(pn.type, isAllocated)
      const iconScale = sprites.getScaleFactor(viewport.zoom) * ICON_SCALE[pn.type]
      sprites.drawSprite(ctx, category, iconPath, sx, sy, viewport.zoom, iconScale)
    }

    // Hover highlight
    if (isHovered) {
      const radius = getNodeRadius(pn.type) * viewport.zoom * 0.5
      ctx.save()
      ctx.globalAlpha = 0.3
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(sx, sy, radius, 0, Math.PI * 2)
      ctx.fill()
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
