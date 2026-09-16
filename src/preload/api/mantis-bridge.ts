import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const mantisApi = {
  connect: (args: { siteUrl: string; apiToken: string }) =>
    ipcRenderer.invoke('mantis:connect', args),

  disconnect: (args?: { siteId?: string }): Promise<void> =>
    ipcRenderer.invoke('mantis:disconnect', args),

  selectSite: (args: { siteId: string }) => ipcRenderer.invoke('mantis:selectSite', args),

  status: () => ipcRenderer.invoke('mantis:status'),

  testConnection: (args?: { siteId?: string }) =>
    ipcRenderer.invoke('mantis:testConnection', args),

  listIssues: (args?: {
    filter?: 'assigned' | 'reported' | 'all'
    limit?: number
    siteId?: string
  }) => ipcRenderer.invoke('mantis:listIssues', args),

  getIssue: (args: { id: string; siteId?: string }) =>
    ipcRenderer.invoke('mantis:getIssue', args),

  listProjects: (args?: { siteId?: string }) => ipcRenderer.invoke('mantis:listProjects', args)
} satisfies PreloadApi['mantis']
