import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

  const handleChange = (value: string) => {
    const idx = Number(value)
    const startNodeId = classStarts.get(idx)
    if (startNodeId !== undefined) {
      onSelect(idx, startNodeId)
    }
  }

  return (
    <Select
      value={selectedClass !== null ? String(selectedClass) : undefined}
      onValueChange={handleChange}
    >
      <SelectTrigger className="w-[180px] bg-stone-950/90 border-amber-900/50 text-stone-100 backdrop-blur-sm focus:ring-amber-500/50">
        <SelectValue placeholder="Select class..." />
      </SelectTrigger>
      <SelectContent className="bg-stone-950 border-stone-700">
        {data.classes?.map((cls, idx) => {
          if (!classStarts.has(idx)) return null
          return (
            <SelectItem
              key={cls.name}
              value={String(idx)}
              className="text-stone-200 focus:bg-stone-800 focus:text-stone-100"
            >
              {cls.name}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

interface AscendancySelectorProps {
  data: SkillTreeData
  selectedClass: number | null
  selectedAscendancy: string | null
  onSelect: (name: string, classId: number) => void
  onClear: () => void
}

export function AscendancySelector({
  data,
  selectedClass,
  selectedAscendancy,
  onSelect,
  onClear,
}: AscendancySelectorProps) {
  if (selectedClass === null || !data.classes) return null

  const cls = data.classes[selectedClass]
  if (!cls?.ascendancies?.length) return null

  const handleChange = (value: string) => {
    if (value === '__none__') {
      onClear()
      return
    }
    const asc = cls.ascendancies.find((a) => a.id === value)
    if (asc) {
      const classId = cls.ascendancies.indexOf(asc) + 1
      onSelect(asc.id, classId)
    }
  }

  return (
    <Select value={selectedAscendancy ?? '__none__'} onValueChange={handleChange}>
      <SelectTrigger className="w-[180px] bg-stone-950/90 border-purple-900/50 text-stone-100 backdrop-blur-sm focus:ring-purple-500/50">
        <SelectValue placeholder="Ascendancy..." />
      </SelectTrigger>
      <SelectContent className="bg-stone-950 border-stone-700">
        <SelectItem
          value="__none__"
          className="text-stone-400 focus:bg-stone-800 focus:text-stone-300"
        >
          No Ascendancy
        </SelectItem>
        {cls.ascendancies.map((asc) => (
          <SelectItem
            key={asc.id}
            value={asc.id}
            className="text-stone-200 focus:bg-stone-800 focus:text-stone-100"
          >
            {asc.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
