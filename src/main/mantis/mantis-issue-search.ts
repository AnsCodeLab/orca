import { sortByUpdatedAtDescending } from '../../shared/updated-at-order'
import type { MantisIssue, MantisIssueFilter, MantisSiteSelection } from '../../shared/mantis-types'
import { acquire, release } from './request-queue'
import { apiBasePath, mantisRequest } from './authenticated-request'
import { clearToken, getClients, isAuthError } from './client'
import { mapMantisIssue } from './mantis-issue-mapping'
import { fetchAllIssuePages } from './mantis-record-pages'
import { toViewer } from './site-identity'

function clampLimit(limit: number | undefined, fallback = 30): number {
  return Math.min(Math.max(1, Number.isFinite(limit) ? Number(limit) : fallback), 100)
}

export async function listIssues(
  filter: MantisIssueFilter = 'assigned',
  limit = 30,
  siteId?: MantisSiteSelection | null
): Promise<MantisIssue[]> {
  const entries = getClients(siteId)
  if (entries.length === 0) {
    return []
  }
  const safeLimit = clampLimit(limit)
  const results = await Promise.all(
    entries.map(async (entry): Promise<MantisIssue[]> => {
      await acquire()
      try {
        // Mantis's REST API has no server-side handler_id/reporter_id filter, so
        // 'assigned'/'reported' resolve the viewer's numeric id once per site here
        // and filter the fetched page client-side below.
        const viewerId =
          filter === 'all'
            ? null
            : toViewer(await mantisRequest(entry, `${apiBasePath()}/users/me`)).id
        const records = await fetchAllIssuePages(entry, (page, pageSize) => {
          const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
          return `${apiBasePath()}/issues?${params.toString()}`
        })
        const issues = records.map((record) => mapMantisIssue(entry.site, record))
        if (filter === 'assigned') {
          return issues.filter((issue) => issue.handler?.id === viewerId)
        }
        if (filter === 'reported') {
          return issues.filter((issue) => issue.reporter?.id === viewerId)
        }
        return issues
      } catch (error) {
        if (isAuthError(error)) {
          clearToken(entry.site.id)
        } else {
          console.warn('[mantis] listIssues failed:', error)
        }
        return []
      } finally {
        release()
      }
    })
  )
  return sortByUpdatedAtDescending(results.flat()).slice(0, safeLimit)
}
