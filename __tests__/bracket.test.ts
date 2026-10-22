import { describe, expect, it } from 'vitest'
import { buildBracketProgressionChanges, createInitialBracketMatches, getScoreValidationMessage, orderKnockoutMatches } from '@/shared/bracket'
import type { Match, Participant } from '@/shared/types'

function createMatch(overrides: Partial<Match>): Match {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    tournament_id: overrides.tournament_id ?? 'tournament-1',
    participant_a: overrides.participant_a ?? null,
    participant_b: overrides.participant_b ?? null,
    round: overrides.round ?? 1,
    score_a: overrides.score_a ?? null,
    score_b: overrides.score_b ?? null,
    winner: overrides.winner ?? null,
    created_at: overrides.created_at ?? '2026-04-16T08:00:00.000Z',
  }
}

function createParticipant(id: string, name: string): Participant {
  return {
    id,
    tournament_id: 'tournament-1',
    name,
    user_id: null,
    created_at: '2026-04-16T08:00:00.000Z',
  }
}

describe('createInitialBracketMatches', () => {
  it('creates first-round pairings for all participants and preserves byes when odd', () => {
    const matches = createInitialBracketMatches('t-1', ['a', 'b', 'c'])

    expect(matches).toHaveLength(2)
    expect(matches.every((match) => match.round === 1)).toBe(true)

    const participantIds = matches.flatMap((match) => [match.participant_a, match.participant_b]).filter(Boolean)
    expect(participantIds.sort()).toEqual(['a', 'b', 'c'])
    expect(matches.some((match) => match.participant_b === null)).toBe(true)
  })
})

describe('getScoreValidationMessage', () => {
  it('rejects missing, negative, invalid, and tied scores', () => {
    expect(getScoreValidationMessage('', '1')).toBe('Trag beide Resultate ein.')
    expect(getScoreValidationMessage('abc', '1')).toBe('Resultate müssen Zahlen sein.')
    expect(getScoreValidationMessage('-1', '1')).toBe('Resultate können nicht negativ sein.')
    expect(getScoreValidationMessage('2', '2')).toBe('Es braucht einen Sieger, ein Unentschieden geht hier nicht.')
  })

  it('accepts valid scores with a clear winner', () => {
    expect(getScoreValidationMessage('3', '1')).toBeNull()
  })
})

describe('buildBracketProgressionChanges', () => {
  it('keeps later-round matches in their visual slot even when fetched in the wrong order', () => {
    const matches = [
      createMatch({
        id: 'qf-1',
        participant_a: 'p1',
        participant_b: 'p2',
        score_a: 1,
        score_b: 0,
        winner: 'p1',
        round: 1,
        created_at: '2026-04-16T08:00:00.000Z',
      }),
      createMatch({
        id: 'qf-2',
        participant_a: 'p3',
        participant_b: 'p4',
        score_a: 0,
        score_b: 1,
        winner: 'p4',
        round: 1,
        created_at: '2026-04-16T08:01:00.000Z',
      }),
      createMatch({
        id: 'qf-3',
        participant_a: 'p5',
        participant_b: 'p6',
        score_a: 1,
        score_b: 0,
        winner: 'p5',
        round: 1,
        created_at: '2026-04-16T08:02:00.000Z',
      }),
      createMatch({
        id: 'qf-4',
        participant_a: 'p7',
        participant_b: 'p8',
        score_a: 0,
        score_b: 1,
        winner: 'p8',
        round: 1,
        created_at: '2026-04-16T08:03:00.000Z',
      }),
      createMatch({
        id: 'sf-bottom',
        participant_a: 'p5',
        participant_b: 'p8',
        round: 2,
        created_at: '2026-04-16T08:04:00.000Z',
      }),
      createMatch({
        id: 'sf-top',
        participant_a: 'p1',
        participant_b: 'p4',
        round: 2,
        created_at: '2026-04-16T08:05:00.000Z',
      }),
    ]

    const orderedMatches = orderKnockoutMatches(matches)
    const semiFinals = orderedMatches.filter((match) => match.round === 2)

    expect(semiFinals.map((match) => match.id)).toEqual(['sf-top', 'sf-bottom'])
  })

  it('creates the next round when all winners in the current round are known', () => {
    const matches = [
      createMatch({
        id: 'm1',
        participant_a: 'p1',
        participant_b: 'p2',
        score_a: 3,
        score_b: 1,
        winner: 'p1',
        created_at: '2026-04-16T08:00:00.000Z',
      }),
      createMatch({
        id: 'm2',
        participant_a: 'p3',
        participant_b: 'p4',
        score_a: 0,
        score_b: 2,
        winner: 'p4',
        created_at: '2026-04-16T08:05:00.000Z',
      }),
    ]

    const { inserts, updates } = buildBracketProgressionChanges('t-1', matches)

    expect(updates).toEqual([])
    expect(inserts).toEqual([
      {
        tournament_id: 't-1',
        participant_a: 'p1',
        participant_b: 'p4',
        round: 2,
        score_a: null,
        score_b: null,
        winner: null,
      },
    ])
  })

  it('creates the next round as soon as at least one advancing team is known', () => {
    const matches = [
      createMatch({
        id: 'm1',
        participant_a: 'p1',
        participant_b: 'p2',
        score_a: 1,
        score_b: 0,
        winner: 'p1',
        created_at: '2026-04-16T08:00:00.000Z',
      }),
      createMatch({
        id: 'm2',
        participant_a: 'p3',
        participant_b: 'p4',
        score_a: null,
        score_b: null,
        winner: null,
        created_at: '2026-04-16T08:05:00.000Z',
      }),
    ]

    const { inserts, updates } = buildBracketProgressionChanges('t-1', matches)

    expect(updates).toEqual([])
    expect(inserts).toEqual([
      {
        tournament_id: 't-1',
        participant_a: 'p1',
        participant_b: null,
        round: 2,
        score_a: null,
        score_b: null,
        winner: null,
      },
    ])
  })

  it('updates downstream rounds and clears invalid saved winners when an earlier winner changes', () => {
    const matches = [
      createMatch({
        id: 'm1',
        participant_a: 'p1',
        participant_b: 'p2',
        score_a: 1,
        score_b: 3,
        winner: 'p2',
        created_at: '2026-04-16T08:00:00.000Z',
      }),
      createMatch({
        id: 'm2',
        participant_a: 'p3',
        participant_b: 'p4',
        score_a: 2,
        score_b: 0,
        winner: 'p3',
        created_at: '2026-04-16T08:05:00.000Z',
      }),
      createMatch({
        id: 'm3',
        participant_a: 'p1',
        participant_b: 'p3',
        round: 2,
        score_a: 3,
        score_b: 2,
        winner: 'p1',
        created_at: '2026-04-16T08:10:00.000Z',
      }),
    ]

    const { inserts, updates } = buildBracketProgressionChanges('t-1', matches)

    expect(inserts).toEqual([])
    expect(updates).toEqual([
      {
        id: 'm3',
        participant_a: 'p2',
        participant_b: 'p3',
        score_a: null,
        score_b: null,
        winner: null,
      },
    ])
  })

  it('creates the knockout bracket from finished group-stage results in both mode', () => {
    const participants = [
      createParticipant('a1', 'Alpha 1'),
      createParticipant('a2', 'Alpha 2'),
      createParticipant('b1', 'Beta 1'),
      createParticipant('b2', 'Beta 2'),
    ]
    const matches = [
      createMatch({
        id: 'g1',
        participant_a: 'a1',
        participant_b: 'a2',
        score_a: 1,
        score_b: 0,
        winner: 'a1',
        round: 1,
      }),
      createMatch({
        id: 'g2',
        participant_a: 'b1',
        participant_b: 'b2',
        score_a: 1,
        score_b: 0,
        winner: 'b1',
        round: 1,
      }),
    ]

    const { updates, inserts } = buildBracketProgressionChanges('t-1', matches, 'both', 2, participants)

    expect(updates).toEqual([])
    expect(inserts).toHaveLength(2)
    expect(inserts.every((match) => match.tournament_id === 't-1' && match.round === 2)).toBe(true)

    const seededPairs = inserts.map((match) => [match.participant_a, match.participant_b].filter(Boolean).sort())
    expect(seededPairs).toEqual([
      ['a1', 'b1'],
      ['a2', 'b2'],
    ])
  })
})
