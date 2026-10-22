// Swiss German formats for the portal: CHF 228.00, 24.09.2026, "Sa 13. Dez.", 24-hour times.

const ZONE = "Europe/Zurich";
const DAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const MON = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."];

function parts(ms: number) {
  const f = new Intl.DateTimeFormat("de-CH", { timeZone: ZONE, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  // Weekday from the calendar date, so it doesn't depend on the runtime's locale data.
  const y = Number(p.year), m = Number(p.month), d = Number(p.day);
  return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), h: p.hour, min: p.minute };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function num(n: number | null | undefined) {
  if (n === null || n === undefined) return "–";
  const sign = n < 0 ? "−" : "";
  return sign + Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "’");
}

/** Rappen → "CHF 228.00" */
export function chf(rappen: number) {
  const francs = Math.floor(Math.abs(rappen) / 100);
  return `${rappen < 0 ? "−" : ""}CHF ${num(francs)}.${pad(Math.abs(rappen) % 100)}`;
}

/** Rappen → "CHF 19" (whole francs, for plan prices). */
export function chfShort(rappen: number) {
  return rappen % 100 ? chf(rappen) : `CHF ${num(rappen / 100)}`;
}

/** 20:02 */
export function time(ms: number) {
  const p = parts(ms);
  return `${p.h}:${p.min}`;
}

/** 18.10. */
export function dayMonth(ms: number) {
  const p = parts(ms);
  return `${pad(p.d)}.${pad(p.m)}.`;
}

/** 24.09.2026 */
export function date(ms: number | null | undefined) {
  if (!ms) return "–";
  const p = parts(ms);
  return `${pad(p.d)}.${pad(p.m)}.${p.y}`;
}

/** 3.2.2026 */
export function dateNarrow(ms: number) {
  const p = parts(ms);
  return `${p.d}.${p.m}.${p.y}`;
}

/** 3. Februar 2027 */
export function longDate(ms: number) {
  const p = parts(ms);
  return `${p.d}. ${MONTHS[p.m - 1]} ${p.y}`;
}

/** Sa 13. Dez. */
export function shortDay(ms: number) {
  const p = parts(ms);
  return `${DAYS[p.wd]} ${p.d}. ${MON[p.m - 1]}`;
}

export function sameDay(a: number, b: number) {
  const x = parts(a), y = parts(b);
  return x.y === y.y && x.m === y.m && x.d === y.d;
}

/** "Heute, 10:00–20:30", "Sa 13. Dez.", "noch kein Datum" */
export function tourDate(startsAt: number | null, endsAt: number | null, now: number) {
  if (!startsAt) return "noch kein Datum";
  if (sameDay(startsAt, now)) return `Heute, ${time(startsAt)}${endsAt ? `–${time(endsAt)}` : ""}`;
  return shortDay(startsAt);
}

/** Di 20. Okt. 2026 · 10:00–20:30 */
export function tourDateLong(startsAt: number | null, endsAt: number | null) {
  if (!startsAt) return "noch kein Datum";
  return `${shortDay(startsAt)} ${parts(startsAt).y} · ${time(startsAt)}${endsAt ? `–${time(endsAt)}` : ""}`;
}

/** "heute, 20:02", "17.10." */
export function when(ms: number, now: number) {
  return sameDay(ms, now) ? `heute, ${time(ms)}` : dayMonth(ms);
}

/** "jetzt", "heute", "12.10.", "nie" */
export function lastActive(ms: number | null, now: number) {
  if (!ms) return "nie";
  if (now - ms < 10 * 60_000) return "jetzt";
  return sameDay(ms, now) ? "heute" : dayMonth(ms);
}

export function initials(name: string) {
  const w = name.trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? "") + (w.length > 1 ? w[w.length - 1][0] : (w[0]?.[1] ?? ""))).toUpperCase();
}

/** For <input type="datetime-local">: the browser's local time, "2026-10-20T10:00". */
export function toLocalInput(ms: number | null | undefined) {
  if (!ms) return "";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** "in 12 Min.", "seit 5 Min." */
export function relMinutes(ms: number, now: number) {
  const m = Math.round((ms - now) / 60_000);
  if (Math.abs(m) < 1) return "jetzt";
  return m > 0 ? `in ${m} Min.` : `seit ${-m} Min.`;
}

/** "+12 Min." when a match runs behind its first plan, else null. */
export function delayText(planned: number | null, scheduled: number | null) {
  if (!planned || !scheduled) return null;
  const m = Math.round((scheduled - planned) / 60_000);
  return m >= 1 ? `+${m} Min.` : null;
}
