import type { MantisIssue, MantisSiteSelection } from '../../shared/mantis-types'
import { acquire, release } from './request-queue'
import { apiBasePath, mantisRequest, MantisApiError } from './authenticated-request'
import { clearToken, getClients, isAuthError } from './client'
import { mapMantisIssue } from './mantis-issue-mapping'
import {
  evictSiteTokenSafely,
  shouldSurfaceSiteFailure,
  withMantisDeadline
} from './mantis-read-failure'
import type { MantisRecord } from './mantis-record-pages'

const ISSUE_READ_TIMEOUT_MS = 30_000

type MantisIssueResponse = {
  issues?: MantisRecord[]
}

export async function getIssue(
  id: string,
  siteId?: MantisSiteSelection | null,
  signal?: AbortSignal
): Promise<MantisIssue | null> {
  const entries = getClients(siteId)
  const surfaceSiteFailure = shouldSurfaceSiteFailure(siteId, entries.length)
  return withMantisDeadline(signal, ISSUE_READ_TIMEOUT_MS, async (requestSignal) => {
    let sawFailure = false
    let firstNonAuthFailure: unknown
    for (const entry of entries) {
      await acquire(requestSignal)
      try {
        const response = await mantisRequest<MantisIssueResponse>(
          entry,
          `${apiBasePath()}/issues/${encodeURIComponent(id)}`,
          { signal: requestSignal }
        )
        const issue = response.issues?.[0]
        if (issue) {
          return mapMantisIssue(entry.site, issue)
        }
      } catch (error) {
        // Why: a 404 means this site doesn't have the issue, not a site
        // failure — it does not count toward "every connected site failed".
        if (error instanceof MantisApiError && error.status === 404) {
          continue
        }
        if (requestSignal.aborted) {
          throw error
        }
        const authFailure = isAuthError(error)
        if (authFailure) {
          evictSiteTokenSafely(clearToken, entry.site.id)
        }
        if (surfaceSiteFailure) {
          throw error
        }
        sawFailure = true
        firstNonAuthFailure ??= authFailure ? undefined : error
        console.warn('[mantis] getIssue failed:', error)
      } finally {
        release()
      }
    }
    if (sawFailure && entries.length > 0) {
      throw firstNonAuthFailure ?? new Error('Could not reach any connected Mantis site.')
    }
    return null
  })
}
