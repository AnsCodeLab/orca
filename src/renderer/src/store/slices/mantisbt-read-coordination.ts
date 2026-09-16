import type { AppState } from '../types'
import type { MantisBTSlice } from './mantisbt-slice-contract'
import type {
  MantisBTConnectionStatus,
  MantisBTSiteSelection
} from '../../../../shared/mantisbt-types'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'

let mantisBTStatusReadGeneration = 0
let mantisBTMutationGeneration = 0

export function getSelectedMantisBTSiteId(
  status: MantisBTConnectionStatus
): MantisBTSiteSelection | null {
  return status.selectedSiteId ?? status.activeSiteId ?? null
}

export function beginMantisBTMutation(): number {
  mantisBTMutationGeneration += 1
  return mantisBTMutationGeneration
}

export function currentMantisBTMutationGeneration(): number {
  return mantisBTMutationGeneration
}

export function nextMantisBTStatusReadGeneration(): number {
  mantisBTStatusReadGeneration += 1
  return mantisBTStatusReadGeneration
}

export function isCurrentMantisBTStatusRead(generation: number): boolean {
  return generation === mantisBTStatusReadGeneration
}

export function isCurrentMantisBTMutation(generation: number): boolean {
  return generation === mantisBTMutationGeneration
}

export function isCurrentMantisBTRuntimeContext(
  contextKey: string,
  settings: AppState['settings']
): boolean {
  return getProviderRuntimeContextKey(settings) === contextKey
}

function nextMantisBTConnectionRevisions(
  revisions: Record<string, number>,
  contextKey: string
): Record<string, number> {
  return { ...revisions, [contextKey]: (revisions[contextKey] ?? 0) + 1 }
}

export function mantisBTStatusUpdate(
  state: AppState,
  contextKey: string,
  status: MantisBTConnectionStatus,
  extra?: Partial<MantisBTSlice>
): Partial<MantisBTSlice> {
  return {
    mantisBTStatus: status,
    mantisBTStatusChecked: true,
    mantisBTStatusContextKey: contextKey,
    mantisBTConnectionRevisions: nextMantisBTConnectionRevisions(
      state.mantisBTConnectionRevisions,
      contextKey
    ),
    ...extra
  }
}
