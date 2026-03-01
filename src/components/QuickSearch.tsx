import { useEffect, useRef } from 'react'

interface QuickSearchProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  onOpenCommandPalette: () => void
  matchCount: number
}

export function QuickSearch({
  searchQuery,
  onSearchChange,
  onOpenCommandPalette,
  matchCount,
}: QuickSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search nodes..."
        className="w-[200px] h-9 px-3 pr-16 bg-stone-950/90 border border-amber-900/50 rounded-md text-sm text-stone-100 placeholder:text-stone-500 backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50"
      />
      {searchQuery && (
        <span className="absolute right-10 top-1/2 -translate-y-1/2 text-xs text-stone-400">
          {matchCount}
        </span>
      )}
      {searchQuery ? (
        <button
          type="button"
          onClick={() => {
            onSearchChange('')
            inputRef.current?.focus()
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-200 bg-stone-800 px-1.5 py-0.5 rounded border border-stone-700"
        >
          &times;
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-stone-500 bg-stone-800 px-1.5 py-0.5 rounded border border-stone-700 hover:text-stone-300"
        >
          Ctrl+K
        </button>
      )}
    </div>
  )
}
