import type { MantisProject, MantisSiteSelection } from '../../shared/mantis-types'
import { acquire, release } from './request-queue'
import { apiBasePath, mantisRequest } from './authenticated-request'
import { clearToken, getClients, isAuthError } from './client'
import { mapMantisProject } from './mantis-issue-mapping'
import {
  evictSiteTokenSafely,
  shouldSurfaceSiteFailure,
  withMantisDeadline
} from './mantis-read-failure'
import type { MantisReadFailure } from './mantis-read-failure'
import type { MantisRecord } from './mantis-record-pages'

const PROJECT_LIST_TIMEOUT_MS = 30_000

type MantisProjectsResponse = {
  projects?: MantisRecord[]
}

function projectDedupeKey(project: MantisProject): string {
  return `${project.siteId}:${project.id}`
}

export async function listProjects(
  siteId?: MantisSiteSelection | null,
  signal?: AbortSignal
): Promise<MantisProject[]> {
  const entries = getClients(siteId)
  if (entries.length === 0) {
    return []
  }
  const surfaceSiteFailure = shouldSurfaceSiteFailure(siteId, entries.length)
  const failures: (MantisReadFailure | undefined)[] = Array.from({ length: entries.length })
  const results = await withMantisDeadline(signal, PROJECT_LIST_TIMEOUT_MS, (requestSignal) =>
    Promise.all(
      entries.map(async (entry, index): Promise<MantisProject[]> => {
        await acquire(requestSignal)
        try {
          const response = await mantisRequest<MantisProjectsResponse>(
            entry,
            `${apiBasePath()}/projects`,
            { signal: requestSignal }
          )
          return (response.projects ?? []).map((project) => mapMantisProject(entry.site, project))
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
          console.warn('[mantis] listProjects failed:', error)
          failures[index] = { error, auth: authFailure }
          return []
        } finally {
          release()
        }
      })
    )
  )
  const recordedFailures = failures.filter(
    (failure): failure is MantisReadFailure => failure !== undefined
  )
  if (recordedFailures.length === entries.length) {
    throw (recordedFailures.find((failure) => !failure.auth) ?? recordedFailures[0]).error
  }
  // Why: project ids are unique only within one Mantis instance (id 1 is the
  // near-universal default project), so an 'all' fan-out dedupes on
  // siteId+id, not the bare id, or two different instances' distinct
  // projects would collide and one would be silently dropped.
  const byKey = new Map<string, MantisProject>()
  for (const project of results.flat()) {
    const key = projectDedupeKey(project)
    if (!byKey.has(key)) {
      byKey.set(key, project)
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name))
}
