import { mantisRequest, type MantisClientForSite } from './authenticated-request'

export type MantisRecord = Record<string, unknown>

type MantisIssuesResponse = {
  issues?: MantisRecord[]
}

export function asRecord(value: unknown): MantisRecord {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: guarded by the `typeof value === 'object'` check in the ternary condition above; every field read off the result is re-validated with `typeof` before use.
  return value && typeof value === 'object' ? (value as MantisRecord) : {}
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

// MantisBT's issue listing has no cursor/total envelope to detect the last
// page from, so a short page (fewer than requested, including empty) is the
// only reliable "no more results" signal. The 50-page guard mirrors Jira's
// 100-page guard: a ceiling against a server that never returns a short page.
export async function fetchAllIssuePages(
  entry: MantisClientForSite,
  pathForPage: (page: number, pageSize: number) => string,
  pageSize = 50
): Promise<MantisRecord[]> {
  const records: MantisRecord[] = []
  for (let page = 1, guard = 0; guard < 50; page += 1, guard += 1) {
    const response = await mantisRequest<MantisIssuesResponse>(entry, pathForPage(page, pageSize))
    const items = Array.isArray(response.issues) ? response.issues : []
    records.push(...items)
    if (items.length < pageSize) {
      break
    }
  }
  return records
}
