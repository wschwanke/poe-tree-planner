import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  aggregateStatsByCategory,
  aggregateStatsByMastery,
  formatStatValue,
} from '@/state/stat-aggregator'
import type { AggregatedStat, MasteryStat } from '@/state/stat-aggregator'
import type { ProcessedNode, TreeMode } from '@/types/skill-tree'
import { useState } from 'react'

interface StatSummaryPanelProps {
  allocatedNodes: Set<string>
  processedNodes: Map<string, ProcessedNode>
  selectedMasteryEffects: Map<string, number>
  treeMode: TreeMode
  onReset: () => void
}

/** Shared collapsible grouped stat renderer */
function GroupedStats({
  groups,
  masteryStats,
}: {
  groups: { name: string; stats: AggregatedStat[] }[]
  masteryStats?: MasteryStat[]
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggle = (name: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const isEmpty = groups.length === 0 && (!masteryStats || masteryStats.length === 0)

  if (isEmpty) {
    return (
      <p className="text-sm text-stone-600 text-center py-4">
        Allocate nodes to see stats
      </p>
    )
  }

  return (
    <>
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.name)
        const numericStats = group.stats.filter((s) => !s.isKeystone)
        const keystoneStats = group.stats.filter((s) => s.isKeystone)
        return (
          <div key={group.name}>
            <button
              type="button"
              onClick={() => toggle(group.name)}
              className="flex items-center gap-1.5 w-full text-left py-1.5 text-xs font-semibold text-stone-400 uppercase tracking-wide hover:text-stone-200 transition-colors"
            >
              <span className="text-[10px] text-stone-600">
                {isCollapsed ? '▶' : '▼'}
              </span>
              {group.name}
            </button>
            {!isCollapsed && (
              <div className="pl-3 pb-2 space-y-0.5">
                {numericStats.map((stat, i) => (
                  <p key={i} className="text-sm text-blue-300 leading-relaxed">
                    {formatStatValue(stat)}
                  </p>
                ))}
                {keystoneStats.map((stat, i) => (
                  <p key={`k-${i}`} className="text-sm text-amber-300 leading-relaxed">
                    {stat.template}
                  </p>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {masteryStats && masteryStats.length > 0 && (
        <>
          <Separator className="bg-stone-800 my-2" />
          <p className="text-xs text-purple-400 font-semibold uppercase tracking-wide pb-1">
            Masteries
          </p>
          {masteryStats.map((ms, i) => (
            <div key={i} className="pb-1">
              <p className="text-xs text-stone-500">{ms.masteryName}</p>
              {ms.stats.map((stat, j) => (
                <p key={j} className="text-sm text-purple-300 leading-relaxed">
                  {stat}
                </p>
              ))}
            </div>
          ))}
        </>
      )}
    </>
  )
}

function GroupedSkillStats({
  allocatedNodes,
  processedNodes,
  selectedMasteryEffects,
}: {
  allocatedNodes: Set<string>
  processedNodes: Map<string, ProcessedNode>
  selectedMasteryEffects: Map<string, number>
}) {
  const { groups, masteryStats } = aggregateStatsByCategory(
    allocatedNodes,
    processedNodes,
    selectedMasteryEffects,
  )
  return (
    <GroupedStats
      groups={groups.map((g) => ({ name: g.categoryName, stats: g.stats }))}
      masteryStats={masteryStats}
    />
  )
}

function GroupedAtlasStats({
  allocatedNodes,
  processedNodes,
}: {
  allocatedNodes: Set<string>
  processedNodes: Map<string, ProcessedNode>
}) {
  const groups = aggregateStatsByMastery(allocatedNodes, processedNodes)
  return (
    <GroupedStats
      groups={groups.map((g) => ({ name: g.masteryName, stats: g.stats }))}
    />
  )
}

export function StatSummaryPanel({
  allocatedNodes,
  processedNodes,
  selectedMasteryEffects,
  treeMode,
  onReset,
}: StatSummaryPanelProps) {
  return (
    <div className="absolute top-0 right-0 z-40 h-full w-80 pointer-events-none">
      <Card className="m-4 h-[calc(100%-2rem)] gap-0 py-0 bg-stone-950/90 border-stone-800 backdrop-blur-sm pointer-events-auto">
        <CardHeader className="px-4 py-3 grid-rows-[auto]">
          <CardTitle className="text-sm text-stone-300">
            {treeMode === 'atlas' ? 'Atlas Stats' : 'Passive Stats'}
          </CardTitle>
        </CardHeader>
        <Separator className="bg-stone-800" />
        <ScrollArea className="flex-1 min-h-0">
          <CardContent className="px-4 py-3 space-y-1">
            {treeMode === 'atlas' ? (
              <GroupedAtlasStats
                allocatedNodes={allocatedNodes}
                processedNodes={processedNodes}
              />
            ) : (
              <GroupedSkillStats
                allocatedNodes={allocatedNodes}
                processedNodes={processedNodes}
                selectedMasteryEffects={selectedMasteryEffects}
              />
            )}
          </CardContent>
        </ScrollArea>
        <Separator className="bg-stone-800" />
        <div className="px-4 py-3 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="w-full border-stone-700 hover:bg-stone-800 hover:text-stone-200"
          >
            Reset Tree
          </Button>
        </div>
      </Card>
    </div>
  )
}
