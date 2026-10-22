// planary-tournament-api: tournaments, entries, matches and live updates for tournament.planary.ch.
//   /tournaments, /t/:id, /people/:username, /files/*   reading (public, or more when signed in)
//   /me, /teams                                          the signed-in person
//   /t/:id/...                                           running a tournament (organisers) and playing in it
//   /t/:id/live                                          WebSocket to the tournament's room
// Sign-in is the Planary account (planary-auth); plans and organisations come from planary-org.

import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from './env';
import { ApiError, errorBody } from './lib/util';
import { entriesApp } from './routes/entries';
import { exportApp } from './routes/export';
import { matchesApp } from './routes/matches';
import { meApp } from './routes/me';
import { publicApp } from './routes/public';
import { tournamentsApp } from './routes/tournaments';

export { TournamentRoom } from './room';

export const app = new Hono<AppEnv>();

const KB = 1024;
const MB = 1024 * KB;

app.use('*', async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  await next();
  if (c.res.status !== 101) c.header('x-request-id', requestId);
});

app.use(
  '*',
  cors({
    origin: (origin, c) =>
      String((c.env as AppEnv['Bindings']).APP_ORIGINS ?? '')
        .split(',')
        .map((o) => o.trim())
        .includes(origin)
        ? origin
        : null,
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
    exposeHeaders: ['x-request-id', 'Content-Disposition'],
    maxAge: 86400,
  }),
);

app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS' || c.req.method === 'GET') return next();
  // Images up to 5 MB; everything else is small JSON.
  const image = /\/(avatar|banner|logo)$/.test(c.req.path);
  return bodyLimit({
    maxSize: image ? 5 * MB + 64 * KB : 64 * KB,
    onError: (c) => c.json(errorBody(c as never, 'Die Anfrage ist zu gross.', 'payload_too_large'), 413),
  })(c, next);
});

app.get('/', (c) => c.json({ service: 'planary-tournament-api', ok: true }));

app.route('/', publicApp);
app.route('/', meApp);
app.route('/', tournamentsApp);
app.route('/', entriesApp);
app.route('/', matchesApp);
app.route('/', exportApp);

app.notFound((c) => c.json(errorBody(c, 'Das gibt es hier nicht.', 'not_found'), 404));

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json(errorBody(c, err.message, err.code), err.status);
  if (err instanceof HTTPException) return c.json(errorBody(c, err.message || 'Die Anfrage ging nicht.', 'bad_request'), err.status);
  console.log(`error ${c.req.method} ${c.req.path}: ${err instanceof Error ? err.stack : err}`);
  return c.json(errorBody(c, 'Bei uns ist etwas schiefgegangen. Versuch es gleich nochmals.', 'internal'), 500);
});

export default { fetch: app.fetch } satisfies ExportedHandler<AppEnv['Bindings']>;
