import { buildSpatialIndex, getOrbitAngle, type SpatialIndex } from '@/data/graph'
import type {
  ClusterGenerationResult,
  ClusterJewelConfig,
  ClusterJewelSize,
} from '@/types/cluster-jewel'
import {
  CLUSTER_INDICES,
  EXPANSION_SIZE_MAP,
  SUB_SOCKET_COUNTS,
  TOTAL_INDICES,
} from '@/types/cluster-jewel'
import type { ProcessedNode, SkillNode, SkillTreeData } from '@/types/skill-tree'

/**
 * Check if a node is a cluster-capable jewel socket.
 * Returns the cluster size or null.
 */
export function isClusterSocket(node: SkillNode): ClusterJewelSize | null {
  if (!node.expansionJewel) return null
  return EXPANSION_SIZE_MAP[node.expansionJewel.size] ?? null
}

// Hardcoded orbit index translation tables matching PoB's ClusterJewels.lua
const TRANSLATE_12_TO_16 = [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15]
const TRANSLATE_16_TO_12 = [0, 1, 1, 2, 3, 4, 4, 5, 6, 7, 7, 8, 9, 10, 10, 11]

function translateOidx(idx: number, srcCount: number, destCount: number): number {
  if (srcCount === destCount) return idx
  if (srcCount === 12 && destCount === 16) return TRANSLATE_12_TO_16[idx]
  if (srcCount === 16 && destCount === 12) return TRANSLATE_16_TO_12[idx]
  return idx
}

/**
 * Recursively resolve a virtual socket ID (cv: prefix) to its real tree data equivalent.
 * Follows the chain of expansionJewel parent+index references until a real node is found.
 */
function resolveRealSocketId(
  socketId: string,
  data: SkillTreeData,
  processedNodes: Map<string, ProcessedNode>,
): string | undefined {
  if (!socketId.startsWith('cv:')) return socketId

  const pn = processedNodes.get(socketId)
  if (!pn?.node.expansionJewel) return undefined

  const parentId = String(pn.node.expansionJewel.parent)
  const index = pn.node.expansionJewel.index

  // Recursively resolve parent if it's also virtual
  const realParentId = resolveRealSocketId(parentId, data, processedNodes)
  if (!realParentId) return undefined

  // Find the real node matching parent + index
  for (const [nodeId, node] of Object.entries(data.nodes)) {
    if (
      node.expansionJewel &&
      String(node.expansionJewel.parent) === realParentId &&
      node.expansionJewel.index === index
    ) {
      return nodeId
    }
  }
  return undefined
}

/**
 * Find real sub-socket proxy references from the tree data.
 * For a given socket ID, look up real nodes that have expansionJewel.parent matching it.
 * Returns a Map from socket array index to the proxy ID that sub-socket should use.
 */
function findRealSubSocketProxies(
  socketId: string,
  data: SkillTreeData,
  processedNodes: Map<string, ProcessedNode>,
): Map<number, string> {
  const realSocketId = resolveRealSocketId(socketId, data, processedNodes)
  if (!realSocketId) return new Map()

  const result = new Map<number, string>()
  for (const [_nodeId, node] of Object.entries(data.nodes)) {
    if (node.expansionJewel && String(node.expansionJewel.parent) === realSocketId) {
      result.set(node.expansionJewel.index, String(node.expansionJewel.proxy))
    }
  }
  return result
}

/**
 * Generate virtual nodes for a cluster jewel socketed at a given socket.
 *
 * Uses the PoB deterministic index-based layout system:
 * 1. Sockets placed at fixed socketIndicies positions
 * 2. Passives fill from smallIndicies, skipping socket-occupied slots
 * 3. Positions computed via orbit index translation (12↔16 lookup tables)
 * 4. Adjacency: walk cluster indices, link consecutive occupied nodes
 *    (closed loop for medium/large, linear chain for small)
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
  const rawNode = socketPn.node.expansionJewel ? socketPn.node : data.nodes[socketId]
  if (!rawNode?.expansionJewel) return { virtualNodes, virtualAdjacency, subSocketIds }

  const proxyId = String(rawNode.expansionJewel.proxy)
  const proxyRaw = data.nodes[proxyId]
  if (!proxyRaw) return { virtualNodes, virtualAdjacency, subSocketIds }

  const proxyGroup = data.groups[String(proxyRaw.group)]
  if (!proxyGroup) return { virtualNodes, virtualAdjacency, subSocketIds }

  const orbit = proxyRaw.orbit
  const orbitRadius = data.constants.orbitRadii[orbit] ?? 0
  const skillsPerOrbit = data.constants.skillsPerOrbit[orbit] ?? 1
  const totalIndicies = TOTAL_INDICES[config.size]
  const indices = CLUSTER_INDICES[config.size]
  const subSocketCount = SUB_SOCKET_COUNTS[config.size]

  // Translate proxy's tree orbit index into cluster index space
  const proxyClusterIdx = translateOidx(proxyRaw.orbitIndex, skillsPerOrbit, totalIndicies)

  // Determine which cluster indices are occupied and what goes there.
  // Map from cluster index → { virtualId, isSocket, socketArrayIndex }
  const occupied = new Map<
    number,
    { virtualId: string; isSocket: boolean; socketArrayIndex: number }
  >()

  // Place sockets first at socketIndicies positions
  const socketClusterIndices = new Set<number>()
  const sortedSocketCis = [...indices.socketIndicies].sort((a, b) => a - b)
  for (let i = 0; i < subSocketCount; i++) {
    const ci = indices.socketIndicies[i]
    socketClusterIndices.add(ci)
    const realDataIndex = sortedSocketCis.indexOf(ci)
    const virtualId = `cv:${socketId}:s${i}`
    occupied.set(ci, { virtualId, isSocket: true, socketArrayIndex: realDataIndex })
    subSocketIds.push(virtualId)
  }

  // Fill passives from smallIndicies, skipping socket-occupied slots
  let passivesPlaced = 0
  let passiveIdx = 0
  const totalPassives = config.passiveCount - subSocketCount // passiveCount includes sockets
  for (const ci of indices.smallIndicies) {
    if (passivesPlaced >= totalPassives) break
    if (socketClusterIndices.has(ci)) continue
    const virtualId = `cv:${socketId}:p${passiveIdx}`
    occupied.set(ci, { virtualId, isSocket: false, socketArrayIndex: -1 })
    passivesPlaced++
    passiveIdx++
  }

  // Look up real sub-socket proxy references for nesting
  const realSubSocketProxies = findRealSubSocketProxies(socketId, data, processedNodes)

  // Generate virtual nodes at computed world positions
  for (const [ci, slot] of occupied) {
    const rotatedIdx = (ci + proxyClusterIdx) % totalIndicies
    const treeOidx = translateOidx(rotatedIdx, totalIndicies, skillsPerOrbit)
    const angle = getOrbitAngle(treeOidx, skillsPerOrbit)
    const worldX = proxyGroup.x + orbitRadius * Math.sin(angle)
    const worldY = proxyGroup.y - orbitRadius * Math.cos(angle)

    // Determine sub-socket expansion jewel data for nesting
    let expansionJewel: SkillNode['expansionJewel']
    if (slot.isSocket) {
      const subSize: ClusterJewelSize | undefined =
        config.size === 'large' ? 'medium' : config.size === 'medium' ? 'small' : undefined
      if (subSize) {
        // Use real sub-socket proxy if available, otherwise fall back to parent proxy
        const subProxy = realSubSocketProxies.get(slot.socketArrayIndex) ?? proxyId
        expansionJewel = {
          size: subSize === 'small' ? 0 : subSize === 'medium' ? 1 : 2,
          index: slot.socketArrayIndex,
          proxy: subProxy,
          parent: socketId,
        }
      }
    }

    const node: SkillNode = {
      name: slot.isSocket ? 'Cluster Jewel Socket' : 'Cluster Passive',
      group: proxyRaw.group,
      orbit,
      orbitIndex: treeOidx,
      out: [],
      in: [],
      isJewelSocket: slot.isSocket ? true : undefined,
      isNotable: false,
      expansionJewel,
    }

    virtualNodes.set(slot.virtualId, {
      id: slot.virtualId,
      node,
      worldX,
      worldY,
      type: slot.isSocket ? 'jewelSocket' : 'normal',
    })
  }

  // Build adjacency by walking cluster indices 0 → totalIndicies-1,
  // linking consecutive occupied nodes
  const orderedIds: string[] = []
  for (let ci = 0; ci < totalIndicies; ci++) {
    const slot = occupied.get(ci)
    if (slot) orderedIds.push(slot.virtualId)
  }

  for (let i = 0; i < orderedIds.length - 1; i++) {
    addEdge(virtualAdjacency, orderedIds[i], orderedIds[i + 1])
  }

  // Close the loop for medium and large clusters
  if (config.size !== 'small' && orderedIds.length > 1) {
    addEdge(virtualAdjacency, orderedIds[orderedIds.length - 1], orderedIds[0])
  }

  // Link entrance node (cluster index 0) to parent socket
  const entranceSlot = occupied.get(0)
  if (entranceSlot) {
    addEdge(virtualAdjacency, socketId, entranceSlot.virtualId)
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
