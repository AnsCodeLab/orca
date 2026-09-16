import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import type {
  MantisConnectArgs,
  MantisConnectionStatus,
  MantisSiteSelection,
  MantisViewer
} from '../../../../shared/mantis-types'

export type MantisSlice = {
  mantisStatus: MantisConnectionStatus
  mantisStatusChecked: boolean
  mantisStatusContextKey: string | null
  mantisConnectionRevisions: Record<string, number>

  checkMantisConnection: () => Promise<void>
  connectMantis: (
    args: MantisConnectArgs
  ) => Promise<{ ok: true; viewer: MantisViewer } | { ok: false; error: string }>
  testMantisConnection: (
    siteId?: string | null
  ) => Promise<{ ok: true; viewer: MantisViewer } | { ok: false; error: string }>
  selectMantisSite: (siteId: MantisSiteSelection) => Promise<void>
  disconnectMantis: (siteId?: string | null) => Promise<void>
}

type MantisStateCreator = StateCreator<AppState, [], [], MantisSlice>

export type MantisSliceSet = Parameters<MantisStateCreator>[0]
export type MantisSliceGet = Parameters<MantisStateCreator>[1]
