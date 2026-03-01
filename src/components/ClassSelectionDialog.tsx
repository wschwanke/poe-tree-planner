import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ProcessedNode, SkillTreeData } from '@/types/skill-tree'

interface ClassSelectionDialogProps {
  open: boolean
  data: SkillTreeData
  processedNodes: Map<string, ProcessedNode>
  onSelect: (classIndex: number, startNodeId: string) => void
}

const CLASS_COLORS: Record<string, string> = {
  Scion: 'border-gray-400 hover:border-gray-300 hover:bg-gray-400/10',
  Marauder: 'border-red-700 hover:border-red-500 hover:bg-red-500/10',
  Ranger: 'border-green-700 hover:border-green-500 hover:bg-green-500/10',
  Witch: 'border-purple-700 hover:border-purple-500 hover:bg-purple-500/10',
  Duelist: 'border-amber-700 hover:border-amber-500 hover:bg-amber-500/10',
  Templar: 'border-blue-700 hover:border-blue-500 hover:bg-blue-500/10',
  Shadow: 'border-cyan-700 hover:border-cyan-500 hover:bg-cyan-500/10',
}

export function ClassSelectionDialog({
  open,
  data,
  processedNodes,
  onSelect,
}: ClassSelectionDialogProps) {
  // Build a map of classIndex -> startNodeId
  const classStarts = new Map<number, string>()
  for (const [id, pn] of processedNodes) {
    if (pn.node.classStartIndex !== undefined) {
      classStarts.set(pn.node.classStartIndex, id)
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-2xl bg-stone-950 border-amber-900/50"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-amber-500 text-xl">Choose Your Class</DialogTitle>
          <DialogDescription className="text-stone-400">
            Select a starting class to begin allocating passive skill points
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
          {data.classes.map((cls, idx) => {
            const startNodeId = classStarts.get(idx)
            if (!startNodeId) return null

            return (
              <button
                type="button"
                key={cls.name}
                onClick={() => onSelect(idx, startNodeId)}
                className={`flex flex-col items-center p-4 rounded-lg border-2 bg-stone-900/50 transition-all cursor-pointer ${CLASS_COLORS[cls.name] ?? 'border-stone-700 hover:border-stone-500'}`}
              >
                <span className="text-lg font-semibold text-stone-100">{cls.name}</span>
                <div className="flex gap-3 mt-2 text-xs text-stone-400">
                  <span className="text-red-400">STR {cls.base_str}</span>
                  <span className="text-green-400">DEX {cls.base_dex}</span>
                  <span className="text-blue-400">INT {cls.base_int}</span>
                </div>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
