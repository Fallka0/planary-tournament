// The database enforces plan limits (supabase/organisations-plan-limits.sql) and raises errors
// that start with a code. These turn them into messages people can act on.

const PLAN_ERRORS: Record<string, (limit: string | null) => string> = {
  PLAN_TEAM_LIMIT: (limit) =>
    `This tournament is full for its plan${limit ? ` (up to ${limit} teams)` : ''}. Upgrade the organisation's plan on portal.planary.ch for bigger tournaments.`,
  PLAN_RUNNING_LIMIT: (limit) =>
    `Your plan allows ${limit ?? 'a limited number of'} running tournament${limit === '1' ? '' : 's'} at a time. Finish the running one first, or upgrade on portal.planary.ch.`,
  PLAN_ORG_LINK: () => 'Tournaments are linked to an organisation from the Planary portal.',
}

/** A friendly message for a plan-limit error from the database, or null for any other error. */
export function planLimitMessage(message: string): string | null {
  const match = /\b(PLAN_[A-Z_]+):\s*(.*)$/.exec(message)
  if (!match) return null
  const build = PLAN_ERRORS[match[1]]
  if (!build) return null
  const limit = /(\d+)/.exec(match[2])?.[1] ?? null
  return build(limit)
}
