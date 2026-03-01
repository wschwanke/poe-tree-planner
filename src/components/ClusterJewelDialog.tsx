import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { ClusterJewelConfig, ClusterJewelSize } from '@/types/cluster-jewel'
import { PASSIVE_RANGES, SUB_SOCKET_COUNTS } from '@/types/cluster-jewel'

interface ClusterJewelDialogProps {
  open: boolean
  socketSize: ClusterJewelSize | null
  currentConfig: ClusterJewelConfig | null
  onConfigure: (config: ClusterJewelConfig) => void
  onRemove: () => void
  onClose: () => void
}

const SIZE_LABELS: Record<ClusterJewelSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
}

const SIZE_COLORS: Record<ClusterJewelSize, string> = {
  small: 'bg-teal-700',
  medium: 'bg-cyan-600',
  large: 'bg-amber-600',
}

export function ClusterJewelDialog({
  open,
  socketSize,
  currentConfig,
  onConfigure,
  onRemove,
  onClose,
}: ClusterJewelDialogProps) {
  const [passiveCount, setPassiveCount] = useState<number | null>(null)

  if (!socketSize) return null

  const range = PASSIVE_RANGES[socketSize]
  const subSockets = SUB_SOCKET_COUNTS[socketSize]
  const effectiveCount = passiveCount ?? currentConfig?.passiveCount ?? range.min

  const passiveOptions: number[] = []
  for (let i = range.min; i <= range.max; i++) {
    passiveOptions.push(i)
  }

  const handleConfigure = () => {
    onConfigure({ size: socketSize, passiveCount: effectiveCount })
    setPassiveCount(null)
  }

  const handleClose = () => {
    setPassiveCount(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm bg-stone-950 border-amber-900/50">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-amber-500">Cluster Jewel</DialogTitle>
            <Badge className={`text-xs px-2 py-0.5 ${SIZE_COLORS[socketSize]}`}>
              {SIZE_LABELS[socketSize]}
            </Badge>
          </div>
          <DialogDescription className="text-stone-400">
            {currentConfig
              ? `${SIZE_LABELS[socketSize]} cluster jewel with ${currentConfig.passiveCount} passives`
              : `Configure a ${SIZE_LABELS[socketSize].toLowerCase()} cluster jewel for this socket`}
          </DialogDescription>
        </DialogHeader>
        <Separator className="bg-stone-800" />

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-stone-300">Number of passives</label>
            <Select
              value={String(effectiveCount)}
              onValueChange={(v) => setPassiveCount(Number(v))}
            >
              <SelectTrigger className="bg-stone-900 border-stone-700 text-stone-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-stone-950 border-stone-700">
                {passiveOptions.map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-stone-300">
                    {n} passives
                    {subSockets > 0 && ` (${n - subSockets} nodes + ${subSockets} socket${subSockets > 1 ? 's' : ''})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {subSockets > 0 && (
            <p className="text-xs text-stone-500">
              Includes {subSockets} {subSockets > 1 ? 'jewel sockets' : 'jewel socket'} for{' '}
              {socketSize === 'large' ? 'medium' : 'small'} cluster jewels
            </p>
          )}

          <Button
            onClick={handleConfigure}
            className="w-full bg-amber-700 hover:bg-amber-600 text-stone-100"
          >
            {currentConfig ? 'Update Jewel' : 'Socket Jewel'}
          </Button>
        </div>

        {currentConfig && (
          <>
            <Separator className="bg-stone-800" />
            <Button
              variant="outline"
              size="sm"
              onClick={onRemove}
              className="w-full border-stone-700 hover:bg-red-950/50 hover:border-red-800 hover:text-red-300"
            >
              Remove Jewel
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
