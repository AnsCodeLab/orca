import type { TaskPageComposerActionsModel } from '../../use-task-page-composer-actions'
import { MantisBTIcon } from '@/components/icons/MantisBTIcon'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'

// Why: MantisBT is connectable from Settings (Phase 2), but the TaskPage
// issue-browsing surface (SourceBar, issue list/preview) is a separate,
// larger follow-up. Without this explicit branch, taskSource === 'mantisBT'
// would fall through the jira/Content.tsx default case and silently render
// Linear's list/empty-state instead — this honest placeholder replaces that.
export function TaskPageMantisBTContent({
  model
}: {
  model: TaskPageComposerActionsModel
}): React.JSX.Element {
  const { hideTaskSource } = model
  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-md border border-border/50 bg-muted/50 px-6 py-14 text-center shadow-sm">
      <MantisBTIcon className="mb-4 size-8" />
      <p className="text-base font-medium text-foreground">
        {translate(
          'auto.components.TaskPage.mantisbtBrowsingUnsupportedTitle',
          'MantisBT browsing is not available yet'
        )}
      </p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {translate(
          'auto.components.TaskPage.mantisbtBrowsingUnsupportedBody',
          'MantisBT can be connected from Settings, but browsing its issues here is not supported yet. Hide it to use another task source.'
        )}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" onClick={() => hideTaskSource('mantisBT', 'MantisBT')}>
          {translate('auto.components.TaskPage.mantisbtHideSource', 'Hide MantisBT')}
        </Button>
      </div>
    </div>
  )
}
