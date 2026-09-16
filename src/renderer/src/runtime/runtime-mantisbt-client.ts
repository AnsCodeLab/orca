import type {
  MantisBTConnectArgs,
  MantisBTConnectionStatus,
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
