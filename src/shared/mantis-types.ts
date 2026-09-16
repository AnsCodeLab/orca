// MantisBT REST API auth is a single per-user API token sent as
// `Authorization: Bearer <token>` (RFC 6750) — there is no separate
// email/username to key an identity on the way Jira Cloud keys on email.
// A connected site is instead keyed on siteUrl + the numeric user id
// resolved from `GET /api/rest/users/me` after connecting.
export type MantisSite = {
  id: string
  siteUrl: string
  userId: string
  displayName: string
}

export type MantisViewer = {
  id: string
  displayName: string
  email?: string
}

export type MantisSiteSelection = (string & {}) | 'all'

export type MantisConnectionStatus = {
  connected: boolean
  viewer: MantisViewer | null
  sites: MantisSite[]
  activeSiteId: string | null
  selectedSiteId: MantisSiteSelection | null
  credentialError?: string
}

export type MantisConnectArgs = {
  siteUrl: string
  apiToken: string
}

export type MantisIssueFilter = 'assigned' | 'reported' | 'all'

// Why: `id` is only unique within one Mantis instance — a project id of 1 is
// the near-universal default project on a fresh install, so two connected
// sites routinely collide on it. `siteId` makes the pair globally unique.
export type MantisProject = {
  id: string
  siteId: string
  name: string
}

export type MantisIssueStatus = {
  id: string
  name: string
  label: string
}

export type MantisIssuePriority = {
  id: string
  name: string
  label: string
}

export type MantisUser = {
  id: string
  name: string
  realName?: string
}

export type MantisIssue = {
  id: string
  summary: string
  description?: string
  project: MantisProject
  status: MantisIssueStatus
  priority?: MantisIssuePriority
  reporter?: MantisUser
  handler?: MantisUser | null
  createdAt: string
  updatedAt: string
  siteId: string
  siteName: string
  url: string
}
