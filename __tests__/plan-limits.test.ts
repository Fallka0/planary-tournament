import { describe, expect, it } from 'vitest'
import { getErrorMessage } from '@/lib/errors'
import { planLimitMessage } from '@/lib/plan-limits'

describe('plan limit errors', () => {
  it('turns the team cap into a message with the limit', () => {
    const message = planLimitMessage('PLAN_TEAM_LIMIT: This plan allows up to 16 teams per tournament.')
    expect(message).toContain('up to 16 teams')
    expect(message).toContain('portal.planary.ch')
  })

  it('turns the running cap into a message', () => {
    expect(planLimitMessage('PLAN_RUNNING_LIMIT: This plan allows 1 running tournament(s) at a time.')).toContain('1 running tournament at a time')
    expect(planLimitMessage('PLAN_RUNNING_LIMIT: This plan allows 3 running tournament(s) at a time.')).toContain('3 running tournaments')
  })

  it('leaves other errors alone', () => {
    expect(planLimitMessage('duplicate key value violates unique constraint')).toBeNull()
    expect(getErrorMessage(new Error('Network down'))).toBe('Network down')
  })

  it('applies to Supabase error objects and Error instances', () => {
    expect(getErrorMessage({ message: 'PLAN_ORG_LINK: Only Planary can link a tournament to an organisation.' })).toContain('Planary portal')
    expect(getErrorMessage(new Error('PLAN_TEAM_LIMIT: This plan allows up to 128 teams per tournament.'))).toContain('128 teams')
  })
})
