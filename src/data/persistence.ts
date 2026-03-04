import type { Build } from '@/types/build'

// --- Builds ---

export async function loadBuilds(): Promise<Build[]> {
  const res = await fetch('/.db/builds')
  return res.json()
}

export function saveBuilds(builds: Build[]): void {
  fetch('/.db/builds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(builds),
  })
}

// --- Preferences ---

let prefsCache: Record<string, string> = {}

export async function loadPreferences(): Promise<Record<string, string>> {
  const res = await fetch('/.db/preferences')
  prefsCache = await res.json()
  return prefsCache
}

export function savePreference(key: string, value: string): void {
  prefsCache[key] = value
  fetch('/.db/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefsCache),
  })
}

export function getPref(key: string, fallback: string): string {
  return prefsCache[key] ?? fallback
}
