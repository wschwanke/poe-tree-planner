import { worldToScreen } from '@/canvas/viewport'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { ClusterJewelConfig } from '@/types/cluster-jewel'
import type { CharacterClass, ProcessedNode, ViewportState } from '@/types/skill-tree'

interface NodeTooltipProps {
  node: ProcessedNode
  viewport: ViewportState
  allocated: boolean
  selectedMasteryEffects?: Map<string, number>
  classes?: CharacterClass[]
  clusterJewels?: Map<string, ClusterJewelConfig>
}

const TYPE_LABELS: Record<string, string> = {
  normal: 'Passive',
  notable: 'Notable',
  keystone: 'Keystone',
  mastery: 'Mastery',
  jewelSocket: 'Jewel Socket',
  classStart: 'Class Start',
  wormhole: 'Wormhole',
  ascendancyStart: 'Ascendancy',
  ascendancyNormal: 'Passive',
  ascendancyNotable: 'Notable',
}

const TYPE_COLORS: Record<string, string> = {
  normal: 'bg-stone-600',
  notable: 'bg-amber-700',
  keystone: 'bg-amber-500',
  mastery: 'bg-purple-700',
  jewelSocket: 'bg-cyan-700',
  classStart: 'bg-stone-500',
  wormhole: 'bg-indigo-700',
  ascendancyStart: 'bg-purple-700',
  ascendancyNormal: 'bg-purple-800',
  ascendancyNotable: 'bg-purple-600',
}

export function NodeTooltip({
  node,
  viewport,
  allocated,
  selectedMasteryEffects,
  classes,
  clusterJewels,
}: NodeTooltipProps) {
  const [sx, sy] = worldToScreen(node.worldX, node.worldY, viewport)

  // Position tooltip to the right of the node, or left if too close to right edge
  const tooltipWidth = 300
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
  const hasDescription = isMastery
    ? selectedEffect !== null || effectCount > 0
    : stats.length > 0 || reminderText.length > 0 || flavourText.length > 0

  return (
    <div className="absolute z-50 pointer-events-none" style={{ left: tooltipX, top: tooltipY }}>
      <Card className="w-[300px] gap-0 py-0 bg-stone-950/95 border-stone-700 backdrop-blur-sm shadow-xl">
        <CardHeader className="px-4 py-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base text-stone-100">
              {node.type === 'classStart' && node.node.classStartIndex !== undefined && classes
                ? (classes[node.node.classStartIndex]?.name ?? node.node.name ?? 'Unknown')
                : (node.node.name ?? 'Unknown')}
            </CardTitle>
            <Badge className={`text-xs px-2 py-0.5 ${TYPE_COLORS[node.type] ?? ''}`}>
              {TYPE_LABELS[node.type] ?? node.type}
            </Badge>
          </div>
          {node.node.ascendancyName && (
            <span className="text-xs text-purple-400">{node.node.ascendancyName}</span>
          )}
          {allocated && <span className="text-xs text-amber-400">Allocated</span>}
          {allocated && clusterJewels?.has(node.id) && (
            <span className="text-xs text-teal-400">
              {clusterJewels.get(node.id)!.size.charAt(0).toUpperCase() +
                clusterJewels.get(node.id)!.size.slice(1)}{' '}
              Cluster Jewel ({clusterJewels.get(node.id)!.passiveCount} passives)
            </span>
          )}
          {allocated &&
            node.node.isJewelSocket &&
            node.node.expansionJewel &&
            !clusterJewels?.has(node.id) && (
              <span className="text-xs text-stone-500">Click to configure cluster jewel</span>
            )}
        </CardHeader>
        {hasDescription && (
          <>
            <Separator className="bg-stone-700" />
            <CardContent className="px-4 py-3 space-y-1.5">
              {isMastery && selectedEffect ? (
                <>
                  {selectedEffect.stats.map((stat, i) => (
                    <p key={i} className="text-sm text-blue-300">
                      {stat.split('\n').map((line, j) => (
                        <span key={j}>
                          {j > 0 && <br />}
                          {line}
                        </span>
                      ))}
                    </p>
                  ))}
                  {selectedEffect.reminderText?.map((text, i) => (
                    <p key={`r-${i}`} className="text-xs text-stone-500 italic">
                      {text}
                    </p>
                  ))}
                  <Separator className="bg-stone-800 my-1" />
                  <p className="text-xs text-stone-500 mb-1">Other choices:</p>
                  {node.node.masteryEffects
                    ?.filter((_, i) => i !== masteryEffectIndex)
                    .map((effect, i) => (
                      <p key={`other-${i}`} className="text-xs text-stone-500">
                        {effect.stats.join(', ')}
                      </p>
                    ))}
                  <p className="text-xs text-stone-600 pt-1">Click to change effect</p>
                </>
              ) : isMastery && effectCount > 0 ? (
                <>
                  <p className="text-xs text-stone-500 mb-1">Available effects:</p>
                  {node.node.masteryEffects?.map((effect, i) => (
                    <div key={i} className="mb-1.5">
                      {effect.stats.map((stat, j) => (
                        <p key={j} className="text-sm text-blue-300/80">
                          {stat.split('\n').map((line, k) => (
                            <span key={k}>
                              {k > 0 && <br />}
                              {line}
                            </span>
                          ))}
                        </p>
                      ))}
                      {i < effectCount - 1 && <Separator className="bg-stone-800 mt-1.5" />}
                    </div>
                  ))}
                  {allocated && (
                    <p className="text-xs text-stone-600 pt-1">Click to choose an effect</p>
                  )}
                </>
              ) : (
                <>
                  {stats.map((stat, i) => (
                    <p key={i} className="text-sm text-blue-300">
                      {stat.split('\n').map((line, j) => (
                        <span key={j}>
                          {j > 0 && <br />}
                          {line}
                        </span>
                      ))}
                    </p>
                  ))}
                  {reminderText.map((text, i) => (
                    <p key={`r-${i}`} className="text-xs text-stone-500 italic">
                      {text}
                    </p>
                  ))}
                  {flavourText.length > 0 && <Separator className="bg-stone-800 my-1" />}
                  {flavourText.map((text, i) => (
                    <p key={`f-${i}`} className="text-xs text-amber-400/70 italic">
                      {text}
                    </p>
                  ))}
                </>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
