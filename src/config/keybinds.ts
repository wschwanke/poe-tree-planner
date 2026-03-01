/**
 * Central keybind configuration.
 * All keybinds are defined here so the help menu auto-updates
 * when bindings are added or changed.
 */

export interface Keybind {
  keys: string[]
  description: string
}

export interface KeybindSection {
  title: string
  binds: Keybind[]
}

export const KEYBIND_SECTIONS: KeybindSection[] = [
  {
    title: 'Navigation',
    binds: [
      { keys: ['Left Click + Drag'], description: 'Pan the skill tree' },
      { keys: ['Scroll Wheel'], description: 'Zoom in / out' },
    ],
  },
  {
    title: 'Node Interaction',
    binds: [
      { keys: ['Left Click'], description: 'Allocate / deallocate a node' },
      { keys: ['Hover'], description: 'Show node tooltip' },
    ],
  },
  {
    title: 'Search',
    binds: [
      { keys: ['Ctrl', 'K'], description: 'Open command palette' },
      { keys: ['↑', '↓'], description: 'Navigate results' },
      { keys: ['Enter'], description: 'Select result and center on node' },
    ],
  },
  {
    title: 'Planning Mode',
    binds: [
      { keys: ['P'], description: 'Toggle planning mode' },
      { keys: ['Left Click'], description: 'Mark node as required' },
      { keys: ['Right Click'], description: 'Mark node as "would like"' },
      { keys: ['Ctrl', 'Click'], description: 'Mark node as blocked' },
    ],
  },
  {
    title: 'General',
    binds: [
      { keys: ['?'], description: 'Toggle help menu' },
    ],
  },
]
