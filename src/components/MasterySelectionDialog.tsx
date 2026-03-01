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
            <Badge className="bg-purple-700 text-xs px-2 py-0.5">Mastery</Badge>
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
                <Button
                  key={effect.effect}
                  variant="outline"
                  onClick={() => canSelect && onSelectEffect(node.id, index)}
                  disabled={!canSelect}
                  className={`w-full h-auto text-left justify-start p-4 whitespace-normal ${
                    isSelected
                      ? 'border-amber-500 bg-amber-500/10 hover:bg-amber-500/15'
                      : 'border-stone-700 hover:border-stone-500 hover:bg-stone-800/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 w-full">
                    <div className="space-y-1 flex-1">
                      {effect.stats.map((stat, i) => (
                        <p key={i} className="text-sm text-blue-300">
                          {stat.split('\n').map((line, j) => (
                            <span key={j}>
                              {j > 0 && <br />}
                              {line}
                            </span>
                          ))}
                        </p>
                      ))}
                      {effect.reminderText?.map((text, i) => (
                        <p key={`r-${i}`} className="text-xs text-stone-500 italic">
                          {text}
                        </p>
                      ))}
                    </div>
                    {isSelected && (
                      <Badge className="bg-amber-600 text-xs px-2 py-0.5 shrink-0">Selected</Badge>
                    )}
                  </div>
                </Button>
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
              className="w-full border-stone-700 hover:bg-red-950/50 hover:border-red-800 hover:text-red-300"
            >
              Remove Mastery
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
