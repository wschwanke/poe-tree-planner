import type { SpriteManager } from '@/data/sprite-manager'
import type { ProcessedNode, SkillTreeData, ViewportState } from '@/types/skill-tree'
import { isInView, worldToScreen } from './viewport'

// ── Tunable background constants ──
// Skill tree background
const SKILL_BG_CENTER_X = 0
const SKILL_BG_CENTER_Y = 0
const SKILL_BG_WIDTH = 26000
const SKILL_BG_HEIGHT = 21000
const SKILL_BG_SCALE = 1.1
const SKILL_BG_OPACITY = 0.7

// Atlas tree background
const ATLAS_BG_CENTER_X = -75
const ATLAS_BG_CENTER_Y = -4800
const ATLAS_BG_WIDTH = 12000
const ATLAS_BG_HEIGHT = 12000
const ATLAS_BG_SCALE = 0.98
const ATLAS_BG_OPACITY = 0.8

export function renderTreeBackground(
  ctx: CanvasRenderingContext2D,
  data: SkillTreeData,
  viewport: ViewportState,
  sprites: SpriteManager,
  isAtlas: boolean,
): void {
  const category = isAtlas ? 'atlasBackground' : 'background'
  const coordKey = isAtlas ? 'AtlasPassiveBackground' : 'Background2'

  const maxZoom = data.imageZoomLevels[data.imageZoomLevels.length - 1]
  const coord = sprites.getSpriteCoord(category, coordKey, maxZoom)
  const image = sprites.getSpriteImage(category, maxZoom)
  if (!coord || !image) return

  const cx = isAtlas ? ATLAS_BG_CENTER_X : SKILL_BG_CENTER_X
  const cy = isAtlas ? ATLAS_BG_CENTER_Y : SKILL_BG_CENTER_Y
  const scale = isAtlas ? ATLAS_BG_SCALE : SKILL_BG_SCALE
  const hw = ((isAtlas ? ATLAS_BG_WIDTH : SKILL_BG_WIDTH) * scale) / 2
  const hh = ((isAtlas ? ATLAS_BG_HEIGHT : SKILL_BG_HEIGHT) * scale) / 2
  const opacity = isAtlas ? ATLAS_BG_OPACITY : SKILL_BG_OPACITY

  const [x0, y0] = worldToScreen(cx - hw, cy - hh, viewport)
  const [x1, y1] = worldToScreen(cx + hw, cy + hh, viewport)

  ctx.globalAlpha = opacity
  ctx.drawImage(image, coord.x, coord.y, coord.w, coord.h, x0, y0, x1 - x0, y1 - y0)
  ctx.globalAlpha = 1
}

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
    // Show group if it has renderable nodes OR is a non-bloodline ascendancy group
    const hasNode = group.nodes.some((nid) => processedNodes.has(nid))
    if (!hasNode) {
      if (!group.background.isHalfImage) continue
      const isAscGroup = group.nodes.some((nid) => {
        const raw = data.nodes[nid]
        return raw?.ascendancyName && !raw.isBloodline
      })
      if (!isAscGroup) continue
    }

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
