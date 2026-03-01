/**
 * Steiner tree solver for PoE skill tree path planning.
 *
 * Uses a tree-growing approach with multi-source 0-1 BFS:
 * - Blocked nodes are removed from the graph
 * - Already-allocated nodes and previously connected nodes cost 0 to traverse
 * - Normal nodes cost 1
 *
 * Tries connecting each required node first (different orderings),
 * then greedily connects the rest. Picks the ordering with lowest total cost.
 * This naturally handles path overlap — shared intermediate nodes are "free"
 * for subsequent terminals.
 */

export interface SolverResult {
  /** All node IDs in the optimal subtree (includes already-allocated nodes) */
  nodes: Set<string>
  /** Number of new points needed (excludes already-allocated nodes) */
  cost: number
}

function buildFilteredAdjacency(
  adjacency: Map<string, Set<string>>,
  blockedNodes: Set<string>,
): Map<string, Set<string>> {
  const filtered = new Map<string, Set<string>>()
  for (const [nodeId, neighbors] of adjacency) {
    if (blockedNodes.has(nodeId)) continue
    const filteredNeighbors = new Set<string>()
    for (const n of neighbors) {
      if (!blockedNodes.has(n)) filteredNeighbors.add(n)
    }
    filtered.set(nodeId, filteredNeighbors)
  }
  return filtered
}

interface BFSResult {
  dist: Map<string, number>
  prev: Map<string, string>
}

/**
 * Multi-source 0-1 BFS from all nodes in `tree`.
 * Nodes in `tree` have weight 0 (free to traverse), others cost 1.
 * Returns distances and predecessor map for path reconstruction.
 */
function multiSourceBFS(
  tree: Set<string>,
  adjacency: Map<string, Set<string>>,
): BFSResult {
  const dist = new Map<string, number>()
  const prev = new Map<string, string>()
  const deque: string[] = []

  // Initialize: all tree nodes at distance 0
  for (const node of tree) {
    dist.set(node, 0)
    deque.push(node)
  }

  while (deque.length > 0) {
    const current = deque.shift()!
    const currentDist = dist.get(current)!

    const neighbors = adjacency.get(current)
    if (!neighbors) continue

    for (const neighbor of neighbors) {
      const weight = tree.has(neighbor) ? 0 : 1
      const newDist = currentDist + weight
      const oldDist = dist.get(neighbor)

      if (oldDist === undefined || newDist < oldDist) {
        dist.set(neighbor, newDist)
        prev.set(neighbor, current)
        if (weight === 0) {
          deque.unshift(neighbor)
        } else {
          deque.push(neighbor)
        }
      }
    }
  }

  return { dist, prev }
}

/**
 * Collect the new (non-tree) nodes on the path from `target` back to the tree.
 */
function collectPathToTree(
  target: string,
  prev: Map<string, string>,
  tree: Set<string>,
): string[] {
  const path: string[] = []
  let current = target
  while (!tree.has(current)) {
    path.push(current)
    const p = prev.get(current)
    if (p === undefined) break
    current = p
  }
  return path
}

/**
 * Grow a tree starting from `initialTree`, connecting required nodes
 * in the given order. First node uses `firstTerminal`, rest are greedy
 * (nearest first).
 */
function growTree(
  firstTerminal: string,
  requiredNodes: Set<string>,
  initialTree: Set<string>,
  adjacency: Map<string, Set<string>>,
): { tree: Set<string>; cost: number } | null {
  const tree = new Set(initialTree)
  const unreached = new Set(requiredNodes)

  // Connect first terminal
  const bfs1 = multiSourceBFS(tree, adjacency)
  if (!bfs1.dist.has(firstTerminal) || bfs1.dist.get(firstTerminal) === undefined) {
    return null
  }
  const path1 = collectPathToTree(firstTerminal, bfs1.prev, tree)
  for (const n of path1) tree.add(n)
  unreached.delete(firstTerminal)

  // Greedy: connect nearest remaining terminal
  while (unreached.size > 0) {
    const bfs = multiSourceBFS(tree, adjacency)

    let nearestTerminal = ''
    let nearestDist = Infinity
    for (const t of unreached) {
      const d = bfs.dist.get(t)
      if (d !== undefined && d < nearestDist) {
        nearestDist = d
        nearestTerminal = t
      }
    }

    if (nearestDist === Infinity) return null // unreachable

    const path = collectPathToTree(nearestTerminal, bfs.prev, tree)
    for (const n of path) tree.add(n)
    unreached.delete(nearestTerminal)
  }

  // Calculate cost: nodes in tree that weren't in the initial tree
  let cost = 0
  for (const n of tree) {
    if (!initialTree.has(n)) cost++
  }

  return { tree, cost }
}

export function solveSteinerTree(
  classStartNodeId: string,
  requiredNodes: Set<string>,
  blockedNodes: Set<string>,
  adjacency: Map<string, Set<string>>,
  allocatedNodes: Set<string>,
): SolverResult | { error: string } {
  if (requiredNodes.size === 0) {
    return { nodes: new Set<string>(), cost: 0 }
  }

  // Build filtered adjacency graph (remove blocked nodes)
  const filteredAdj = buildFilteredAdjacency(adjacency, blockedNodes)

  // Initial tree = all allocated nodes + class start
  const initialTree = new Set(allocatedNodes)
  initialTree.add(classStartNodeId)

  // Check reachability first
  const reachCheck = multiSourceBFS(initialTree, filteredAdj)
  for (const reqNode of requiredNodes) {
    if (!reachCheck.dist.has(reqNode)) {
      return { error: 'Required node is unreachable (may be blocked off)' }
    }
  }

  // Try each required node as the first to connect, pick best overall result
  let bestResult: Set<string> | null = null
  let bestCost = Infinity

  for (const firstTerminal of requiredNodes) {
    const result = growTree(firstTerminal, requiredNodes, initialTree, filteredAdj)
    if (result && result.cost < bestCost) {
      bestCost = result.cost
      bestResult = result.tree
    }
  }

  if (!bestResult) {
    return { error: 'Required node is unreachable (may be blocked off)' }
  }

  return { nodes: bestResult, cost: bestCost }
}
