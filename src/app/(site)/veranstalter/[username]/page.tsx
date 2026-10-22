"use client";

import { use } from "react";
import { TournamentRow } from "@/components/common";
import { Empty, ErrorCard, Ic, Loading, Sk } from "@/components/ui";
import { useApi } from "@/lib/api";
import { useNow } from "@/lib/now";
import type { Profile, Summary } from "@/lib/types";

export default function OrganiserPage({ params }: PageProps<"/veranstalter/[username]">) {
  const { username } = use(params);
  const { data, error, reload } = useApi<{ profile: Profile; tournaments: Summary[] }>(`/people/${encodeURIComponent(username)}`);
  const now = useNow();
  if (error && !data) return error.status === 404 ? <Empty icon="user" title="Nicht gefunden">Diese Person gibt es in Tournament nicht.</Empty> : <ErrorCard title="Die Seite hat nicht geladen" error={error} onRetry={reload} />;
  if (!data) {
    return (
      <Loading label="Wird geladen">
        <Sk h={420} />
      </Loading>
    );
  }
  const p = data.profile;
  const links = [
    ["Website", p.links.website],
    ["X", p.links.x],
    ["GitHub", p.links.github],
  ].filter(([, u]) => u);
  return (
    <>
      <header className="op-h" style={p.bannerUrl ? { backgroundImage: `url(${p.bannerUrl})` } : undefined}>
        <span className="logo logo-xl op-av">
          {p.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatarUrl} alt="" />
          ) : (
            p.name.slice(0, 2).toUpperCase()
          )}
        </span>
      </header>
      <div className="ph" style={{ marginTop: 20 }}>
        <div>
          <h1>{p.name}</h1>
          <p>
            @{p.username}
            {p.bio ? ` · ${p.bio}` : ""}
          </p>
        </div>
        {links.length ? (
          <div className="ph-a">
            {links.map(([l, u]) => (
              <a key={l} className="btn btn-line btn-s" href={u} rel="noopener nofollow ugc" target="_blank">
                {l}
                <Ic name="arrow-ur" small />
              </a>
            ))}
          </div>
        ) : null}
      </div>
      <section className="box" aria-labelledby="op-t">
        <div className="box-h">
          <h2 id="op-t" className="box-t">
            Turniere
          </h2>
        </div>
        {data.tournaments.length ? (
          <div>
            {data.tournaments.map((t) => (
              <TournamentRow key={t.id} t={t} now={now} />
            ))}
          </div>
        ) : (
          <p className="box-s">Noch keine öffentlichen Turniere.</p>
        )}
      </section>
    </>
  );
}
