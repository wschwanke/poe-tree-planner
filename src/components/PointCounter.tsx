import { Badge } from '@/components/ui/badge'

interface PointCounterProps {
  used: number
  total: number
}

export function PointCounter({ used, total }: PointCounterProps) {
  return (
    <div className="absolute top-4 left-4 z-40">
      <Badge
        variant="outline"
        className="text-sm px-3 py-1.5 bg-stone-950/90 border-amber-900/50 text-stone-200 backdrop-blur-sm"
      >
        <span className="text-amber-400 font-bold">{used}</span>
        <span className="mx-1 text-stone-500">/</span>
        <span className="text-stone-400">{total}</span>
        <span className="ml-1.5 text-stone-500 text-xs">points</span>
      </Badge>
    </div>
  )
}
