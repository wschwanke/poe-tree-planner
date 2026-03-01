import type { ProcessedNode, SkillTreeData } from '@/types/skill-tree'

interface ClassSelectorProps {
  data: SkillTreeData
  processedNodes: Map<string, ProcessedNode>
  selectedClass: number | null
  onSelect: (classIndex: number, startNodeId: string) => void
}

export function ClassSelector({
  data,
  processedNodes,
  selectedClass,
  onSelect,
}: ClassSelectorProps) {
  // Build a map of classIndex -> startNodeId
  const classStarts = new Map<number, string>()
  for (const [id, pn] of processedNodes) {
    if (pn.node.classStartIndex !== undefined) {
      classStarts.set(pn.node.classStartIndex, id)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = Number(e.target.value)
    const startNodeId = classStarts.get(idx)
    if (startNodeId !== undefined) {
      onSelect(idx, startNodeId)
    }
  }

  return (
    <select
      value={selectedClass ?? ''}
      onChange={handleChange}
      className="bg-stone-900 border border-amber-900/50 text-stone-100 text-sm rounded px-2 py-1.5 cursor-pointer outline-none focus:border-amber-500/70"
    >
      <option value="" disabled>
        Select class...
      </option>
      {data.classes.map((cls, idx) => {
        if (!classStarts.has(idx)) return null
        return (
          <option key={cls.name} value={idx}>
            {cls.name}
          </option>
        )
      })}
    </select>
  )
}
