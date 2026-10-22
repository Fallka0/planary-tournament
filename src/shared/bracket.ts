// Brackets and group stages: pure functions, used by the Tournament API (which owns the matches)
// and by the app (which draws them). No imports outside src/shared, so both can bundle it.
import { sanitizeGroupCount } from './settings'
import type { Match, MatchFormat, Participant, TournamentMode } from './types'

export type MatchUpdate = Pick<Match, 'id' | 'participant_a' | 'participant_b' | 'score_a' | 'score_b' | 'winner'>
export type MatchInsert = Pick<Match, 'tournament_id' | 'participant_a' | 'participant_b' | 'round' | 'score_a' | 'score_b' | 'winner'>

export interface GroupStandingRow {
  participantId: string
  name: string
  played: number
  wins: number
  losses: number
  pointsFor: number
  pointsAgainst: number
  differential: number
}

export interface GroupStageGroup {
  label: string
  participantIds: string[]
  matches: Match[]
  standings: GroupStandingRow[]
}

export interface TournamentStructure {
  groupStageRoundCount: number
  knockoutStartRound: number
  groupStageMatches: Match[]
  knockoutMatches: Match[]
  groups: GroupStageGroup[]
  qualifiedParticipantIds: string[]
  isGroupStageComplete: boolean
}

function sortMatches(matches: Match[]) {
  return [...matches].sort((left, right) => {
    if (left.round !== right.round) return left.round - right.round
    if (left.created_at && right.created_at && left.created_at !== right.created_at) {
      return new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
    }
    return left.id.localeCompare(right.id)
  })
}

function getSlotMatchScore(match: Match, expectedParticipantA: string | null, expectedParticipantB: string | null) {
  if (!expectedParticipantA && !expectedParticipantB) return 0

  const expectedParticipants = [expectedParticipantA, expectedParticipantB].filter(Boolean)
  let score = 0

  if (match.participant_a && expectedParticipants.includes(match.participant_a)) score += 2
  if (match.participant_b && expectedParticipants.includes(match.participant_b)) score += 2

  const knownParticipants = [match.participant_a, match.participant_b].filter(Boolean)
  if (expectedParticipants.length === 1 && knownParticipants.length === 1 && knownParticipants[0] === expectedParticipants[0]) {
    score += 1
  }

  return score
}

export function orderKnockoutMatches(matches: Match[], startRound = 1) {
  const orderedMatches = sortMatches(matches)
  const roundNumbers = [...new Set(orderedMatches.map((match) => match.round))].sort((left, right) => left - right)

  if (roundNumbers.length === 0) {
    return []
  }

  const baselineRounds = orderedMatches.reduce<Map<number, Match[]>>((map, match) => {
    const current = map.get(match.round) ?? []
    current.push(match)
    map.set(match.round, current)
    return map
  }, new Map())
  const orderedRounds = new Map<number, Match[]>()

  roundNumbers.forEach((roundNumber) => {
    const roundMatches = [...(baselineRounds.get(roundNumber) ?? [])]

    if (roundNumber === startRound) {
      orderedRounds.set(roundNumber, roundMatches)
      return
    }

    const previousRoundMatches = orderedRounds.get(roundNumber - 1) ?? []
    if (previousRoundMatches.length === 0) {
      orderedRounds.set(roundNumber, roundMatches)
      return
    }

    const expectedSlotCount = Math.max(roundMatches.length, Math.ceil(previousRoundMatches.length / 2))
    const assignedMatches = new Array<Match | null>(expectedSlotCount).fill(null)
    const baselineIndex = new Map(roundMatches.map((match, index) => [match.id, index]))
    const candidates = roundMatches
      .flatMap((match) =>
        Array.from({ length: expectedSlotCount }, (_, slotIndex) => {
          const expectedParticipantA = previousRoundMatches[slotIndex * 2]?.winner ?? null
          const expectedParticipantB = previousRoundMatches[slotIndex * 2 + 1]?.winner ?? null

          return {
            match,
            slotIndex,
            score: getSlotMatchScore(match, expectedParticipantA, expectedParticipantB),
            baselinePosition: baselineIndex.get(match.id) ?? Number.MAX_SAFE_INTEGER,
          }
        }),
      )
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => {
        if (left.score !== right.score) return right.score - left.score
        if (left.slotIndex !== right.slotIndex) return left.slotIndex - right.slotIndex
        return left.baselinePosition - right.baselinePosition
      })

    const usedMatchIds = new Set<string>()

    candidates.forEach((candidate) => {
      if (assignedMatches[candidate.slotIndex] || usedMatchIds.has(candidate.match.id)) return
      assignedMatches[candidate.slotIndex] = candidate.match
      usedMatchIds.add(candidate.match.id)
    })

    const remainingMatches = roundMatches.filter((match) => !usedMatchIds.has(match.id))

    assignedMatches.forEach((match, slotIndex) => {
      if (match) return
      assignedMatches[slotIndex] = remainingMatches.shift() ?? null
    })

    orderedRounds.set(
      roundNumber,
      assignedMatches.filter((match): match is Match => Boolean(match)),
    )
  })

  return roundNumbers.flatMap((roundNumber) => orderedRounds.get(roundNumber) ?? [])
}

function buildRoundMap(matches: Match[]) {
  return matches.reduce<Map<number, Match[]>>((map, match) => {
    const current = map.get(match.round) ?? []
    current.push(match)
    map.set(match.round, current)
    return map
  }, new Map())
}

function shuffleParticipants(participantIds: string[]) {
  return [...participantIds].sort(() => Math.random() - 0.5)
}

function getGroupSizes(totalParticipants: number, requestedGroupCount: number) {
  const groupCount = sanitizeGroupCount(requestedGroupCount, 'group', totalParticipants)
  const baseSize = Math.floor(totalParticipants / groupCount)
  const extraParticipants = totalParticipants % groupCount

  return Array.from({ length: groupCount }, (_, index) => baseSize + (index < extraParticipants ? 1 : 0)).filter((size) => size > 0)
}

function getRoundRobinRoundCount(groupSize: number) {
  if (groupSize <= 1) return 0
  return groupSize % 2 === 0 ? groupSize - 1 : groupSize
}

function createRoundRobinRounds(participantIds: string[]) {
  if (participantIds.length <= 1) return [] as Array<Array<[string | null, string | null]>>

  const slots: Array<string | null> = [...participantIds]
  // Add a bye slot for odd-sized groups so the round-robin rotation still works.
  if (slots.length % 2 !== 0) slots.push(null)

  const rounds: Array<Array<[string | null, string | null]>> = []
  const rotation = [...slots]
  const roundCount = rotation.length - 1
  const half = rotation.length / 2

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const pairings: Array<[string | null, string | null]> = []

    for (let index = 0; index < half; index += 1) {
      const home = rotation[index]
      const away = rotation[rotation.length - 1 - index]
      pairings.push(roundIndex % 2 === 0 ? [home, away] : [away, home])
    }

    rounds.push(pairings)

    // Keep the first slot fixed and rotate the rest to build the next round.
    const fixed = rotation[0]
    const moving = rotation.slice(1)
    moving.unshift(moving.pop() ?? null)
    rotation.splice(0, rotation.length, fixed, ...moving)
  }

  return rounds
}

function createGroupStageMatches(tournamentId: string, participantIds: string[], requestedGroupCount: number): MatchInsert[] {
  const shuffled = shuffleParticipants(participantIds)
  const groupSizes = getGroupSizes(shuffled.length, requestedGroupCount)
  const matches: MatchInsert[] = []
  let cursor = 0

  groupSizes.forEach((groupSize) => {
    const groupParticipants = shuffled.slice(cursor, cursor + groupSize)
    cursor += groupSize

    createRoundRobinRounds(groupParticipants).forEach((round, roundIndex) => {
      round.forEach(([participantA, participantB]) => {
        if (!participantA || !participantB) return

        matches.push({
          tournament_id: tournamentId,
          participant_a: participantA,
          participant_b: participantB,
          round: roundIndex + 1,
          score_a: null,
          score_b: null,
          winner: null,
        })
      })
    })
  })

  return matches
}

function createKnockoutMatches(tournamentId: string, participantIds: string[], startRound = 1): MatchInsert[] {
  if (participantIds.length === 0) return []

  return Array.from({ length: Math.ceil(participantIds.length / 2) }, (_, index) => {
    const participantA = participantIds[index * 2] ?? null
    const participantB = participantIds[index * 2 + 1] ?? null
    const hasBye = Boolean(participantA && !participantB)

    return {
      tournament_id: tournamentId,
      participant_a: participantA,
      participant_b: participantB,
      round: startRound,
      score_a: hasBye ? 1 : null,
      score_b: hasBye ? 0 : null,
      winner: hasBye ? participantA : null,
    }
  })
}

function getParticipantName(participants: Participant[], participantId: string) {
  return participants.find((participant) => participant.id === participantId)?.name ?? 'TBD'
}

function buildConnectedGroups(participants: Participant[], matches: Match[]) {
  const adjacency = new Map<string, Set<string>>()

  participants.forEach((participant) => {
    adjacency.set(participant.id, new Set())
  })

  matches.forEach((match) => {
    if (!match.participant_a || !match.participant_b) return
    adjacency.get(match.participant_a)?.add(match.participant_b)
    adjacency.get(match.participant_b)?.add(match.participant_a)
  })

  const visited = new Set<string>()
  const groups: string[][] = []

  // Rebuild groups from the match graph so group-stage data stays usable even if
  // we only persisted matches and participants.
  participants.forEach((participant) => {
    if (visited.has(participant.id)) return

    const stack = [participant.id]
    const group: string[] = []
    visited.add(participant.id)

    while (stack.length > 0) {
      const current = stack.pop()
      if (!current) continue
      group.push(current)

      ;(adjacency.get(current) ?? new Set()).forEach((neighbor) => {
        if (visited.has(neighbor)) return
        visited.add(neighbor)
        stack.push(neighbor)
      })
    }

    groups.push(group)
  })

  return groups
}

function buildGroupStandings(participants: Participant[], matches: Match[], participantIds: string[]) {
  const rows = new Map<string, GroupStandingRow>(
    participantIds.map((participantId) => [
      participantId,
      {
        participantId,
        name: getParticipantName(participants, participantId),
        played: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        differential: 0,
      },
    ]),
  )

  matches.forEach((match) => {
    if (!match.participant_a || !match.participant_b) return
    const participantA = rows.get(match.participant_a)
    const participantB = rows.get(match.participant_b)
    if (!participantA || !participantB) return

    participantA.played += 1
    participantB.played += 1

    const scoreA = match.score_a ?? 0
    const scoreB = match.score_b ?? 0
    participantA.pointsFor += scoreA
    participantA.pointsAgainst += scoreB
    participantB.pointsFor += scoreB
    participantB.pointsAgainst += scoreA

    if (match.winner === match.participant_a) {
      participantA.wins += 1
      participantB.losses += 1
    }

    if (match.winner === match.participant_b) {
      participantB.wins += 1
      participantA.losses += 1
    }
  })

  return [...rows.values()]
    .map((row) => ({ ...row, differential: row.pointsFor - row.pointsAgainst }))
    .sort((left, right) => {
      if (left.wins !== right.wins) return right.wins - left.wins
      if (left.differential !== right.differential) return right.differential - left.differential
      if (left.pointsFor !== right.pointsFor) return right.pointsFor - left.pointsFor
      return left.name.localeCompare(right.name)
    })
}

function getKnockoutQualifierCount(totalParticipants: number) {
  const highestPowerOfTwo = Math.pow(2, Math.floor(Math.log2(Math.max(totalParticipants, 2))))
  return Math.max(2, highestPowerOfTwo)
}

function selectQualifiedParticipantIds(groups: GroupStageGroup[], totalParticipants: number) {
  const qualifierCount = Math.min(getKnockoutQualifierCount(totalParticipants), groups.reduce((sum, group) => sum + group.standings.length, 0))
  const selected: string[] = []
  let position = 0

  while (selected.length < qualifierCount) {
    let addedInRound = false

    groups.forEach((group) => {
      const contender = group.standings[position]?.participantId
      if (!contender || selected.includes(contender) || selected.length >= qualifierCount) return
      selected.push(contender)
      addedInRound = true
    })

    if (!addedInRound) break
    position += 1
  }

  return selected
}

function seedQualifiedParticipants(groups: GroupStageGroup[], qualifiedParticipantIds: string[]) {
  const seeding = groups.flatMap((group) =>
    group.standings
      .filter((row) => qualifiedParticipantIds.includes(row.participantId))
      .map((row, index) => ({ participantId: row.participantId, seedBand: index, groupLabel: group.label, wins: row.wins, differential: row.differential })),
  )

  return [...seeding]
    .sort((left, right) => {
      if (left.seedBand !== right.seedBand) return left.seedBand - right.seedBand
      if (left.wins !== right.wins) return right.wins - left.wins
      if (left.differential !== right.differential) return right.differential - left.differential
      return left.groupLabel.localeCompare(right.groupLabel)
    })
    .map((entry) => entry.participantId)
}

export function getRequiredWins(matchFormat: MatchFormat) {
  const bestOf = Number.parseInt(matchFormat.replace('bo', ''), 10)
  return Math.floor(bestOf / 2) + 1
}

export function createInitialBracketMatches(
  tournamentId: string,
  participantIds: string[],
  mode: TournamentMode = 'knockout',
  requestedGroupCount = 1,
) {
  if (mode === 'group' || mode === 'both') {
    return createGroupStageMatches(tournamentId, participantIds, requestedGroupCount)
  }

  return createKnockoutMatches(tournamentId, shuffleParticipants(participantIds), 1)
}

export function getScoreValidationMessage(scoreA: string, scoreB: string, matchFormat: MatchFormat = 'bo1') {
  if (scoreA.trim() === '' || scoreB.trim() === '') {
    return 'Trag beide Resultate ein.'
  }

  const parsedScoreA = Number.parseInt(scoreA, 10)
  const parsedScoreB = Number.parseInt(scoreB, 10)

  if (Number.isNaN(parsedScoreA) || Number.isNaN(parsedScoreB)) {
    return 'Resultate müssen Zahlen sein.'
  }

  if (parsedScoreA < 0 || parsedScoreB < 0) {
    return 'Resultate können nicht negativ sein.'
  }

  if (parsedScoreA === parsedScoreB) {
    return 'Es braucht einen Sieger, ein Unentschieden geht hier nicht.'
  }

  if (matchFormat === 'bo1') {
    return null
  }

  const requiredWins = getRequiredWins(matchFormat)
  const bestOf = Number.parseInt(matchFormat.replace('bo', ''), 10)
  const winningScore = Math.max(parsedScoreA, parsedScoreB)
  const losingScore = Math.min(parsedScoreA, parsedScoreB)

  if (winningScore !== requiredWins) {
    return `Ein ${matchFormat.toUpperCase()}-Spiel endet, sobald eine Seite ${requiredWins} Siege hat.`
  }

  if (losingScore >= requiredWins) {
    return `Die unterlegene Seite bleibt im ${matchFormat.toUpperCase()} unter ${requiredWins} Siegen.`
  }

  if (parsedScoreA + parsedScoreB > bestOf) {
    return `Im ${matchFormat.toUpperCase()} gibt es nicht so viele Spiele.`
  }

  return null
}

function buildKnockoutProgressionChanges(tournamentId: string, matches: Match[], startRound = 1) {
  const orderedMatches = orderKnockoutMatches(matches, startRound)
  const rounds = buildRoundMap(orderedMatches)
  const updates: MatchUpdate[] = []
  const inserts: MatchInsert[] = []
  const maxRound = Math.max(...orderedMatches.map((match) => match.round), startRound - 1)

  for (let round = startRound; round <= maxRound; round += 1) {
    const currentRoundMatches = rounds.get(round) ?? []
    if (currentRoundMatches.length === 0) continue

    const nextRoundNumber = round + 1
    const expectedNextRoundSize = Math.ceil(currentRoundMatches.length / 2)
    const nextRoundMatches = rounds.get(nextRoundNumber) ?? []

    if (nextRoundMatches.length === 0) {
      if (currentRoundMatches.length <= 1) continue

      const nextRound = Array.from({ length: expectedNextRoundSize }, (_, index) => {
        const sourceMatchA = currentRoundMatches[index * 2]
        const sourceMatchB = currentRoundMatches[index * 2 + 1]
        const participantA = sourceMatchA?.winner ?? null
        const participantB = sourceMatchB?.winner ?? null
        const hasBye = Boolean(participantA && !sourceMatchB)

        return {
          tournament_id: tournamentId,
          participant_a: participantA,
          participant_b: participantB,
          round: nextRoundNumber,
          score_a: hasBye ? 1 : null,
          score_b: hasBye ? 0 : null,
          winner: hasBye ? participantA : null,
        }
      })
      const hasKnownParticipants = nextRound.some((match) => match.participant_a !== null || match.participant_b !== null)

      if (!hasKnownParticipants) continue

      inserts.push(...nextRound)
      rounds.set(
        nextRoundNumber,
        nextRound.map((match, index) => ({
          id: `generated-${nextRoundNumber}-${index}`,
          tournament_id: match.tournament_id,
          participant_a: match.participant_a,
          participant_b: match.participant_b,
          round: match.round,
          score_a: match.score_a,
          score_b: match.score_b,
          winner: match.winner,
        })),
      )
      continue
    }

    nextRoundMatches.forEach((match, index) => {
      const sourceMatchA = currentRoundMatches[index * 2]
      const sourceMatchB = currentRoundMatches[index * 2 + 1]
      const expectedParticipantA = sourceMatchA?.winner ?? null
      const expectedParticipantB = sourceMatchB?.winner ?? null
      const hasBye = Boolean(expectedParticipantA && !sourceMatchB)
      // A downstream result only survives if the winner still belongs to the
      // updated pairing after earlier rounds were edited.
      const currentWinnerStillValid = match.winner !== null && [expectedParticipantA, expectedParticipantB].includes(match.winner)

      const scoreA = hasBye ? 1 : currentWinnerStillValid ? match.score_a : null
      const scoreB = hasBye ? 0 : currentWinnerStillValid ? match.score_b : null
      const winner = hasBye ? expectedParticipantA : currentWinnerStillValid ? match.winner : null

      if (
        match.participant_a !== expectedParticipantA ||
        match.participant_b !== expectedParticipantB ||
        match.score_a !== scoreA ||
        match.score_b !== scoreB ||
        match.winner !== winner
      ) {
        updates.push({
          id: match.id,
          participant_a: expectedParticipantA,
          participant_b: expectedParticipantB,
          score_a: scoreA,
          score_b: scoreB,
          winner,
        })

        nextRoundMatches[index] = {
          ...match,
          participant_a: expectedParticipantA,
          participant_b: expectedParticipantB,
          score_a: scoreA,
          score_b: scoreB,
          winner,
        }
      }
    })

    rounds.set(nextRoundNumber, nextRoundMatches)
  }

  return { updates, inserts }
}

export function getTournamentStructure(
  mode: TournamentMode,
  requestedGroupCount: number,
  participants: Participant[],
  matches: Match[],
): TournamentStructure {
  if (mode === 'knockout') {
    return {
      groupStageRoundCount: 0,
      knockoutStartRound: 1,
      groupStageMatches: [],
      knockoutMatches: orderKnockoutMatches(matches, 1),
      groups: [],
      qualifiedParticipantIds: [],
      isGroupStageComplete: false,
    }
  }

  const groupSizes = getGroupSizes(participants.length, requestedGroupCount)
  const groupStageRoundCount = Math.max(...groupSizes.map(getRoundRobinRoundCount), 0)
  const groupStageMatches = sortMatches(matches.filter((match) => match.round <= groupStageRoundCount))
  const knockoutMatches =
    mode === 'both' ? orderKnockoutMatches(matches.filter((match) => match.round > groupStageRoundCount), groupStageRoundCount + 1) : []
  const connectedGroups = buildConnectedGroups(participants, groupStageMatches)
    .map((participantIds) => [...participantIds].sort((left, right) => getParticipantName(participants, left).localeCompare(getParticipantName(participants, right))))
    .sort((left, right) => getParticipantName(participants, left[0] ?? '').localeCompare(getParticipantName(participants, right[0] ?? '')))

  const groups = connectedGroups.map((participantIds, index) => {
    const groupMatches = groupStageMatches.filter(
      (match) =>
        Boolean(match.participant_a && participantIds.includes(match.participant_a)) &&
        Boolean(match.participant_b && participantIds.includes(match.participant_b)),
    )

    return {
      label: `Gruppe ${String.fromCharCode(65 + index)}`,
      participantIds,
      matches: groupMatches,
      standings: buildGroupStandings(participants, groupMatches, participantIds),
    }
  })

  const isGroupStageComplete = groupStageMatches.length > 0 && groupStageMatches.every((match) => match.winner !== null)
  const qualifiedParticipantIds = mode === 'both' && isGroupStageComplete ? selectQualifiedParticipantIds(groups, participants.length) : []

  return {
    groupStageRoundCount,
    knockoutStartRound: groupStageRoundCount + 1,
    groupStageMatches,
    knockoutMatches,
    groups,
    qualifiedParticipantIds,
    isGroupStageComplete,
  }
}

export function buildBracketProgressionChanges(
  tournamentId: string,
  matches: Match[],
  mode: TournamentMode = 'knockout',
  requestedGroupCount = 1,
  participants: Participant[] = [],
) {
  if (mode === 'knockout') {
    return buildKnockoutProgressionChanges(tournamentId, matches, 1)
  }

  if (mode === 'group') {
    return { updates: [] as MatchUpdate[], inserts: [] as MatchInsert[] }
  }

  const structure = getTournamentStructure(mode, requestedGroupCount, participants, matches)

  if (structure.knockoutMatches.length === 0) {
    if (!structure.isGroupStageComplete) {
      return { updates: [] as MatchUpdate[], inserts: [] as MatchInsert[] }
    }

    const seededParticipants = seedQualifiedParticipants(structure.groups, structure.qualifiedParticipantIds)
    return {
      updates: [] as MatchUpdate[],
      inserts: createKnockoutMatches(tournamentId, seededParticipants, structure.knockoutStartRound),
    }
  }

  return buildKnockoutProgressionChanges(tournamentId, structure.knockoutMatches, structure.knockoutStartRound)
}
