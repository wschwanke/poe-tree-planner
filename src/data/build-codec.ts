import pako from 'pako'
import type { Build, ExportedBuild } from '@/types/build'

function toUrlSafeBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromUrlSafeBase64(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (str.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function encodeBuild(build: Build): string {
  const exported: ExportedBuild = {
    version: 1,
    treeMode: build.treeMode,
    name: build.name,
    classId: build.classId,
    banditChoice: build.banditChoice,
    steps: build.steps.map((s) => ({
      name: s.name,
      description: s.description,
      classId: s.classId,
      ascendClassId: s.ascendClassId,
      allocatedNodeIds: s.allocatedNodeIds,
      masteryEffects: s.masteryEffects,
    })),
  }
  const json = JSON.stringify(exported)
  const deflated = pako.deflate(new TextEncoder().encode(json))
  return toUrlSafeBase64(deflated)
}

export function decodeBuild(encoded: string): ExportedBuild | { error: string } {
  try {
    const bytes = fromUrlSafeBase64(encoded.trim())
    const inflated = pako.inflate(bytes)
    const json = new TextDecoder().decode(inflated)
    const data = JSON.parse(json) as ExportedBuild

    if (data.version !== 1) return { error: 'Unsupported build format version' }
    if (data.treeMode !== 'skill' && data.treeMode !== 'atlas') {
      return { error: 'Invalid tree mode in build data' }
    }
    if (!data.name || !Array.isArray(data.steps) || data.steps.length === 0) {
      return { error: 'Invalid build data: missing name or steps' }
    }

    return data
  } catch {
    return { error: 'Failed to decode build. Check the code and try again.' }
  }
}
