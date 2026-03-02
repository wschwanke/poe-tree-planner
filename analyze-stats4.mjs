import fs from 'fs'

const atlasData = JSON.parse(fs.readFileSync('data/atlas-tree.json', 'utf8'))
const currentPattern = /^([+-]?\d+\.?\d*)(%?)\s+(.+)$/

const stats = new Set()
for (const [id, node] of Object.entries(atlasData.nodes || {})) {
  if (node.stats) {
    for (const s of node.stats) {
      for (const line of s.split('\n')) {
        if (line.trim()) stats.add(line.trim())
      }
    }
  }
}

const unmatched = [...stats].filter(s => !currentPattern.test(s))
const matched = [...stats].filter(s => currentPattern.test(s))

console.log(`Atlas: ${stats.size} total, ${matched.length} matched, ${unmatched.length} unmatched`)
console.log('\n--- First 40 unmatched atlas stats ---')
unmatched.slice(0, 40).forEach(s => console.log(`  ${s}`))

// Show template grouping for atlas unmatched
const templateMap = new Map()
const numPattern = /([+-]?\d+\.?\d*%?)/
for (const s of unmatched) {
  if (!numPattern.test(s)) continue
  const template = s.replace(/[+-]?\d+\.?\d*%?/g, '#')
  if (!templateMap.has(template)) templateMap.set(template, [])
  templateMap.get(template).push(s)
}

console.log('\n--- Atlas unmatched templates with >1 variant ---')
const sorted = [...templateMap.entries()]
  .filter(([, v]) => v.length > 1)
  .sort((a, b) => b[1].length - a[1].length)
sorted.forEach(([t, examples]) => {
  console.log(`\n  [${examples.length}x] ${t}`)
  examples.forEach(e => console.log(`    ${e}`))
})
