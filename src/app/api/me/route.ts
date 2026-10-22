const AUTH_API = process.env.AUTH_API_URL || "https://auth.planary.ch";

// Server-side hop to planary-auth to check the token.
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return Response.json({ error: "not authenticated" }, { status: 401 });
  }
  try {
    const res = await fetch(`${AUTH_API}/api/auth/me`, { headers: { Authorization: authorization }, cache: "no-store" });
    return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch {
    return Response.json({ error: "auth unavailable" }, { status: 502 });
  }
}
