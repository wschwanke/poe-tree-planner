import { useEffect, useState } from 'react'
import { SkillTreeCanvas } from '@/components/SkillTreeCanvas'
import { getPref, loadPreferences, savePreference } from '@/data/persistence'
import { useSkillTree } from '@/hooks/useSkillTree'
import { useBuildStore } from '@/state/build-store'
import type { TreeMode } from '@/types/skill-tree'

function App() {
  const [treeMode, setTreeMode] = useState<TreeMode>('skill')
  const { context, loading, error } = useSkillTree(treeMode)

  useEffect(() => {
    loadPreferences().then(() => {
      setTreeMode((getPref('tree-mode', 'skill') as TreeMode) || 'skill')
    })
    useBuildStore.getState().loadBuilds()
  }, [])

  const handleTreeModeChange = (mode: TreeMode) => {
    useBuildStore.getState().setActiveBuild(null)
    savePreference('tree-mode', mode)
    setTreeMode(mode)
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="text-red-400 text-center">
          <p className="text-lg font-semibold">Failed to load {treeMode === 'atlas' ? 'atlas' : 'skill'} tree</p>
          <p className="text-sm text-stone-500 mt-1">{error}</p>
        </div>
      </div>
    )
  }

  if (loading || !context) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-stone-500 text-sm mt-3">Loading {treeMode === 'atlas' ? 'atlas' : 'skill'} tree...</p>
        </div>
      </div>
    )
  }

  return (
    <SkillTreeCanvas
      context={context}
      treeMode={treeMode}
      onTreeModeChange={handleTreeModeChange}
    />
  )
}

export default App
