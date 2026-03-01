/**
 * Steiner tree solver for PoE skill tree path planning.
 *
 * Uses an MST-based 2-approximation with weighted edges:
 * - Blocked nodes are removed from the graph
 * - Already-allocated nodes cost 0 to traverse
 * - Would-like nodes cost 0.7 (soft waypoints)
 * - Normal nodes cost 1.0
 */

export interface SolverResult {
  /** All node IDs in the optimal subtree (includes already-allocated nodes) */
  nodes: Set<string>
  /** Number of new points needed (excludes already-allocated nodes) */
  cost: number
}

interface DijkstraResult {
  dist: Map<string, number>
  prev: Map<string, string>
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

/**
 * Weighted Dijkstra from a source node.
 * Edge weight to enter a node:
 *   - allocated node: 0 (free)
 *   - would-like node: 0.7 (preferred)
 *   - normal node: 1.0
 */
function dijkstra(
  source: string,
  adjacency: Map<string, Set<string>>,
  allocatedNodes: Set<string>,
  wouldLikeNodes: Set<string>,
): DijkstraResult {
  const dist = new Map<string, number>()
  const prev = new Map<string, string>()
  // Simple priority queue using sorted array (graph is sparse, ~3k nodes)
  const queue: Array<{ node: string; cost: number }> = []

  dist.set(source, 0)
  queue.push({ node: source, cost: 0 })

  while (queue.length > 0) {
    // Find min cost entry
    let minIdx = 0
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].cost < queue[minIdx].cost) minIdx = i
    }
    const { node: current, cost: currentCost } = queue[minIdx]
    queue.splice(minIdx, 1)

    // Skip if we already found a shorter path
    const known = dist.get(current)
    if (known !== undefined && currentCost > known) continue

    const neighbors = adjacency.get(current)
    if (!neighbors) continue

    for (const neighbor of neighbors) {
      let edgeWeight: number
      if (allocatedNodes.has(neighbor)) {
        edgeWeight = 0
      } else if (wouldLikeNodes.has(neighbor)) {
        edgeWeight = 0.7
      } else {
        edgeWeight = 1.0
      }

      const newDist = currentCost + edgeWeight
      const prevDist = dist.get(neighbor)
      if (prevDist === undefined || newDist < prevDist) {
        dist.set(neighbor, newDist)
        prev.set(neighbor, current)
        queue.push({ node: neighbor, cost: newDist })
      }
    }
  }

  return { dist, prev }
}

/** Reconstruct the path from source to target using Dijkstra's prev map */
function reconstructPath(
  source: string,
  target: string,
  prev: Map<string, string>,
): string[] {
  const path: string[] = []
  let current: string | undefined = target
  while (current !== undefined && current !== source) {
    path.push(current)
    current = prev.get(current)
  }
  if (current === source) {
    path.push(source)
  }
  path.reverse()
  return path
}

/**
 * Prim's MST on a complete graph defined by a distance matrix.
 * Returns the set of MST edges as [i, j] index pairs.
 */
function primMST(
  terminals: string[],
  distMatrix: Map<string, Map<string, number>>,
): Array<[string, string]> {
  if (terminals.length <= 1) return []

  const inMST = new Set<string>()
  const edges: Array<[string, string]> = []
  inMST.add(terminals[0])

  while (inMST.size < terminals.length) {
    let bestFrom = ''
    let bestTo = ''
    let bestDist = Infinity

    for (const from of inMST) {
      const dists = distMatrix.get(from)
      if (!dists) continue
      for (const to of terminals) {
        if (inMST.has(to)) continue
        const d = dists.get(to)
        if (d !== undefined && d < bestDist) {
          bestDist = d
          bestFrom = from
          bestTo = to
        }
      }
    }

    if (bestDist === Infinity) break // Unreachable terminal
    inMST.add(bestTo)
    edges.push([bestFrom, bestTo])
  }

  return edges
}

export function solveSteinerTree(
  classStartNodeId: string,
  requiredNodes: Set<string>,
  wouldLikeNodes: Set<string>,
  blockedNodes: Set<string>,
  adjacency: Map<string, Set<string>>,
  allocatedNodes: Set<string>,
): SolverResult | { error: string } {
  if (requiredNodes.size === 0) {
    return { nodes: new Set<string>(), cost: 0 }
  }

  // Step 1: Build filtered adjacency graph
  const filteredAdj = buildFilteredAdjacency(adjacency, blockedNodes)

  // Step 2: Define terminals (class start + required nodes)
  const terminals = [classStartNodeId, ...requiredNodes]
  // Deduplicate
  const terminalSet = new Set(terminals)
  const uniqueTerminals = [...terminalSet]

  // Step 3: Run Dijkstra from each terminal
  const dijkstraResults = new Map<string, DijkstraResult>()
  for (const terminal of uniqueTerminals) {
    dijkstraResults.set(
      terminal,
      dijkstra(terminal, filteredAdj, allocatedNodes, wouldLikeNodes),
    )
  }

  // Check if all required nodes are reachable from class start
  const startResult = dijkstraResults.get(classStartNodeId)!
  for (const reqNode of requiredNodes) {
    if (!startResult.dist.has(reqNode)) {
      return {
        error: `Required node is unreachable (may be blocked off)`,
      }
    }
  }

  // Step 4: Build distance matrix between terminals
  const distMatrix = new Map<string, Map<string, number>>()
  for (const from of uniqueTerminals) {
    const dists = new Map<string, number>()
    const result = dijkstraResults.get(from)!
    for (const to of uniqueTerminals) {
      if (from === to) continue
      const d = result.dist.get(to)
      if (d !== undefined) dists.set(to, d)
    }
    distMatrix.set(from, dists)
  }

  // Step 5: Compute MST
  const mstEdges = primMST(uniqueTerminals, distMatrix)

  // Step 6: Map MST edges back to actual paths
  const resultNodes = new Set<string>()
  for (const [from, to] of mstEdges) {
    const result = dijkstraResults.get(from)!
    const path = reconstructPath(from, to, result.prev)
    for (const nodeId of path) {
      resultNodes.add(nodeId)
    }
  }

  // Also ensure all terminals are included
  for (const t of uniqueTerminals) {
    resultNodes.add(t)
  }

  // Step 7: Prune non-terminal leaf nodes
  // Build adjacency within result set
  let changed = true
  while (changed) {
    changed = false
    const toRemove: string[] = []
    for (const nodeId of resultNodes) {
      if (terminalSet.has(nodeId)) continue
      if (allocatedNodes.has(nodeId)) continue // Keep allocated nodes (free)
      // Count neighbors in result set
      const neighbors = filteredAdj.get(nodeId)
      if (!neighbors) {
        toRemove.push(nodeId)
        continue
      }
      let neighborCount = 0
      for (const n of neighbors) {
        if (resultNodes.has(n)) neighborCount++
      }
      // Leaf = only 1 connection within the result tree
      if (neighborCount <= 1) {
        toRemove.push(nodeId)
      }
    }
    for (const id of toRemove) {
      resultNodes.delete(id)
      changed = true
    }
  }

  // Re-add terminals that may have been removed
  for (const t of uniqueTerminals) {
    resultNodes.add(t)
  }

  // Step 8: Calculate cost (nodes not already allocated, excluding class start)
  let cost = 0
  for (const nodeId of resultNodes) {
    if (!allocatedNodes.has(nodeId) && nodeId !== classStartNodeId) {
      cost++
    }
  }

  return { nodes: resultNodes, cost }
}
