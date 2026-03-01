import { worldToScreen } from '@/canvas/viewport'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { ProcessedNode, ViewportState } from '@/types/skill-tree'

interface NodeTooltipProps {
  node: ProcessedNode
  viewport: ViewportState
  allocated: boolean
  selectedMasteryEffects?: Map<string, number>
}

const TYPE_LABELS: Record<string, string> = {
  normal: 'Passive',
  notable: 'Notable',
  keystone: 'Keystone',
  mastery: 'Mastery',
  jewelSocket: 'Jewel Socket',
  classStart: 'Class Start',
}

const TYPE_COLORS: Record<string, string> = {
  normal: 'bg-stone-600',
  notable: 'bg-amber-700',
  keystone: 'bg-amber-500',
  mastery: 'bg-purple-700',
  jewelSocket: 'bg-cyan-700',
  classStart: 'bg-stone-500',
}

export function NodeTooltip({
  node,
  viewport,
  allocated,
  selectedMasteryEffects,
}: NodeTooltipProps) {
  const [sx, sy] = worldToScreen(node.worldX, node.worldY, viewport)

  // Position tooltip to the right of the node, or left if too close to right edge
  const tooltipWidth = 280
  const tooltipX = sx + 30 + tooltipWidth > viewport.width ? sx - tooltipWidth - 20 : sx + 20
  const tooltipY = Math.max(10, Math.min(sy - 20, viewport.height - 300))

  const stats = node.node.stats ?? []
  const reminderText = node.node.reminderText ?? []
  const flavourText = node.node.flavourText ?? []

  // Mastery: show selected effect stats or hint
  const masteryEffectIndex = selectedMasteryEffects?.get(node.id)
  const selectedEffect =
    masteryEffectIndex !== undefined ? node.node.masteryEffects?.[masteryEffectIndex] : null
  const isMastery = node.type === 'mastery'
  const effectCount = node.node.masteryEffects?.length ?? 0

  return (
    <div className="absolute z-50 pointer-events-none" style={{ left: tooltipX, top: tooltipY }}>
      <Card className="w-[280px] bg-stone-950/95 border-stone-700 backdrop-blur-sm shadow-xl">
        <CardHeader className="pb-2 p-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm text-stone-100">{node.node.name ?? 'Unknown'}</CardTitle>
            <Badge className={`text-[10px] px-1.5 py-0 ${TYPE_COLORS[node.type] ?? ''}`}>
              {TYPE_LABELS[node.type] ?? node.type}
            </Badge>
          </div>
          {allocated && <span className="text-[10px] text-amber-400">Allocated</span>}
        </CardHeader>
        <Separator className="bg-stone-700" />
        <CardContent className="p-3 pt-2 space-y-1">
          {isMastery && selectedEffect ? (
            <>
              {selectedEffect.stats.map((stat, i) => (
                <p key={i} className="text-xs text-blue-300">
                  {stat.split('\n').map((line, j) => (
                    <span key={j}>
                      {j > 0 && <br />}
                      {line}
                    </span>
                  ))}
                </p>
              ))}
              {selectedEffect.reminderText?.map((text, i) => (
                <p key={`r-${i}`} className="text-[11px] text-stone-500 italic">
                  {text}
                </p>
              ))}
              <p className="text-[10px] text-stone-600 pt-1">Click to change effect</p>
            </>
          ) : isMastery && effectCount > 0 ? (
            <p className="text-[11px] text-stone-400">Click to choose from {effectCount} effects</p>
          ) : (
            <>
              {stats.map((stat, i) => (
                <p key={i} className="text-xs text-blue-300">
                  {stat.split('\n').map((line, j) => (
                    <span key={j}>
                      {j > 0 && <br />}
                      {line}
                    </span>
                  ))}
                </p>
              ))}
              {reminderText.map((text, i) => (
                <p key={`r-${i}`} className="text-[11px] text-stone-500 italic">
                  {text}
                </p>
              ))}
              {flavourText.length > 0 && <Separator className="bg-stone-800 my-1" />}
              {flavourText.map((text, i) => (
                <p key={`f-${i}`} className="text-[11px] text-amber-400/70 italic">
                  {text}
                </p>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
