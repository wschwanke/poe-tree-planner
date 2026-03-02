import type { SkillTreeData, SpriteCoord } from '@/types/skill-tree'

interface LoadedSprite {
  image: HTMLImageElement
  ready: boolean
}

export class SpriteManager {
  private images = new Map<string, LoadedSprite>()
  private data: SkillTreeData
  private assetBasePath: string
  private filenameMap: Record<string, string> = {}

  constructor(data: SkillTreeData, assetBasePath = '/assets/') {
    this.data = data
    this.assetBasePath = assetBasePath
  }

  private getLocalFilename(cdnUrl: string): string {
    if (this.filenameMap[cdnUrl]) return this.filenameMap[cdnUrl]

    // Extract the base filename from the CDN URL
    // e.g. "https://web.poecdn.com/image/passive-skill/skills-0.jpg?fe66e493" -> "skills-0.jpg"
    const match = cdnUrl.match(/\/([^/]+?\.\w+)(?:\?|$)/)
    if (match) {
      const local = `${this.assetBasePath}${match[1]}`
      this.filenameMap[cdnUrl] = local
      return local
    }
    return cdnUrl
  }

  getMaxZoomLevelIndex(): number {
    return this.data.imageZoomLevels.length - 1
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

    const localPath = this.getLocalFilename(variant.filename)
    this.loadImage(localPath)
  }

  preloadAllCategories(zoom: number): void {
    for (const cat of Object.keys(this.data.sprites)) {
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
    useMaxZoom?: boolean,
  ): boolean {
    const spriteSheet = this.data.sprites[category]
    if (!spriteSheet) return false

    const idx = useMaxZoom ? this.getMaxZoomLevelIndex() : this.getZoomLevelIndex(zoom)
    const zoomKey = String(this.data.imageZoomLevels[idx])
    const variant = spriteSheet[zoomKey]
    if (!variant) return false

    const coord = variant.coords[coordKey]
    if (!coord) return false

    const localPath = this.getLocalFilename(variant.filename)
    const sprite = this.loadImage(localPath)
    if (!sprite.ready) return false

    const scaleFactor = scale ?? (zoom / this.data.imageZoomLevels[idx])
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
    const localPath = this.getLocalFilename(variant.filename)
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
