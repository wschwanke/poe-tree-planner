import { create } from 'zustand'
import type { SearchResult } from '@/data/search'

interface SearchState {
  searchQuery: string
  matchingNodeIds: Set<string>
  results: SearchResult[]
  commandPaletteOpen: boolean

  setSearchQuery: (query: string) => void
  setResults: (results: SearchResult[], ids: Set<string>) => void
  openCommandPalette: () => void
  closeCommandPalette: () => void
  clearSearch: () => void
}

export const useSearchStore = create<SearchState>((set) => ({
  searchQuery: '',
  matchingNodeIds: new Set<string>(),
  results: [],
  commandPaletteOpen: false,

  setSearchQuery: (query) => set({ searchQuery: query }),

  setResults: (results, ids) => set({ results, matchingNodeIds: ids }),

  openCommandPalette: () => set({ commandPaletteOpen: true }),

  closeCommandPalette: () => set({ commandPaletteOpen: false }),

  clearSearch: () =>
    set({
      searchQuery: '',
      matchingNodeIds: new Set<string>(),
      results: [],
    }),
}))
