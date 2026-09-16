import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import type {
  MantisBTConnectArgs,
  MantisBTConnectionStatus,
  MantisBTSiteSelection,
  MantisBTViewer
} from '../../../../shared/mantisbt-types'

export type MantisBTSlice = {
  mantisBTStatus: MantisBTConnectionStatus
  mantisBTStatusChecked: boolean
  mantisBTStatusContextKey: string | null
  mantisBTConnectionRevisions: Record<string, number>

  checkMantisBTConnection: () => Promise<void>
  connectMantisBT: (
    args: MantisBTConnectArgs
  ) => Promise<{ ok: true; viewer: MantisBTViewer } | { ok: false; error: string }>
  testMantisBTConnection: (
    siteId?: string | null
  ) => Promise<{ ok: true; viewer: MantisBTViewer } | { ok: false; error: string }>
  selectMantisBTSite: (siteId: MantisBTSiteSelection) => Promise<void>
  disconnectMantisBT: (siteId?: string | null) => Promise<void>
}

type MantisBTStateCreator = StateCreator<AppState, [], [], MantisBTSlice>

export type MantisBTSliceSet = Parameters<MantisBTStateCreator>[0]
export type MantisBTSliceGet = Parameters<MantisBTStateCreator>[1]
