import { Badge } from '@/components/ui/badge'

interface PointCounterProps {
  used: number
  total: number
  ascUsed?: number
  ascTotal?: number
}

export function PointCounter({ used, total, ascUsed, ascTotal }: PointCounterProps) {
  const overLimit = used > total
  const ascOverLimit = ascUsed !== undefined && ascTotal !== undefined && ascUsed > ascTotal

  return (
    <div className="flex items-center gap-1.5">
      <Badge
        variant="outline"
        className={`px-3 py-1.5 bg-stone-950/90 text-stone-200 backdrop-blur-sm ${overLimit ? 'border-red-600/70' : 'border-amber-900/50'}`}
      >
        <span className={`font-bold ${overLimit ? 'text-red-500' : 'text-amber-400'}`}>{used}</span>
        <span className={`mx-1 ${overLimit ? 'text-red-500/60' : 'text-stone-500'}`}>/</span>
        <span className={overLimit ? 'text-red-500/80' : 'text-stone-400'}>{total}</span>
        <span className={`ml-1.5 text-xs ${overLimit ? 'text-red-500/60' : 'text-stone-500'}`}>
          points
        </span>
      </Badge>
      {ascUsed !== undefined && ascTotal !== undefined && (
        <Badge
          variant="outline"
          className={`px-3 py-1.5 bg-stone-950/90 text-stone-200 backdrop-blur-sm ${ascOverLimit ? 'border-red-600/70' : 'border-purple-900/50'}`}
        >
          <span className={`font-bold ${ascOverLimit ? 'text-red-500' : 'text-purple-400'}`}>
            {ascUsed}
          </span>
          <span className={`mx-1 ${ascOverLimit ? 'text-red-500/60' : 'text-stone-500'}`}>/</span>
          <span className={ascOverLimit ? 'text-red-500/80' : 'text-stone-400'}>{ascTotal}</span>
          <span className={`ml-1.5 text-xs ${ascOverLimit ? 'text-red-500/60' : 'text-stone-500'}`}>
            ascendancy
          </span>
        </Badge>
      )}
    </div>
  )
}
