import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import type * as Os from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const OLD_FETCH = globalThis.fetch
const { closeAllConnectionsMock, netFetchMock, resolveProxyMock, setProxyMock } = vi.hoisted(
  () => ({
    closeAllConnectionsMock: vi.fn(),
    netFetchMock: vi.fn(),
    resolveProxyMock: vi.fn(),
    setProxyMock: vi.fn()
  })
)

type SafeStorageMockOptions = {
  encryptionAvailable?: boolean
  decryptString?: (value: Buffer) => string
}

type MantisSiteFixture = {
  siteUrl?: string
  userId?: string
  displayName?: string
}

let tempHome = ''
let fetchMock: ReturnType<typeof vi.fn>

function mkdtempLike(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix))
}

function tokenPathForSite(siteId: string): string {
  return join(
    tempHome,
    '.orca',
    'mantis-tokens',
    `${Buffer.from(siteId).toString('base64url')}.enc`
  )
}

function writeMantisFiles(
  siteId: string,
  token: string | Buffer,
  fixture: MantisSiteFixture = {}
): void {
  const orcaDir = join(tempHome, '.orca')
  mkdirSync(join(orcaDir, 'mantis-tokens'), { recursive: true })
  writeFileSync(
    join(orcaDir, 'mantis-sites.json'),
    JSON.stringify(
      {
        version: 1,
        activeSiteId: siteId,
        selectedSiteId: siteId,
        sites: [
          {
            id: siteId,
            siteUrl: fixture.siteUrl ?? 'https://mantis.example.com',
            userId: fixture.userId ?? '42',
            displayName: fixture.displayName ?? 'William'
          }
        ]
      },
      null,
      2
    ),
    { encoding: 'utf-8' }
  )
  writeFileSync(tokenPathForSite(siteId), token)
}

function writeMultiSiteFiles(
  sites: { id: string; token: string | Buffer }[],
  selectedSiteId: string
): void {
  const orcaDir = join(tempHome, '.orca')
  mkdirSync(join(orcaDir, 'mantis-tokens'), { recursive: true })
  writeFileSync(
    join(orcaDir, 'mantis-sites.json'),
    JSON.stringify(
      {
        version: 1,
        activeSiteId: sites[0]?.id ?? null,
        selectedSiteId,
        sites: sites.map((site) => ({
          id: site.id,
          siteUrl: `https://${site.id}.example.com`,
          userId: `user-${site.id}`,
          displayName: site.id
        }))
      },
      null,
      2
    ),
    { encoding: 'utf-8' }
  )
  for (const site of sites) {
    writeFileSync(tokenPathForSite(site.id), site.token)
  }
}

async function loadClientModule(options: SafeStorageMockOptions = {}) {
  vi.resetModules()
  vi.doMock('electron', () => ({
    net: { fetch: netFetchMock },
    session: {
      defaultSession: {
        closeAllConnections: closeAllConnectionsMock,
        resolveProxy: resolveProxyMock,
        setProxy: setProxyMock
      }
    }
  }))
  // Why here and not in beforeEach: vi.resetModules() above gives the http-client module
  // a fresh singleton, so the port must be installed on that instance.
  const { setMainHttpClient } = await import('../network/http-client')
  setMainHttpClient({
    fetch: (url, init) => netFetchMock(url, init),
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fixture implements only resolveProxy/setProxy, the two proxySession operations mantisFetch calls.
    proxySession: () => ({ resolveProxy: resolveProxyMock, setProxy: setProxyMock }) as never
  })
  const { setSecretStore } = await import('../../shared/secret-store')
  setSecretStore({
    isEncryptionAvailable: () => options.encryptionAvailable ?? false,
    encryptString: (value) => Buffer.from(value),
    decryptString: options.decryptString ?? ((value) => value.toString('utf-8')),
    describeProtectionGap: () => null
  })
  vi.doMock('os', async () => {
    const actual = await vi.importActual<typeof Os>('os')
    return { ...actual, homedir: () => tempHome }
  })

  // One import call per reset so the split modules share a single graph (and
  // thus one copy of the request queue / credential caches) per test.
  const [client, queue, api] = await Promise.all([
    import('./client'),
    import('./request-queue'),
    import('./authenticated-request')
  ])
  return { ...client, ...queue, ...api }
}

beforeEach(() => {
  tempHome = mkdtempLike('orca-mantis-client-')
  fetchMock = vi.fn(async () => {
    throw new Error('fetch should not be called')
  })
  netFetchMock.mockReset()
  resolveProxyMock.mockReset()
  setProxyMock.mockReset()
  closeAllConnectionsMock.mockReset()
  resolveProxyMock.mockResolvedValue('DIRECT')
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: authenticated-request.ts routes every call through httpClient.fetch (netFetchMock); this stub only guards against an accidental fallback to the raw global.
  globalThis.fetch = fetchMock as typeof fetch
  vi.restoreAllMocks()
})

afterEach(() => {
  globalThis.fetch = OLD_FETCH
})

describe('Mantis client credential storage', () => {
  it('connects successfully and persists the site and token', async () => {
    netFetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: { id: 42, name: 'wquintal', real_name: 'William', email: 'william@example.com' }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    const mantis = await loadClientModule({ encryptionAvailable: true })

    await expect(
      mantis.connect({ siteUrl: 'mantis.example.com', apiToken: 'token-alpha' })
    ).resolves.toMatchObject({
      ok: true,
      viewer: { id: '42', displayName: 'William', email: 'william@example.com' }
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(netFetchMock).toHaveBeenCalledWith(
      'https://mantis.example.com/api/rest/users/me',
      expect.objectContaining({ headers: expect.any(Headers) })
    )
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: authenticated-request.ts always constructs RequestInit.headers as a Headers instance before calling fetch.
    const headers = netFetchMock.mock.calls[0]?.[1]?.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer token-alpha')
    expect(headers.get('User-Agent')).toBe('Orca')

    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: this is exactly the shape writeSiteFile serializes; the assertions below verify the actual field values.
    const stored = JSON.parse(
      readFileSync(join(tempHome, '.orca', 'mantis-sites.json'), 'utf-8')
    ) as {
      sites: { id: string; userId: string; displayName: string }[]
    }
    expect(stored.sites).toHaveLength(1)
    expect(stored.sites[0]).toMatchObject({ userId: '42', displayName: 'William' })
    const storedSiteId = stored.sites[0]?.id
    expect(storedSiteId).toBeTruthy()
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: guarded by the `toBeTruthy()` assertion on the previous line.
    expect(existsSync(tokenPathForSite(storedSiteId as string))).toBe(true)
  })

  it('reports a connection failure for an invalid token', async () => {
    netFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Access denied' }), {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'Content-Type': 'application/json' }
      })
    )
    const mantis = await loadClientModule()

    await expect(
      mantis.connect({ siteUrl: 'mantis.example.com', apiToken: 'bad-token' })
    ).resolves.toEqual({ ok: false, error: 'Access denied' })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(mantis.getStatus()).toMatchObject({ connected: false })
  })

  it('requires an API token to connect', async () => {
    const mantis = await loadClientModule()

    await expect(
      mantis.connect({ siteUrl: 'mantis.example.com', apiToken: '  ' })
    ).resolves.toEqual({ ok: false, error: 'API token is required.' })
    expect(netFetchMock).not.toHaveBeenCalled()
  })

  it('reflects persisted sites in getStatus', async () => {
    const siteId = 'site-alpha'
    writeMantisFiles(siteId, 'token-alpha')
    const mantis = await loadClientModule({ encryptionAvailable: true })

    expect(mantis.getStatus()).toMatchObject({
      connected: true,
      activeSiteId: siteId,
      selectedSiteId: siteId,
      sites: [{ id: siteId, displayName: 'William' }],
      viewer: { id: '42', displayName: 'William' }
    })
  })

  it('removes a site token and site-file entry on disconnect', async () => {
    const siteId = 'site-alpha'
    const tokenPath = tokenPathForSite(siteId)
    writeMantisFiles(siteId, 'token-alpha')
    const mantis = await loadClientModule({ encryptionAvailable: true })
    expect(mantis.getStatus().connected).toBe(true)

    mantis.disconnect(siteId)

    expect(existsSync(tokenPath)).toBe(false)
    expect(mantis.getStatus()).toMatchObject({ connected: false, sites: [] })
  })

  it('supports selectSite and getClients across multiple connected sites', async () => {
    writeMultiSiteFiles(
      [
        { id: 'alpha', token: 'token-alpha' },
        { id: 'beta', token: 'token-beta' }
      ],
      'alpha'
    )
    const mantis = await loadClientModule({ encryptionAvailable: true })

    expect(
      mantis
        .getClients('all')
        .map((client) => client.site.id)
        .sort()
    ).toEqual(['alpha', 'beta'])
    expect(mantis.getClients('beta').map((client) => client.site.id)).toEqual(['beta'])

    const status = mantis.selectSite('beta')
    expect(status.selectedSiteId).toBe('beta')
    expect(status.activeSiteId).toBe('beta')
    expect(mantis.getClients().map((client) => client.site.id)).toEqual(['beta'])
  })

  it('clears the token and removes the site on clearToken', async () => {
    const siteId = 'site-alpha'
    const tokenPath = tokenPathForSite(siteId)
    writeMantisFiles(siteId, 'token-alpha')
    const mantis = await loadClientModule({ encryptionAvailable: true })
    expect(mantis.getStatus().connected).toBe(true)

    mantis.clearToken(siteId)

    expect(existsSync(tokenPath)).toBe(false)
    expect(mantis.getStatus()).toMatchObject({ connected: false, sites: [] })
  })

  it('classifies only 401 responses as auth errors', async () => {
    const mantis = await loadClientModule()

    expect(mantis.isAuthError(new mantis.MantisApiError('Unauthorized', 401))).toBe(true)
    expect(mantis.isAuthError(new mantis.MantisApiError('Forbidden', 403))).toBe(false)
    expect(mantis.isAuthError(new Error('boom'))).toBe(false)
  })

  it('does not pass encrypted safeStorage bytes to Mantis when encryption is unavailable', async () => {
    const siteId = 'site-alpha'
    const tokenPath = tokenPathForSite(siteId)
    writeMantisFiles(siteId, Buffer.from([0x76, 0x31, 0x30, 0xff, 0xfe]))
    const mantis = await loadClientModule({ encryptionAvailable: false })

    await expect(mantis.testConnection(siteId)).resolves.toEqual({
      ok: false,
      error:
        'Could not decrypt saved Mantis credential. Approve Keychain access or reconnect Mantis.'
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(existsSync(tokenPath)).toBe(true)
    expect(mantis.getStatus()).toMatchObject({
      connected: true,
      credentialError:
        'Could not decrypt saved Mantis credential. Approve Keychain access or reconnect Mantis.',
      sites: [{ id: siteId }]
    })
  })

  it('bridges proxy environment settings before Mantis connect requests', async () => {
    netFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { id: 7, name: 'ada', real_name: 'Ada' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    const mantis = await loadClientModule()

    await expect(
      mantis.connect({ siteUrl: 'mantis.example.com', apiToken: 'token-alpha' })
    ).resolves.toMatchObject({ ok: true, viewer: { displayName: 'Ada' } })

    expect(resolveProxyMock).toHaveBeenCalledWith('https://mantis.example.com/api/rest/users/me')
    expect(netFetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('evicts the token when testConnection receives a 401', async () => {
    const siteId = 'site-alpha'
    writeMantisFiles(siteId, 'token-alpha')
    netFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Access denied' }), {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'Content-Type': 'application/json' }
      })
    )
    const mantis = await loadClientModule({ encryptionAvailable: true })

    await expect(mantis.testConnection(siteId)).resolves.toMatchObject({ ok: false })

    expect(existsSync(tokenPathForSite(siteId))).toBe(false)
    expect(mantis.getStatus()).toMatchObject({ connected: false, sites: [] })
  })

  it('propagates a real deletion failure from disconnect instead of reporting success', async () => {
    const siteId = 'site-alpha'
    writeMantisFiles(siteId, 'token-alpha')
    const tokenPath = tokenPathForSite(siteId)
    // Replace the token file with a directory so unlinkSync fails with
    // EISDIR — a real non-ENOENT deletion failure, distinct from "already
    // gone", that must not be swallowed as a successful disconnect.
    unlinkSync(tokenPath)
    mkdirSync(tokenPath)
    const mantis = await loadClientModule({ encryptionAvailable: true })
    expect(mantis.getStatus().connected).toBe(true)

    expect(() => mantis.disconnect(siteId)).toThrow()

    // Deletion genuinely failed — the directory is still there, and the
    // site is not silently reported as disconnected.
    expect(existsSync(tokenPath)).toBe(true)
  })

  it('surfaces the HTTPS-required error message when connecting over plain HTTP', async () => {
    const mantis = await loadClientModule()

    await expect(
      mantis.connect({ siteUrl: 'http://mantis.example.com', apiToken: 'token-alpha' })
    ).resolves.toEqual({
      ok: false,
      error: 'Enter an HTTPS Mantis site URL (HTTP is only allowed for localhost).'
    })
    expect(netFetchMock).not.toHaveBeenCalled()
  })
})
