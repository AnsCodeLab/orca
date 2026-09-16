import { ensureElectronProxyFromEnvironment } from '../network/proxy-settings'
import { getMainHttpClient } from '../network/http-client'
import { withSpan } from '../observability/tracer'
import type { MantisSite } from '../../shared/mantis-types'

// Why: matches Jira's authenticated-request.ts choice of a non-browser
// User-Agent — Electron's net.fetch otherwise sends a Chrome UA, and some
// MantisBT deployments sit behind reverse-proxy rules keyed on it.
const MANTIS_API_USER_AGENT = 'Orca'

export type MantisClientForSite = {
  site: MantisSite
  authorization: string
}

export function apiBasePath(): string {
  return '/api/rest'
}

export class MantisApiError extends Error {
  status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.status = status
  }
}

// MantisBT REST auth is a single per-user API token sent as a Bearer token
// (RFC 6750); there is no Basic/PAT branching the way Jira Server/Cloud need.
export function authHeader(apiToken: string): string {
  return `Bearer ${apiToken}`
}

function describeErrorCause(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('cause' in error)) {
    return undefined
  }
  const cause = error.cause
  if (cause instanceof Error) {
    return `${cause.name}: ${cause.message}`
  }
  return cause === undefined ? undefined : String(cause)
}

async function mantisFetch(url: string, init: RequestInit): Promise<Response> {
  return withSpan(
    'mantis.request',
    async (span) => {
      span.setAttribute('mantis.siteUrl', new URL(url).origin)
      const httpClient = getMainHttpClient()
      const proxySession = httpClient.proxySession()
      await ensureElectronProxyFromEnvironment({
        ...(proxySession ? { proxySession } : {}),
        probeUrl: url
      }).catch((error) => {
        span.addEvent('mantis.proxySetupFailed', {
          errorName: error instanceof Error ? error.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error)
        })
      })
      try {
        // Why the port: on the desktop this is Electron's net.fetch, which follows
        // Chromium proxy/session state and avoids undici's stale keep-alive sockets
        // after VPN path changes. A host without Chromium gets Node's fetch instead.
        return await httpClient.fetch(url, init)
      } catch (error) {
        span.setAttribute(
          'mantis.transportErrorName',
          error instanceof Error ? error.name : typeof error
        )
        span.setAttribute(
          'mantis.transportErrorMessage',
          error instanceof Error ? error.message : String(error)
        )
        const cause = describeErrorCause(error)
        if (cause) {
          span.setAttribute('mantis.transportErrorCause', cause)
        }
        throw error
      }
    },
    { kind: 'client' }
  )
}

export async function requestWithCredentials(
  siteUrl: string,
  apiToken: string,
  path: string,
  init?: RequestInit
): Promise<unknown> {
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')
  headers.set('Content-Type', 'application/json')
  headers.set('User-Agent', MANTIS_API_USER_AGENT)
  headers.set('Authorization', authHeader(apiToken))
  const response = await mantisFetch(`${siteUrl}${path}`, {
    ...init,
    headers
  })
  if (!response.ok) {
    throw new MantisApiError(await readMantisError(response), response.status)
  }
  if (response.status === 204) {
    return null
  }
  return response.json()
}

async function readMantisError(response: Response): Promise<string> {
  try {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: response.json() returns `any`; `data.message` is read with a truthy check before use.
    const data = (await response.json()) as { message?: string }
    if (data.message) {
      return data.message
    }
  } catch {
    // Fall through to status text.
  }
  return response.statusText || `Mantis request failed (${response.status})`
}

export async function mantisRequest<T>(
  client: MantisClientForSite,
  path: string,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')
  headers.set('Content-Type', 'application/json')
  headers.set('User-Agent', MANTIS_API_USER_AGENT)
  headers.set('Authorization', client.authorization)
  const response = await mantisFetch(`${client.site.siteUrl}${path}`, {
    ...init,
    headers
  })
  if (!response.ok) {
    throw new MantisApiError(await readMantisError(response), response.status)
  }
  if (response.status === 204) {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: HTTP 204 has no body; every caller's `T` is expected to tolerate null for a no-content response.
    return null as T
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: response.json() returns `any`; `T` is the caller-declared expected shape for this endpoint, the same trust boundary as every typed REST client in this codebase.
  return (await response.json()) as T
}
