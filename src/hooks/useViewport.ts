import { useCallback, useEffect, useState } from 'react'
import { centerOnWorld, createViewport, pan, zoomAtPoint } from '@/canvas/viewport'
import type { ViewportState } from '@/types/skill-tree'

export function useViewport(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const [viewport, setViewport] = useState<ViewportState>(() =>
    createViewport(window.innerWidth, window.innerHeight),
  )

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      setViewport((vp) => ({ ...vp, width: window.innerWidth, height: window.innerHeight }))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    setViewport((vp) => zoomAtPoint(vp, e.offsetX, e.offsetY, e.deltaY))
  }, [])

  // Attach wheel listener with passive: false
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [canvasRef, handleWheel])

  const handlePan = useCallback((dx: number, dy: number) => {
    setViewport((vp) => pan(vp, dx, dy))
  }, [])

  const handleCenterOn = useCallback((worldX: number, worldY: number, zoom?: number) => {
    setViewport((vp) => centerOnWorld(vp, worldX, worldY, zoom))
  }, [])

  return { viewport, setViewport, handlePan, handleCenterOn }
}
