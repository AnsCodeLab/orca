import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const mantisBTApi = {
  connect: (args: { siteUrl: string; apiToken: string }) =>
    ipcRenderer.invoke('mantisBT:connect', args),

  disconnect: (args?: { siteId?: string }): Promise<void> =>
    ipcRenderer.invoke('mantisBT:disconnect', args),

  selectSite: (args: { siteId: string }) => ipcRenderer.invoke('mantisBT:selectSite', args),

  status: () => ipcRenderer.invoke('mantisBT:status'),

  testConnection: (args?: { siteId?: string }) =>
    ipcRenderer.invoke('mantisBT:testConnection', args),

  listIssues: (args?: {
    filter?: 'assigned' | 'reported' | 'all'
    limit?: number
    siteId?: string
  }) => ipcRenderer.invoke('mantisBT:listIssues', args),

  getIssue: (args: { id: string; siteId?: string }) =>
    ipcRenderer.invoke('mantisBT:getIssue', args),

  listProjects: (args?: { siteId?: string }) => ipcRenderer.invoke('mantisBT:listProjects', args)
} satisfies PreloadApi['mantisBT']
