import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { SearchResult } from '@/data/search'

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

const MAX_VISIBLE = 50

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  searchQuery: string
  onSearchChange: (query: string) => void
  results: SearchResult[]
  onSelectResult: (nodeId: string) => void
}

export function CommandPalette({
  open,
  onClose,
  searchQuery,
  onSearchChange,
  results,
  onSelectResult,
}: CommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const visibleResults = results.slice(0, MAX_VISIBLE)
  const overflow = results.length - MAX_VISIBLE

  // Reset selection when query changes
  const prevQueryRef = useRef(searchQuery)
  if (prevQueryRef.current !== searchQuery) {
    prevQueryRef.current = searchQuery
    if (selectedIndex !== 0) setSelectedIndex(0)
  }

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // Scroll selected item into view
  const selectedItemRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest' })
  })

  const handleSelect = useCallback(
    (nodeId: string) => {
      onSelectResult(nodeId)
      onClose()
    },
    [onSelectResult, onClose],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, visibleResults.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (visibleResults[selectedIndex]) {
            handleSelect(visibleResults[selectedIndex].id)
          }
          break
      }
    },
    [visibleResults, selectedIndex, handleSelect],
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-[520px] p-0 gap-0 bg-stone-950 border-stone-700"
        onKeyDown={handleKeyDown}
      >
        <div className="p-3 border-b border-stone-800">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search for nodes, stats, keystones..."
            className="w-full h-10 px-3 bg-stone-900 border border-stone-700 rounded-md text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
        </div>

        <ScrollArea className="max-h-[400px]">
          <div className="p-2">
            {visibleResults.length === 0 && searchQuery && (
              <p className="px-3 py-6 text-sm text-stone-500 text-center">
                No matching nodes found
              </p>
            )}
            {!searchQuery && (
              <p className="px-3 py-6 text-sm text-stone-500 text-center">
                Type to search nodes by name, stats, type...
              </p>
            )}
            {visibleResults.map((result, i) => {
              const firstStat =
                result.node.node.stats?.[0] ??
                result.node.node.masteryEffects?.[0]?.stats?.[0] ??
                ''

              return (
                <button
                  type="button"
                  key={result.id}
                  ref={i === selectedIndex ? selectedItemRef : undefined}
                  onClick={() => handleSelect(result.id)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`flex items-center gap-2 w-full px-3 py-2 rounded text-left cursor-pointer transition-colors ${
                    i === selectedIndex ? 'bg-stone-800' : 'hover:bg-stone-800/50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-stone-100 font-medium truncate">
                        {result.node.node.name ?? 'Unknown'}
                      </span>
                      <Badge
                        className={`text-[10px] px-1.5 py-0 shrink-0 ${TYPE_COLORS[result.node.type] ?? ''}`}
                      >
                        {TYPE_LABELS[result.node.type] ?? result.node.type}
                      </Badge>
                      {result.matchField !== 'name' && (
                        <span className="text-[10px] text-stone-600 shrink-0">
                          ({result.matchField})
                        </span>
                      )}
                    </div>
                    {firstStat && (
                      <p className="text-xs text-stone-500 truncate mt-0.5">{firstStat}</p>
                    )}
                  </div>
                </button>
              )
            })}
            {overflow > 0 && (
              <p className="px-3 py-2 text-xs text-stone-600 text-center">
                and {overflow} more results...
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
