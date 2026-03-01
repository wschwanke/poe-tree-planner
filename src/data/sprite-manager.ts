import type { SkillTreeData, SpriteCoord } from '@/types/skill-tree'

// Map CDN filenames to local asset paths
const filenameMap: Record<string, string> = {}

function getLocalFilename(cdnUrl: string): string {
  if (filenameMap[cdnUrl]) return filenameMap[cdnUrl]

  // Extract the base filename from the CDN URL
  // e.g. "https://web.poecdn.com/image/passive-skill/skills-0.jpg?fe66e493" -> "skills-0.jpg"
  const match = cdnUrl.match(/\/([^/]+?\.\w+)(?:\?|$)/)
  if (match) {
    const local = `/assets/${match[1]}`
    filenameMap[cdnUrl] = local
    return local
  }
  return cdnUrl
}

interface LoadedSprite {
  image: HTMLImageElement
  ready: boolean
}

export class SpriteManager {
  private images = new Map<string, LoadedSprite>()
  private data: SkillTreeData

  constructor(data: SkillTreeData) {
    this.data = data
  }

  getZoomLevelIndex(zoom: number): number {
    const levels = this.data.imageZoomLevels
    // Find the smallest sprite zoom that is >= our viewport zoom
    for (let i = 0; i < levels.length; i++) {
      if (levels[i] >= zoom) return i
    }
    return levels.length - 1
  }

  getZoomLevel(zoom: number): string {
    const idx = this.getZoomLevelIndex(zoom)
    return String(this.data.imageZoomLevels[idx])
  }

  getScaleFactor(zoom: number): number {
    const idx = this.getZoomLevelIndex(zoom)
    const spriteZoom = this.data.imageZoomLevels[idx]
    return zoom / spriteZoom
  }

  private loadImage(url: string): LoadedSprite {
    const existing = this.images.get(url)
    if (existing) return existing

    const img = new Image()
    const sprite: LoadedSprite = { image: img, ready: false }
    this.images.set(url, sprite)

    img.onload = () => {
      sprite.ready = true
    }
    img.onerror = () => {
      /* silently skip failed loads */
    }
    img.src = url

    return sprite
  }

  preloadCategory(category: string, zoom: number): void {
    const spriteSheet = this.data.sprites[category]
    if (!spriteSheet) return

    const zoomKey = this.getZoomLevel(zoom)
    const variant = spriteSheet[zoomKey]
    if (!variant) return

    const localPath = getLocalFilename(variant.filename)
    this.loadImage(localPath)
  }

  preloadAllCategories(zoom: number): void {
    const categories = [
      'normalInactive',
      'normalActive',
      'notableInactive',
      'notableActive',
      'keystoneInactive',
      'keystoneActive',
      'frame',
      'groupBackground',
      'background',
      'startNode',
      'line',
      'mastery',
      'masteryConnected',
      'masteryInactive',
      'masteryActiveSelected',
      'jewel',
    ]
    for (const cat of categories) {
      this.preloadCategory(cat, zoom)
    }
  }

  drawSprite(
    ctx: CanvasRenderingContext2D,
    category: string,
    coordKey: string,
    dx: number,
    dy: number,
    zoom: number,
    scale?: number,
  ): boolean {
    const spriteSheet = this.data.sprites[category]
    if (!spriteSheet) return false

    const zoomKey = this.getZoomLevel(zoom)
    const variant = spriteSheet[zoomKey]
    if (!variant) return false

    const coord = variant.coords[coordKey]
    if (!coord) return false

    const localPath = getLocalFilename(variant.filename)
    const sprite = this.loadImage(localPath)
    if (!sprite.ready) return false

    const scaleFactor = scale ?? this.getScaleFactor(zoom)
    const dw = coord.w * scaleFactor
    const dh = coord.h * scaleFactor

    ctx.drawImage(
      sprite.image,
      coord.x,
      coord.y,
      coord.w,
      coord.h,
      dx - dw / 2,
      dy - dh / 2,
      dw,
      dh,
    )

    return true
  }

  getSpriteImage(category: string, zoom: number): HTMLImageElement | null {
    const spriteSheet = this.data.sprites[category]
    if (!spriteSheet) return null
    const zoomKey = this.getZoomLevel(zoom)
    const variant = spriteSheet[zoomKey]
    if (!variant) return null
    const localPath = getLocalFilename(variant.filename)
    const sprite = this.loadImage(localPath)
    return sprite.ready ? sprite.image : null
  }

  getSpriteCoord(category: string, coordKey: string, zoom: number): SpriteCoord | null {
    const spriteSheet = this.data.sprites[category]
    if (!spriteSheet) return null
    const zoomKey = this.getZoomLevel(zoom)
    const variant = spriteSheet[zoomKey]
    if (!variant) return null
    return variant.coords[coordKey] ?? null
  }
}
