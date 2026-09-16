import type { MantisProject, MantisSiteSelection } from '../../shared/mantis-types'
import { acquire, release } from './request-queue'
import { apiBasePath, mantisRequest } from './authenticated-request'
import { clearToken, getClients, isAuthError } from './client'
import { mapMantisProject } from './mantis-issue-mapping'
import type { MantisRecord } from './mantis-record-pages'

type MantisProjectsResponse = {
  projects?: MantisRecord[]
}

export async function listProjects(siteId?: MantisSiteSelection | null): Promise<MantisProject[]> {
  const entries = getClients(siteId)
  if (entries.length === 0) {
    return []
  }
  const results = await Promise.all(
    entries.map(async (entry): Promise<MantisProject[]> => {
      await acquire()
      try {
        const response = await mantisRequest<MantisProjectsResponse>(
          entry,
          `${apiBasePath()}/projects`
        )
        return (response.projects ?? []).map((project) => mapMantisProject(project))
      } catch (error) {
        if (isAuthError(error)) {
          clearToken(entry.site.id)
        } else {
          console.warn('[mantis] listProjects failed:', error)
        }
        return []
      } finally {
        release()
      }
    })
  )
  // Why: an 'all' selection can query the same project id from more than one
  // site if two connected sites point at the same Mantis instance.
  const byId = new Map<string, MantisProject>()
  for (const project of results.flat()) {
    if (!byId.has(project.id)) {
      byId.set(project.id, project)
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
}
