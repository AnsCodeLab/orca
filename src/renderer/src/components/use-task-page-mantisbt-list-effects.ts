import type { TaskPageMantisBTListProjectionModel } from './use-task-page-mantisbt-list-projection'
import { useEffect } from 'react'
import { createTaskPageMantisBTLoadFailureState } from '@/components/task-page-mantisbt-load-state'
import { parseMantisBTProjectSelectionKey } from '@/components/task-page-mantisbt-project-selection'
import { MANTISBT_ITEM_LIMIT } from './task-page-source-context'

export type TaskPageMantisBTListEffectsModel = TaskPageMantisBTListProjectionModel

export function useTaskPageMantisBTListEffects(
  model: TaskPageMantisBTListProjectionModel
): TaskPageMantisBTListEffectsModel {
  const {
    taskResumeApplied,
    taskSource,
    mantisBTConnected,
    selectedMantisBTSiteId,
    selectedMantisBTProjectId,
    mantisBTTaskSourceContext,
    listMantisBTIssues,
    activeMantisBTPreset,
    mantisBTRefreshNonce,
    setMantisBTIssues,
    setMantisBTLoading,
    setMantisBTError,
    setMantisBTErrorDetailsOpen,
    selectedMantisBTIssueKey,
    setSelectedMantisBTIssueKey,
    selectedMantisBTIssueFallback,
    setSelectedMantisBTIssueFallback,
    fetchedMantisBTIssues
  } = model

  // Why: fetch effect — no JQL-equivalent search or per-project status-order
  // RPC exists for MantisBT (see mantisbt-issue-sorter.ts), so this mirrors
  // Jira's fetch effect minus those two branches.
  useEffect(() => {
    if (!taskResumeApplied || taskSource !== 'mantisBT' || !mantisBTConnected) {
      return
    }
    let cancelled = false
    setMantisBTLoading(true)
    setMantisBTError(null)
    setMantisBTErrorDetailsOpen(false)
    const projectSelection = parseMantisBTProjectSelectionKey(selectedMantisBTProjectId)
    void listMantisBTIssues(activeMantisBTPreset, MANTISBT_ITEM_LIMIT, {
      sourceContext: mantisBTTaskSourceContext,
      siteId: projectSelection?.siteId ?? undefined,
      projectId: projectSelection?.projectId ?? undefined
    })
      .then((issues) => {
        if (cancelled) {
          return
        }
        setMantisBTIssues(issues)
        setMantisBTLoading(false)
      })
      .catch((err) => {
        if (cancelled) {
          return
        }
        const failureState = createTaskPageMantisBTLoadFailureState(err)
        setMantisBTIssues(failureState.issues)
        setMantisBTError(failureState.error)
        setMantisBTLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    taskSource,
    mantisBTConnected,
    selectedMantisBTSiteId,
    selectedMantisBTProjectId,
    activeMantisBTPreset,
    mantisBTRefreshNonce,
    taskResumeApplied,
    mantisBTTaskSourceContext
  ])

  // Why: reconcile against the fetched (pre-search-filter) list, not the
  // displayed one — MantisBT's search box filters client-side, so checking
  // the filtered list would wrongly close an open, still-valid issue's
  // detail Sheet the moment it scrolls out of the current search view.
  useEffect(() => {
    if (!taskResumeApplied || taskSource !== 'mantisBT') {
      return
    }
    if (!mantisBTConnected || fetchedMantisBTIssues.length === 0) {
      if (selectedMantisBTIssueKey !== null) {
        setSelectedMantisBTIssueKey(null)
      }
      if (selectedMantisBTIssueFallback !== null) {
        setSelectedMantisBTIssueFallback(null)
      }
      return
    }
    if (
      selectedMantisBTIssueKey &&
      !fetchedMantisBTIssues.some((issue) => issue.id === selectedMantisBTIssueKey)
    ) {
      setSelectedMantisBTIssueKey(null)
      setSelectedMantisBTIssueFallback(null)
    }
  }, [
    fetchedMantisBTIssues,
    mantisBTConnected,
    selectedMantisBTIssueFallback,
    selectedMantisBTIssueKey,
    taskResumeApplied,
    taskSource,
    setSelectedMantisBTIssueFallback,
    setSelectedMantisBTIssueKey
  ])

  return model
}
