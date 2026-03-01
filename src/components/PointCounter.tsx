import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type BanditChoice, useTreeStore } from '@/state/tree-store'

interface PointCounterProps {
  used: number
  total: number
}

export function PointCounter({ used, total }: PointCounterProps) {
  const banditChoice = useTreeStore((s) => s.banditChoice)
  const setBanditChoice = useTreeStore((s) => s.setBanditChoice)

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant="outline"
        className="px-3 py-1.5 bg-stone-950/90 border-amber-900/50 text-stone-200 backdrop-blur-sm"
      >
        <span className="text-amber-400 font-bold">{used}</span>
        <span className="mx-1 text-stone-500">/</span>
        <span className="text-stone-400">{total}</span>
        <span className="ml-1.5 text-stone-500 text-xs">points</span>
      </Badge>
      <Select
        value={banditChoice}
        onValueChange={(v) => setBanditChoice(v as BanditChoice)}
      >
        <SelectTrigger
          size="sm"
          className="h-7 bg-stone-950/90 border-amber-900/50 text-stone-300 backdrop-blur-sm text-xs"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-stone-950 border-amber-900/50">
          <SelectItem value="none" className="text-stone-300 text-xs">
            Bandits: Help
          </SelectItem>
          <SelectItem value="kill_all" className="text-stone-300 text-xs">
            Bandits: Kill All (+1)
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
