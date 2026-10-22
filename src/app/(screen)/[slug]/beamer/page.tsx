"use client";

// The beamer view (handoff W-Tournament-Beamer): full screen, always ink, updates itself.
// Without internet it keeps the last state it saw and says since when.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState, useSyncExternalStore } from "react";
import { Bracket } from "@/components/Bracket";
import { GroupTables } from "@/components/Viewer";
import { Ic, Mark, MarkSprite } from "@/components/ui";
import { API } from "@/lib/api";
import { knockoutRounds, model, scheduleList } from "@/lib/bracket-view";
import { delayText, time } from "@/lib/fmt";
import { useLive } from "@/lib/live";
import type { PublicView } from "@/lib/types";

const second = (cb: () => void) => {
  const t = window.setInterval(cb, 1000);
  return () => window.clearInterval(t);
};
const clockNow = () => Math.floor(Date.now() / 1000);

function Clock() {
  const s = useSyncExternalStore(second, clockNow, () => 0);
  return <span className="bmr-clock">{s ? time(s * 1000) : "--:--"}</span>;
}

export default function BeamerPage({ params }: PageProps<"/[slug]/beamer">) {
  const { slug } = use(params);
  const router = useRouter();
  const [first, setFirst] = useState<PublicView | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(`${API}/t/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async (r) => {
        if (!alive) return;
        if (r.status === 404) setMissing(true);
        else if (r.ok) setFirst((await r.json()) as PublicView);
      })
      .catch(() => {
        // Offline: useLive shows the cached state.
      });
    return () => {
      alive = false;
    };
  }, [slug]);
  const { view, status, stamp } = useLive(slug, first, { remember: true });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && router.push(`/${slug}`);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, slug]);

  const close = (
    <Link className="btn btn-scr btn-s" href={`/${slug}`}>
      <Ic name="x" small />
      Schliessen
    </Link>
  );

  if (!view) {
    return (
      <div className="pl bmr-pl">
        <MarkSprite />
        <div className="bmr bmr-empty">
          <div className="bmr-top">
            <p className="bmr-name">{missing ? "Turnier nicht gefunden" : "Wird geladen"}</p>
            <div className="bmr-r">{close}</div>
          </div>
          <p className="bmr-sub" role="status">
            {missing ? "Diese Adresse gibt es nicht." : status === "offline" ? "Keine Verbindung und noch kein gespeicherter Stand." : "Verbindung wird aufgebaut."}
          </p>
        </div>
      </div>
    );
  }

  const t = view.tournament;
  const ctx = model(view);
  const rounds = knockoutRounds(view, ctx);
  const list = scheduleList(view, ctx);
  const now = list.filter((x) => x.status === "live" || x.status === "reported");
  const next = list.filter((x) => x.status === "next").slice(0, now.length ? 2 : 3);
  const groupsPhase = ctx.structure.groups.length > 0 && (!rounds.length || !ctx.structure.isGroupStageComplete);
  const brand = t.brand?.color ? ({ ["--brand" as string]: t.brand.color } as React.CSSProperties) : undefined;
  const label = t.state === "live" ? (t.phase ? `Live · ${t.phase}` : "Live") : t.state === "done" ? "Abgeschlossen" : "Gleich geht es los";
  const offline = status !== "live";

  return (
    <div className="pl bmr-pl" style={brand}>
      <MarkSprite />
      <div className={`bmr${t.brand ? " branded" : ""}`}>
        <div className="bmr-top">
          {t.brand?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="bmr-logo" src={t.brand.logoUrl} alt="" />
          ) : null}
          <div>
            <h1 className="bmr-name">{t.name}</h1>
            <p className="bmr-sub">
              {[t.phase && t.state === "live" ? t.phase : null, t.game, t.venue].filter(Boolean).map((x) => (
                <span key={x as string}>{x}</span>
              ))}
            </p>
          </div>
          <div className="bmr-r">
            <span className={`scr-live${t.state === "live" ? " on" : ""}`}>
              {t.state === "live" ? <span className="dot warn" /> : null}
              {label}
            </span>
            <Clock />
            {close}
          </div>
        </div>
        {offline && stamp ? (
          <p className="bmr-off" role="status">
            <Ic name="alert" small />
            {status === "offline" ? "Keine Verbindung." : "Verbindung wird wieder aufgebaut."} Stand {time(stamp)}.
          </p>
        ) : null}
        <div className="bmr-body">
          <div className="bmr-main">
            {groupsPhase ? (
              <div className="bmr-groups">
                <GroupTables ctx={ctx} />
              </div>
            ) : rounds.length ? (
              <Bracket rounds={rounds} />
            ) : (
              <div className="bmr-wait">
                <p className="bmr-big">{view.entries.filter((e) => e.status === "confirmed").length} {t.entryType === "team" ? "Teams" : "Spieler"} angemeldet</p>
                <ul className="bmr-names">
                  {view.entries
                    .filter((e) => e.status === "confirmed")
                    .map((e) => (
                      <li key={e.id}>
                        {e.name}
                        {t.checkIn ? <span className={e.checkedIn ? "in" : ""}>{e.checkedIn ? " · da" : ""}</span> : null}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
          <aside className="bmr-side">
            {now.length ? (
              now.slice(0, 2).map((x) => (
                <section className="bmr-now" key={x.m.id} aria-label="Jetzt live">
                  <h3>
                    <span className="dot warn" />
                    Jetzt live · {x.code}
                    {x.m.station ? ` · ${x.m.station.name}` : ""}
                  </h3>
                  <div className="bmr-sc">
                    <div className="ex-tm">
                      <span className="nm">{x.a}</span>
                      <span className="sc">{x.m.report ? x.m.report.a : ""}</span>
                    </div>
                    <div className="ex-tm">
                      <span className="nm">{x.b}</span>
                      <span className="sc">{x.m.report ? x.m.report.b : ""}</span>
                    </div>
                  </div>
                </section>
              ))
            ) : null}
            <section className="bmr-next" aria-label="Als Nächstes">
              <h3>Als Nächstes</h3>
              {next.length ? (
                <ol>
                  {next.map((x) => (
                    <li key={x.m.id}>
                      <b>{x.m.scheduledAt ? time(x.m.scheduledAt) : x.code}</b>
                      <div>
                        {x.a} gegen {x.b}
                        <span>{[x.m.station?.name, x.round, delayText(x.m.plannedAt, x.m.scheduledAt)].filter(Boolean).join(" · ")}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="bmr-note">{t.state === "done" ? "Alle Spiele sind gespielt." : "Der Spielplan folgt."}</p>
              )}
            </section>
          </aside>
        </div>
        <div className="bmr-foot">
          <span>
            Live mitverfolgen: <b>tournament.planary.ch/{t.slug}</b>
          </span>
          <span className="wm">
            <Mark />
            Planary
          </span>
        </div>
      </div>
    </div>
  );
}
