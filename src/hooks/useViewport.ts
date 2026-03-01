import { useCallback, useEffect, useRef, useState } from 'react'
import { centerOnWorld, createViewport, pan, zoomAtPoint } from '@/canvas/viewport'
import type { ViewportState } from '@/types/skill-tree'

export function useViewport(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  // Primary viewport lives in a ref — mutations don't trigger React re-renders.
  // The rAF render loop reads from this ref directly.
  const viewportRef = useRef<ViewportState>(createViewport(window.innerWidth, window.innerHeight))

  // A dirty flag so the render loop knows when to redraw.
  const dirtyRef = useRef(true)

  // Throttled React state for components that need reactivity (e.g. NodeTooltip).
  // Updated at most once per rAF frame via the render loop in SkillTreeCanvas.
  const [viewportState, setViewportState] = useState<ViewportState>(() => viewportRef.current)

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      viewportRef.current = {
        ...viewportRef.current,
        width: window.innerWidth,
        height: window.innerHeight,
      }
      dirtyRef.current = true
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    viewportRef.current = zoomAtPoint(viewportRef.current, e.offsetX, e.offsetY, e.deltaY)
    dirtyRef.current = true
  }, [])

  // Attach wheel listener with passive: false
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [canvasRef, handleWheel])

  const handlePan = useCallback((dx: number, dy: number) => {
    viewportRef.current = pan(viewportRef.current, dx, dy)
    dirtyRef.current = true
  }, [])

  const handleCenterOn = useCallback((worldX: number, worldY: number, zoom?: number) => {
    viewportRef.current = centerOnWorld(viewportRef.current, worldX, worldY, zoom)
    dirtyRef.current = true
  }, [])

  return {
    viewportRef,
    dirtyRef,
    viewportState,
    setViewportState,
    handlePan,
    handleCenterOn,
  }
}
