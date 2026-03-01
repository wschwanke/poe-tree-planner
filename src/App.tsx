import { SkillTreeCanvas } from '@/components/SkillTreeCanvas'
import { useSkillTree } from '@/hooks/useSkillTree'

function App() {
  const { context, loading, error } = useSkillTree()

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="text-red-400 text-center">
          <p className="text-lg font-semibold">Failed to load skill tree</p>
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
          <p className="text-stone-500 text-sm mt-3">Loading skill tree...</p>
        </div>
      </div>
    )
  }

  return <SkillTreeCanvas context={context} />
}

export default App
