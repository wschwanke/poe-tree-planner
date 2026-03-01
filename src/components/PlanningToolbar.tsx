import { useCallback } from 'react'
import { solveSteinerTree } from '@/data/solver'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePlanningStore } from '@/state/planning-store'
import { useTreeStore } from '@/state/tree-store'
import type { ProcessedNode } from '@/types/skill-tree'

interface PlanningToolbarProps {
  adjacency: Map<string, Set<string>>
  processedNodes: Map<string, ProcessedNode>
}

export function PlanningToolbar({ adjacency, processedNodes }: PlanningToolbarProps) {
  const active = usePlanningStore((s) => s.active)
  const requiredNodes = usePlanningStore((s) => s.requiredNodes)
  const blockedNodes = usePlanningStore((s) => s.blockedNodes)
  const solverPreview = usePlanningStore((s) => s.solverPreview)
  const solverStatus = usePlanningStore((s) => s.solverStatus)
  const solverPointCost = usePlanningStore((s) => s.solverPointCost)
  const solverError = usePlanningStore((s) => s.solverError)
  const togglePlanningMode = usePlanningStore((s) => s.togglePlanningMode)
  const clearFlags = usePlanningStore((s) => s.clearFlags)
  const setSolverResult = usePlanningStore((s) => s.setSolverResult)

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
    setSolverResult,
  ])

  const handleApply = useCallback(() => {
    if (solverPreview.size === 0) return
    applyNodes(solverPreview)
    usePlanningStore.getState().clearFlags()
  }, [solverPreview, applyNodes])

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={active ? 'default' : 'outline'}
        size="sm"
        onClick={togglePlanningMode}
        className={
          active
            ? 'h-7 bg-cyan-800 hover:bg-cyan-700 text-cyan-100 border-cyan-600 text-xs'
            : 'h-7 bg-stone-950/90 border-amber-900/50 text-stone-300 backdrop-blur-sm text-xs hover:bg-stone-900/90'
        }
      >
        {active ? 'Planning' : 'Plan'}
      </Button>

      {active && (
        <>
          {requiredNodes.size > 0 && (
            <Badge
              variant="outline"
              className="px-2 py-0.5 bg-green-950/90 border-green-700/50 text-green-300 text-xs"
            >
              {requiredNodes.size} req
            </Badge>
          )}
          {blockedNodes.size > 0 && (
            <Badge
              variant="outline"
              className="px-2 py-0.5 bg-red-950/90 border-red-700/50 text-red-300 text-xs"
            >
              {blockedNodes.size} blocked
            </Badge>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleSolve}
            disabled={requiredNodes.size === 0}
            className="h-7 bg-stone-950/90 border-amber-900/50 text-stone-300 backdrop-blur-sm text-xs hover:bg-stone-900/90 disabled:opacity-40"
          >
            Solve
          </Button>

          {solverStatus === 'solved' && solverPointCost > 0 && (
            <Button
              size="sm"
              onClick={handleApply}
              className="h-7 bg-green-800 hover:bg-green-700 text-green-100 border-green-600 text-xs"
            >
              Apply ({solverPointCost} pts)
            </Button>
          )}

          {solverStatus === 'error' && solverError && (
            <Badge
              variant="outline"
              className="px-2 py-0.5 bg-red-950/90 border-red-700/50 text-red-300 text-xs"
            >
              {solverError}
            </Badge>
          )}

          {(requiredNodes.size > 0 || blockedNodes.size > 0) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFlags}
              className="h-7 text-stone-500 hover:text-stone-300 text-xs"
            >
              Clear
            </Button>
          )}
        </>
      )}
    </div>
  )
}
