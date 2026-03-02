import { useState } from 'react'
import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { usePlanningStore } from '@/state/planning-store'
import { type BanditChoice, useTreeStore } from '@/state/tree-store'

export function SettingsDialog() {
  const [open, setOpen] = useState(false)

  const treeMode = useTreeStore((s) => s.treeMode)
  const banditChoice = useTreeStore((s) => s.banditChoice)
  const setBanditChoice = useTreeStore((s) => s.setBanditChoice)
  const preferNotables = usePlanningStore((s) => s.preferNotables)
  const togglePreferNotables = usePlanningStore((s) => s.togglePreferNotables)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-7 w-7 p-0 bg-stone-950/90 border-amber-900/50 text-stone-400 backdrop-blur-sm hover:bg-stone-900/90 hover:text-stone-200"
        title="Settings"
      >
        <Settings className="w-3.5 h-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-stone-950/95 border-stone-700 backdrop-blur-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-stone-100">Settings</DialogTitle>
            <DialogDescription className="text-stone-500">
              Configure your tree planner preferences
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Quest Rewards — skill tree only */}
            {treeMode === 'skill' && (
              <>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">
                    Quest Rewards
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <span className="text-sm text-stone-300">Bandit Quest</span>
                        <p className="text-xs text-stone-500">Deal with the Bandit Lords</p>
                      </div>
                      <Select
                        value={banditChoice}
                        onValueChange={(v) => setBanditChoice(v as BanditChoice)}
                      >
                        <SelectTrigger
                          size="sm"
                          className="h-7 w-[140px] bg-stone-900 border-stone-700 text-stone-300 text-xs"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-stone-950 border-stone-700">
                          <SelectItem value="none" className="text-stone-300 text-xs">
                            Help Bandits
                          </SelectItem>
                          <SelectItem value="kill_all" className="text-stone-300 text-xs">
                            Kill All (+1 pt)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator className="bg-stone-800" />
              </>
            )}

            {/* Planning */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">
                Planning
              </h3>
              <div className="space-y-2">
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <span className="text-sm text-stone-300">Prefer notables</span>
                    <p className="text-xs text-stone-500">
                      Prioritise notable nodes when solving paths
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferNotables}
                    onChange={togglePreferNotables}
                    className="accent-amber-500 w-4 h-4 shrink-0"
                  />
                </label>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
