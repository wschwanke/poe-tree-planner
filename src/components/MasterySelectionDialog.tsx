import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import type { ProcessedNode } from '@/types/skill-tree'

interface MasterySelectionDialogProps {
  open: boolean
  node: ProcessedNode | null
  currentEffectIndex: number | null
  canAffordPoint: boolean
  onSelectEffect: (nodeId: string, effectIndex: number) => void
  onUnallocate: (nodeId: string) => void
  onClose: () => void
}

export function MasterySelectionDialog({
  open,
  node,
  currentEffectIndex,
  canAffordPoint,
  onSelectEffect,
  onUnallocate,
  onClose,
}: MasterySelectionDialogProps) {
  if (!node) return null

  const effects = node.node.masteryEffects ?? []
  const isAllocated = currentEffectIndex !== null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-stone-950 border-amber-900/50">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-amber-500">{node.node.name ?? 'Mastery'}</DialogTitle>
            <Badge className="bg-purple-700 text-[10px] px-1.5 py-0">Mastery</Badge>
          </div>
          <DialogDescription className="text-stone-400">
            {isAllocated ? 'Change or remove your mastery effect' : 'Choose a mastery effect'}
            {!isAllocated && ' (costs 1 passive point)'}
          </DialogDescription>
        </DialogHeader>
        <Separator className="bg-stone-800" />
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-2 pr-2">
            {effects.map((effect, index) => {
              const isSelected = index === currentEffectIndex
              const canSelect = isAllocated || canAffordPoint
              return (
                <button
                  type="button"
                  key={effect.effect}
                  onClick={() => canSelect && onSelectEffect(node.id, index)}
                  disabled={!canSelect}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'border-amber-500 bg-amber-500/10'
                      : canSelect
                        ? 'border-stone-700 hover:border-stone-500 hover:bg-stone-800/50 cursor-pointer'
                        : 'border-stone-800 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1">
                      {effect.stats.map((stat, i) => (
                        <p key={i} className="text-xs text-blue-300">
                          {stat.split('\n').map((line, j) => (
                            <span key={j}>
                              {j > 0 && <br />}
                              {line}
                            </span>
                          ))}
                        </p>
                      ))}
                      {effect.reminderText?.map((text, i) => (
                        <p key={`r-${i}`} className="text-[11px] text-stone-500 italic">
                          {text}
                        </p>
                      ))}
                    </div>
                    {isSelected && (
                      <Badge className="bg-amber-600 text-[10px] px-1.5 py-0 shrink-0">
                        Selected
                      </Badge>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </ScrollArea>
        {isAllocated && (
          <>
            <Separator className="bg-stone-800" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUnallocate(node.id)}
              className="w-full text-xs border-stone-700 hover:bg-red-950/50 hover:border-red-800 hover:text-red-300"
            >
              Remove Mastery
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
