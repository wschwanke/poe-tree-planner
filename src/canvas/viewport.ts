import type { ViewportState } from '@/types/skill-tree'

export const MIN_ZOOM = 0.05
export const MAX_ZOOM = 0.8
export const DEFAULT_ZOOM = 0.25

export function createViewport(width: number, height: number): ViewportState {
  return {
    offsetX: 0,
    offsetY: 0,
    zoom: DEFAULT_ZOOM,
    width,
    height,
  }
}

export function worldToScreen(worldX: number, worldY: number, vp: ViewportState): [number, number] {
  const sx = (worldX - vp.offsetX) * vp.zoom + vp.width / 2
  const sy = (worldY - vp.offsetY) * vp.zoom + vp.height / 2
  return [sx, sy]
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  vp: ViewportState,
): [number, number] {
  const wx = (screenX - vp.width / 2) / vp.zoom + vp.offsetX
  const wy = (screenY - vp.height / 2) / vp.zoom + vp.offsetY
  return [wx, wy]
}

export function zoomAtPoint(
  vp: ViewportState,
  screenX: number,
  screenY: number,
  delta: number,
): ViewportState {
  const zoomFactor = delta > 0 ? 0.9 : 1.1
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, vp.zoom * zoomFactor))

  // Keep the world point under the cursor fixed
  const [worldX, worldY] = screenToWorld(screenX, screenY, vp)
  const newOffsetX = worldX - (screenX - vp.width / 2) / newZoom
  const newOffsetY = worldY - (screenY - vp.height / 2) / newZoom

  return { ...vp, zoom: newZoom, offsetX: newOffsetX, offsetY: newOffsetY }
}

export function pan(vp: ViewportState, dx: number, dy: number): ViewportState {
  return {
    ...vp,
    offsetX: vp.offsetX - dx / vp.zoom,
    offsetY: vp.offsetY - dy / vp.zoom,
  }
}

export function isInView(
  worldX: number,
  worldY: number,
  vp: ViewportState,
  margin: number = 100,
): boolean {
  const [sx, sy] = worldToScreen(worldX, worldY, vp)
  return sx >= -margin && sx <= vp.width + margin && sy >= -margin && sy <= vp.height + margin
}

export function centerOnWorld(
  vp: ViewportState,
  worldX: number,
  worldY: number,
  zoom?: number,
): ViewportState {
  return {
    ...vp,
    offsetX: worldX,
    offsetY: worldY,
    zoom: zoom ?? vp.zoom,
  }
}
