import type {
  MantisBTConnectArgs,
  MantisBTConnectionStatus,
  MantisBTIssue,
  MantisBTIssueFilter,
  MantisBTProject,
  MantisBTSiteSelection,
  MantisBTViewer
} from '../../../shared/mantisbt-types'
import { callRuntimeRpc } from './runtime-rpc-client'
import { getMantisBTRuntimeTarget, type RuntimeMantisBTSettings } from './runtime-mantisbt-target'

export type { RuntimeMantisBTSettings } from './runtime-mantisbt-target'

export type MantisBTConnectResult =
  | { ok: true; viewer: MantisBTViewer }
  | { ok: false; error: string }

export async function mantisBTStatus(
  settings: RuntimeMantisBTSettings
): Promise<MantisBTConnectionStatus> {
  const target = getMantisBTRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<MantisBTConnectionStatus>(target, 'mantisBT.status', undefined, {
        timeoutMs: 15_000
      })
    : window.api.mantisBT.status()
}

export async function mantisBTConnect(
  settings: RuntimeMantisBTSettings,
  args: MantisBTConnectArgs
): Promise<MantisBTConnectResult> {
  const target = getMantisBTRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<MantisBTConnectResult>(target, 'mantisBT.connect', args, { timeoutMs: 30_000 })
    : window.api.mantisBT.connect(args)
}

export async function mantisBTDisconnect(
  settings: RuntimeMantisBTSettings,
  siteId?: string | null
): Promise<void> {
  const target = getMantisBTRuntimeTarget(settings)
  if (target.kind === 'environment') {
    await callRuntimeRpc<{ ok: true }>(
      target,
      'mantisBT.disconnect',
      siteId ? { siteId } : undefined,
      { timeoutMs: 15_000 }
    )
    return
  }
  await window.api.mantisBT.disconnect(siteId ? { siteId } : undefined)
}

export async function mantisBTSelectSite(
  settings: RuntimeMantisBTSettings,
  siteId: MantisBTSiteSelection
): Promise<MantisBTConnectionStatus> {
  const target = getMantisBTRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<MantisBTConnectionStatus>(
        target,
        'mantisBT.selectSite',
        { siteId },
        { timeoutMs: 15_000 }
      )
    : window.api.mantisBT.selectSite({ siteId })
}

export async function mantisBTTestConnection(
  settings: RuntimeMantisBTSettings,
  siteId?: string | null
): Promise<MantisBTConnectResult> {
  const target = getMantisBTRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<MantisBTConnectResult>(
        target,
        'mantisBT.testConnection',
        siteId ? { siteId } : undefined,
        { timeoutMs: 30_000 }
      )
    : window.api.mantisBT.testConnection(siteId ? { siteId } : undefined)
}

export async function mantisBTListIssues(
  settings: RuntimeMantisBTSettings,
  filter?: MantisBTIssueFilter,
  limit?: number,
  siteId?: MantisBTSiteSelection | null,
  projectId?: string | null
): Promise<MantisBTIssue[]> {
  const target = getMantisBTRuntimeTarget(settings)
  const args = {
    filter,
    limit,
    siteId: siteId ?? undefined,
    projectId: projectId ?? undefined
  }
  // Why: fetchAllIssuePages has no server-side handler_id/reporter_id filter
  // to narrow the request, so a large self-hosted instance can take minutes
  // — matches ISSUE_SEARCH_TIMEOUT_MS in src/main/mantisbt/mantisbt-issue-search.ts.
  // A project_id filter IS respected server-side and is the recommended way
  // to keep a large multi-project instance's fetch fast.
  return target.kind === 'environment'
    ? callRuntimeRpc<MantisBTIssue[]>(target, 'mantisBT.listIssues', args, { timeoutMs: 300_000 })
    : window.api.mantisBT.listIssues(args)
}

export async function mantisBTGetIssue(
  settings: RuntimeMantisBTSettings,
  id: string,
  siteId?: string | null
): Promise<MantisBTIssue | null> {
  const target = getMantisBTRuntimeTarget(settings)
  const args = { id, siteId: siteId ?? undefined }
  return target.kind === 'environment'
    ? callRuntimeRpc<MantisBTIssue | null>(target, 'mantisBT.getIssue', args, { timeoutMs: 30_000 })
    : window.api.mantisBT.getIssue(args)
}

export async function mantisBTListProjects(
  settings: RuntimeMantisBTSettings,
  siteId?: MantisBTSiteSelection | null
): Promise<MantisBTProject[]> {
  const target = getMantisBTRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<MantisBTProject[]>(
        target,
        'mantisBT.listProjects',
        siteId ? { siteId } : undefined,
        { timeoutMs: 30_000 }
      )
    : window.api.mantisBT.listProjects(siteId ? { siteId } : undefined)
}
