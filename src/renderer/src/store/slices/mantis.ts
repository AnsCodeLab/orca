import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import { createMantisConnectionActions } from './mantis-connection-actions'
import type { MantisSlice } from './mantis-slice-contract'

export type { MantisSlice } from './mantis-slice-contract'

export const createMantisSlice: StateCreator<AppState, [], [], MantisSlice> = (set, get) => ({
  mantisStatus: {
    connected: false,
    viewer: null,
    sites: [],
    activeSiteId: null,
    selectedSiteId: null
  },
  mantisStatusChecked: false,
  mantisStatusContextKey: null,
  mantisConnectionRevisions: {},
  ...createMantisConnectionActions(set, get)
})
