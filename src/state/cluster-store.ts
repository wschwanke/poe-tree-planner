import { create } from 'zustand'
import type { ClusterJewelConfig } from '@/types/cluster-jewel'

interface ClusterState {
  clusterJewels: Map<string, ClusterJewelConfig>
  dialogSocketId: string | null
  version: number

  openDialog: (socketId: string) => void
  closeDialog: () => void
  setClusterJewel: (socketId: string, config: ClusterJewelConfig) => void
  removeClusterJewel: (socketId: string) => void
  reset: () => void
}

export const useClusterStore = create<ClusterState>((set, get) => ({
  clusterJewels: new Map(),
  dialogSocketId: null,
  version: 0,

  openDialog(socketId) {
    set({ dialogSocketId: socketId })
  },

  closeDialog() {
    set({ dialogSocketId: null })
  },

  setClusterJewel(socketId, config) {
    const state = get()
    const newJewels = new Map(state.clusterJewels)
    newJewels.set(socketId, config)
    set({
      clusterJewels: newJewels,
      version: state.version + 1,
    })
  },

  removeClusterJewel(socketId) {
    const state = get()
    const newJewels = new Map(state.clusterJewels)

    // Cascade: remove any nested cluster jewels in sub-sockets
    const toRemove = [socketId]
    while (toRemove.length > 0) {
      const id = toRemove.pop()!
      newJewels.delete(id)
      // Find sub-sockets that belong to this cluster
      for (const [subId] of newJewels) {
        if (subId.startsWith(`cv:${id}:s`)) {
          toRemove.push(subId)
        }
      }
    }

    set({
      clusterJewels: newJewels,
      version: state.version + 1,
    })
  },

  reset() {
    set({
      clusterJewels: new Map(),
      dialogSocketId: null,
      version: 0,
    })
  },
}))
