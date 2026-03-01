import { type SpatialIndex, buildSpatialIndex, getOrbitAngle } from '@/data/graph'
import type {
  ClusterGenerationResult,
  ClusterJewelConfig,
  ClusterJewelSize,
} from '@/types/cluster-jewel'
import { EXPANSION_SIZE_MAP, SUB_SOCKET_COUNTS } from '@/types/cluster-jewel'
import type { ProcessedNode, SkillNode, SkillTreeData } from '@/types/skill-tree'

/**
 * Check if a node is a cluster-capable jewel socket.
 * Returns the cluster size or null.
 */
export function isClusterSocket(node: SkillNode): ClusterJewelSize | null {
  if (!node.expansionJewel) return null
  return EXPANSION_SIZE_MAP[node.expansionJewel.size] ?? null
}

/**
 * Generate virtual nodes for a cluster jewel socketed at a given socket.
 *
 * Layout: Nodes are placed in a half-arc on the proxy's orbit, radiating outward
 * from the proxy position in both directions. The proxy serves as the entry point
 * that connects back to the socket via a straight line. Virtual nodes form two
 * arms extending from the proxy, with sub-sockets placed at the arm endpoints.
 */
export function generateClusterNodes(
  socketId: string,
  config: ClusterJewelConfig,
  data: SkillTreeData,
  processedNodes: Map<string, ProcessedNode>,
): ClusterGenerationResult {
  const virtualNodes = new Map<string, ProcessedNode>()
  const virtualAdjacency = new Map<string, Set<string>>()
  const subSocketIds: string[] = []

  const socketPn = processedNodes.get(socketId)
  if (!socketPn) return { virtualNodes, virtualAdjacency, subSocketIds }

  // For virtual sub-sockets (from parent clusters), expansionJewel is on the node itself
  const rawNode = socketPn.node.expansionJewel
    ? socketPn.node
    : data.nodes[socketId]
  if (!rawNode?.expansionJewel) return { virtualNodes, virtualAdjacency, subSocketIds }

  const proxyId = String(rawNode.expansionJewel.proxy)
  const proxyRaw = data.nodes[proxyId]
  if (!proxyRaw) return { virtualNodes, virtualAdjacency, subSocketIds }

  const proxyGroup = data.groups[String(proxyRaw.group)]
  if (!proxyGroup) return { virtualNodes, virtualAdjacency, subSocketIds }

  const orbit = proxyRaw.orbit
  const orbitRadius = data.constants.orbitRadii[orbit] ?? 0
  const totalInOrbit = data.constants.skillsPerOrbit[orbit] ?? 1
  const proxyOrbitIndex = proxyRaw.orbitIndex

  // Find occupied orbit indices in this group (exclude the proxy itself)
  const usedIndices = new Set<number>()
  for (const existingNodeId of proxyGroup.nodes) {
    const existing = data.nodes[existingNodeId]
    if (existing && existing.orbit === orbit && existing.orbitIndex !== proxyOrbitIndex) {
      usedIndices.add(existing.orbitIndex)
    }
  }

  const passiveCount = config.passiveCount
  const subSocketCount = SUB_SOCKET_COUNTS[config.size]

  // Build two arms radiating from the proxy position.
  // Arm 1 goes clockwise (increasing orbit index), arm 2 goes counter-clockwise.
  const cwFree: number[] = [] // clockwise free positions from proxy
  const ccwFree: number[] = [] // counter-clockwise free positions from proxy

  for (let step = 1; step < totalInOrbit; step++) {
    const cwIdx = (proxyOrbitIndex + step) % totalInOrbit
    if (!usedIndices.has(cwIdx)) cwFree.push(cwIdx)

    const ccwIdx = (proxyOrbitIndex - step + totalInOrbit) % totalInOrbit
    if (!usedIndices.has(ccwIdx)) ccwFree.push(ccwIdx)
  }

  // Distribute nodes across both arms, alternating to keep them balanced.
  // The entry node goes at the proxy position. Remaining nodes split evenly.
  // Total: 1 entry + (passiveCount - 1) arm nodes
  const armNodeCount = passiveCount - 1
  const cwCount = Math.ceil(armNodeCount / 2)
  const ccwCount = armNodeCount - cwCount

  const cwPositions = cwFree.slice(0, cwCount)
  const ccwPositions = ccwFree.slice(0, ccwCount)

  // Determine sub-socket placement: at the far ends of each arm
  // Large: 2 sub-sockets (one at end of each arm)
  // Medium: 1 sub-socket (at end of longer arm)
  // Small: 0 sub-sockets
  const subSocketPositionIndices = new Set<number>() // indices into the ordered node list
  // We'll mark them after building the ordered position lists

  // Build the ordered chain: ccw arm (reversed) → entry → cw arm
  // This gives a continuous arc from one end through the proxy to the other
  const orderedPositions: { orbitIndex: number; isEntry: boolean }[] = []

  // CCW arm in reverse order (far to near)
  for (let i = ccwPositions.length - 1; i >= 0; i--) {
    orderedPositions.push({ orbitIndex: ccwPositions[i], isEntry: false })
  }
  // Entry node at proxy position
  orderedPositions.push({ orbitIndex: proxyOrbitIndex, isEntry: true })
  // CW arm (near to far)
  for (const pos of cwPositions) {
    orderedPositions.push({ orbitIndex: pos, isEntry: false })
  }

  // Mark sub-socket positions at the endpoints
  if (subSocketCount >= 1 && orderedPositions.length > 0) {
    subSocketPositionIndices.add(orderedPositions.length - 1) // end of CW arm
  }
  if (subSocketCount >= 2 && orderedPositions.length > 1) {
    subSocketPositionIndices.add(0) // end of CCW arm
  }

  // Generate virtual nodes
  const nodeIds: string[] = []
  let subSocketIdx = 0

  for (let i = 0; i < orderedPositions.length; i++) {
    const { orbitIndex } = orderedPositions[i]
    const angle = getOrbitAngle(orbitIndex, totalInOrbit)
    const worldX = proxyGroup.x + orbitRadius * Math.sin(angle)
    const worldY = proxyGroup.y - orbitRadius * Math.cos(angle)

    const isSubSocket = subSocketPositionIndices.has(i)
    const virtualId = isSubSocket
      ? `cv:${socketId}:s${subSocketIdx}`
      : `cv:${socketId}:p${i}`

    if (isSubSocket) {
      subSocketIds.push(virtualId)
      subSocketIdx++
    }

    // Determine the sub-socket's cluster size for nesting
    const subSocketSize: ClusterJewelSize | undefined = isSubSocket
      ? config.size === 'large'
        ? 'medium'
        : config.size === 'medium'
          ? 'small'
          : undefined
      : undefined

    const node: SkillNode = {
      name: isSubSocket ? 'Cluster Jewel Socket' : 'Cluster Passive',
      group: proxyRaw.group,
      orbit,
      orbitIndex,
      out: [],
      in: [],
      isJewelSocket: isSubSocket ? true : undefined,
      isNotable: false,
      expansionJewel: isSubSocket && subSocketSize
        ? {
            size: subSocketSize === 'small' ? 0 : subSocketSize === 'medium' ? 1 : 2,
            index: subSocketIdx - 1,
            proxy: proxyId,
            parent: socketId,
          }
        : undefined,
    }

    virtualNodes.set(virtualId, {
      id: virtualId,
      node,
      worldX,
      worldY,
      type: isSubSocket ? 'jewelSocket' : 'normal',
    })

    nodeIds.push(virtualId)
  }

  // Build adjacency: continuous chain through the arc
  for (let i = 0; i < nodeIds.length - 1; i++) {
    addEdge(virtualAdjacency, nodeIds[i], nodeIds[i + 1])
  }

  // Connect the socket to the entry node (the one at the proxy position)
  // The entry is in the middle of the chain
  const entryIdx = orderedPositions.findIndex((p) => p.isEntry)
  if (entryIdx >= 0 && nodeIds[entryIdx]) {
    addEdge(virtualAdjacency, socketId, nodeIds[entryIdx])
  }

  return { virtualNodes, virtualAdjacency, subSocketIds }
}

function addEdge(adj: Map<string, Set<string>>, a: string, b: string) {
  if (!adj.has(a)) adj.set(a, new Set())
  if (!adj.has(b)) adj.set(b, new Set())
  adj.get(a)!.add(b)
  adj.get(b)!.add(a)
}

/**
 * Merge base tree data with all cluster generation results.
 * Returns combined processedNodes, adjacency, and rebuilt spatial index.
 */
export function buildMergedData(
  baseProcessedNodes: Map<string, ProcessedNode>,
  baseAdjacency: Map<string, Set<string>>,
  clusterResults: Map<string, ClusterGenerationResult>,
): {
  processedNodes: Map<string, ProcessedNode>
  adjacency: Map<string, Set<string>>
  spatialIndex: SpatialIndex
} {
  if (clusterResults.size === 0) {
    return {
      processedNodes: baseProcessedNodes,
      adjacency: baseAdjacency,
      spatialIndex: buildSpatialIndex(baseProcessedNodes),
    }
  }

  const mergedNodes = new Map(baseProcessedNodes)
  const mergedAdj = new Map<string, Set<string>>()

  // Deep copy base adjacency
  for (const [k, v] of baseAdjacency) {
    mergedAdj.set(k, new Set(v))
  }

  // Merge each cluster result
  for (const [, result] of clusterResults) {
    for (const [id, pn] of result.virtualNodes) {
      mergedNodes.set(id, pn)
    }
    for (const [id, neighbors] of result.virtualAdjacency) {
      const existing = mergedAdj.get(id)
      if (existing) {
        for (const n of neighbors) existing.add(n)
      } else {
        mergedAdj.set(id, new Set(neighbors))
      }
    }
  }

  return {
    processedNodes: mergedNodes,
    adjacency: mergedAdj,
    spatialIndex: buildSpatialIndex(mergedNodes),
  }
}
