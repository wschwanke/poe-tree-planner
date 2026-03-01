import { deflate } from 'pako'
import type { Build, BuildStep } from '@/types/build'
import type { ProcessedNode } from '@/types/skill-tree'

const POB_TREE_VERSION = 6
const POB_TREE_URL_PREFIX = 'https://www.pathofexile.com/passive-skill-tree/'

function encodePassiveTreeUrl(step: BuildStep, processedNodes: Map<string, ProcessedNode>): string {
  // Find class start node to exclude from encoding
  let classStartNodeId: string | null = null
  for (const [id, pn] of processedNodes) {
    if (pn.node.classStartIndex === step.classId) {
      classStartNodeId = id
      break
    }
  }

  // Collect skill IDs (the node's `skill` field), excluding class start
  const skillIds: number[] = []
  for (const nodeId of step.allocatedNodeIds) {
    if (nodeId === classStartNodeId) continue
    const pn = processedNodes.get(nodeId)
    if (pn?.node.skill != null) {
      skillIds.push(pn.node.skill)
    }
  }

  // Binary format: version(4B) + classId(1B) + ascendClassId(1B) + nodeSkillIds(2B each)
  const size = 6 + skillIds.length * 2
  const buf = new ArrayBuffer(size)
  const view = new DataView(buf)

  view.setInt32(0, POB_TREE_VERSION, false) // big-endian
  view.setUint8(4, step.classId)
  view.setUint8(5, step.ascendClassId)

  for (let i = 0; i < skillIds.length; i++) {
    view.setUint16(6 + i * 2, skillIds[i], false) // big-endian
  }

  // Base64url encode
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  return POB_TREE_URL_PREFIX + b64
}

function buildXml(build: Build, processedNodes: Map<string, ProcessedNode>): string {
  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push('<PathOfBuilding>')
  lines.push('  <Build level="100" className="" ascendClassName="" />')
  lines.push(`  <Tree activeSpec="${build.steps.findIndex((s) => s.id === build.activeStepId) + 1}">`)

  for (const step of build.steps) {
    const url = encodePassiveTreeUrl(step, processedNodes)
    const escapedName = escapeXml(step.name)

    // Mastery effects: comma-separated "effect:nodeSkillId" pairs
    const masteryPairs: string[] = []
    for (const [nodeId, effectIndex] of Object.entries(step.masteryEffects)) {
      const pn = processedNodes.get(nodeId)
      if (pn?.node.masteryEffects?.[effectIndex]) {
        const effect = pn.node.masteryEffects[effectIndex]
        if (pn.node.skill != null) {
          masteryPairs.push(`${effect.effect}:${pn.node.skill}`)
        }
      }
    }
    const masteryAttr = masteryPairs.length > 0 ? ` masteryEffects="${masteryPairs.join(',')}"` : ''

    lines.push(`    <Spec title="${escapedName}" classId="${step.classId}" ascendClassId="${step.ascendClassId}"${masteryAttr} treeVersion="${POB_TREE_VERSION}">`)
    lines.push(`      <URL>${url}</URL>`)
    lines.push('    </Spec>')
  }

  lines.push('  </Tree>')
  lines.push('</PathOfBuilding>')
  return lines.join('\n')
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function exportBuildToPoB(
  build: Build,
  processedNodes: Map<string, ProcessedNode>,
): string {
  const xml = buildXml(build, processedNodes)
  const compressed = deflate(new TextEncoder().encode(xml))
  return urlSafeBase64Encode(compressed)
}

export function getStepTreeUrls(
  build: Build,
  processedNodes: Map<string, ProcessedNode>,
): { name: string; url: string }[] {
  return build.steps.map((step) => ({
    name: step.name,
    url: encodePassiveTreeUrl(step, processedNodes),
  }))
}

function urlSafeBase64Encode(data: Uint8Array): string {
  let binary = ''
  for (const byte of data) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_')
}
