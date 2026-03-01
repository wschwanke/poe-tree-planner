import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePlanningStore } from '@/state/planning-store'
import { type BanditChoice, useTreeStore } from '@/state/tree-store'

export function SettingsPopover() {
  const banditChoice = useTreeStore((s) => s.banditChoice)
  const setBanditChoice = useTreeStore((s) => s.setBanditChoice)
  const preferNotables = usePlanningStore((s) => s.preferNotables)
  const togglePreferNotables = usePlanningStore((s) => s.togglePreferNotables)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0 bg-stone-950/90 border-amber-900/50 text-stone-400 backdrop-blur-sm hover:bg-stone-900/90 hover:text-stone-200"
          title="Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 bg-stone-950/95 border-stone-700 backdrop-blur-sm p-3 space-y-3"
      >
        <h4 className="text-xs font-medium text-stone-400 uppercase tracking-wider">Settings</h4>

        {/* Bandit choice */}
        <div className="space-y-1.5">
          <label className="text-xs text-stone-400">Bandit Quest</label>
          <Select
            value={banditChoice}
            onValueChange={(v) => setBanditChoice(v as BanditChoice)}
          >
            <SelectTrigger
              size="sm"
              className="h-7 bg-stone-900 border-stone-700 text-stone-300 text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-stone-950 border-stone-700">
              <SelectItem value="none" className="text-stone-300 text-xs">
                Help Bandits
              </SelectItem>
              <SelectItem value="kill_all" className="text-stone-300 text-xs">
                Kill All (+1 point)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Prefer notables checkbox */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={preferNotables}
              onChange={togglePreferNotables}
              className="accent-amber-500"
            />
            <span className="text-xs text-stone-300">Prefer notables in plan solve</span>
          </label>
        </div>
      </PopoverContent>
    </Popover>
  )
}
