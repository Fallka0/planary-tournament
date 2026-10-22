// Bindings, vars and secrets.

export interface Env {
  DB: D1Database;
  /** Avatars, team pictures and tournament logos. */
  FILES: R2Bucket;
  /** One TournamentRoom per tournament (live connections). */
  ROOM: DurableObjectNamespace;
  /** planary-auth: /api/auth/me checks tokens. */
  AUTH: Fetcher;
  /** planary-org: /internal/* (limits, membership, organisations, banners, tournament events). */
  ORG?: Fetcher;

  APP_ORIGINS: string;
  APP_URL: string;
  /** This API's own address, for image links (the request URL can be rewritten by routes). */
  API_URL?: string;
  PORTAL_URL: string;

  /** Shared with planary-org. */
  INTERNAL_KEY?: string;
}

export interface PersonCtx {
  id: string;
  name: string;
  email: string;
}

export type Vars = { requestId: string };

export type AppEnv = { Bindings: Env; Variables: Vars };
