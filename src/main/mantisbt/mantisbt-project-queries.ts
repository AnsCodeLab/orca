import type { MantisBTProject, MantisBTSiteSelection } from '../../shared/mantisbt-types'
import { acquire, release } from './request-queue'
import { apiBasePath, mantisBTRequest } from './authenticated-request'
import { clearToken, getClients, isAuthError } from './client'
import { mapMantisBTProject } from './mantisbt-issue-mapping'
import {
  evictSiteTokenSafely,
  shouldSurfaceSiteFailure,
  withMantisBTDeadline
} from './mantisbt-read-failure'
import type { MantisBTReadFailure } from './mantisbt-read-failure'
import type { MantisBTRecord } from './mantisbt-record-pages'

const PROJECT_LIST_TIMEOUT_MS = 30_000

type MantisBTProjectsResponse = {
  projects?: MantisBTRecord[]
}

function projectDedupeKey(project: MantisBTProject): string {
  return `${project.siteId}:${project.id}`
}

export async function listProjects(
  siteId?: MantisBTSiteSelection | null,
  signal?: AbortSignal
): Promise<MantisBTProject[]> {
  const entries = getClients(siteId)
  if (entries.length === 0) {
    return []
  }
  const surfaceSiteFailure = shouldSurfaceSiteFailure(siteId, entries.length)
  const failures: (MantisBTReadFailure | undefined)[] = Array.from({ length: entries.length })
  const results = await withMantisBTDeadline(signal, PROJECT_LIST_TIMEOUT_MS, (requestSignal) =>
    Promise.all(
      entries.map(async (entry, index): Promise<MantisBTProject[]> => {
        await acquire(requestSignal)
        try {
          const response = await mantisBTRequest<MantisBTProjectsResponse>(
            entry,
            `${apiBasePath()}/projects`,
            { signal: requestSignal }
          )
          return (response.projects ?? []).map((project) => mapMantisBTProject(entry.site, project))
        } catch (error) {
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
          console.warn('[mantisBT] listProjects failed:', error)
          failures[index] = { error, auth: authFailure }
          return []
        } finally {
          release()
        }
      })
    )
  )
  const recordedFailures = failures.filter(
    (failure): failure is MantisBTReadFailure => failure !== undefined
  )
  if (recordedFailures.length === entries.length) {
    throw (recordedFailures.find((failure) => !failure.auth) ?? recordedFailures[0]).error
  }
  // Why: project ids are unique only within one MantisBT instance (id 1 is the
  // near-universal default project), so an 'all' fan-out dedupes on
  // siteId+id, not the bare id, or two different instances' distinct
  // projects would collide and one would be silently dropped.
  const byKey = new Map<string, MantisBTProject>()
  for (const project of results.flat()) {
    const key = projectDedupeKey(project)
    if (!byKey.has(key)) {
      byKey.set(key, project)
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name))
}
