import {
  mantisConnect,
  mantisDisconnect,
  mantisSelectSite,
  mantisStatus,
  mantisTestConnection
} from '@/runtime/runtime-mantis-client'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'
import { translate } from '@/i18n/i18n'
import type { MantisSlice, MantisSliceGet, MantisSliceSet } from './mantis-slice-contract'
import type { MantisConnectionStatus } from '../../../../shared/mantis-types'
import {
  beginMantisMutation,
  currentMantisMutationGeneration,
  getSelectedMantisSiteId,
  isCurrentMantisMutation,
  isCurrentMantisRuntimeContext,
  isCurrentMantisStatusRead,
  mantisStatusUpdate,
  nextMantisStatusReadGeneration
} from './mantis-read-coordination'

const DISCONNECTED_STATUS: MantisConnectionStatus = {
  connected: false,
  viewer: null,
  sites: [],
  activeSiteId: null,
  selectedSiteId: null
}

type MantisConnectionActions = Pick<
  MantisSlice,
  | 'checkMantisConnection'
  | 'connectMantis'
  | 'testMantisConnection'
  | 'selectMantisSite'
  | 'disconnectMantis'
>

function hasMantisStatusChanged(
  previous: MantisSlice['mantisStatus'],
  next: MantisSlice['mantisStatus']
): boolean {
  return (
    previous.connected !== next.connected ||
    previous.credentialError !== next.credentialError ||
    previous.viewer?.email !== next.viewer?.email ||
    getSelectedMantisSiteId(previous) !== getSelectedMantisSiteId(next) ||
    (previous.sites?.length ?? 0) !== (next.sites?.length ?? 0)
  )
}

export function createMantisConnectionActions(
  set: MantisSliceSet,
  get: MantisSliceGet
): MantisConnectionActions {
  return {
    checkMantisConnection: async () => {
      const contextKey = getProviderRuntimeContextKey(get().settings)
      const statusReadGeneration = nextMantisStatusReadGeneration()
      const mutationGeneration = currentMantisMutationGeneration()
      if (get().mantisStatusContextKey !== contextKey) {
        set({ mantisStatusChecked: false })
      }
      try {
        const status = await mantisStatus(get().settings)
        if (
          mutationGeneration !== currentMantisMutationGeneration() ||
          !isCurrentMantisStatusRead(statusReadGeneration) ||
          getProviderRuntimeContextKey(get().settings) !== contextKey
        ) {
          return
        }
        const previous = get().mantisStatus
        if (hasMantisStatusChanged(previous, status)) {
          set((state) => mantisStatusUpdate(state, contextKey, status))
        } else if (!get().mantisStatusChecked) {
          set({ mantisStatusChecked: true, mantisStatusContextKey: contextKey })
        } else if (get().mantisStatusContextKey !== contextKey) {
          set({ mantisStatusContextKey: contextKey })
        }
      } catch {
        if (
          mutationGeneration !== currentMantisMutationGeneration() ||
          !isCurrentMantisStatusRead(statusReadGeneration) ||
          getProviderRuntimeContextKey(get().settings) !== contextKey
        ) {
          return
        }
        if (get().mantisStatus.connected) {
          set((state) =>
            mantisStatusUpdate(state, contextKey, DISCONNECTED_STATUS)
          )
        } else if (!get().mantisStatusChecked) {
          set({ mantisStatusChecked: true, mantisStatusContextKey: contextKey })
        } else if (get().mantisStatusContextKey !== contextKey) {
          set({ mantisStatusContextKey: contextKey })
        }
      }
    },

    connectMantis: async (args) => {
      const requestGeneration = beginMantisMutation()
      const contextKey = getProviderRuntimeContextKey(get().settings)
      try {
        const result = await mantisConnect(get().settings, args)
        if (
          result.ok &&
          isCurrentMantisMutation(requestGeneration) &&
          isCurrentMantisRuntimeContext(contextKey, get().settings)
        ) {
          set((state) =>
            mantisStatusUpdate(state, contextKey, {
              ...get().mantisStatus,
              connected: true,
              viewer: result.viewer
            })
          )
          void get().checkMantisConnection()
        } else if (result.ok) {
          return {
            ok: false as const,
            error: translate(
              'auto.store.slices.mantis.connectionSuperseded',
              'Mantis connection was superseded by a newer request.'
            )
          }
        }
        return result
      } catch (error) {
        return {
          ok: false as const,
          error: error instanceof Error ? error.message : 'Connection failed'
        }
      }
    },

    testMantisConnection: async (siteId) => {
      const requestGeneration = beginMantisMutation()
      const contextKey = getProviderRuntimeContextKey(get().settings)
      try {
        const result = await mantisTestConnection(get().settings, siteId)
        if (
          !isCurrentMantisMutation(requestGeneration) ||
          !isCurrentMantisRuntimeContext(contextKey, get().settings)
        ) {
          return result
        }
        const status = await mantisStatus(get().settings)
        if (
          isCurrentMantisMutation(requestGeneration) &&
          isCurrentMantisRuntimeContext(contextKey, get().settings)
        ) {
          set((state) => mantisStatusUpdate(state, contextKey, status))
        }
        return result
      } catch (error) {
        return { ok: false as const, error: error instanceof Error ? error.message : 'Test failed' }
      }
    },

    selectMantisSite: async (siteId) => {
      const requestGeneration = beginMantisMutation()
      const contextKey = getProviderRuntimeContextKey(get().settings)
      const status = await mantisSelectSite(get().settings, siteId)
      if (
        !isCurrentMantisMutation(requestGeneration) ||
        getProviderRuntimeContextKey(get().settings) !== contextKey
      ) {
        return
      }
      set((state) => mantisStatusUpdate(state, contextKey, status))
    },

    disconnectMantis: async (siteId) => {
      const requestGeneration = beginMantisMutation()
      const contextKey = getProviderRuntimeContextKey(get().settings)
      await mantisDisconnect(get().settings, siteId)
      if (
        !isCurrentMantisMutation(requestGeneration) ||
        !isCurrentMantisRuntimeContext(contextKey, get().settings)
      ) {
        return
      }
      const status = await mantisStatus(get().settings)
      if (
        !isCurrentMantisMutation(requestGeneration) ||
        !isCurrentMantisRuntimeContext(contextKey, get().settings)
      ) {
        return
      }
      set((state) =>
        mantisStatusUpdate(
          state,
          contextKey,
          status.connected
            ? status
            : DISCONNECTED_STATUS
        )
      )
    }
  }
}
