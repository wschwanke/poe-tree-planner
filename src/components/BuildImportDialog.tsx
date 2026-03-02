import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useBuildStore } from '@/state/build-store'
import type { TreeMode } from '@/types/skill-tree'

interface BuildImportDialogProps {
  open: boolean
  onClose: () => void
  treeMode: TreeMode
}

export function BuildImportDialog({ open, onClose, treeMode }: BuildImportDialogProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const importBuild = useBuildStore((s) => s.importBuild)

  const handleImport = useCallback(() => {
    setError(null)
    setSuccess(false)
    const trimmed = code.trim()
    if (!trimmed) {
      setError('Please paste a build code')
      return
    }
    const result = importBuild(trimmed, treeMode)
    if (result.success) {
      setSuccess(true)
      setTimeout(() => {
        setCode('')
        setError(null)
        setSuccess(false)
        onClose()
      }, 600)
    } else {
      setError(result.error ?? 'Import failed')
    }
  }, [code, treeMode, importBuild, onClose])

  const handleOpenChange = useCallback(
    (o: boolean) => {
      if (!o) {
        setCode('')
        setError(null)
        setSuccess(false)
        onClose()
      }
    },
    [onClose],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-stone-950/95 border-stone-700 backdrop-blur-sm sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-stone-100">Import Build</DialogTitle>
          <DialogDescription className="text-stone-500">
            Paste a build code to import it
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <textarea
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setError(null)
              setSuccess(false)
            }}
            placeholder="Paste build code here..."
            rows={4}
            className="w-full text-xs bg-stone-900 border border-stone-700 rounded px-3 py-2 text-stone-300 resize-none focus:outline-none focus:border-amber-500/50 font-mono"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          {success && <p className="text-xs text-green-400">Build imported successfully!</p>}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenChange(false)}
              className="text-stone-400 hover:text-stone-200"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={!code.trim() || success}
              className="bg-amber-600 hover:bg-amber-500 text-stone-950"
            >
              Import
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
