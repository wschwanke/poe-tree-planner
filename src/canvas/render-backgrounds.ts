import type { SpriteManager } from '@/data/sprite-manager'
import type { ProcessedNode, SkillTreeData, ViewportState } from '@/types/skill-tree'
import { isInView, worldToScreen } from './viewport'

/** Draw a group background sprite with 1px top inset to prevent
 *  image smoothing from sampling adjacent sprites in the sheet. */
function drawGroupSprite(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteManager,
  coordKey: string,
  dx: number,
  dy: number,
  zoom: number,
): boolean {
  const coord = sprites.getSpriteCoord('groupBackground', coordKey, zoom)
  const image = sprites.getSpriteImage('groupBackground', zoom)
  if (!coord || !image) return false

  const scaleFactor = sprites.getScaleFactor(zoom)
  const srcX = coord.x
  const srcY = coord.y + 1
  const srcW = coord.w
  const srcH = coord.h - 1
  const dw = srcW * scaleFactor
  const dh = srcH * scaleFactor

  ctx.drawImage(image, srcX, srcY, srcW, srcH, dx - dw / 2, dy - dh / 2, dw, dh)
  return true
}

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

        // Inset source rect by 1px on top to avoid sampling adjacent
        // sprites in the sheet when the canvas applies image smoothing
        const srcX = coord.x
        const srcY = coord.y + 1
        const srcW = coord.w
        const srcH = coord.h - 1

        const dw = srcW * scaleFactor
        const dh = srcH * scaleFactor
        const cx = Math.round(sx)
        const cy = Math.round(sy)

        // Draw top half: bottom edge at center Y
        ctx.drawImage(image, srcX, srcY, srcW, srcH, cx - dw / 2, cy - dh, dw, dh)

        // Draw mirrored bottom half: flip vertically around center Y
        ctx.save()
        ctx.translate(cx, cy)
        ctx.scale(1, -1)
        ctx.drawImage(image, srcX, srcY, srcW, srcH, -dw / 2, -dh, dw, dh)
        ctx.restore()
      }
    } else {
      // Draw manually with 1px top inset to avoid sampling adjacent
      // sprites in the sheet when the canvas applies image smoothing
      const drawn = drawGroupSprite(ctx, sprites, coordKey, sx, sy, viewport.zoom)
      if (!drawn) {
        const altKey = `${coordKey.replace('PSGroupBackground', 'GroupBackground')}Alt`
        drawGroupSprite(ctx, sprites, altKey, sx, sy, viewport.zoom)
      }
    }
  }
}
