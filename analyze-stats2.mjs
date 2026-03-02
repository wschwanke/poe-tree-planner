import fs from 'fs'

const data = JSON.parse(fs.readFileSync('data/skill-tree.json', 'utf8'))
const stats = new Set()
for (const [id, node] of Object.entries(data.nodes || {})) {
  if (node.stats) {
    for (const s of node.stats) {
      for (const line of s.split('\n')) {
        if (line.trim()) stats.add(line.trim())
      }
    }
  }
}

const currentPattern = /^([+-]?\d+\.?\d*)(%?)\s+(.+)$/

// Pattern to find ANY number (possibly with +/- and %) in the stat
const numberInStat = /([+-]?\d+\.?\d*)(%?)/

const unmatched = [...stats].filter(s => !currentPattern.test(s))

// Categorize unmatched
const hasNumber = unmatched.filter(s => numberInStat.test(s))
const noNumber = unmatched.filter(s => !numberInStat.test(s))

console.log('Unmatched with numbers:', hasNumber.length)
console.log('Unmatched with NO numbers (true keystones):', noNumber.length)

console.log('\n--- True keystones (no numbers) ---')
noNumber.forEach(s => console.log(`  "${s}"`))

// Now let's see what the number-containing stats look like with # replacement
console.log('\n--- Stats with numbers (showing # pattern) ---')
const templateMap = new Map()
for (const s of hasNumber) {
  // Replace all numbers with # to see the template
  const template = s.replace(/[+-]?\d+\.?\d*%?/g, '#')
  if (!templateMap.has(template)) templateMap.set(template, [])
  templateMap.get(template).push(s)
}

// Show templates sorted by frequency
const sorted = [...templateMap.entries()].sort((a, b) => b[1].length - a[1].length)
console.log(`\nUnique templates: ${sorted.length}`)
console.log('\n--- Top 50 templates by frequency ---')
sorted.slice(0, 50).forEach(([template, examples]) => {
  console.log(`\n[${examples.length}x] ${template}`)
  examples.slice(0, 3).forEach(e => console.log(`    ${e}`))
})

// Also check: what if we handle the pattern "text NUMBER% text" or "text NUMBER text"
// using a more flexible regex that captures the number wherever it appears?
console.log('\n\n--- Testing improved regex ---')
// This regex finds the first numeric value (possibly with +/- and %) and splits around it
const improvedPattern = /^(.*?)([+-]?\d+\.?\d*)(%?)\s*(.*)$/
let improvedMatches = 0
let improvedUnmatched = 0
const stillUnmatched = []
for (const s of unmatched) {
  const m = s.match(improvedPattern)
  if (m && (m[2] !== '' || m[4] !== '')) {
    improvedMatches++
  } else {
    improvedUnmatched++
    stillUnmatched.push(s)
  }
}
console.log('Now matched with improved regex:', improvedMatches)
console.log('Still unmatched:', improvedUnmatched)
stillUnmatched.forEach(s => console.log(`  "${s}"`))
