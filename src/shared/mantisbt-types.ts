// MantisBT REST API auth is a single per-user API token sent as
// `Authorization: Bearer <token>` (RFC 6750) — there is no separate
// email/username to key an identity on the way Jira Cloud keys on email.
// A connected site is instead keyed on siteUrl + the numeric user id
// resolved from `GET /api/rest/users/me` after connecting.
export type MantisBTSite = {
  id: string
  siteUrl: string
  userId: string
  displayName: string
}

export type MantisBTViewer = {
  id: string
  displayName: string
  email?: string
}

export type MantisBTSiteSelection = (string & {}) | 'all'

export type MantisBTConnectionStatus = {
  connected: boolean
  viewer: MantisBTViewer | null
  sites: MantisBTSite[]
  activeSiteId: string | null
  selectedSiteId: MantisBTSiteSelection | null
  credentialError?: string
}

export type MantisBTConnectArgs = {
  siteUrl: string
  apiToken: string
}

export type MantisBTIssueFilter = 'assigned' | 'reported' | 'all'

// Why: `id` is only unique within one MantisBT instance — a project id of 1 is
// the near-universal default project on a fresh install, so two connected
// sites routinely collide on it. `siteId` makes the pair globally unique.
export type MantisBTProject = {
  id: string
  siteId: string
  name: string
}

export type MantisBTIssueStatus = {
  id: string
  name: string
  label: string
}

export type MantisBTIssuePriority = {
  id: string
  name: string
  label: string
}

export type MantisBTUser = {
  id: string
  name: string
  realName?: string
}

export type MantisBTIssue = {
  id: string
  summary: string
  description?: string
  project: MantisBTProject
  status: MantisBTIssueStatus
  priority?: MantisBTIssuePriority
  reporter?: MantisBTUser
  handler?: MantisBTUser | null
  createdAt: string
  updatedAt: string
  siteId: string
  siteName: string
  url: string
}
