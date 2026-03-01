import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { aggregateStats, formatStatValue } from '@/state/stat-aggregator'
import type { ProcessedNode } from '@/types/skill-tree'

interface StatSummaryPanelProps {
  allocatedNodes: Set<string>
  processedNodes: Map<string, ProcessedNode>
  selectedMasteryEffects: Map<string, number>
  pointsUsed: number
  totalPoints: number
  onReset: () => void
}

export function StatSummaryPanel({
  allocatedNodes,
  processedNodes,
  selectedMasteryEffects,
  pointsUsed,
  totalPoints,
  onReset,
}: StatSummaryPanelProps) {
  const { stats, masteryStats } = aggregateStats(
    allocatedNodes,
    processedNodes,
    selectedMasteryEffects,
  )
  const numericStats = stats.filter((s) => !s.isKeystone)
  const keystoneStats = stats.filter((s) => s.isKeystone)

  return (
    <div className="absolute top-0 right-0 z-40 h-full w-72 pointer-events-none">
      <Card className="m-4 h-[calc(100%-2rem)] bg-stone-950/90 border-stone-800 backdrop-blur-sm pointer-events-auto flex flex-col">
        <CardHeader className="pb-2 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-stone-300">Passive Stats</CardTitle>
            <Badge variant="outline" className="text-xs border-amber-900/50">
              <span className="text-amber-400">{pointsUsed}</span>
              <span className="text-stone-500 mx-0.5">/</span>
              <span className="text-stone-400">{totalPoints}</span>
            </Badge>
          </div>
        </CardHeader>
        <Separator className="bg-stone-800" />
        <ScrollArea className="flex-1 min-h-0">
          <CardContent className="p-3 space-y-0.5">
            {stats.length === 0 && masteryStats.length === 0 && (
              <p className="text-xs text-stone-600 text-center py-4">Allocate nodes to see stats</p>
            )}
            {numericStats.map((stat, i) => (
              <p key={i} className="text-xs text-blue-300 leading-relaxed">
                {formatStatValue(stat)}
              </p>
            ))}
            {keystoneStats.length > 0 && numericStats.length > 0 && (
              <Separator className="bg-stone-800 my-2" />
            )}
            {keystoneStats.map((stat, i) => (
              <p key={`k-${i}`} className="text-xs text-amber-300 leading-relaxed">
                {stat.description}
              </p>
            ))}
            {masteryStats.length > 0 && (
              <>
                <Separator className="bg-stone-800 my-2" />
                <p className="text-[10px] text-purple-400 font-semibold uppercase tracking-wide pb-1">
                  Masteries
                </p>
                {masteryStats.map((ms, i) => (
                  <div key={i} className="pb-1">
                    <p className="text-[10px] text-stone-500">{ms.masteryName}</p>
                    {ms.stats.map((stat, j) => (
                      <p key={j} className="text-xs text-purple-300 leading-relaxed">
                        {stat}
                      </p>
                    ))}
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </ScrollArea>
        <Separator className="bg-stone-800" />
        <div className="p-3 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="w-full text-xs border-stone-700 hover:bg-stone-800 hover:text-stone-200"
          >
            Reset Tree
          </Button>
        </div>
      </Card>
    </div>
  )
}
