// Exports for organisers (plan Event and up):
//   GET /t/:id/export.csv?what=results|entries   semicolon CSV with a BOM, so Excel in de-CH opens it as is
//   GET /t/:id/export.pdf                        the results: ranking, groups, every match

import { Hono, type Context } from 'hono';
import { getTournamentStructure } from '../../../src/shared/bracket';
import { roundLabels } from '../../../src/shared/rounds';
import type { AppEnv } from '../env';
import { requirePerson } from '../lib/auth';
import { asMatch, featuresOf, formatLine, loadBundle, loadTournament, participantsOf, requireRole, roleOf, safeList, type Bundle } from '../lib/core';
import { PLAN_NAME } from '../lib/org';
import { renderPdf, type Line } from '../lib/pdf';
import { ApiError } from '../lib/util';

export const exportApp = new Hono<AppEnv>();

const ZONE = 'Europe/Zurich';

function when(ms: number | null) {
  if (!ms) return '';
  return new Intl.DateTimeFormat('de-CH', { timeZone: ZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms)).replace(',', '');
}

/** A cell: quoted when needed; formulas defused so a name can't run in Excel. */
function cell(v: unknown) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const csv = (rows: unknown[][]) => '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';

async function exporter(c: Context<AppEnv>) {
  const person = await requirePerson(c);
  const t = await loadTournament(c.env, c.req.param('id') ?? '');
  const b = await loadBundle(c.env, t);
  requireRole(await roleOf(c.env, t, person, b.organisers), 'run');
  const features = await featuresOf(c.env, t);
  if (!features.limits.export) throw new ApiError(403, `Den Export gibt es mit dem Turnier-Pass oder mit Plus. Dein Turnier läuft im Plan ${PLAN_NAME[features.plan]}.`, 'plan_feature');
  return b;
}

/** 1, 2, then 3 for both semifinal losers, from the knockout; null without a decided final. */
export function ranking(b: Bundle) {
  const participants = participantsOf(b.entries, b.t.id);
  const s = getTournamentStructure(b.t.mode, b.t.group_count, participants, b.matches.map(asMatch));
  const name = (id: string | null) => b.entries.find((e) => e.id === id)?.name ?? '';
  if (b.t.mode === 'group') {
    if (!s.isGroupStageComplete || s.groups.length !== 1) return null;
    return s.groups[0].standings.map((r, i) => ({ place: i + 1, name: r.name }));
  }
  const ko = s.knockoutMatches;
  if (!ko.length) return null;
  const last = Math.max(...ko.map((m) => m.round));
  const final = ko.filter((m) => m.round === last);
  if (final.length !== 1 || !final[0].winner) return null;
  const f = final[0];
  const out = [
    { place: 1, name: name(f.winner) },
    { place: 2, name: name(f.winner === f.participant_a ? f.participant_b : f.participant_a) },
  ];
  for (const m of ko.filter((x) => x.round === last - 1 && x.winner && x.participant_a && x.participant_b)) {
    out.push({ place: 3, name: name(m.winner === m.participant_a ? m.participant_b : m.participant_a) });
  }
  return out;
}

exportApp.get('/t/:id/export.csv', async (c) => {
  const b = await exporter(c);
  const what = c.req.query('what') === 'entries' ? 'entries' : 'results';
  const name = (id: string | null) => b.entries.find((e) => e.id === id)?.name ?? '';
  let body: string;
  if (what === 'entries') {
    body = csv([
      ['Name', 'Status', 'Eingecheckt', 'Mitglieder', 'Angemeldet'],
      ...b.entries.map((e) => [e.name, e.status === 'confirmed' ? (b.t.state === 'open' || b.t.state === 'draft' ? 'Angemeldet' : 'Im Turnier') : 'Warteliste', e.checked_in_at ? when(e.checked_in_at) : '', safeList(e.members).join(', '), when(e.created_at)]),
    ]);
  } else {
    const labels = roundLabels(b.t.mode, b.t.group_count, participantsOf(b.entries, b.t.id), b.matches.map(asMatch));
    const station = new Map(b.stations.map((s) => [s.id, s.name]));
    body = csv([
      ['Runde', 'Spiel', 'Station', 'Geplant', 'Gespielt', 'Seite A', 'Seite B', 'Resultat A', 'Resultat B', 'Sieger'],
      ...b.matches
        .filter((m) => m.participant_a && m.participant_b)
        .map((m, i) => [labels.get(m.round) ?? `Runde ${m.round}`, i + 1, m.station_id ? station.get(m.station_id) ?? '' : '', when(m.planned_at), when(m.finished_at), name(m.participant_a), name(m.participant_b), m.score_a ?? '', m.score_b ?? '', name(m.winner)]),
    ]);
  }
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${b.t.slug}-${what === 'entries' ? 'anmeldungen' : 'resultate'}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
});

exportApp.get('/t/:id/export.pdf', async (c) => {
  const b = await exporter(c);
  const { t } = b;
  const participants = participantsOf(b.entries, t.id);
  const matches = b.matches.map(asMatch);
  const s = getTournamentStructure(t.mode, t.group_count, participants, matches);
  const labels = roundLabels(t.mode, t.group_count, participants, matches);
  const name = (id: string | null) => b.entries.find((e) => e.id === id)?.name ?? 'offen';
  const lines: Line[] = [
    { text: t.name, size: 22, bold: true },
    { text: [t.game, formatLine(t), when(t.starts_at), t.venue].filter(Boolean).join(' · '), muted: true, gap: 2 },
    { text: `${t.organisation_name || t.owner_name} · ${participants.length} ${t.entry_type === 'team' ? 'Teams' : 'Spieler'} · ${t.state === 'done' ? 'Abgeschlossen' : t.state === 'live' ? 'Läuft' : 'Noch nicht gestartet'}`, muted: true },
  ];
  const rank = ranking(b);
  if (rank) {
    lines.push({ text: 'Rangliste', size: 14, bold: true, gap: 18 });
    for (const r of rank) lines.push({ text: `${r.place}.  ${r.name}`, size: 11, gap: 2 });
  }
  for (const g of s.groups) {
    lines.push({ text: g.label, size: 14, bold: true, gap: 18 });
    lines.push({ text: 'Platz  Name  ·  Spiele  Siege  Niederlagen  Differenz', muted: true, size: 9 });
    g.standings.forEach((r, i) => lines.push({ text: `${i + 1}.  ${r.name}  ·  ${r.played}  ${r.wins}  ${r.losses}  ${r.differential > 0 ? '+' : ''}${r.differential}`, gap: 1 }));
  }
  const rounds = [...new Set(b.matches.map((m) => m.round))].sort((x, y) => x - y);
  for (const r of rounds) {
    const list = b.matches.filter((m) => m.round === r && m.participant_a && m.participant_b);
    if (!list.length) continue;
    lines.push({ text: labels.get(r) ?? `Runde ${r}`, size: 14, bold: true, gap: 18 });
    for (const m of list) {
      const result = m.winner ? `${m.score_a} : ${m.score_b}` : 'offen';
      lines.push({ text: `${name(m.participant_a)} gegen ${name(m.participant_b)}    ${result}`, gap: 2 });
    }
  }
  lines.push({ text: `Erstellt mit Planary Tournament am ${when(Date.now())}. tournament.planary.ch/${t.slug}`, muted: true, size: 8, gap: 24 });
  return new Response(renderPdf(t.name, lines), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${t.slug}-resultate.pdf"`, 'Cache-Control': 'no-store' },
  });
});
