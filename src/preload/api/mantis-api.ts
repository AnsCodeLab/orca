import type {
  MantisConnectionStatus,
  MantisIssue,
  MantisIssueFilter,
  MantisProject,
  MantisSiteSelection,
  MantisViewer
} from '../../shared/mantis-types'

export type MantisApi = {
  connect: (args: {
    siteUrl: string
    apiToken: string
  }) => Promise<{ ok: true; viewer: MantisViewer } | { ok: false; error: string }>
  disconnect: (args?: { siteId?: string }) => Promise<void>
  selectSite: (args: { siteId: MantisSiteSelection }) => Promise<MantisConnectionStatus>
  status: () => Promise<MantisConnectionStatus>
  testConnection: (args?: {
    siteId?: string
  }) => Promise<{ ok: true; viewer: MantisViewer } | { ok: false; error: string }>
  listIssues: (args?: {
    filter?: MantisIssueFilter
    limit?: number
    siteId?: MantisSiteSelection
  }) => Promise<MantisIssue[]>
  getIssue: (args: { id: string; siteId?: string }) => Promise<MantisIssue | null>
  listProjects: (args?: { siteId?: MantisSiteSelection }) => Promise<MantisProject[]>
}
