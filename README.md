# PoE Tree Planner

A Path of Exile 1 passive skill tree planner built with React, TypeScript, and HTML5 Canvas.

## Features

- **Interactive Skill Tree** — Full passive tree (3,281 nodes) rendered on HTML5 Canvas with pan and zoom
- **Class Selection** — Choose a starting class to begin allocating points
- **Smart Pathing** — Shortest-path allocation via BFS; chain-breaking logic on deallocation
- **Node Tooltips** — Hover any node to see its stats and description
- **Stat Summary** — Aggregated stat totals from all allocated nodes
- **Point Counter** — Track allocated passive points
- **Command Palette** — Search nodes by name or stat (`Ctrl+K`)
- **Planning Mode** — Mark nodes as required or blocked to plan builds before committing points (`P`)
- **Build Manager** — Save and load multiple builds
- **Path of Building Export** — Export builds in PoB-compatible format
- **Cluster Jewels** — Cluster jewel socket support
- **Mastery Selection** — Choose mastery effects for mastery nodes
- **Keyboard Shortcuts** — Help menu with all keybinds (`?`)

## Tech Stack

- [React 19](https://react.dev/) + [TypeScript 5.9](https://www.typescriptlang.org/)
- [Vite 8](https://vite.dev/) (with SWC)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/) (Radix primitives)
- [Zustand](https://zustand.docs.pmnd.rs/) for state management
- [Biome](https://biomejs.dev/) for linting and formatting

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Lint

```bash
npm run lint         # auto-fix
npm run lint:check   # check only
```

## Project Structure

```
src/
├── canvas/           # Canvas rendering pipeline
│   ├── renderer.ts           # Main render loop
│   ├── render-nodes.ts       # Node rendering (frames + icons)
│   ├── render-connections.ts # Lines between nodes
│   ├── render-backgrounds.ts # Group background images
│   ├── render-planning.ts    # Planning mode overlays
│   ├── viewport.ts           # Pan/zoom transform math
│   └── hit-detection.ts      # Click → node lookup via spatial index
├── components/       # React components
│   ├── SkillTreeCanvas.tsx       # Main canvas + UI overlay
│   ├── ClassSelectionDialog.tsx  # Starting class picker
│   ├── NodeTooltip.tsx           # Hover tooltip
│   ├── PointCounter.tsx          # Passive point display
│   ├── StatSummaryPanel.tsx      # Aggregated stats
│   ├── BuildManager.tsx          # Save/load builds
│   ├── BuildToolbar.tsx          # Toolbar controls
│   ├── CommandPalette.tsx        # Ctrl+K search
│   ├── QuickSearch.tsx           # Inline search
│   ├── PlanningToolbar.tsx       # Planning mode controls
│   ├── PlanningInfoPanel.tsx     # Planning mode info
│   ├── PoBExportDialog.tsx       # Path of Building export
│   ├── ClusterJewelDialog.tsx    # Cluster jewel config
│   ├── MasterySelectionDialog.tsx# Mastery effect picker
│   ├── SettingsDialog.tsx        # Settings
│   ├── HelpMenu.tsx              # Keyboard shortcut reference
│   └── ui/                       # shadcn/ui primitives
├── config/           # Keybind definitions
├── data/             # Data loading and processing
│   ├── skill-tree-loader.ts  # Parse skill-tree.json
│   ├── graph.ts               # BFS, adjacency, spatial index
│   ├── sprite-manager.ts      # Sprite sheet loading
│   ├── search.ts              # Node search logic
│   ├── solver.ts              # Path optimization
│   ├── cluster-jewels.ts      # Cluster jewel data
│   └── pob-export.ts          # PoB export encoding
├── hooks/            # React hooks
│   ├── useSkillTree.ts         # Load and process tree data
│   ├── useCanvasInteraction.ts # Mouse/touch event handling
│   ├── useViewport.ts          # Pan/zoom state
│   └── useSearch.ts            # Search state
├── state/            # Zustand stores
│   ├── tree-store.ts       # Core tree state (allocation, class)
│   ├── build-store.ts      # Build save/load
│   ├── planning-store.ts   # Planning mode state
│   ├── search-store.ts     # Search state
│   ├── cluster-store.ts    # Cluster jewel state
│   └── stat-aggregator.ts  # Stat totals computation
├── types/            # TypeScript type definitions
│   ├── skill-tree.ts   # Skill tree data types
│   ├── build.ts        # Build types
│   └── cluster-jewel.ts# Cluster jewel types
└── lib/
    └── utils.ts        # Utility helpers (cn, etc.)
```

## Keybinds

| Key | Action |
|-----|--------|
| Left Click + Drag | Pan the skill tree |
| Scroll Wheel | Zoom in / out |
| Left Click | Allocate / deallocate a node |
| Hover | Show node tooltip |
| `Ctrl+K` | Open command palette |
| `P` | Toggle planning mode |
| `?` | Toggle help menu |

## License

Private
