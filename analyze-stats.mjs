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
const pattern = /^([+-]?\d+\.?\d*)(%?)\s+(.+)$/
const matched = [...stats].filter(s => pattern.test(s))
const unmatched = [...stats].filter(s => !pattern.test(s))

console.log('Total unique stat lines:', stats.size)
console.log('Matched stat lines:', matched.length)
console.log('Unmatched stat lines:', unmatched.length)

console.log('\n--- ALL unmatched stats ---')
unmatched.forEach(s => console.log(s))

console.log('\n--- Sample matched stats (first 20) ---')
matched.slice(0, 20).forEach(s => {
  const m = s.match(pattern)
  console.log(`"${s}" => value=${m[1]}, pct=${m[2]}, desc="${m[3]}"`)
})
