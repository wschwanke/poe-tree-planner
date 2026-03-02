// Test the new parseStat logic against real data
import fs from 'fs'

const EMBEDDED_NUM = /([+-]?\d+\.?\d*)(%)?\s*/

function parseStat(line, statMap, keystoneStats) {
  const trimmed = line.trim()
  if (!trimmed) return

  const match = trimmed.match(EMBEDDED_NUM)
  if (match && match.index !== undefined) {
    const value = parseFloat(match[1])
    const pct = match[2] ?? ''
    const before = trimmed.slice(0, match.index)
    const after = trimmed.slice(match.index + match[0].length)
    const hadSign = match[1].startsWith('+') || match[1].startsWith('-')
    const signMarker = hadSign ? '+' : ''
    const template = `${before}${signMarker}#${pct} ${after}`.replace(/\s+/g, ' ').trim()
    statMap.set(template, (statMap.get(template) ?? 0) + value)
  } else {
    keystoneStats.add(trimmed)
  }
}

function formatStat(template, value) {
  const numStr = Number.isInteger(value) ? String(value) : value.toFixed(1)
  if (template.includes('+#')) {
    const signed = value >= 0 ? `+${numStr}` : String(numStr)
    return template.replace('+#', signed)
  }
  return template.replace('#', numStr)
}

// Test with known examples
const statMap = new Map()
const keystoneStats = new Set()

const testStats = [
  // Leading sign stats
  '+10 to Strength',
  '+5 to Strength',
  '+10% to Fire Resistance',
  '+5% to Fire Resistance',
  // No-sign leading stats
  '10% increased maximum Life',
  '5% increased maximum Life',
  // Mid-string stats without sign
  'Minions have 25% increased maximum Life',
  'Minions have 12% increased maximum Life',
  'Regenerate 0.5% of Life per second',
  'Regenerate 1.6% of Life per second',
  // Mid-string with +
  'Your Maps have +5% chance to contain Ore Deposits',
  'Your Maps have +8% chance to contain Ore Deposits',
  // Negative stat
  'Enemies Ignited by you have -5% to Fire Resistance',
  // Keystone
  'Transfiguration of Mind',
  'Cannot be Stunned',
]

for (const stat of testStats) {
  parseStat(stat, statMap, keystoneStats)
}

console.log('=== Aggregated Stats (formatted) ===')
const sorted = [...statMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
for (const [template, value] of sorted) {
  console.log(`  ${formatStat(template, value)}  [template="${template}" value=${value}]`)
}

console.log('\n=== Keystone Stats ===')
for (const stat of keystoneStats) {
  console.log(`  ${stat}`)
}

// Test with real data
const data = JSON.parse(fs.readFileSync('data/skill-tree.json', 'utf8'))
const atlasData = JSON.parse(fs.readFileSync('data/atlas-tree.json', 'utf8'))

function countStats(treeData, label) {
  const sm = new Map()
  const ks = new Set()
  let totalLines = 0
  for (const [id, node] of Object.entries(treeData.nodes || {})) {
    if (node.stats) {
      for (const s of node.stats) {
        for (const line of s.split('\n')) {
          if (line.trim()) {
            totalLines++
            parseStat(line, sm, ks)
          }
        }
      }
    }
  }
  console.log(`\n${label}: ${totalLines} stat lines -> ${sm.size} merged numeric + ${ks.size} keystone`)
}

countStats(data, 'Skill Tree')
countStats(atlasData, 'Atlas Tree')
