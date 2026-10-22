# Planary Tournament

Turniere für Vereine, Schulen und Communities at **tournament.planary.ch**: sign-up, schedule, bracket and a beamer view that updates itself. German, "du".

Two parts in this repo:

| Folder | What | Runs on |
| --- | --- | --- |
| `/` (Next.js 16) | The app: public tournament pages, the beamer, creating and running tournaments, teams, profiles | Vercel, `tournament.planary.ch` |
| `api/` (Cloudflare Worker) | `planary-tournament-api`: D1 database, one Durable Object per tournament for live updates, R2 for images | Cloudflare, `tournament-api.planary.ch` |

`src/shared/` holds the bracket and group-stage logic (and its tests). The API decides with it; the app draws with it.

Sign-in is the Planary account (planary-auth). Organisations, plans and their limits come from planary-org; every tournament change is reported back to it for the Console and the customer portal. The app used to run on Supabase. That is gone: the old data was not moved, the new backend starts empty.

## Routes

| Route | Screen |
| --- | --- |
| `/` | Public tournaments, with search and status filter |
| `/meine` | Tournaments you run (yourself, as co-organiser, or through your organisation) and play in |
| `/neu?plan=gratis\|event\|verein&org=<id>` | Create a tournament, in your name or for an organisation |
| `/<slug>` | The tournament: bracket, groups, schedule, teams, the selected match; sign-up, waiting list, check-in, your next match with reporting and confirming |
| `/<slug>/beamer` | Full screen, live. Shows the last state without internet (service worker plus the last view kept in the browser) |
| `/<slug>/verwalten` | Organisers: start (check-in decides the field), participants, matches and results, stations, settings, logo and colour, co-organisers, export, delete |
| `/teams`, `/profil`, `/veranstalter/<username>` | Your teams, your profile, a public organiser page |

## What the plans unlock

The API enforces planary-org's limits (`api/src/lib/org.ts` keeps a copy for when planary-org doesn't answer):

| | Gratis | Event | Verein |
| --- | --- | --- | --- |
| Teams per tournament | 16 | 128 | 128 |
| Running at the same time | 1 | 1 | unlimited |
| Organisers per tournament | 1 | 1 | 5 |
| Check-in, waiting list, logo and colour, CSV/PDF export, match-day support | no | yes | yes |

Teams reporting their own results, stations and the delay-aware schedule are in every plan.

## Develop

```bash
npm install
npm run dev                 # the app on http://localhost:3000
npm run typecheck && npm run lint && npm test

cd api
npm install
npm run db:migrate:local
npm run dev                 # the API on http://localhost:8791
npm test                    # in the Workers runtime with a local D1, R2 and Durable Object
```

For the whole thing locally, also run planary-auth (`wrangler dev --port 8787`) and planary-org (`--port 8790`). The service bindings connect through the local dev registry. Give the API and planary-org the same `INTERNAL_KEY` in their `.dev.vars`, and set `API_URL=http://localhost:8791` in `api/.dev.vars`. Point the app at them with `.env.local` (see `.env.example`).

## Deploy

**API** (`api/`):

1. `wrangler d1 create planary-tournament`, `wrangler r2 bucket create planary-tournament-files`, `npm run db:migrate`.
2. `wrangler secret put INTERNAL_KEY` (the same value as in planary-org).
3. `npm run deploy`. The first deploy creates the `tournament-api.planary.ch` domain and the Durable Object class.
4. Check `APP_ORIGINS`, `APP_URL`, `API_URL` and `PORTAL_URL` in `wrangler.jsonc`.

**App:** Vercel with the variables in `.env.example`. planary-auth already allows `https://tournament.planary.ch` as a return address.

**planary-org:** add `https://tournament.planary.ch` to `PORTAL_ORIGINS` only if the app should call the portal API directly. It doesn't today: everything goes through the Tournament API.

**Supabase:** the app no longer uses it. Delete the old project (and its auth users and storage) in the Supabase dashboard once you no longer need the data.
