# planary-tournament-api

The backend of Planary Tournament: a Cloudflare Worker (Hono) at `tournament-api.planary.ch` with D1 (`migrations/`), one Durable Object per tournament (`src/room.ts`, live updates over WebSocket) and R2 for images.

- **Auth:** the Planary access token, checked by planary-auth over the `AUTH` binding.
- **Plans:** limits, organisation membership and banners come from planary-org over `ORG` (`x-internal-key`). Every change is sent back as a tournament event, so the Console and the portal show the tournament.
- **Brackets:** `../src/shared/bracket.ts`, the same code the app draws with. The API owns the matches; after every change it moves winners on, plans the schedule (`src/lib/schedule.ts`: stations, delays), updates the phase line and publishes the new public view to the room.
- **Messages:** German, ready to show. Codes (`plan_team_limit`, `full`, `already_started`, …) for the app to react to.

See the main README for routes, setup and deploy. `npm test` runs every route in the Workers runtime.
