import { useCallback } from 'react'
import { solveSteinerTree } from '@/data/solver'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { usePlanningStore } from '@/state/planning-store'
import { useTreeStore } from '@/state/tree-store'
import type { ProcessedNode } from '@/types/skill-tree'

interface PlanningInfoPanelProps {
  adjacency: Map<string, Set<string>>
  processedNodes: Map<string, ProcessedNode>
}

export function PlanningInfoPanel({ adjacency, processedNodes }: PlanningInfoPanelProps) {
  const requiredNodes = usePlanningStore((s) => s.requiredNodes)
  const blockedNodes = usePlanningStore((s) => s.blockedNodes)
  const preferNotables = usePlanningStore((s) => s.preferNotables)
  const solverStatus = usePlanningStore((s) => s.solverStatus)
  const solverPreview = usePlanningStore((s) => s.solverPreview)
  const solverPointCost = usePlanningStore((s) => s.solverPointCost)
  const solverError = usePlanningStore((s) => s.solverError)
  const togglePreferNotables = usePlanningStore((s) => s.togglePreferNotables)
  const clearFlags = usePlanningStore((s) => s.clearFlags)
  const setSolverResult = usePlanningStore((s) => s.setSolverResult)
  const setPlanningMode = usePlanningStore((s) => s.setPlanningMode)

  const classStartNodeId = useTreeStore((s) => s.classStartNodeId)
  const allocatedNodes = useTreeStore((s) => s.allocatedNodes)
  const applyNodes = useTreeStore((s) => s.applyNodes)

  const handleSolve = useCallback(() => {
    if (!classStartNodeId || requiredNodes.size === 0) return

    const result = solveSteinerTree(
      classStartNodeId,
      requiredNodes,
      blockedNodes,
      adjacency,
      allocatedNodes,
      processedNodes,
      preferNotables,
    )

    if ('error' in result) {
      usePlanningStore.getState().clearSolverPreview()
      usePlanningStore.setState({ solverStatus: 'error', solverError: result.error })
    } else {
      setSolverResult(result.nodes, result.cost)
    }
  }, [
    classStartNodeId,
    requiredNodes,
    blockedNodes,
    adjacency,
    allocatedNodes,
    processedNodes,
    preferNotables,
    setSolverResult,
  ])

  const handleApply = useCallback(() => {
    if (solverPreview.size === 0) return
    applyNodes(solverPreview)
    usePlanningStore.getState().clearFlags()
    setPlanningMode(false)
  }, [solverPreview, applyNodes, setPlanningMode])

  const handleClose = useCallback(() => {
    setPlanningMode(false)
  }, [setPlanningMode])

  const hasFlags = requiredNodes.size > 0 || blockedNodes.size > 0

  return (
    <div className="absolute top-0 right-0 z-40 h-full w-80 pointer-events-none">
      <Card className="m-4 gap-0 py-0 bg-stone-950/90 border-stone-800 backdrop-blur-sm pointer-events-auto">
        <CardHeader className="px-4 py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-cyan-400">Planning Mode</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-6 w-6 p-0 text-stone-500 hover:text-stone-300"
            >
              ✕
            </Button>
          </div>
        </CardHeader>
        <Separator className="bg-stone-800" />
        <CardContent className="px-4 py-3 space-y-3">
          {/* Flag badges */}
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="px-2 py-0.5 bg-green-950/90 border-green-700/50 text-green-300 text-xs"
            >
              {requiredNodes.size} required
            </Badge>
            <Badge
              variant="outline"
              className="px-2 py-0.5 bg-red-950/90 border-red-700/50 text-red-300 text-xs"
            >
              {blockedNodes.size} blocked
            </Badge>
          </div>

          {/* Prefer notables checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={preferNotables}
              onChange={togglePreferNotables}
              className="accent-cyan-500"
            />
            <span className="text-sm text-stone-300">Prefer notables in paths</span>
          </label>

          {/* Solve button */}
          <Button
            size="sm"
            onClick={handleSolve}
            disabled={requiredNodes.size === 0}
            className="w-full bg-cyan-800 hover:bg-cyan-700 text-cyan-100 border-cyan-600 text-xs disabled:opacity-40"
          >
            Solve
          </Button>

          {/* Apply button (after solve) */}
          {solverStatus === 'solved' && solverPointCost > 0 && (
            <Button
              size="sm"
              onClick={handleApply}
              className="w-full bg-green-800 hover:bg-green-700 text-green-100 border-green-600 text-xs"
            >
              Apply ({solverPointCost} pts)
            </Button>
          )}

          {/* Error text */}
          {solverStatus === 'error' && solverError && (
            <p className="text-xs text-red-400">{solverError}</p>
          )}

          {/* Clear all flags */}
          {hasFlags && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFlags}
              className="w-full text-stone-500 hover:text-stone-300 text-xs"
            >
              Clear All Flags
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
