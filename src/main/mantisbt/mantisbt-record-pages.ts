import { mantisBTRequest, type MantisBTClientForSite } from './authenticated-request'

export type MantisBTRecord = Record<string, unknown>

type MantisBTIssuesResponse = {
  issues?: MantisBTRecord[]
}

export function asRecord(value: unknown): MantisBTRecord {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: guarded by the `typeof value === 'object'` check in the ternary condition above; every field read off the result is re-validated with `typeof` before use.
  return value && typeof value === 'object' ? (value as MantisBTRecord) : {}
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export class MantisBTPaginationLimitError extends Error {
  constructor() {
    super('MantisBT issue list exceeded the pagination safety limit; narrow the query.')
    this.name = 'MantisBTPaginationLimitError'
  }
}

// MantisBT's issue listing has no cursor/total envelope to detect the last
// page from, so a short page (fewer than requested, including empty) is the
// only reliable "no more results" signal. The 500-page ceiling is a safety
// net against a server that never returns a short page — hitting it throws
// instead of silently returning a truncated result set, since a MantisBT
// instance can legitimately have more than 25,000 issues on one project.
export async function fetchAllIssuePages(
  entry: MantisBTClientForSite,
  pathForPage: (page: number, pageSize: number) => string,
  pageSize = 50,
  signal?: AbortSignal
): Promise<MantisBTRecord[]> {
  const records: MantisBTRecord[] = []
  for (let page = 1, guard = 0; ; page += 1, guard += 1) {
    if (guard >= 500) {
      throw new MantisBTPaginationLimitError()
    }
    const response = await mantisBTRequest<MantisBTIssuesResponse>(
      entry,
      pathForPage(page, pageSize),
      {
        signal
      }
    )
    const items = Array.isArray(response.issues) ? response.issues : []
    records.push(...items)
    if (items.length < pageSize) {
      break
    }
  }
  return records
}
