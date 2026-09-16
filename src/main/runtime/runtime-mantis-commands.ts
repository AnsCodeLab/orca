import type {
  MantisConnectArgs,
  MantisConnectionStatus,
  MantisIssue,
  MantisIssueFilter,
  MantisProject,
  MantisSiteSelection,
  MantisViewer
} from '../../shared/mantis-types'
import { connect, disconnect, getStatus, selectSite, testConnection } from '../mantis/client'
import { getIssue, listIssues, listProjects } from '../mantis/issues'

type MantisConnectResult = { ok: true; viewer: MantisViewer } | { ok: false; error: string }

export class RuntimeMantisCommands {
  mantisConnect(args: MantisConnectArgs): Promise<MantisConnectResult> {
    return connect(args)
  }

  mantisDisconnect(siteId?: string): { ok: true } {
    disconnect(siteId)
    return { ok: true }
  }

  mantisSelectSite(siteId: MantisSiteSelection): MantisConnectionStatus {
    return selectSite(siteId)
  }

  mantisStatus(): MantisConnectionStatus {
    return getStatus()
  }

  mantisTestConnection(siteId?: string): Promise<MantisConnectResult> {
    return testConnection(siteId)
  }

  mantisListIssues(
    filter?: MantisIssueFilter,
    limit = 30,
    siteId?: MantisSiteSelection | null,
    signal?: AbortSignal
  ): Promise<MantisIssue[]> {
    return listIssues(filter, limit, siteId, signal)
  }

  mantisGetIssue(
    id: string,
    siteId?: MantisSiteSelection | null,
    signal?: AbortSignal
  ): Promise<MantisIssue | null> {
    return getIssue(id, siteId, signal)
  }

  mantisListProjects(
    siteId?: MantisSiteSelection | null,
    signal?: AbortSignal
  ): Promise<MantisProject[]> {
    return listProjects(siteId, signal)
  }
}
