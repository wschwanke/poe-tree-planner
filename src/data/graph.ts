import type { NodeType, ProcessedNode, SkillTreeData } from '@/types/skill-tree'

// Non-uniform orbit angle tables (in degrees) for orbits with 16 and 40 nodes.
// PoE uses irregular spacing for these orbits; all others use uniform spacing.
const ORBIT_ANGLES_16 = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330]
const ORBIT_ANGLES_40 = [
  0, 10, 20, 30, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 130, 135, 140, 150, 160, 170, 180, 190,
  200, 210, 220, 225, 230, 240, 250, 260, 270, 280, 290, 300, 310, 315, 320, 330, 340, 350,
]

const DEG_TO_RAD = Math.PI / 180

export function getOrbitAngle(orbitIndex: number, totalInOrbit: number): number {
  if (totalInOrbit === 16) return ORBIT_ANGLES_16[orbitIndex] * DEG_TO_RAD
  if (totalInOrbit === 40) return ORBIT_ANGLES_40[orbitIndex] * DEG_TO_RAD
  return (2 * Math.PI * orbitIndex) / totalInOrbit
}

export function getNodeType(
  node: {
    isKeystone?: boolean
    isNotable?: boolean
    isMastery?: boolean
    isJewelSocket?: boolean
    isWormhole?: boolean
    isAscendancyStart?: boolean
    classStartIndex?: number
  },
  ascendancyName?: string,
): NodeType {
  if (ascendancyName) {
    if (node.isAscendancyStart) return 'ascendancyStart'
    if (node.isNotable) return 'ascendancyNotable'
    return 'ascendancyNormal'
  }
  if (node.classStartIndex !== undefined) return 'classStart'
  if (node.isKeystone) return 'keystone'
  if (node.isNotable) return 'notable'
  if (node.isMastery) return 'mastery'
  if (node.isJewelSocket) return 'jewelSocket'
  if (node.isWormhole) return 'wormhole'
  return 'normal'
}

export function buildProcessedNodes(data: SkillTreeData): Map<string, ProcessedNode> {
  const { nodes, groups, constants } = data
  const { skillsPerOrbit, orbitRadii } = constants
  const result = new Map<string, ProcessedNode>()

  for (const [id, node] of Object.entries(nodes)) {
    // Always skip bloodline nodes
    if (node.isBloodline) continue
    // Skip proxy nodes and cluster sub-sockets (they appear only as virtual nodes when a cluster jewel is configured)
    if (node.isProxy) continue
    if (node.expansionJewel?.parent) continue

    const group = groups[String(node.group)]
    if (!group) continue

    const orbit = node.orbit
    const orbitIndex = node.orbitIndex
    const radius = orbitRadii[orbit] ?? 0
    const totalInOrbit = skillsPerOrbit[orbit] ?? 1

    const angle = getOrbitAngle(orbitIndex, totalInOrbit)
    const worldX = group.x + radius * Math.sin(angle)
    const worldY = group.y - radius * Math.cos(angle)

    result.set(id, {
      id,
      node,
      worldX,
      worldY,
      type: getNodeType(node, node.ascendancyName),
    })
  }

  return result
}

export function buildAdjacencyGraph(
  processedNodes: Map<string, ProcessedNode>,
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>()

  for (const [id, pn] of processedNodes) {
    // Mastery nodes are not part of the pathing/connectivity graph
    if (pn.node.isMastery) continue
    adj.set(id, new Set())
  }

  for (const [id, pn] of processedNodes) {
    if (pn.node.isMastery) continue
    const neighbors = adj.get(id)!
    const aAsc = !!pn.node.ascendancyName
    for (const outId of pn.node.out) {
      const outPn = processedNodes.get(outId)
      if (outPn && !outPn.node.isMastery) {
        // Skip edges between ascendancy and non-ascendancy nodes
        if (aAsc !== !!outPn.node.ascendancyName) continue
        neighbors.add(outId)
        let targetNeighbors = adj.get(outId)
        if (!targetNeighbors) {
          targetNeighbors = new Set()
          adj.set(outId, targetNeighbors)
        }
        targetNeighbors.add(id)
      }
    }
    for (const inId of pn.node.in) {
      const inPn = processedNodes.get(inId)
      if (inPn && !inPn.node.isMastery) {
        if (aAsc !== !!inPn.node.ascendancyName) continue
        neighbors.add(inId)
        let targetNeighbors = adj.get(inId)
        if (!targetNeighbors) {
          targetNeighbors = new Set()
          adj.set(inId, targetNeighbors)
        }
        targetNeighbors.add(id)
      }
    }
  }

  return adj
}

const CELL_SIZE = 200

export interface SpatialIndex {
  cells: Map<string, string[]>
  cellSize: number
}

function cellKey(cx: number, cy: number): string {
  return `${cx},${cy}`
}

export function buildSpatialIndex(processedNodes: Map<string, ProcessedNode>): SpatialIndex {
  const cells = new Map<string, string[]>()

  for (const [id, pn] of processedNodes) {
    const cx = Math.floor(pn.worldX / CELL_SIZE)
    const cy = Math.floor(pn.worldY / CELL_SIZE)
    const key = cellKey(cx, cy)
    let cell = cells.get(key)
    if (!cell) {
      cell = []
      cells.set(key, cell)
    }
    cell.push(id)
  }

  return { cells, cellSize: CELL_SIZE }
}

export function queryNearbyNodes(
  index: SpatialIndex,
  worldX: number,
  worldY: number,
  radius: number,
): string[] {
  const results: string[] = []
  const cellRadius = Math.ceil(radius / index.cellSize)
  const cx = Math.floor(worldX / index.cellSize)
  const cy = Math.floor(worldY / index.cellSize)

  for (let dx = -cellRadius; dx <= cellRadius; dx++) {
    for (let dy = -cellRadius; dy <= cellRadius; dy++) {
      const key = cellKey(cx + dx, cy + dy)
      const cell = index.cells.get(key)
      if (cell) {
        for (const id of cell) {
          results.push(id)
        }
      }
    }
  }

  return results
}

export interface PathResult {
  nodesToAllocate: string[]
  fullPath: string[]
}

export function findShortestPath(
  _from: string,
  to: string,
  adjacency: Map<string, Set<string>>,
  allocatedNodes: Set<string>,
): PathResult | null {
  // 0-1 BFS from 'to' toward any allocated node.
  // Cost 0 to traverse already-allocated nodes, cost 1 for unallocated.
  // This minimizes the number of NEW nodes that must be allocated.
  const dist = new Map<string, number>()
  const parent = new Map<string, string>()
  const deque: string[] = [to]
  dist.set(to, 1)

  let bestResult: PathResult | null = null
  let bestCost = Infinity

  while (deque.length > 0) {
    const current = deque.shift()!
    const currentDist = dist.get(current)!

    if (currentDist >= bestCost) continue

    if (allocatedNodes.has(current) && current !== to) {
      // Reconstruct full path from to → current
      const fullPath: string[] = []
      let node: string | undefined = current
      while (node !== undefined && node !== to) {
        fullPath.unshift(node)
        node = parent.get(node)
      }
      fullPath.unshift(to)

      const nodesToAllocate = fullPath.filter((n) => !allocatedNodes.has(n))

      if (nodesToAllocate.length < bestCost) {
        bestCost = nodesToAllocate.length
        bestResult = { nodesToAllocate, fullPath }
      }
      continue
    }

    const neighbors = adjacency.get(current)
    if (!neighbors) continue

    for (const neighbor of neighbors) {
      const edgeCost = allocatedNodes.has(neighbor) ? 0 : 1
      const newDist = currentDist + edgeCost

      if (newDist < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, newDist)
        parent.set(neighbor, current)

        if (edgeCost === 0) {
          deque.unshift(neighbor)
        } else {
          deque.push(neighbor)
        }
      }
    }
  }

  return bestResult
}

export function getConnectedComponent(
  startId: string,
  adjacency: Map<string, Set<string>>,
  allocatedNodes: Set<string>,
): Set<string> {
  const connected = new Set<string>()
  const queue: string[] = [startId]
  connected.add(startId)

  while (queue.length > 0) {
    const current = queue.shift()!
    const neighbors = adjacency.get(current)
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (allocatedNodes.has(neighbor) && !connected.has(neighbor)) {
          connected.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
  }

  return connected
}
