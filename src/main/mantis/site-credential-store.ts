import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getSecretStore } from '../../shared/secret-store'
import {
  CredentialDecryptionError,
  credentialFileHasContent,
  readStoredCredentialToken
} from '../integration-credential-file'
import type { MantisSite, MantisSiteSelection } from '../../shared/mantis-types'

export type MantisSiteFile = {
  version: 1
  activeSiteId: string | null
  selectedSiteId: MantisSiteSelection | null
  sites: MantisSite[]
}

let cachedSiteFile: MantisSiteFile | null = null
let siteFileLoaded = false
const cachedTokens = new Map<string, string>()
// Why: decrypt failures are recorded per site so getStatus can explain
// failing reads without re-touching the keychain on every status poll.
export const credentialErrors = new Map<string, string>()

function getOrcaDir(): string {
  return join(homedir(), '.orca')
}

function getSiteFilePath(): string {
  return join(getOrcaDir(), 'mantis-sites.json')
}

function getTokenDir(): string {
  return join(getOrcaDir(), 'mantis-tokens')
}

function getTokenPath(siteId: string): string {
  return join(getTokenDir(), `${Buffer.from(siteId).toString('base64url')}.enc`)
}

function ensureOrcaDir(): void {
  const dir = getOrcaDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function ensureTokenDir(): void {
  const dir = getTokenDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function emptySiteFile(): MantisSiteFile {
  return {
    version: 1,
    activeSiteId: null,
    selectedSiteId: null,
    sites: []
  }
}

export function hasStoredToken(siteId: string): boolean {
  return cachedTokens.has(siteId) || credentialFileHasContent(getTokenPath(siteId))
}

function normalizeSite(input: unknown): MantisSite | null {
  if (!input || typeof input !== 'object') {
    return null
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: guarded by the `typeof input !== 'object'` check above; every field is re-validated with `typeof` below before use.
  const record = input as Record<string, unknown>
  if (
    typeof record.id !== 'string' ||
    typeof record.siteUrl !== 'string' ||
    typeof record.userId !== 'string' ||
    typeof record.displayName !== 'string'
  ) {
    return null
  }
  return {
    id: record.id,
    siteUrl: record.siteUrl,
    userId: record.userId,
    displayName: record.displayName
  }
}

function readSiteFileFromDisk(): MantisSiteFile {
  const path = getSiteFilePath()
  if (!existsSync(path)) {
    return emptySiteFile()
  }
  try {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: JSON.parse returns `any`; every field is defensively validated (Array.isArray/typeof) below before use, and normalizeSite re-validates each site entry independently.
    const parsed = JSON.parse(readFileSync(path, { encoding: 'utf-8' })) as Partial<MantisSiteFile>
    const sites = Array.isArray(parsed.sites)
      ? parsed.sites
          .map((site) => normalizeSite(site))
          .filter((site): site is MantisSite => site !== null)
          .filter((site) => hasStoredToken(site.id))
      : []
    const activeSiteId =
      typeof parsed.activeSiteId === 'string' &&
      sites.some((site) => site.id === parsed.activeSiteId)
        ? parsed.activeSiteId
        : (sites[0]?.id ?? null)
    const selectedSiteId =
      parsed.selectedSiteId === 'all' ||
      (typeof parsed.selectedSiteId === 'string' &&
        sites.some((site) => site.id === parsed.selectedSiteId))
        ? parsed.selectedSiteId
        : activeSiteId
    return { version: 1, activeSiteId, selectedSiteId, sites }
  } catch {
    return emptySiteFile()
  }
}

export function getSiteFile(): MantisSiteFile {
  if (!siteFileLoaded || !cachedSiteFile) {
    cachedSiteFile = readSiteFileFromDisk()
    siteFileLoaded = true
  }
  return cachedSiteFile
}

export function writeSiteFile(file: MantisSiteFile): void {
  ensureOrcaDir()
  const sites = file.sites.filter((site) => hasStoredToken(site.id))
  const activeSiteId =
    file.activeSiteId && sites.some((site) => site.id === file.activeSiteId)
      ? file.activeSiteId
      : (sites[0]?.id ?? null)
  const selectedSiteId =
    file.selectedSiteId === 'all'
      ? 'all'
      : file.selectedSiteId && sites.some((site) => site.id === file.selectedSiteId)
        ? file.selectedSiteId
        : activeSiteId

  cachedSiteFile = {
    version: 1,
    activeSiteId,
    selectedSiteId,
    sites
  }
  siteFileLoaded = true
  writeFileSync(getSiteFilePath(), JSON.stringify(cachedSiteFile, null, 2), {
    encoding: 'utf-8',
    mode: 0o600
  })
}

function writeEncryptedToken(path: string, apiToken: string): void {
  if (getSecretStore().isEncryptionAvailable()) {
    writeFileSync(path, getSecretStore().encryptString(apiToken), { mode: 0o600 })
    return
  }
  console.warn('[mantis] secret encryption unavailable — storing token in plaintext')
  writeFileSync(path, apiToken, { encoding: 'utf-8', mode: 0o600 })
}

export function readToken(siteId: string): string | null {
  const cached = cachedTokens.get(siteId)
  if (cached !== undefined) {
    return cached
  }
  const path = getTokenPath(siteId)
  if (!existsSync(path)) {
    return null
  }
  try {
    const raw = readFileSync(path)
    const token = readStoredCredentialToken('Mantis', raw)
    if (token) {
      cachedTokens.set(siteId, token)
    }
    credentialErrors.delete(siteId)
    return token
  } catch (error) {
    if (error instanceof CredentialDecryptionError) {
      credentialErrors.set(siteId, error.message)
      throw error
    }
    return null
  }
}

export function saveToken(siteId: string, apiToken: string): void {
  ensureOrcaDir()
  ensureTokenDir()
  writeEncryptedToken(getTokenPath(siteId), apiToken)
  cachedTokens.set(siteId, apiToken)
  credentialErrors.delete(siteId)
}

export function deleteToken(siteId: string): void {
  cachedTokens.delete(siteId)
  credentialErrors.delete(siteId)
  try {
    unlinkSync(getTokenPath(siteId))
  } catch {
    // Token may not exist — safe to ignore.
  }
}
