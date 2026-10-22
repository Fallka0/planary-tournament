// Who is calling: the Planary access token, checked by planary-auth over the AUTH binding.

import type { Context } from 'hono';
import type { AppEnv, Env, PersonCtx } from '../env';
import { ApiError } from './util';

export async function personFromToken(env: Env, authorization: string | undefined): Promise<PersonCtx | null> {
  if (!authorization || !/^Bearer\s+\S+/i.test(authorization)) return null;
  let res: Response;
  try {
    res = await env.AUTH.fetch(new Request('https://auth.internal/api/auth/me', { headers: { Authorization: authorization } }));
  } catch (error) {
    console.log(`auth binding failed: ${error}`);
    return null;
  }
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as { user?: { id?: unknown; name?: unknown; email?: unknown } } | null;
  const user = data?.user;
  if (!user || typeof user.id !== 'string' || !user.id) return null;
  const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
  const name = (typeof user.name === 'string' && user.name.trim()) || email.split('@')[0] || 'Planary';
  return { id: user.id, name: name.slice(0, 120), email: email.slice(0, 254) };
}

export const optionalPerson = (c: Context<AppEnv>) => personFromToken(c.env, c.req.header('authorization'));

export async function requirePerson(c: Context<AppEnv>): Promise<PersonCtx> {
  const person = await optionalPerson(c);
  if (!person) throw new ApiError(401, 'Melde dich zuerst an.', 'unauthenticated');
  return person;
}
