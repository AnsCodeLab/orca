import type { MantisIssue, MantisSiteSelection } from '../../shared/mantis-types'
import { acquire, release } from './request-queue'
import { apiBasePath, mantisRequest, MantisApiError } from './authenticated-request'
import { clearToken, getClients, isAuthError } from './client'
import { mapMantisIssue } from './mantis-issue-mapping'
import type { MantisRecord } from './mantis-record-pages'

type MantisIssueResponse = {
  issues?: MantisRecord[]
}

export async function getIssue(
  id: string,
  siteId?: MantisSiteSelection | null
): Promise<MantisIssue | null> {
  const entries = getClients(siteId)
  for (const entry of entries) {
    await acquire()
    try {
      const response = await mantisRequest<MantisIssueResponse>(
        entry,
        `${apiBasePath()}/issues/${encodeURIComponent(id)}`
      )
      const issue = response.issues?.[0]
      if (issue) {
        return mapMantisIssue(entry.site, issue)
      }
    } catch (error) {
      // Why: a 404 means this site doesn't have the issue, not a site
      // failure — keep trying the remaining connected sites.
      if (error instanceof MantisApiError && error.status === 404) {
        continue
      }
      if (isAuthError(error)) {
        clearToken(entry.site.id)
      } else {
        console.warn('[mantis] getIssue failed:', error)
      }
    } finally {
      release()
    }
  }
  return null
}
