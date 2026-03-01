import type { SpriteManager } from '@/data/sprite-manager'
import type { ProcessedNode, SkillTreeData, ViewportState } from '@/types/skill-tree'
import { isInView, worldToScreen } from './viewport'

export function renderGroupBackgrounds(
  ctx: CanvasRenderingContext2D,
  data: SkillTreeData,
  processedNodes: Map<string, ProcessedNode>,
  viewport: ViewportState,
  sprites: SpriteManager,
): void {
  const { groups } = data

  for (const [, group] of Object.entries(groups)) {
    if (!group.background) continue
    // Skip groups with no renderable nodes
    const hasNode = group.nodes.some((nid) => processedNodes.has(nid))
    if (!hasNode) continue

    if (!isInView(group.x, group.y, viewport, 500)) continue

    const [sx, sy] = worldToScreen(group.x, group.y, viewport)
    const coordKey = group.background.image

    if (group.background.isHalfImage) {
      // Half-image backgrounds need to be drawn twice: once above center,
      // once mirrored below center to form the full circular background.
      const coord = sprites.getSpriteCoord('groupBackground', coordKey, viewport.zoom)
      const image = sprites.getSpriteImage('groupBackground', viewport.zoom)
      if (coord && image) {
        const scaleFactor = sprites.getScaleFactor(viewport.zoom)
        const dw = coord.w * scaleFactor
        const dh = coord.h * scaleFactor

        // Draw top half: bottom edge at center Y
        ctx.drawImage(image, coord.x, coord.y, coord.w, coord.h, sx - dw / 2, sy - dh, dw, dh)

        // Draw mirrored bottom half: flip vertically around center Y
        ctx.save()
        ctx.translate(sx, sy)
        ctx.scale(1, -1)
        ctx.drawImage(image, coord.x, coord.y, coord.w, coord.h, -dw / 2, -dh, dw, dh)
        ctx.restore()
      }
    } else {
      const drawn = sprites.drawSprite(ctx, 'groupBackground', coordKey, sx, sy, viewport.zoom)
      if (!drawn) {
        // Try alt variant
        const altKey = `${coordKey.replace('PSGroupBackground', 'GroupBackground')}Alt`
        sprites.drawSprite(ctx, 'groupBackground', altKey, sx, sy, viewport.zoom)
      }
    }
  }
}
