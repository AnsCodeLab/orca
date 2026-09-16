import { defineMethod } from '../core'
import {
  Connect,
  IssueId,
  ListIssues,
  SelectSite,
  SiteSelection
} from '../../../../shared/rpc-contract/mantis-params'

export const MANTIS_METHODS = [
  defineMethod({
    name: 'mantis.connect',
    params: Connect,
    handler: async (params, { runtime }) =>
      runtime.mantisConnect({
        siteUrl: params.siteUrl.trim(),
        apiToken: params.apiToken.trim()
      })
  }),
  defineMethod({
    name: 'mantis.disconnect',
    params: SiteSelection,
    handler: async (params, { runtime }) => runtime.mantisDisconnect(params?.siteId)
  }),
  defineMethod({
    name: 'mantis.selectSite',
    params: SelectSite,
    handler: async (params, { runtime }) => runtime.mantisSelectSite(params.siteId.trim())
  }),
  defineMethod({
    name: 'mantis.status',
    params: null,
    handler: async (_params, { runtime }) => runtime.mantisStatus()
  }),
  defineMethod({
    name: 'mantis.testConnection',
    params: SiteSelection,
    handler: async (params, { runtime }) => runtime.mantisTestConnection(params?.siteId)
  }),
  defineMethod({
    name: 'mantis.listIssues',
    params: ListIssues,
    handler: async (params, { runtime }) =>
      runtime.mantisListIssues(params?.filter, params?.limit, params?.siteId)
  }),
  defineMethod({
    name: 'mantis.getIssue',
    params: IssueId,
    handler: async (params, { runtime }) => runtime.mantisGetIssue(params.id.trim(), params.siteId)
  }),
  defineMethod({
    name: 'mantis.listProjects',
    params: SiteSelection,
    handler: async (params, { runtime }) => runtime.mantisListProjects(params?.siteId)
  })
]
