import fs from 'fs'

const data = JSON.parse(fs.readFileSync('data/skill-tree.json', 'utf8'))

// Check atlas tree too
let atlasData = null
try {
  atlasData = JSON.parse(fs.readFileSync('data/atlas-tree.json', 'utf8'))
} catch {}

const allStats = new Set()

function collectStats(treeData, label) {
  const stats = new Set()
  for (const [id, node] of Object.entries(treeData.nodes || {})) {
    if (node.stats) {
      for (const s of node.stats) {
        for (const line of s.split('\n')) {
          if (line.trim()) {
            stats.add(line.trim())
            allStats.add(line.trim())
          }
        }
      }
    }
  }
  console.log(`\n${label}: ${stats.size} unique stat lines`)
  return stats
}

const skillStats = collectStats(data, 'Skill tree')
if (atlasData) collectStats(atlasData, 'Atlas tree')

// Find stats with multiple numbers
const multiNumber = [...allStats].filter(s => {
  const matches = s.match(/\d+\.?\d*/g)
  return matches && matches.length > 1
})

console.log(`\nStats with multiple numbers: ${multiNumber.length}`)
console.log('\n--- Examples of multi-number stats ---')
multiNumber.slice(0, 30).forEach(s => console.log(`  ${s}`))

// Check how the current code handles stats that match but merge badly
// e.g. "+10% to Fire Resistance" and "+10% to Cold Resistance" should NOT merge
// but "+10% increased Maximum Life" from two nodes SHOULD merge
const currentPattern = /^([+-]?\d+\.?\d*)(%?)\s+(.+)$/
const matched = [...allStats].filter(s => currentPattern.test(s))

// Show some matched stats to verify they're merging correctly
console.log('\n--- Sample currently matched stats, grouped by merge key ---')
const mergeGroups = new Map()
for (const s of matched) {
  const m = s.match(currentPattern)
  const key = `${m[2]} ${m[3]}`.trim()
  if (!mergeGroups.has(key)) mergeGroups.set(key, [])
  mergeGroups.get(key).push(s)
}
const groupsSorted = [...mergeGroups.entries()]
  .filter(([, v]) => v.length > 1)
  .sort((a, b) => b[1].length - a[1].length)

console.log(`Groups with >1 variant: ${groupsSorted.length}`)
groupsSorted.slice(0, 20).forEach(([key, examples]) => {
  console.log(`\n  Key: "${key}" (${examples.length} variants)`)
  examples.slice(0, 3).forEach(e => console.log(`    ${e}`))
})
