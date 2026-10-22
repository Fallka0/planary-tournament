"use client";

import Link from "next/link";
import { Play } from "@/components/Play";
import { useToast } from "@/components/Shell";
import { stateLabel, TOURNAMENT_STATE } from "@/components/status";
import { Chip, Empty, ErrorCard, Ic, Loading, Sk } from "@/components/ui";
import { Viewer } from "@/components/Viewer";
import { useApi } from "@/lib/api";
import { APP_URL } from "@/lib/auth";
import { initials, tourDateLong } from "@/lib/fmt";
import { useLive } from "@/lib/live";
import type { TournamentView } from "@/lib/types";
import { ranking } from "@/lib/ranking";

export function Share({ slug, dark = false }: { slug: string; dark?: boolean }) {
  const toast = useToast();
  const url = `${APP_URL}/${slug}`;
  return (
    <button
      className={`btn ${dark ? "btn-scr" : "btn-line"} btn-s`}
      type="button"
      onClick={async () => {
        try {
          if (navigator.share) await navigator.share({ url });
          else {
            await navigator.clipboard.writeText(url);
            toast("Link kopiert.");
          }
        } catch {
          // Closed the share sheet.
        }
      }}
    >
      <Ic name="link" small />
      Teilen
    </button>
  );
}

export function TournamentPage({ slug }: { slug: string }) {
  const { data, error, reload } = useApi<TournamentView>(`/t/${encodeURIComponent(slug)}`);
  const { view: live } = useLive(slug, data && data.tournament.state !== "draft" ? data : null);

  if (error && !data) {
    return error.status === 404 ? (
      <Empty icon="search" title="Turnier nicht gefunden" action={<Link className="btn btn-line btn-s" href="/">Alle Turniere</Link>}>
        Diese Adresse gibt es nicht, oder das Turnier ist noch ein Entwurf.
      </Empty>
    ) : (
      <ErrorCard title="Das Turnier hat nicht geladen" error={error} onRetry={reload} />
    );
  }
  if (!data) {
    return (
      <Loading label="Turnier wird geladen">
        <Sk h={560} r={24} />
      </Loading>
    );
  }
  // The newest public state, with what only this person sees (role, own sign-up).
  const v: TournamentView = live && live.tournament.version > data.tournament.version ? { ...data, ...live, me: data.me, limits: data.limits } : data;
  const t = v.tournament;
  const s = TOURNAMENT_STATE[t.state];
  const role = v.me?.role ?? null;
  const podium = t.state === "done" ? ranking(v) : null;
  const brand = t.brand?.color ? ({ ["--brand" as string]: t.brand.color } as React.CSSProperties) : undefined;

  return (
    <>
      {t.state === "draft" ? (
        <p className="alert info">
          <Ic name="info" />
          <span className="grow">Entwurf. Nur ihr Organisatoren seht dieses Turnier. Unter Verwalten öffnet ihr die Anmeldung.</span>
        </p>
      ) : null}
      <article className={`ex tour${t.brand?.color ? " branded" : ""}`} style={brand} aria-labelledby="t-name">
        <div className="ex-top">
          {t.brand?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="t-logo" src={t.brand.logoUrl} alt="" />
          ) : null}
          <div>
            <Chip chip={t.state === "live" ? "scr-live" : `scr-chip ${s.chip}`} dot={t.state === "done" ? null : s.dot}>
              {stateLabel(t)}
            </Chip>
            <h1 id="t-name" className="ex-name" style={{ marginTop: 12 }}>
              {t.name}
            </h1>
            <p className="ex-meta">
              <span>
                <Ic name="game" small />
                {t.game}
              </span>
              {t.startsAt ? (
                <span>
                  <Ic name="cal" small />
                  {tourDateLong(t.startsAt, t.endsAt)}
                </span>
              ) : null}
              {t.venue ? (
                <span>
                  <Ic name="pin" small />
                  {t.venue}
                </span>
              ) : null}
              <span>
                <Ic name="bracket" small />
                {t.format}
              </span>
              <span>
                <Ic name="org" small />
                {t.organisation?.name ?? t.owner.name}
              </span>
            </p>
          </div>
          <div className="ex-acts">
            {t.state !== "draft" ? (
              <Link className="btn btn-paper btn-s" href={`/${t.slug}/beamer`}>
                <Ic name="screen" small />
                Beamer-Ansicht
              </Link>
            ) : null}
            <Share slug={t.slug} dark />
            {role === "owner" || role === "admin" || role === "scorer" ? (
              <Link className="btn btn-scr btn-s" href={`/${t.slug}/verwalten`}>
                <Ic name="gear" small />
                Verwalten
              </Link>
            ) : null}
          </div>
        </div>
        {podium?.length ? (
          <ol className="podium" aria-label="Rangliste">
            {podium.slice(0, 4).map((p, i) => (
              <li key={`${p.place}-${i}`} className={`pd-${p.place}`}>
                <span className="pd-n">{p.place}.</span>
                <b>{p.name}</b>
              </li>
            ))}
          </ol>
        ) : null}
        <Viewer v={v} />
      </article>
      <div className="g3 sec">
        <div className="stack">
          <Play v={v} />
          {t.description ? (
            <section className="box" aria-labelledby="info-h">
              <h2 id="info-h" className="box-t" style={{ marginBottom: 10 }}>
                Infos
              </h2>
              <div className="prose">
                {t.description.split(/\n{2,}/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          ) : null}
        </div>
        <section className="box" aria-labelledby="org-h">
          <h2 id="org-h" className="box-t" style={{ marginBottom: 10 }}>
            Wer das Turnier leitet
          </h2>
          <ul>
            {v.organisers.map((o) => (
              <li className="list-r" key={o.id}>
                <span className="av">{initials(o.name)}</span>
                <div className="grow">
                  <b>{o.name}</b>
                  <span className="s">{o.role === "owner" ? "leitet" : o.role === "admin" ? "leitet mit" : "trägt Resultate ein"}</span>
                </div>
              </li>
            ))}
          </ul>
          {t.organisation ? <p className="box-s" style={{ marginTop: 10 }}>Im Namen von {t.organisation.name}.</p> : null}
          {t.state === "open" && t.startsAt ? <p className="box-s" style={{ marginTop: 6 }}>Beginn {tourDateLong(t.startsAt, t.endsAt)}.</p> : null}
        </section>
      </div>
    </>
  );
}
