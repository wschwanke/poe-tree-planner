import type { ProcessedNode } from '@/types/skill-tree'

const TYPE_LABELS: Record<string, string> = {
  normal: 'passive',
  notable: 'notable',
  keystone: 'keystone',
  mastery: 'mastery',
  jewelSocket: 'jewel socket',
  classStart: 'class start',
}

export interface SearchResult {
  id: string
  node: ProcessedNode
  matchField: string
}

export function buildSearchIndex(processedNodes: Map<string, ProcessedNode>): Map<string, string> {
  const index = new Map<string, string>()

  for (const [id, pn] of processedNodes) {
    const n = pn.node
    if (n.isProxy) continue

    const parts: string[] = []

    if (n.name) parts.push(n.name)

    const typeLabel = TYPE_LABELS[pn.type]
    if (typeLabel) parts.push(typeLabel)

    if (n.stats) parts.push(n.stats.join('\n'))

    if (n.masteryEffects) {
      for (const effect of n.masteryEffects) {
        parts.push(effect.stats.join('\n'))
      }
    }

    if (n.ascendancyName) parts.push(n.ascendancyName)

    if (n.grantedStrength) parts.push(`+${n.grantedStrength} to strength`)
    if (n.grantedDexterity) parts.push(`+${n.grantedDexterity} to dexterity`)
    if (n.grantedIntelligence) parts.push(`+${n.grantedIntelligence} to intelligence`)

    index.set(id, parts.join('\n').toLowerCase())
  }

  return index
}

function detectMatchField(query: string, pn: ProcessedNode): string {
  const q = query.toLowerCase()
  const n = pn.node

  if (n.name?.toLowerCase().includes(q)) return 'name'
  if (TYPE_LABELS[pn.type]?.includes(q)) return 'type'
  if (n.stats?.some((s) => s.toLowerCase().includes(q))) return 'stats'
  if (n.masteryEffects?.some((e) => e.stats.some((s) => s.toLowerCase().includes(q))))
    return 'mastery effect'
  if (n.ascendancyName?.toLowerCase().includes(q)) return 'ascendancy'
  if (n.grantedStrength && `+${n.grantedStrength} to strength`.includes(q)) return 'attribute'
  if (n.grantedDexterity && `+${n.grantedDexterity} to dexterity`.includes(q)) return 'attribute'
  if (n.grantedIntelligence && `+${n.grantedIntelligence} to intelligence`.includes(q))
    return 'attribute'

  return 'match'
}

export function searchNodes(
  query: string,
  processedNodes: Map<string, ProcessedNode>,
  searchIndex: Map<string, string>,
): SearchResult[] {
  const q = query.toLowerCase().trim()
  if (!q) return []

  const results: SearchResult[] = []

  for (const [id, indexText] of searchIndex) {
    if (!indexText.includes(q)) continue
    const pn = processedNodes.get(id)
    if (!pn) continue

    results.push({
      id,
      node: pn,
      matchField: detectMatchField(query, pn),
    })
  }

  // Sort: name matches first, then notables/keystones, then alphabetical
  results.sort((a, b) => {
    const aName = a.matchField === 'name' ? 0 : 1
    const bName = b.matchField === 'name' ? 0 : 1
    if (aName !== bName) return aName - bName

    const typePriority: Record<string, number> = {
      keystone: 0,
      notable: 1,
      mastery: 2,
      jewelSocket: 3,
      normal: 4,
      classStart: 5,
    }
    const aType = typePriority[a.node.type] ?? 4
    const bType = typePriority[b.node.type] ?? 4
    if (aType !== bType) return aType - bType

    return (a.node.node.name ?? '').localeCompare(b.node.node.name ?? '')
  })

  return results
}
