import { useCallback, useEffect, useMemo, useRef } from 'react'
import { buildSearchIndex, searchNodes } from '@/data/search'
import { useSearchStore } from '@/state/search-store'
import type { ProcessedNode } from '@/types/skill-tree'

export function useSearch(processedNodes: Map<string, ProcessedNode>) {
  const searchIndex = useMemo(() => buildSearchIndex(processedNodes), [processedNodes])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchQuery = useSearchStore((s) => s.searchQuery)
  const results = useSearchStore((s) => s.results)
  const commandPaletteOpen = useSearchStore((s) => s.commandPaletteOpen)
  const setSearchQuery = useSearchStore((s) => s.setSearchQuery)
  const setResults = useSearchStore((s) => s.setResults)
  const openCommandPalette = useSearchStore((s) => s.openCommandPalette)
  const closeCommandPalette = useSearchStore((s) => s.closeCommandPalette)
  const clearSearch = useSearchStore((s) => s.clearSearch)

  const runSearch = useCallback(
    (query: string) => {
      const r = searchNodes(query, processedNodes, searchIndex)
      const ids = new Set(r.map((item) => item.id))
      setResults(r, ids)
    },
    [processedNodes, searchIndex, setResults],
  )

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query)

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      if (!query.trim()) {
        setResults([], new Set())
        return
      }

      debounceRef.current = setTimeout(() => {
        runSearch(query)
      }, 150)
    },
    [setSearchQuery, setResults, runSearch],
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Ctrl+K / Cmd+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        if (commandPaletteOpen) {
          closeCommandPalette()
        } else {
          openCommandPalette()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [commandPaletteOpen, openCommandPalette, closeCommandPalette])

  return {
    searchQuery,
    setSearchQuery: handleSearchChange,
    results,
    matchCount: results.length,
    commandPaletteOpen,
    openCommandPalette,
    closeCommandPalette,
    clearSearch,
  }
}
