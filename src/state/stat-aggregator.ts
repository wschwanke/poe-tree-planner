import type { ProcessedNode } from '@/types/skill-tree'

export interface AggregatedStat {
  description: string
  value: number | null
  isKeystone: boolean
}

export interface MasteryStat {
  masteryName: string
  stats: string[]
}

const STAT_PATTERN = /^([+-]?\d+\.?\d*)(%?)\s+(.+)$/

function parseStat(line: string, statMap: Map<string, number>, keystoneStats: string[]): void {
  const trimmed = line.trim()
  if (!trimmed) return
  const match = trimmed.match(STAT_PATTERN)
  if (match) {
    const value = parseFloat(match[1])
    const percent = match[2]
    const desc = `${percent} ${match[3]}`.trim()
    statMap.set(desc, (statMap.get(desc) ?? 0) + value)
  } else {
    keystoneStats.push(trimmed)
  }
}

export function aggregateStats(
  allocatedNodes: Set<string>,
  processedNodes: Map<string, ProcessedNode>,
  selectedMasteryEffects?: Map<string, number>,
): { stats: AggregatedStat[]; masteryStats: MasteryStat[] } {
  const statMap = new Map<string, number>()
  const keystoneStats: string[] = []

  for (const nodeId of allocatedNodes) {
    const pn = processedNodes.get(nodeId)
    if (!pn || !pn.node.stats) continue

    for (const stat of pn.node.stats) {
      for (const line of stat.split('\n')) {
        parseStat(line, statMap, keystoneStats)
      }
    }
  }

  // Collect mastery effect stats separately for display
  const masteryStats: MasteryStat[] = []
  if (selectedMasteryEffects) {
    for (const [nodeId, effectIndex] of selectedMasteryEffects) {
      const pn = processedNodes.get(nodeId)
      if (!pn?.node.masteryEffects) continue
      const effect = pn.node.masteryEffects[effectIndex]
      if (!effect) continue
      masteryStats.push({
        masteryName: pn.node.name ?? 'Mastery',
        stats: effect.stats,
      })
      // Also add to numeric aggregation
      for (const stat of effect.stats) {
        for (const line of stat.split('\n')) {
          parseStat(line, statMap, keystoneStats)
        }
      }
    }
  }

  const result: AggregatedStat[] = []

  // Sort numeric stats by description
  const sorted = Array.from(statMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  for (const [desc, value] of sorted) {
    result.push({ description: desc, value, isKeystone: false })
  }

  // Add keystone/non-numeric stats
  for (const stat of keystoneStats) {
    result.push({ description: stat, value: null, isKeystone: true })
  }

  return { stats: result, masteryStats }
}

export function formatStatValue(stat: AggregatedStat): string {
  if (stat.value === null) return stat.description

  const sign = stat.value >= 0 ? '+' : ''
  const desc = stat.description
  // Check if description starts with % (from our aggregation format)
  if (desc.startsWith('% ')) {
    return `${sign}${stat.value}% ${desc.slice(2)}`
  }
  return `${sign}${stat.value} ${desc}`
}
