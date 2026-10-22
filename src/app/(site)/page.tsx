"use client";

import Link from "next/link";
import { useState } from "react";
import { TournamentRow } from "@/components/common";
import { Empty, ErrorCard, Ic, Loading, PageHead, Sk } from "@/components/ui";
import { useApi } from "@/lib/api";
import { useNow } from "@/lib/now";
import type { Summary } from "@/lib/types";

type Filter = "" | "live" | "open" | "done";
const FILTERS: [Filter, string][] = [
  ["", "Alle"],
  ["live", "Live"],
  ["open", "Anmeldung offen"],
  ["done", "Abgeschlossen"],
];

export default function DiscoverPage() {
  const [filter, setFilter] = useState<Filter>("");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const params = new URLSearchParams();
  if (filter) params.set("state", filter);
  if (term) params.set("q", term);
  const { data, error, reload } = useApi<{ tournaments: Summary[] }>(`/tournaments${params.size ? `?${params}` : ""}`, 30_000);
  const now = useNow();

  return (
    <>
      <PageHead title="Turniere" sub="Öffentliche Turniere von Vereinen, Schulen und Communities. Mit dem Link sieht jede und jeder Bracket, Spielplan und Resultate.">
        <Link className="btn btn-ink" href="/neu">
          <Ic name="plus" small />
          Turnier erstellen
        </Link>
      </PageHead>
      <form
        className="find"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(q.trim());
        }}
      >
        <label className="srch">
          <span className="sr">Turniere suchen</span>
          <Ic name="search" small />
          <input className="inp" type="search" placeholder="Name, Spiel, Ort oder Verein" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => setTerm(q.trim())} />
        </label>
        <div className="filters" role="group" aria-label="Status">
          {FILTERS.map(([f, label]) => (
            <button key={f || "all"} className={`fchip${filter === f ? " on" : ""}`} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {label}
            </button>
          ))}
        </div>
      </form>
      {error && !data ? (
        <ErrorCard title="Die Turniere haben nicht geladen" error={error} onRetry={reload} />
      ) : !data ? (
        <Loading label="Turniere werden geladen">
          <Sk h={360} />
        </Loading>
      ) : !data.tournaments.length ? (
        <Empty icon="trophy" title={term || filter ? "Nichts gefunden" : "Noch keine öffentlichen Turniere"} action={<Link className="btn btn-ink btn-s" href="/neu">Turnier erstellen</Link>}>
          {term || filter ? "Kein Turnier passt zu dieser Suche." : "Sobald ein Verein ein öffentliches Turnier erstellt, steht es hier."}
        </Empty>
      ) : (
        <section className="box" aria-label="Turniere">
          <div>
            {data.tournaments.map((t) => (
              <TournamentRow key={t.id} t={t} now={now} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
