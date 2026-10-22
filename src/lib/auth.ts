export const AUTH_BASE_URL = process.env.NEXT_PUBLIC_AUTH_BASE_URL || "https://auth.planary.ch";
export const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.planary.ch";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://tournament.planary.ch";

/** `auto` = single sign-on: an existing Planary session comes straight back without a click. */
export function buildAuthUrl(mode: "login" | "signup", returnTo: string, auto = false) {
  const target = new URL(mode === "signup" ? "/signup" : "/", AUTH_BASE_URL);
  target.searchParams.set("returnTo", returnTo);
  if (auto) target.searchParams.set("auto", "1");
  return target.toString();
}

export function signOutUrl(returnTo: string) {
  const target = new URL("/logout", AUTH_BASE_URL);
  target.searchParams.set("returnTo", returnTo);
  return target.toString();
}
