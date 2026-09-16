import { createHash } from 'node:crypto'
import type { MantisSite, MantisViewer } from '../../shared/mantis-types'
import { asRecord } from './mantis-record-pages'

export function normalizeMantisSiteUrl(siteUrl: string): string {
  const trimmed = siteUrl.trim()
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const url = new URL(withProtocol)
  url.pathname = url.pathname.replace(/\/+$/, '')
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

export function getSiteId(siteUrl: string, userId: string): string {
  return createHash('sha256').update(`${siteUrl}\n${userId}`).digest('base64url').slice(0, 24)
}

// Why: MantisBT's `rest_user_get_me` handler wraps the identity in a `user`
// object (some deployments instead return a `users` array). Accept either
// envelope, or an already-unwrapped record, so callers can pass the raw
// response body straight through without knowing which shape they got.

function extractMantisUser(data: Record<string, unknown>): Record<string, unknown> {
  if (data.user && typeof data.user === 'object') {
    return asRecord(data.user)
  }
  const users = data.users
  if (Array.isArray(users) && users.length > 0) {
    return asRecord(users[0])
  }
  return data
}

export function toViewer(data: unknown): MantisViewer {
  const user = extractMantisUser(asRecord(data))
  const id =
    typeof user.id === 'number' ? String(user.id) : typeof user.id === 'string' ? user.id : ''
  const username =
    typeof user.name === 'string'
      ? user.name
      : typeof user.username === 'string'
        ? user.username
        : ''
  const realName = typeof user.real_name === 'string' ? user.real_name : ''
  return {
    id,
    displayName: realName || username || id,
    email: typeof user.email === 'string' ? user.email : undefined
  }
}

export function siteToViewer(site: MantisSite | null): MantisViewer | null {
  if (!site) {
    return null
  }
  return {
    id: site.userId,
    displayName: site.displayName
  }
}
