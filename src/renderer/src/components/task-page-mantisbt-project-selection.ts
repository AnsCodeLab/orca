// Why: MantisBT project ids are only unique per-site (id 1 is the
// near-universal default project on a fresh install — see
// mantisbt-project-queries.ts's projectDedupeKey), so a selected project must
// carry its owning site alongside the raw id to filter unambiguously,
// including when the site scope elsewhere is 'all sites'.
const SEPARATOR = '::'

export type MantisBTProjectSelection = {
  siteId: string
  projectId: string
}

export function buildMantisBTProjectSelectionKey(siteId: string, projectId: string): string {
  return `${siteId}${SEPARATOR}${projectId}`
}

export function parseMantisBTProjectSelectionKey(value: string): MantisBTProjectSelection | null {
  if (value === 'all') {
    return null
  }
  const separatorIndex = value.indexOf(SEPARATOR)
  if (separatorIndex === -1) {
    return null
  }
  const siteId = value.slice(0, separatorIndex)
  const projectId = value.slice(separatorIndex + SEPARATOR.length)
  if (!siteId || !projectId) {
    return null
  }
  return { siteId, projectId }
}
