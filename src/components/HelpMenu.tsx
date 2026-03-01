import { useCallback, useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { KEYBIND_SECTIONS } from '@/config/keybinds'

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded bg-stone-800 border border-stone-600 text-stone-300 text-xs font-mono">
      {children}
    </kbd>
  )
}

export function HelpMenu() {
  const [open, setOpen] = useState(false)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    },
    [],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-7 w-7 p-0 bg-stone-950/90 border-amber-900/50 text-stone-400 backdrop-blur-sm hover:bg-stone-900/90 hover:text-stone-200"
        title="Help (?)"
      >
        ?
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-stone-950/95 border-stone-700 backdrop-blur-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-stone-100">Keyboard Shortcuts</DialogTitle>
            <DialogDescription className="text-stone-500">
              Press <Kbd>?</Kbd> to toggle this menu
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {KEYBIND_SECTIONS.map((section, i) => (
              <div key={section.title}>
                {i > 0 && <Separator className="bg-stone-800 mb-4" />}
                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">
                  {section.title}
                </h3>
                <div className="space-y-2">
                  {section.binds.map((bind) => (
                    <div
                      key={bind.description}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className="text-sm text-stone-300">{bind.description}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {bind.keys.map((key, j) => (
                          <span key={j} className="flex items-center gap-1">
                            {j > 0 && <span className="text-stone-600 text-xs">+</span>}
                            <Kbd>{key}</Kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
