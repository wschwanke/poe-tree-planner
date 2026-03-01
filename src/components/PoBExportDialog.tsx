import { useCallback, useMemo, useState } from 'react'
import { Check, Clipboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { exportBuildToPoB, getStepTreeUrls } from '@/data/pob-export'
import { useBuildStore } from '@/state/build-store'
import { useTreeStore } from '@/state/tree-store'

export function PoBExportDialog() {
  const open = useBuildStore((s) => s.pobExportOpen)
  const closePoBExport = useBuildStore((s) => s.closePoBExport)
  const builds = useBuildStore((s) => s.builds)
  const activeBuildId = useBuildStore((s) => s.activeBuildId)
  const processedNodes = useTreeStore((s) => s.processedNodes)

  const activeBuild = builds.find((b) => b.id === activeBuildId) ?? null

  const pobCode = useMemo(() => {
    if (!activeBuild || !processedNodes) return ''
    try {
      return exportBuildToPoB(activeBuild, processedNodes)
    } catch {
      return 'Error generating export code'
    }
  }, [activeBuild, processedNodes])

  const treeUrls = useMemo(() => {
    if (!activeBuild || !processedNodes) return []
    try {
      return getStepTreeUrls(activeBuild, processedNodes)
    } catch {
      return []
    }
  }, [activeBuild, processedNodes])

  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(pobCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const textarea = document.createElement('textarea')
      textarea.value = pobCode
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [pobCode])

  if (!activeBuild) return null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closePoBExport()}>
      <DialogContent className="bg-stone-950/95 border-stone-700 backdrop-blur-sm sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-stone-100">Export to Path of Building</DialogTitle>
          <DialogDescription className="text-stone-500">
            {activeBuild.name} — {activeBuild.steps.length} step
            {activeBuild.steps.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* PoB import code */}
          <div>
            <label className="text-xs font-medium text-stone-400 mb-1 block">
              PoB Import Code
            </label>
            <div className="relative">
              <textarea
                readOnly
                value={pobCode}
                rows={4}
                className="w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-xs text-stone-300 font-mono resize-none focus:outline-none focus:border-amber-500/50"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
              <Button
                variant="outline"
                size="xs"
                onClick={handleCopy}
                className="absolute top-2 right-2 h-6 px-2 border-stone-600 bg-stone-800/80 hover:bg-stone-700"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 mr-1 text-green-400" />
                    <span className="text-green-400 text-[10px]">Copied</span>
                  </>
                ) : (
                  <>
                    <Clipboard className="w-3 h-3 mr-1" />
                    <span className="text-[10px]">Copy</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <Separator className="bg-stone-800" />

          {/* Per-step tree URLs */}
          <div>
            <label className="text-xs font-medium text-stone-400 mb-1.5 block">
              Passive Tree URLs
            </label>
            <div className="space-y-2">
              {treeUrls.map((item) => (
                <div key={item.name}>
                  <span className="text-xs text-stone-500">{item.name}</span>
                  <input
                    readOnly
                    value={item.url}
                    className="w-full bg-stone-900 border border-stone-700 rounded px-2 py-1 text-[10px] text-stone-400 font-mono focus:outline-none focus:border-amber-500/50"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
