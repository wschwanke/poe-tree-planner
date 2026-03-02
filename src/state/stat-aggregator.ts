import type { ProcessedNode } from '@/types/skill-tree'

export interface AggregatedStat {
  /** Template string with `#` where the numeric value goes (e.g. "# to Strength", "Minions have #% increased maximum Life") */
  template: string
  value: number | null
  isKeystone: boolean
}

export interface MasteryStat {
  masteryName: string
  stats: string[]
}

// Matches the first numeric value (with optional +/-) and optional % suffix anywhere in the string
const EMBEDDED_NUM = /([+-]?\d+\.?\d*)(%)?\s*/

function parseStat(
  line: string,
  statMap: Map<string, number>,
  keystoneStats: Set<string>,
): void {
  const trimmed = line.trim()
  if (!trimmed) return

  const match = trimmed.match(EMBEDDED_NUM)
  if (match && match.index !== undefined) {
    const value = Number.parseFloat(match[1])
    const pct = match[2] ?? ''
    const before = trimmed.slice(0, match.index)
    const after = trimmed.slice(match.index + match[0].length)
    // Preserve `+` sign convention in template when the original stat had it
    const hadSign = match[1].startsWith('+') || match[1].startsWith('-')
    const signMarker = hadSign ? '+' : ''
    const template = `${before}${signMarker}#${pct} ${after}`.replace(/\s+/g, ' ').trim()
    statMap.set(template, (statMap.get(template) ?? 0) + value)
  } else {
    keystoneStats.add(trimmed)
  }
}

export function aggregateStats(
  allocatedNodes: Set<string>,
  processedNodes: Map<string, ProcessedNode>,
  selectedMasteryEffects?: Map<string, number>,
): { stats: AggregatedStat[]; masteryStats: MasteryStat[] } {
  const statMap = new Map<string, number>()
  const keystoneStats = new Set<string>()

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

  // Sort numeric stats by template
  const sorted = Array.from(statMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  for (const [template, value] of sorted) {
    result.push({ template, value, isKeystone: false })
  }

  // Add keystone/non-numeric stats (deduplicated)
  for (const stat of keystoneStats) {
    result.push({ template: stat, value: null, isKeystone: true })
  }

  return { stats: result, masteryStats }
}

export function formatStatValue(stat: AggregatedStat): string {
  if (stat.value === null) return stat.template

  const value = stat.value
  const numStr = Number.isInteger(value) ? String(value) : value.toFixed(1)

  // Template uses `+#` when the original stat had a sign prefix (e.g. "+10 to Strength")
  if (stat.template.includes('+#')) {
    const signed = value >= 0 ? `+${numStr}` : String(numStr)
    return stat.template.replace('+#', signed)
  }
  return stat.template.replace('#', numStr)
}
