import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// Tests run inside the Workers runtime with a local D1, R2 and the TournamentRoom object.
// AUTH stands in for planary-auth: "Bearer test|<id>|<email>|<name>" is that person.
// ORG stands in for planary-org: an organisation id containing "verein" has plan Plus (members
// u_owner as owner, u_member as member); a tournament owned by an account id containing "event"
// has a Turnier-Pass; everything else is Gratis.
export default defineConfig(async () => {
  const migrations = await readD1Migrations('migrations');
  return {
    plugins: [
      cloudflareTest({
        main: 'src/index.ts',
        miniflare: {
          compatibilityDate: '2025-09-01',
          d1Databases: ['DB'],
          r2Buckets: ['FILES'],
          durableObjects: { ROOM: 'TournamentRoom' },
          bindings: {
            TEST_MIGRATIONS: migrations,
            APP_ORIGINS: 'https://tournament.planary.ch,http://localhost:3000',
            APP_URL: 'https://tournament.planary.ch',
            PORTAL_URL: 'https://portal.planary.ch',
            INTERNAL_KEY: 'test-internal-key',
          },
          serviceBindings: {
            AUTH(req: Request) {
              const parts = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '').split('|');
              if (parts.length < 3 || parts[0] !== 'test') return new Response(JSON.stringify({ error: 'not authenticated' }), { status: 401 });
              return Response.json({ user: { id: parts[1], email: parts[2], name: parts[3] ?? '' } });
            },
            ORG(req: Request) {
              if (req.headers.get('x-internal-key') !== 'test-internal-key') return new Response('{}', { status: 404 });
              const url = new URL(req.url);
              const LIMITS = {
                gratis: { maxTeams: 16, maxRunning: 1, maxOrganisers: 2, branding: false, checkIn: true, waitingList: false, export: false, matchDaySupport: false, invoice: false },
                pass: { maxTeams: 128, maxRunning: 1, maxOrganisers: 10, branding: true, checkIn: true, waitingList: true, export: true, matchDaySupport: false, invoice: false },
                plus: { maxTeams: 128, maxRunning: null, maxOrganisers: 10, branding: true, checkIn: true, waitingList: true, export: true, matchDaySupport: true, invoice: true },
              };
              if (url.pathname === '/internal/limits') {
                const org = url.searchParams.get('org') ?? '';
                const user = url.searchParams.get('user') ?? '';
                const plan = org.includes('verein') ? 'plus' : 'gratis';
                const pass = plan === 'gratis' && user.includes('event');
                return Response.json({ plan, limits: LIMITS[pass ? 'pass' : plan], running: 0, source: org ? 'organisation' : pass ? 'event_pass' : 'person' });
              }
              const m = url.pathname.match(/^\/internal\/orgs\/([^/]+)\/membership$/);
              if (m) {
                const user = url.searchParams.get('user');
                const role = m[1].includes('verein') ? (user === 'u_owner' ? 'owner' : user === 'u_member' ? 'member' : null) : null;
                return Response.json({ role });
              }
              const p = url.pathname.match(/^\/internal\/people\/([^/]+)\/orgs$/);
              // u_member is also in an organisation that only uses Wishlist: Tournament leaves it out.
              if (p)
                return Response.json({
                  orgs:
                    p[1] === 'u_owner' || p[1] === 'u_member'
                      ? [
                          { id: 'org_verein', name: 'Verein Gurten LAN', initials: 'GL', role: p[1] === 'u_owner' ? 'owner' : 'member', plan: 'plus', services: ['tournament', 'wishlist'] },
                          ...(p[1] === 'u_member' ? [{ id: 'org_wish', name: 'Wunschclub', initials: 'WU', role: 'owner', plan: 'gratis', services: ['wishlist'] }] : []),
                        ]
                      : [],
                });
              if (url.pathname === '/internal/banners') return Response.json({ banners: [{ kind: 'incident', title: 'Störung bei Planary: Live-Resultate kommen verzögert an.', text: 'Seit 19:58.', ref: 'inc_1', tournamentIds: [] }] });
              if (url.pathname === '/internal/tournament-events') return Response.json({ ok: true });
              return new Response('{}', { status: 404 });
            },
          },
        },
      }),
    ],
    test: { setupFiles: ['test/setup.ts'] },
  };
});
