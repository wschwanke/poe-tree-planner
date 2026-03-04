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

export interface MasteryGroup {
  masteryName: string
  stats: AggregatedStat[]
  keystoneStats: string[]
}

export function aggregateStatsByMastery(
  allocatedNodes: Set<string>,
  processedNodes: Map<string, ProcessedNode>,
): MasteryGroup[] {
  // Build groupId → masteryName map by finding mastery nodes in each group
  const groupMasteryName = new Map<number, string>()
  for (const pn of processedNodes.values()) {
    if (pn.node.isMastery && pn.node.name) {
      groupMasteryName.set(pn.node.group, pn.node.name)
    }
  }

  // Per-group stat maps
  const groupStatMaps = new Map<string, Map<string, number>>()
  const groupKeystoneSets = new Map<string, Set<string>>()

  for (const nodeId of allocatedNodes) {
    const pn = processedNodes.get(nodeId)
    if (!pn || !pn.node.stats) continue
    // Skip mastery nodes and start nodes (classStartIndex defined)
    if (pn.node.isMastery || pn.node.classStartIndex !== undefined) continue

    const masteryName = groupMasteryName.get(pn.node.group) ?? 'General'

    if (!groupStatMaps.has(masteryName)) {
      groupStatMaps.set(masteryName, new Map())
      groupKeystoneSets.set(masteryName, new Set())
    }

    const statMap = groupStatMaps.get(masteryName)!
    const keystones = groupKeystoneSets.get(masteryName)!

    for (const stat of pn.node.stats) {
      for (const line of stat.split('\n')) {
        parseStat(line, statMap, keystones)
      }
    }
  }

  // Build result array
  const groups: MasteryGroup[] = []
  for (const [masteryName, statMap] of groupStatMaps) {
    const stats: AggregatedStat[] = []
    const sorted = Array.from(statMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    for (const [template, value] of sorted) {
      stats.push({ template, value, isKeystone: false })
    }
    const keystoneStats = Array.from(groupKeystoneSets.get(masteryName) ?? []).sort()
    for (const stat of keystoneStats) {
      stats.push({ template: stat, value: null, isKeystone: true })
    }
    groups.push({ masteryName, stats, keystoneStats })
  }

  // Sort alphabetically, "General" last
  groups.sort((a, b) => {
    if (a.masteryName === 'General') return 1
    if (b.masteryName === 'General') return -1
    return a.masteryName.localeCompare(b.masteryName)
  })

  return groups
}

// ── Stat category classification ──

interface CategoryDef {
  name: string
  keywords: (string | RegExp)[]
}

const STAT_CATEGORIES: CategoryDef[] = [
  {
    name: 'Minions',
    keywords: ['Minion', 'Zombie', 'Spectre', 'Skeleton', 'Golem', 'Phantasm', 'Summoned', 'Raised', 'Sentinel'],
  },
  {
    name: 'Auras & Curses',
    keywords: ['Aura', 'Curse', 'Hex', 'Herald', 'Banner', 'Mark ', 'Reservation', 'Blessing'],
  },
  {
    name: 'Totems, Traps & Mines',
    keywords: ['Totem', 'Trap', 'Mine', 'Brand', 'Detonation'],
  },
  {
    name: 'Life',
    keywords: ['maximum Life', 'Life Regenerat', 'Life Recovery', 'Leeched as Life', 'Recouped as Life', 'Life per', 'Life gained'],
  },
  {
    name: 'Mana',
    keywords: ['maximum Mana', 'Mana Regenerat', 'Mana Cost', 'Leeched as Mana', 'Recouped as Mana', 'Mana per'],
  },
  {
    name: 'Energy Shield',
    keywords: ['Energy Shield'],
  },
  {
    name: 'Defences',
    keywords: ['Armour', 'Evasion Rating', 'Block', 'Suppress', 'Fortif', 'Physical Damage Reduction', 'Damage taken'],
  },
  {
    name: 'Resistances',
    keywords: ['Resistance', /maximum.{0,20}Resist/],
  },
  {
    name: 'Attributes',
    keywords: ['to Strength', 'to Dexterity', 'to Intelligence', 'to all Attributes'],
  },
  {
    name: 'Critical Strike',
    keywords: ['Critical Strike'],
  },
  {
    name: 'Attack',
    keywords: [
      'Attack', 'Melee', 'Accuracy', 'Impale', 'Dual Wield',
      'Sword', 'Axe', 'Mace', 'Claw', 'Dagger', 'Bow ',
      'Wand ', 'Staff', 'Shield', 'Weapon', 'Two Hand',
    ],
  },
  {
    name: 'Spell',
    keywords: ['Spell', 'Cast Speed', 'Caster', 'Channelling', 'Arcane'],
  },
  {
    name: 'Elemental',
    keywords: ['Fire Damage', 'Cold Damage', 'Lightning Damage', 'Elemental Damage', 'Exposure', 'Penetrat'],
  },
  {
    name: 'Chaos & DoT',
    keywords: ['Chaos Damage', 'Poison', 'Bleed', 'Damage over Time', 'DoT', 'Wither', 'Ignite Duration', 'Ignite Damage'],
  },
  {
    name: 'Projectile',
    keywords: ['Projectile', 'Arrow', 'Pierce', 'Chain', 'Fork'],
  },
  {
    name: 'Charges',
    keywords: ['Charge', 'Rage'],
  },
  {
    name: 'Flasks',
    keywords: ['Flask', 'Tincture'],
  },
  {
    name: 'Movement & Utility',
    keywords: ['Movement Speed', 'Onslaught', 'Elusive', 'Phasing', 'Area of Effect', 'Duration', 'Cooldown', 'Warcry'],
  },
]

function classifyTemplate(template: string): string {
  for (const cat of STAT_CATEGORIES) {
    for (const kw of cat.keywords) {
      if (kw instanceof RegExp) {
        if (kw.test(template)) return cat.name
      } else {
        if (template.includes(kw)) return cat.name
      }
    }
  }
  return 'General'
}

export interface CategoryGroup {
  categoryName: string
  stats: AggregatedStat[]
}

export function aggregateStatsByCategory(
  allocatedNodes: Set<string>,
  processedNodes: Map<string, ProcessedNode>,
  selectedMasteryEffects?: Map<string, number>,
): { groups: CategoryGroup[]; masteryStats: MasteryStat[] } {
  // Per-category stat maps
  const categoryStatMaps = new Map<string, Map<string, number>>()
  const categoryKeystoneSets = new Map<string, Set<string>>()

  function addToCategoryMaps(line: string) {
    const trimmed = line.trim()
    if (!trimmed) return

    const match = trimmed.match(EMBEDDED_NUM)
    if (match && match.index !== undefined) {
      const value = Number.parseFloat(match[1])
      const pct = match[2] ?? ''
      const before = trimmed.slice(0, match.index)
      const after = trimmed.slice(match.index + match[0].length)
      const hadSign = match[1].startsWith('+') || match[1].startsWith('-')
      const signMarker = hadSign ? '+' : ''
      const template = `${before}${signMarker}#${pct} ${after}`.replace(/\s+/g, ' ').trim()

      const category = classifyTemplate(template)
      if (!categoryStatMaps.has(category)) {
        categoryStatMaps.set(category, new Map())
        categoryKeystoneSets.set(category, new Set())
      }
      const statMap = categoryStatMaps.get(category)!
      statMap.set(template, (statMap.get(template) ?? 0) + value)
    } else {
      const category = classifyTemplate(trimmed)
      if (!categoryStatMaps.has(category)) {
        categoryStatMaps.set(category, new Map())
        categoryKeystoneSets.set(category, new Set())
      }
      categoryKeystoneSets.get(category)!.add(trimmed)
    }
  }

  for (const nodeId of allocatedNodes) {
    const pn = processedNodes.get(nodeId)
    if (!pn || !pn.node.stats || pn.node.isMastery) continue

    for (const stat of pn.node.stats) {
      for (const line of stat.split('\n')) {
        addToCategoryMaps(line)
      }
    }
  }

  // Process mastery effects — aggregate into categories AND collect raw MasteryStat[]
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
      for (const stat of effect.stats) {
        for (const line of stat.split('\n')) {
          addToCategoryMaps(line)
        }
      }
    }
  }

  // Build category order based on STAT_CATEGORIES definition order, General last
  const categoryOrder = new Map<string, number>()
  for (let i = 0; i < STAT_CATEGORIES.length; i++) {
    categoryOrder.set(STAT_CATEGORIES[i].name, i)
  }
  categoryOrder.set('General', STAT_CATEGORIES.length)

  const groups: CategoryGroup[] = []
  for (const [category, statMap] of categoryStatMaps) {
    const stats: AggregatedStat[] = []
    const sorted = Array.from(statMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    for (const [template, value] of sorted) {
      stats.push({ template, value, isKeystone: false })
    }
    const keystones = Array.from(categoryKeystoneSets.get(category) ?? []).sort()
    for (const ks of keystones) {
      stats.push({ template: ks, value: null, isKeystone: true })
    }
    groups.push({ categoryName: category, stats })
  }

  groups.sort((a, b) => {
    const oa = categoryOrder.get(a.categoryName) ?? STAT_CATEGORIES.length
    const ob = categoryOrder.get(b.categoryName) ?? STAT_CATEGORIES.length
    return oa - ob
  })

  return { groups, masteryStats }
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
