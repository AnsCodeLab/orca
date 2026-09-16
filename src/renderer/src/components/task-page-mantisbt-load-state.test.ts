import { describe, expect, it } from 'vitest'
import { createTaskPageMantisBTLoadFailureState } from './task-page-mantisbt-load-state'

describe('TaskPage MantisBT load state', () => {
  it('explains MantisBT forbidden errors while clearing stale issues', () => {
    expect(createTaskPageMantisBTLoadFailureState(new Error('Forbidden'))).toEqual({
      issues: [],
      error: {
        title: 'Error 403: MantisBT denied access to this issue list. Check project permissions.',
        details: 'Forbidden'
      }
    })
  })

  it('explains MantisBT authentication errors', () => {
    expect(createTaskPageMantisBTLoadFailureState(new Error('Error 401: Unauthorized'))).toEqual({
      issues: [],
      error: {
        title:
          'Error 401: MantisBT authentication failed. Reconnect MantisBT in Settings, then try again.',
        details: 'Unauthorized'
      }
    })
  })

  it('explains network errors', () => {
    expect(createTaskPageMantisBTLoadFailureState(new Error('Network request failed'))).toEqual({
      issues: [],
      error: {
        title: "Couldn't reach MantisBT. Check your connection and try again.",
        details: 'Network request failed'
      }
    })
  })

  it('explains MantisBT server errors', () => {
    expect(createTaskPageMantisBTLoadFailureState(new Error('Service Unavailable'))).toEqual({
      issues: [],
      error: {
        title:
          'Error 503: MantisBT had a server error while loading issues. Try again in a moment.',
        details: 'Service Unavailable'
      }
    })
  })

  it('uses the generic load error for non-Error rejections', () => {
    expect(createTaskPageMantisBTLoadFailureState('failed')).toEqual({
      issues: [],
      error: {
        title: "Couldn't load MantisBT issues. Try again in a moment.",
        details: 'Failed to load MantisBT issues.'
      }
    })
  })
})
