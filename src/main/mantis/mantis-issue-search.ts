import { sortByUpdatedAtDescending } from '../../shared/updated-at-order'
import type { MantisIssue, MantisIssueFilter, MantisSiteSelection } from '../../shared/mantis-types'
import { acquire, release } from './request-queue'
import { apiBasePath, mantisRequest } from './authenticated-request'
import { clearToken, getClients, isAuthError } from './client'
import { mapMantisIssue } from './mantis-issue-mapping'
import { fetchAllIssuePages } from './mantis-record-pages'
import {
  evictSiteTokenSafely,
  shouldSurfaceSiteFailure,
  withMantisDeadline
} from './mantis-read-failure'
import { toViewer } from './site-identity'
import type { MantisReadFailure } from './mantis-read-failure'

const ISSUE_SEARCH_TIMEOUT_MS = 30_000

function clampLimit(limit: number | undefined, fallback = 30): number {
  return Math.min(Math.max(1, Number.isFinite(limit) ? Number(limit) : fallback), 100)
}

export async function listIssues(
  filter: MantisIssueFilter = 'assigned',
  limit = 30,
  siteId?: MantisSiteSelection | null,
  signal?: AbortSignal
): Promise<MantisIssue[]> {
  const entries = getClients(siteId)
  if (entries.length === 0) {
    return []
  }
  const safeLimit = clampLimit(limit)
  const surfaceSiteFailure = shouldSurfaceSiteFailure(siteId, entries.length)
  const failures: (MantisReadFailure | undefined)[] = Array.from({ length: entries.length })
  const results = await withMantisDeadline(signal, ISSUE_SEARCH_TIMEOUT_MS, (requestSignal) =>
    Promise.all(
      entries.map(async (entry, index): Promise<MantisIssue[]> => {
        await acquire(requestSignal)
        try {
          // Mantis's REST API has no server-side handler_id/reporter_id filter, so
          // 'assigned'/'reported' resolve the viewer's numeric id once per site here
          // and filter the fetched page client-side below.
          const viewerId =
            filter === 'all'
              ? null
              : toViewer(
                  await mantisRequest(entry, `${apiBasePath()}/users/me`, { signal: requestSignal })
                ).id
          const records = await fetchAllIssuePages(
            entry,
            (page, pageSize) => {
              const params = new URLSearchParams({
                page: String(page),
                page_size: String(pageSize)
              })
              return `${apiBasePath()}/issues?${params.toString()}`
            },
            50,
            requestSignal
          )
          const issues = records.map((record) => mapMantisIssue(entry.site, record))
          if (filter === 'assigned') {
            return issues.filter((issue) => issue.handler?.id === viewerId)
          }
          if (filter === 'reported') {
            return issues.filter((issue) => issue.reporter?.id === viewerId)
          }
          return issues
        } catch (error) {
          if (requestSignal.aborted) {
            // Abandoned by the caller: not a site failure, so don't clear tokens or mask a real one.
            throw error
          }
          const authFailure = isAuthError(error)
          if (authFailure) {
            evictSiteTokenSafely(clearToken, entry.site.id)
          }
          if (surfaceSiteFailure) {
            throw error
          }
          console.warn('[mantis] listIssues failed:', error)
          failures[index] = { error, auth: authFailure }
          return []
        } finally {
          release()
        }
      })
    )
  )
  // 'all' fan-out: only surface an error when every connected site failed, so a
  // partial success (or a genuinely empty result) is not reported as an error.
  const recordedFailures = failures.filter(
    (failure): failure is MantisReadFailure => failure !== undefined
  )
  if (recordedFailures.length === entries.length && entries.length > 0) {
    throw (recordedFailures.find((failure) => !failure.auth) ?? recordedFailures[0]).error
  }
  return sortByUpdatedAtDescending(results.flat()).slice(0, safeLimit)
}
