import type {
  MantisConnectArgs,
  MantisConnectionStatus,
  MantisSiteSelection,
  MantisViewer
} from '../../../shared/mantis-types'
import { callRuntimeRpc } from './runtime-rpc-client'
import { getMantisRuntimeTarget, type RuntimeMantisSettings } from './runtime-mantis-target'

export type { RuntimeMantisSettings } from './runtime-mantis-target'

export type MantisConnectResult =
  | { ok: true; viewer: MantisViewer }
  | { ok: false; error: string }

export async function mantisStatus(
  settings: RuntimeMantisSettings
): Promise<MantisConnectionStatus> {
  const target = getMantisRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<MantisConnectionStatus>(target, 'mantis.status', undefined, {
        timeoutMs: 15_000
      })
    : window.api.mantis.status()
}

export async function mantisConnect(
  settings: RuntimeMantisSettings,
  args: MantisConnectArgs
): Promise<MantisConnectResult> {
  const target = getMantisRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<MantisConnectResult>(target, 'mantis.connect', args, { timeoutMs: 30_000 })
    : window.api.mantis.connect(args)
}

export async function mantisDisconnect(
  settings: RuntimeMantisSettings,
  siteId?: string | null
): Promise<void> {
  const target = getMantisRuntimeTarget(settings)
  if (target.kind === 'environment') {
    await callRuntimeRpc<{ ok: true }>(
      target,
      'mantis.disconnect',
      siteId ? { siteId } : undefined,
      { timeoutMs: 15_000 }
    )
    return
  }
  await window.api.mantis.disconnect(siteId ? { siteId } : undefined)
}

export async function mantisSelectSite(
  settings: RuntimeMantisSettings,
  siteId: MantisSiteSelection
): Promise<MantisConnectionStatus> {
  const target = getMantisRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<MantisConnectionStatus>(
        target,
        'mantis.selectSite',
        { siteId },
        { timeoutMs: 15_000 }
      )
    : window.api.mantis.selectSite({ siteId })
}

export async function mantisTestConnection(
  settings: RuntimeMantisSettings,
  siteId?: string | null
): Promise<MantisConnectResult> {
  const target = getMantisRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<MantisConnectResult>(
        target,
        'mantis.testConnection',
        siteId ? { siteId } : undefined,
        { timeoutMs: 30_000 }
      )
    : window.api.mantis.testConnection(siteId ? { siteId } : undefined)
}
