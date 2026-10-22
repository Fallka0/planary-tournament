// The schedule on its own: stations, players waiting for their previous match, and delays.

import { describe, expect, it } from 'vitest';
import { delayMinutes, schedule, type SlotMatch } from '../src/lib/schedule';

const MIN = 60_000;
const T0 = Date.parse('2026-10-20T10:00:00+02:00');

function m(id: string, round: number, a: string | null, b: string | null, extra: Partial<SlotMatch> = {}): SlotMatch {
  return { id, round, participant_a: a, participant_b: b, winner: null, station_id: null, planned_at: null, scheduled_at: null, started_at: null, finished_at: null, ...extra };
}

const opts = (extra: Partial<Parameters<typeof schedule>[1]> = {}) => ({ start: T0, now: T0, matchMs: 30 * MIN, breakMs: 5 * MIN, stations: ['s1', 's2'], ...extra });

function apply(list: SlotMatch[], changes: ReturnType<typeof schedule>) {
  return list.map((x) => ({ ...x, ...(changes.get(x.id) ?? {}) }));
}

describe('schedule', () => {
  it('spreads a round over the stations and queues the rest', () => {
    const list = [m('1', 1, 'a', 'b'), m('2', 1, 'c', 'd'), m('3', 1, 'e', 'f')];
    const out = apply(list, schedule(list, opts()));
    expect(out.map((x) => [x.station_id, (x.planned_at! - T0) / MIN])).toEqual([
      ['s1', 0],
      ['s2', 0],
      ['s1', 35],
    ]);
  });

  it('waits for the previous round while the players are not known', () => {
    const list = [m('1', 1, 'a', 'b'), m('2', 1, 'c', 'd'), m('3', 2, null, null)];
    const out = apply(list, schedule(list, opts()));
    expect((out[2].planned_at! - T0) / MIN).toBe(35);
  });

  it('runs everything at once without stations, but a player plays one match at a time', () => {
    const list = [m('1', 1, 'a', 'b'), m('2', 1, 'c', 'd'), m('3', 2, 'a', 'c')];
    const out = apply(list, schedule(list, opts({ stations: [] })));
    expect(out.map((x) => [x.station_id, (x.planned_at! - T0) / MIN])).toEqual([
      [null, 0],
      [null, 0],
      [null, 35],
    ]);
  });

  it('pushes later matches back when a match runs late, and never earlier than planned', () => {
    let list = [m('1', 1, 'a', 'b'), m('2', 1, 'c', 'd'), m('3', 1, 'e', 'f'), m('4', 1, 'g', 'h')];
    list = apply(list, schedule(list, opts()));
    // Match 1 started 10 minutes late and runs 20 minutes over.
    list[0] = { ...list[0], started_at: T0 + 10 * MIN };
    const now = T0 + 60 * MIN;
    list = apply(list, schedule(list, opts({ now })));
    const third = list[2];
    expect(third.station_id).toBe('s1');
    expect((third.planned_at! - T0) / MIN).toBe(35);
    // Match 1 is still running at 11:00: the earliest end is now, plus the break.
    expect((third.scheduled_at! - T0) / MIN).toBe(65);
    expect(delayMinutes(third)).toBe(30);
    // Station 2 is on time: match 4 keeps its plan.
    list[1] = { ...list[1], started_at: T0, finished_at: T0 + 25 * MIN, winner: 'c' };
    list = apply(list, schedule(list, opts({ now: T0 + 26 * MIN })));
    expect(delayMinutes(list[3])).toBe(0);
  });

  it('skips byes', () => {
    const list = [m('1', 1, 'a', null, { winner: 'a' }), m('2', 1, 'b', 'c')];
    const out = schedule(list, opts());
    expect(out.has('1')).toBe(false);
    expect(out.get('2')?.station_id).toBe('s1');
  });
});
