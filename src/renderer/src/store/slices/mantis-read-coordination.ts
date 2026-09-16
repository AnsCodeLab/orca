import type { AppState } from '../types'
import type { MantisSlice } from './mantis-slice-contract'
import type { MantisConnectionStatus, MantisSiteSelection } from '../../../../shared/mantis-types'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'

let mantisStatusReadGeneration = 0
let mantisMutationGeneration = 0

export function getSelectedMantisSiteId(
  status: MantisConnectionStatus
): MantisSiteSelection | null {
  return status.selectedSiteId ?? status.activeSiteId ?? null
}

export function beginMantisMutation(): number {
  mantisMutationGeneration += 1
  return mantisMutationGeneration
}

export function currentMantisMutationGeneration(): number {
  return mantisMutationGeneration
}

export function nextMantisStatusReadGeneration(): number {
  mantisStatusReadGeneration += 1
  return mantisStatusReadGeneration
}

export function isCurrentMantisStatusRead(generation: number): boolean {
  return generation === mantisStatusReadGeneration
}

export function isCurrentMantisMutation(generation: number): boolean {
  return generation === mantisMutationGeneration
}

export function isCurrentMantisRuntimeContext(
  contextKey: string,
  settings: AppState['settings']
): boolean {
  return getProviderRuntimeContextKey(settings) === contextKey
}

function nextMantisConnectionRevisions(
  revisions: Record<string, number>,
  contextKey: string
): Record<string, number> {
  return { ...revisions, [contextKey]: (revisions[contextKey] ?? 0) + 1 }
}

export function mantisStatusUpdate(
  state: AppState,
  contextKey: string,
  status: MantisConnectionStatus,
  extra?: Partial<MantisSlice>
): Partial<MantisSlice> {
  return {
    mantisStatus: status,
    mantisStatusChecked: true,
    mantisStatusContextKey: contextKey,
    mantisConnectionRevisions: nextMantisConnectionRevisions(
      state.mantisConnectionRevisions,
      contextKey
    ),
    ...extra
  }
}
