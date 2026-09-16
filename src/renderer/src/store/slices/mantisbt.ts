import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import { createMantisBTConnectionActions } from './mantisbt-connection-actions'
import type { MantisBTSlice } from './mantisbt-slice-contract'

export type { MantisBTSlice } from './mantisbt-slice-contract'

export const createMantisBTSlice: StateCreator<AppState, [], [], MantisBTSlice> = (set, get) => ({
  mantisBTStatus: {
    connected: false,
    viewer: null,
    sites: [],
    activeSiteId: null,
    selectedSiteId: null
  },
  mantisBTStatusChecked: false,
  mantisBTStatusContextKey: null,
  mantisBTConnectionRevisions: {},
  ...createMantisBTConnectionActions(set, get)
})
