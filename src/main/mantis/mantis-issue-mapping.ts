import type {
  MantisIssue,
  MantisIssuePriority,
  MantisIssueStatus,
  MantisProject,
  MantisSite,
  MantisUser
} from '../../shared/mantis-types'
import { asRecord, asString } from './mantis-record-pages'

function asIdentifier(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function mapMantisUser(value: unknown): MantisUser | undefined {
  const user = asRecord(value)
  const id = asIdentifier(user.id)
  if (!id) {
    return undefined
  }
  return {
    id,
    name: asString(user.name, asString(user.username, id)),
    realName: asString(user.real_name) || undefined
  }
}

function mapMantisStatus(value: unknown): MantisIssueStatus {
  const status = asRecord(value)
  return {
    id: asIdentifier(status.id),
    name: asString(status.name, 'Unknown'),
    label: asString(status.label, asString(status.name, 'Unknown'))
  }
}

function mapMantisPriority(value: unknown): MantisIssuePriority | undefined {
  const priority = asRecord(value)
  const id = asIdentifier(priority.id)
  if (!id) {
    return undefined
  }
  return {
    id,
    name: asString(priority.name, 'Priority'),
    label: asString(priority.label, asString(priority.name, 'Priority'))
  }
}

export function mapMantisProject(value: unknown): MantisProject {
  const project = asRecord(value)
  const id = asIdentifier(project.id)
  return {
    id,
    name: asString(project.name, id || 'Untitled project')
  }
}

export function issueUrl(site: MantisSite, id: string): string {
  return `${site.siteUrl}/view.php?id=${id}`
}

export function mapMantisIssue(site: MantisSite, raw: Record<string, unknown>): MantisIssue {
  const id = asIdentifier(raw.id)
  // Why: created_at/updated_at absent would otherwise silently report the
  // lookup time as the issue's timestamps rather than surfacing the gap
  // (mirrors Jira's ISSUE_SUMMARY_FIELDS "now" fallback rationale).
  const now = new Date().toISOString()
  return {
    id,
    summary: asString(raw.summary),
    description: asString(raw.description) || undefined,
    project: mapMantisProject(raw.project),
    status: mapMantisStatus(raw.status),
    priority: mapMantisPriority(raw.priority),
    reporter: mapMantisUser(raw.reporter),
    handler: raw.handler === null ? null : mapMantisUser(raw.handler),
    createdAt: asString(raw.created_at, now),
    updatedAt: asString(raw.updated_at, now),
    siteId: site.id,
    siteName: site.displayName,
    url: issueUrl(site, id)
  }
}
