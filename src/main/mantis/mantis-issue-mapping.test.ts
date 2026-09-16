import { describe, expect, it } from 'vitest'
import type { MantisSite } from '../../shared/mantis-types'
import { mapMantisIssue, mapMantisProject } from './mantis-issue-mapping'

const site: MantisSite = {
  id: 'site-1',
  siteUrl: 'https://mantis.example.com',
  userId: '42',
  displayName: 'William'
}

describe('mapMantisIssue', () => {
  it('maps a full raw issue record', () => {
    const raw = {
      id: 123,
      summary: 'Something broke',
      description: 'Detailed repro steps',
      project: { id: 1, name: 'Demo' },
      status: { id: 10, name: 'new', label: 'new' },
      priority: { id: 30, name: 'normal', label: 'normal' },
      reporter: { id: 5, name: 'reporter', real_name: 'Reporter Real' },
      handler: { id: 42, name: 'wquintal', real_name: 'William' },
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-02-01T00:00:00.000Z'
    }

    expect(mapMantisIssue(site, raw)).toEqual({
      id: '123',
      summary: 'Something broke',
      description: 'Detailed repro steps',
      project: { id: '1', name: 'Demo' },
      status: { id: '10', name: 'new', label: 'new' },
      priority: { id: '30', name: 'normal', label: 'normal' },
      reporter: { id: '5', name: 'reporter', realName: 'Reporter Real' },
      handler: { id: '42', name: 'wquintal', realName: 'William' },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-02-01T00:00:00.000Z',
      siteId: 'site-1',
      siteName: 'William',
      url: 'https://mantis.example.com/view.php?id=123'
    })
  })

  it('does not throw and applies sane defaults when optional fields are missing', () => {
    const raw = {
      id: 456,
      summary: 'Minimal issue',
      project: { id: 2, name: 'Other' },
      status: { id: 11, name: 'feedback', label: 'feedback' },
      reporter: { id: 7, name: 'someone' },
      created_at: '2024-03-01T00:00:00.000Z',
      updated_at: '2024-03-02T00:00:00.000Z'
    }

    let issue: ReturnType<typeof mapMantisIssue> | undefined
    expect(() => {
      issue = mapMantisIssue(site, raw)
    }).not.toThrow()

    expect(issue?.description).toBeUndefined()
    expect(issue?.handler).toBeUndefined()
    expect(issue?.priority).toBeUndefined()
    expect(issue?.reporter).toEqual({ id: '7', name: 'someone' })
  })

  it('explicitly maps a null handler to null, not undefined', () => {
    const raw = {
      id: 789,
      summary: 'Unassigned',
      project: { id: 2, name: 'Other' },
      status: { id: 11, name: 'feedback', label: 'feedback' },
      reporter: { id: 7, name: 'someone' },
      handler: null,
      created_at: '2024-03-01T00:00:00.000Z',
      updated_at: '2024-03-02T00:00:00.000Z'
    }

    expect(mapMantisIssue(site, raw).handler).toBeNull()
  })

  it('falls back to a fresh timestamp when created/updated are absent, rather than throwing', () => {
    const raw = { id: 999, summary: 'No timestamps', project: {}, status: {}, reporter: {} }

    expect(() => mapMantisIssue(site, raw)).not.toThrow()
    const issue = mapMantisIssue(site, raw)
    expect(Number.isNaN(new Date(issue.createdAt).getTime())).toBe(false)
    expect(Number.isNaN(new Date(issue.updatedAt).getTime())).toBe(false)
  })
})

describe('mapMantisProject', () => {
  it('maps id and name defensively, falling back when name is missing', () => {
    expect(mapMantisProject({ id: 5, name: 'Demo' })).toEqual({ id: '5', name: 'Demo' })
    expect(mapMantisProject({ id: 5 })).toEqual({ id: '5', name: '5' })
    expect(mapMantisProject({})).toEqual({ id: '', name: 'Untitled project' })
  })
})
