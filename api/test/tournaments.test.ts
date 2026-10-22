// Tournaments end to end: plans and limits, sign-up with waiting list and check-in, the start,
// the bracket to the final, teams reporting results, permissions, exports and the live room.

import { beforeEach, describe, expect, it } from 'vitest';
import { call, del, env, EVENT, get, json, MATTEO, MEMBER, ok, OWNER, PLAYERS, PNG, post, reset, soloTournament } from './helpers';

beforeEach(reset);

async function playAll(id: string, who = MATTEO) {
  // Plays every open match with a 1:0 for side A, round by round, until nothing is left.
  for (let i = 0; i < 50; i++) {
    const v = await ok(get(`/t/${id}`, who));
    if (v.tournament.state !== 'live') return v;
    const open = v.matches.filter((m: any) => m.participant_a && m.participant_b && !m.winner);
    if (!open.length) return v;
    await ok(post(`/t/${id}/matches/${open[0].id}/result`, { a: '1', b: '0' }, who));
  }
  throw new Error('did not finish');
}

describe('creating', () => {
  it('needs an account and picks a free address', async () => {
    expect((await post('/tournaments', { name: 'Gurten LAN', game: 'CS2' })).status).toBe(401);
    const a = await ok(post('/tournaments', { name: 'Gurten LAN', game: 'CS2' }, MATTEO));
    const b = await ok(post('/tournaments', { name: 'Gurten LAN', game: 'CS2' }, MATTEO));
    expect(a.slug).toBe('gurten-lan');
    expect(b.slug).toBe('gurten-lan-2');
    expect((await post('/tournaments', { name: 'Neu', game: 'CS2', slug: 'neu' }, MATTEO)).status).toBe(400);
  });

  it('keeps drafts to the organisers', async () => {
    const { id, slug } = await ok(post('/tournaments', { name: 'Geheim', game: 'CS2' }, MATTEO));
    expect((await get(`/t/${slug}`)).status).toBe(404);
    expect((await get(`/t/${slug}`, PLAYERS[0])).status).toBe(404);
    const v = await ok(get(`/t/${id}`, MATTEO));
    expect(v.me.role).toBe('owner');
    expect(v.limits.planName).toBe('Gratis');
    expect((await post(`/t/${id}/publish`, {}, PLAYERS[0])).status).toBe(403);
    await ok(post(`/t/${id}/publish`, {}, MATTEO));
    expect((await get(`/t/${slug}`)).status).toBe(200);
  });

  it('holds Gratis to its limits and opens features with a better plan', async () => {
    const big = await json(post('/tournaments', { name: 'Gross', game: 'CS2', maxTeams: 32 }, MATTEO));
    expect(big.code).toBe('plan_team_limit');
    expect(big.error).toContain('bis 16 Teams');
    expect((await json(post('/tournaments', { name: 'Check', game: 'CS2', checkIn: true }, MATTEO))).code).toBe('plan_feature');
    const ev = await ok(post('/tournaments', { name: 'Event', game: 'CS2', maxTeams: 64, checkIn: true, waitingList: true, brandColor: '#1F1B3A' }, EVENT));
    const v = await ok(get(`/t/${ev.id}`, EVENT));
    expect(v.tournament.checkIn).toBe(true);
    expect(v.tournament.brand).toEqual({ logoUrl: null, color: '#1f1b3a' });
  });

  it('runs in an organisation for its members only', async () => {
    expect((await json(post('/tournaments', { name: 'Fremd', game: 'CS2', organisationId: 'org_verein' }, MATTEO))).code).toBe('not_member');
    const t = await ok(post('/tournaments', { name: 'Vereinsturnier', game: 'CS2', organisationId: 'org_verein', organisationName: 'Verein Gurten LAN', maxTeams: 128 }, OWNER));
    // A member of the organisation runs it with the owner.
    const v = await ok(get(`/t/${t.id}`, MEMBER));
    expect(v.me.role).toBe('admin');
    expect(v.limits.planName).toBe('Verein');
    const mine = await ok(get('/tournaments?mine=1', MEMBER));
    expect(mine.organising.map((x: any) => x.id)).toEqual([t.id]);
    const me = await ok(get('/me', MEMBER));
    expect(me.orgs[0]).toMatchObject({ id: 'org_verein', role: 'member' });
  });
});

describe('signing up', () => {
  it('signs players up once, closes when full, and lists public tournaments', async () => {
    const id = await soloTournament(MATTEO, 3, { maxTeams: 4 });
    expect((await json(post(`/t/${id}/entries`, {}, PLAYERS[0]))).code).toBe('already_entered');
    await ok(post(`/t/${id}/entries`, {}, PLAYERS[3]));
    expect((await json(post(`/t/${id}/entries`, {}, PLAYERS[4]))).code).toBe('full');
    const list = await ok(get('/tournaments'));
    expect(list.tournaments[0]).toMatchObject({ slug: 'gurten-lan', teams: 4, maxTeams: 4 });
    expect((await ok(get('/tournaments?q=gurten'))).tournaments).toHaveLength(1);
    expect((await ok(get('/tournaments?q=nichts'))).tournaments).toHaveLength(0);
    // Players see their own sign-up.
    const v = await ok(get(`/t/${id}`, PLAYERS[1]));
    expect(v.me.entryId).toBe(v.entries[1].id);
    expect(JSON.stringify(v)).not.toContain('@play.test');
  });

  it('puts late sign-ups on the waiting list and moves them up when someone leaves', async () => {
    const { id } = await ok(post('/tournaments', { name: 'Warte', game: 'CS2', entryType: 'solo', maxTeams: 2, waitingList: true, publish: true }, EVENT));
    for (const p of PLAYERS.slice(0, 4)) await ok(post(`/t/${id}/entries`, {}, p));
    let v = await ok(get(`/t/${id}`, EVENT));
    expect(v.entries.map((e: any) => e.status)).toEqual(['confirmed', 'confirmed', 'waiting', 'waiting']);
    await ok(del(`/t/${id}/entries/${v.entries[0].id}`, PLAYERS[0]));
    v = await ok(get(`/t/${id}`, EVENT));
    expect(v.entries.map((e: any) => [e.name, e.status])).toEqual([
      ['Spieler 2', 'confirmed'],
      ['Spieler 3', 'confirmed'],
      ['Spieler 4', 'waiting'],
    ]);
    // Others can't remove someone else's sign-up.
    expect((await del(`/t/${id}/entries/${v.entries[0].id}`, PLAYERS[3])).status).toBe(403);
  });

  it('signs teams up with their roster and checks the team size', async () => {
    const { id } = await ok(post('/tournaments', { name: 'Teams', game: 'Valorant', entryType: 'team', teamSize: 3, publish: true }, MATTEO));
    const small = await ok(post('/teams', { name: 'Zwei', members: ['A', 'B'] }, PLAYERS[0]));
    expect((await json(post(`/t/${id}/entries`, { teamId: small.id }, PLAYERS[0]))).code).toBe('team_too_small');
    const team = await ok(post('/teams', { name: 'Berner Bären', tag: 'bb', members: ['A', 'B', 'C'] }, PLAYERS[0]));
    expect((await json(post(`/t/${id}/entries`, { teamId: team.id }, PLAYERS[1]))).code).toBe('invalid_team');
    await ok(post(`/t/${id}/entries`, { teamId: team.id }, PLAYERS[0]));
    const v = await ok(get(`/t/${id}`));
    expect(v.entries[0]).toMatchObject({ name: 'Berner Bären', members: ['A', 'B', 'C'] });
    // Organisers add teams by name.
    await ok(post(`/t/${id}/entries`, { name: 'Gastteam' }, MATTEO));
    expect((await json(post(`/t/${id}/entries`, { name: 'gastteam' }, MATTEO))).code).toBe('duplicate_name');
  });

  it('starts with the checked-in field and fills up from the checked-in waiting list', async () => {
    const { id } = await ok(post('/tournaments', { name: 'Check-in', game: 'CS2', entryType: 'solo', maxTeams: 4, checkIn: true, waitingList: true, publish: true }, EVENT));
    for (const p of PLAYERS.slice(0, 6)) await ok(post(`/t/${id}/entries`, {}, p));
    let v = await ok(get(`/t/${id}`, EVENT));
    expect(v.tournament.checkInOpen).toBe(true);
    // Players 1, 2 and 3 check in; 4 doesn't; 5 on the waiting list does.
    for (const i of [0, 1, 2, 4]) await ok(post(`/t/${id}/entries/${v.entries[i].id}/check-in`, { checkedIn: true }, PLAYERS[i]));
    expect((await post(`/t/${id}/entries/${v.entries[0].id}/check-in`, {}, PLAYERS[1])).status).toBe(403);
    const preview = await ok(post(`/t/${id}/start`, { dryRun: true }, EVENT));
    expect(preview).toEqual({ plays: ['Spieler 1', 'Spieler 2', 'Spieler 3', 'Spieler 5'], dropped: ['Spieler 4'], promoted: ['Spieler 5'] });
    v = await ok(post(`/t/${id}/start`, {}, EVENT));
    expect(v.tournament.state).toBe('live');
    const inBracket = new Set(v.matches.flatMap((m: any) => [m.participant_a, m.participant_b]).filter(Boolean));
    expect([...inBracket].map((eid) => v.entries.find((e: any) => e.id === eid).name).sort()).toEqual(['Spieler 1', 'Spieler 2', 'Spieler 3', 'Spieler 5']);
    expect((await json(post(`/t/${id}/entries`, {}, PLAYERS[10]))).code).toBe('already_started');
  });
});

describe('playing', () => {
  it('plays a knockout to the final and finishes by itself', async () => {
    const id = await soloTournament(MATTEO, 6);
    await ok(post(`/t/${id}/stations`, { stations: ['Tisch 1', 'Tisch 2'] }, MATTEO));
    let v = await ok(post(`/t/${id}/start`, {}, MATTEO));
    expect(v.tournament.phase).toBe('Viertelfinals');
    const first = v.matches.filter((m: any) => m.participant_a && m.participant_b);
    expect(first.every((m: any) => m.station && m.plannedAt)).toBe(true);
    expect((await json(post(`/t/${id}/matches/${first[0].id}/result`, { a: '1', b: '1' }, MATTEO))).code).toBe('invalid_score');
    v = await playAll(id);
    expect(v.tournament.state).toBe('done');
    expect(v.tournament.phase).toBeNull();
    const finals = v.matches.filter((m: any) => m.round === Math.max(...v.matches.map((x: any) => x.round)));
    expect(finals).toHaveLength(1);
    expect(finals[0].winner).toBeTruthy();
    // Results after the end need the tournament reopened.
    expect((await json(post(`/t/${id}/matches/${finals[0].id}/reset`, {}, MATTEO))).code).toBe('not_live');
    await ok(post(`/t/${id}/reopen`, {}, MATTEO));
    v = await ok(post(`/t/${id}/matches/${finals[0].id}/reset`, {}, MATTEO));
    expect(v.tournament.state).toBe('live');
    expect(v.tournament.phase).toBe('Final');
  });

  it('runs groups, then the knockout of the best', async () => {
    const id = await soloTournament(MATTEO, 8, { mode: 'both', groupCount: 2 });
    let v = await ok(post(`/t/${id}/start`, {}, MATTEO));
    expect(v.tournament.phase).toBe('Gruppenphase');
    v = await playAll(id);
    expect(v.tournament.state).toBe('done');
    const rounds = new Set(v.matches.map((m: any) => m.round));
    expect(rounds.size).toBeGreaterThan(3);
  });

  it('lets teams report and confirm, and sends disagreements to the organisers', async () => {
    const id = await soloTournament(MATTEO, 2, { confirmResults: true });
    let v = await ok(post(`/t/${id}/start`, {}, MATTEO));
    const m = v.matches[0];
    const sideA = PLAYERS[v.entries.findIndex((e: any) => e.id === m.participant_a)];
    const sideB = PLAYERS[v.entries.findIndex((e: any) => e.id === m.participant_b)];
    expect((await post(`/t/${id}/matches/${m.id}/report`, { a: '1', b: '0' }, PLAYERS[5])).status).toBe(403);
    v = await ok(post(`/t/${id}/matches/${m.id}/report`, { a: '1', b: '0' }, sideA));
    expect(v.matches[0].report).toMatchObject({ by: m.participant_a, a: 1, b: 0 });
    expect(v.matches[0].winner).toBeNull();
    expect((await json(post(`/t/${id}/matches/${m.id}/confirm`, {}, sideA))).code).toBe('own_report');
    // B disagrees: the organisers decide.
    v = await ok(post(`/t/${id}/matches/${m.id}/report`, { a: '0', b: '1' }, sideB));
    expect(v.matches[0].disputed).toBe(true);
    expect((await json(post(`/t/${id}/matches/${m.id}/confirm`, {}, sideA))).code).toBe('disputed');
    v = await ok(post(`/t/${id}/matches/${m.id}/result`, { a: '1', b: '0' }, MATTEO));
    expect(v.matches[0]).toMatchObject({ winner: m.participant_a, report: null, disputed: false });
    expect(v.tournament.state).toBe('done');
  });

  it('confirms a report into the result', async () => {
    const id = await soloTournament(MATTEO, 2, { confirmResults: true, matchFormat: 'bo3' });
    const v0 = await ok(post(`/t/${id}/start`, {}, MATTEO));
    const m = v0.matches[0];
    const sideA = PLAYERS[v0.entries.findIndex((e: any) => e.id === m.participant_a)];
    const sideB = PLAYERS[v0.entries.findIndex((e: any) => e.id === m.participant_b)];
    expect((await json(post(`/t/${id}/matches/${m.id}/report`, { a: '1', b: '0' }, sideA))).code).toBe('invalid_score');
    await ok(post(`/t/${id}/matches/${m.id}/report`, { a: '2', b: '1' }, sideA));
    const v = await ok(post(`/t/${id}/matches/${m.id}/confirm`, {}, sideB));
    expect(v.matches[0]).toMatchObject({ score_a: 2, score_b: 1, winner: m.participant_a });
  });

  it('allows one running tournament on Gratis', async () => {
    const a = await soloTournament(MATTEO, 2);
    await ok(post(`/t/${a}/start`, {}, MATTEO));
    const { id: b } = await ok(post('/tournaments', { name: 'Zweites', game: 'CS2', entryType: 'solo', publish: true }, MATTEO));
    await ok(post(`/t/${b}/entries`, { name: 'X' }, MATTEO));
    await ok(post(`/t/${b}/entries`, { name: 'Y' }, MATTEO));
    expect((await json(post(`/t/${b}/start`, {}, MATTEO))).code).toBe('plan_running_limit');
  });
});

describe('organisers', () => {
  it('adds scorers by username where the plan allows', async () => {
    const id = await soloTournament(MATTEO, 2);
    await ok(get('/me', PLAYERS[9]));
    const username = (await ok(get('/me', PLAYERS[9]))).me.username;
    expect((await json(post(`/t/${id}/organisers`, { username, role: 'scorer' }, MATTEO))).code).toBe('plan_organiser_limit');

    const t = await ok(post('/tournaments', { name: 'Verein', game: 'CS2', entryType: 'solo', organisationId: 'org_verein', publish: true }, OWNER));
    await ok(post(`/t/${t.id}/organisers`, { username, role: 'scorer' }, OWNER));
    await ok(post(`/t/${t.id}/entries`, { name: 'A' }, OWNER));
    await ok(post(`/t/${t.id}/entries`, { name: 'B' }, OWNER));
    const v = await ok(post(`/t/${t.id}/start`, {}, OWNER));
    // A scorer enters results but doesn't run the tournament.
    expect((await post(`/t/${t.id}/finish`, {}, PLAYERS[9])).status).toBe(403);
    await ok(post(`/t/${t.id}/matches/${v.matches[0].id}/result`, { a: '0', b: '1' }, PLAYERS[9]));
    expect((await del(`/t/${t.id}`, MEMBER)).status).toBe(403);
    await ok(del(`/t/${t.id}`, OWNER));
    expect((await get(`/t/${t.id}`)).status).toBe(404);
  });
});

describe('profiles, logos and exports', () => {
  it('creates a profile with a username and shows the organiser page', async () => {
    const me = await ok(get('/me', MATTEO));
    expect(me.me).toMatchObject({ username: 'matteo-keller', name: 'Matteo Keller' });
    expect((await json(post('/me', { username: 'A' }, MATTEO))).code).toBe('invalid_username');
    expect((await json(post('/me', { website: 'javascript:alert(1)' }, MATTEO))).code).toBe('invalid_url');
    await ok(post('/me', { username: 'matteo', bio: 'Leitet den Gurten LAN.', website: 'https://gurtenlan.ch' }, MATTEO));
    await soloTournament(MATTEO, 2);
    const page = await ok(get('/people/matteo'));
    expect(page.profile).toMatchObject({ username: 'matteo', bio: 'Leitet den Gurten LAN.' });
    expect(page.tournaments).toHaveLength(1);
    expect(JSON.stringify(page)).not.toContain('@gurten.test');
  });

  it('stores logos for plans with branding, checked by their bytes', async () => {
    const free = await soloTournament(MATTEO, 0);
    const form = () => {
      const f = new FormData();
      f.append('file', new File([PNG], 'logo.png', { type: 'image/png' }));
      return f;
    };
    expect((await json(call('POST', `/t/${free}/logo`, { who: MATTEO, form: form() }))).code).toBe('plan_feature');
    const { id } = await ok(post('/tournaments', { name: 'Marke', game: 'CS2' }, EVENT));
    const v = await ok(call('POST', `/t/${id}/logo`, { who: EVENT, form: form() }));
    const path = new URL(v.tournament.brand.logoUrl).pathname;
    const img = await get(path);
    expect(img.headers.get('content-type')).toBe('image/png');
    const svg = new FormData();
    svg.append('file', new File(['<svg/>'], 'x.png', { type: 'image/png' }));
    expect((await call('POST', `/t/${id}/logo`, { who: EVENT, form: svg })).status).toBe(415);
    expect((await get('/files/../../etc/passwd')).status).toBe(404);
  });

  it('exports CSV and PDF from plan Event', async () => {
    const free = await soloTournament(MATTEO, 2);
    expect((await json(get(`/t/${free}/export.csv`, MATTEO))).code).toBe('plan_feature');
    const { id } = await ok(post('/tournaments', { name: 'Export', game: 'CS2', entryType: 'solo', publish: true }, EVENT));
    await ok(post(`/t/${id}/entries`, { name: '=HYPERLINK("x")' }, EVENT));
    await ok(post(`/t/${id}/entries`, { name: 'Zürich; Bern' }, EVENT));
    await ok(post(`/t/${id}/start`, {}, EVENT));
    await playAll(id, EVENT);
    const entries = await get(`/t/${id}/export.csv?what=entries`, EVENT);
    const text = await entries.text();
    expect(text.startsWith('﻿Name;Status')).toBe(true);
    expect(text).toContain(`'=HYPERLINK(""x"")`);
    expect(text).toContain('"Zürich; Bern"');
    const results = await (await get(`/t/${id}/export.csv`, EVENT)).text();
    expect(results.split('\r\n')[0]).toBe('﻿Runde;Spiel;Station;Geplant;Gespielt;Seite A;Seite B;Resultat A;Resultat B;Sieger');
    expect(results).toContain('Final');
    const pdf = await get(`/t/${id}/export.pdf`, EVENT);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    const bytes = new Uint8Array(await pdf.arrayBuffer());
    const head = new TextDecoder('latin1').decode(bytes);
    expect(head.startsWith('%PDF-1.4')).toBe(true);
    expect(head).toContain('(Rangliste)');
    // ü in WinAnsi is one byte 0xFC.
    expect(head).toContain('Z\xfcrich');
    expect(head.trimEnd().endsWith('%%EOF')).toBe(true);
    expect((await get(`/t/${id}/export.pdf`, PLAYERS[0])).status).toBe(403);
  });
});

describe('live', () => {
  it('sends every change to the room', async () => {
    const id = await soloTournament(MATTEO, 2);
    const res = await get(`/t/${id}/live`, null).then(() => call('GET', `/t/${id}/live`, { headers: { Upgrade: 'websocket' } }));
    expect(res.status).toBe(101);
    const ws = res.webSocket!;
    ws.accept();
    const views: any[] = [];
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(String(e.data));
      if (msg.type === 'view') views.push(msg.view);
    });
    await ok(post(`/t/${id}/start`, {}, MATTEO));
    for (let i = 0; i < 50 && !views.some((v) => v.tournament.state === 'live'); i++) await new Promise((r) => setTimeout(r, 20));
    const live = views.find((v) => v.tournament.state === 'live');
    expect(live.matches).toHaveLength(1);
    expect(live.me).toBeUndefined();
    ws.close();
    // A plain GET explains itself.
    expect((await get(`/t/${id}/live`)).status).toBe(426);
  });

  it('shows incident banners to organisers only', async () => {
    const id = await soloTournament(MATTEO, 0);
    expect((await ok(get(`/t/${id}/banners`, MATTEO))).banners).toHaveLength(1);
    expect((await ok(get(`/t/${id}/banners`, PLAYERS[0]))).banners).toHaveLength(0);
  });
});

describe('teams', () => {
  it('keeps teams to their owner', async () => {
    const t = await ok(post('/teams', { name: 'Bären', members: ['A', 'A', 'B'] }, PLAYERS[0]));
    expect((await ok(get('/teams', PLAYERS[0]))).teams[0]).toMatchObject({ name: 'Bären', members: ['A', 'B'] });
    expect((await post(`/teams/${t.id}`, { name: 'Weg' }, PLAYERS[1])).status).toBe(404);
    expect((await ok(get('/teams', PLAYERS[1]))).teams).toHaveLength(0);
    await ok(del(`/teams/${t.id}`, PLAYERS[0]));
    expect(env).toBeTruthy();
  });
});
