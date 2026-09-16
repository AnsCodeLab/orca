import { ipcMain } from 'electron'
import { connect, disconnect, getStatus, selectSite, testConnection } from '../mantis/client'
import { _resetPreflightCache } from './preflight'
import { getIssue, listIssues, listProjects } from '../mantis/issues'
import type {
  MantisConnectArgs,
  MantisIssueFilter,
  MantisSiteSelection
} from '../../shared/mantis-types'

const VALID_FILTERS = new Set<MantisIssueFilter>(['assigned', 'reported', 'all'])

function normalizeSiteId(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeSiteSelection(value: unknown): MantisSiteSelection | undefined {
  const siteId = normalizeSiteId(value)
  return siteId as MantisSiteSelection | undefined
}

function clampLimit(value: unknown, fallback = 30): number {
  const limit = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(Math.max(1, limit), 100)
}

/** Registers every `mantis:*` IPC handler on the main process. */
export function registerMantisHandlers(): void {
  ipcMain.handle('mantis:connect', async (_event, args: MantisConnectArgs) => {
    if (typeof args?.siteUrl !== 'string' || typeof args?.apiToken !== 'string') {
      return { ok: false, error: 'Site URL and API token are required.' }
    }
    const result = await connect({
      siteUrl: args.siteUrl,
      apiToken: args.apiToken
    })
    if (result.ok) {
      _resetPreflightCache()
    }
    return result
  })

  ipcMain.handle('mantis:disconnect', async (_event, args?: { siteId?: string }) => {
    disconnect(normalizeSiteId(args?.siteId))
    _resetPreflightCache()
  })

  ipcMain.handle('mantis:selectSite', async (_event, args: { siteId: MantisSiteSelection }) => {
    const siteId = normalizeSiteSelection(args?.siteId)
    if (!siteId) {
      return getStatus()
    }
    return selectSite(siteId)
  })

  ipcMain.handle('mantis:status', async () => {
    return getStatus()
  })

  ipcMain.handle('mantis:testConnection', async (_event, args?: { siteId?: string }) => {
    return testConnection(normalizeSiteId(args?.siteId))
  })

  ipcMain.handle(
    'mantis:listIssues',
    async (
      _event,
      args?: { filter?: MantisIssueFilter; limit?: number; siteId?: MantisSiteSelection }
    ) => {
      const filter = VALID_FILTERS.has(args?.filter as MantisIssueFilter)
        ? (args!.filter as MantisIssueFilter)
        : undefined
      return listIssues(filter, clampLimit(args?.limit), normalizeSiteSelection(args?.siteId))
    }
  )

  ipcMain.handle('mantis:getIssue', async (_event, args: { id: string; siteId?: string }) => {
    if (typeof args?.id !== 'string' || !args.id.trim()) {
      return null
    }
    return getIssue(args.id.trim(), normalizeSiteId(args.siteId))
  })

  ipcMain.handle(
    'mantis:listProjects',
    async (_event, args?: { siteId?: MantisSiteSelection }) => {
      return listProjects(normalizeSiteSelection(args?.siteId))
    }
  )
}
