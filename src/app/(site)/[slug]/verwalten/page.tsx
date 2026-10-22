"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, use } from "react";
import { SignInGate } from "@/components/common";
import { Entries } from "@/components/manage/Entries";
import { Matches } from "@/components/manage/Matches";
import { Overview } from "@/components/manage/Overview";
import { Settings } from "@/components/manage/Settings";
import { Stations } from "@/components/manage/Stations";
import { stateLabel, TOURNAMENT_STATE } from "@/components/status";
import { Chip, Empty, ErrorCard, Ic, Loading, PageHead, Sk } from "@/components/ui";
import { useApi } from "@/lib/api";
import { useLive } from "@/lib/live";
import type { TournamentView } from "@/lib/types";

const TABS = [
  ["uebersicht", "Übersicht"],
  ["teilnehmer", "Teilnehmer"],
  ["spiele", "Spiele"],
  ["stationen", "Stationen"],
  ["einstellungen", "Einstellungen"],
] as const;
type Tab = (typeof TABS)[number][0];

function Manage({ slug }: { slug: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const { data, error, reload } = useApi<TournamentView>(`/t/${encodeURIComponent(slug)}`);
  // Live while it runs, so results from scorers and teams appear without reloading.
  const { view: live } = useLive(slug, data && data.tournament.state !== "draft" ? data : null);

  if (error && !data) return error.status === 404 ? <Empty icon="search" title="Turnier nicht gefunden">Diese Adresse gibt es nicht.</Empty> : <ErrorCard title="Das Turnier hat nicht geladen" error={error} onRetry={reload} />;
  if (!data) {
    return (
      <Loading label="Wird geladen">
        <Sk h={520} />
      </Loading>
    );
  }
  const v: TournamentView = live && live.tournament.version > data.tournament.version ? { ...data, ...live, me: data.me, limits: data.limits } : data;
  const role = v.me?.role ?? null;
  if (!role) {
    return (
      <Empty icon="lock" title="Nur für Organisatoren" action={<Link className="btn btn-line btn-s" href={`/${slug}`}>Zum Turnier</Link>}>
        Verwalten können, wer das Turnier erstellt hat, wer es mitleitet und die Mitglieder der Organisation.
      </Empty>
    );
  }
  const t = v.tournament;
  const scorer = role === "scorer";
  const tabs = scorer ? TABS.filter(([k]) => k === "spiele") : TABS;
  const asked = params.get("tab") as Tab | null;
  const fallback: Tab = scorer || t.state === "live" ? "spiele" : "uebersicht";
  const tab: Tab = asked && tabs.some(([k]) => k === asked) ? asked : fallback;
  const s = TOURNAMENT_STATE[t.state];

  return (
    <>
      <PageHead
        crumb={
          <p className="crumb">
            <Link className="ul" href={`/${t.slug}`}>
              {t.name}
            </Link>
            <Ic name="chev-r" small />
            Verwalten
          </p>
        }
        title={t.name}
        chip={
          <Chip chip={s.chip} dot={t.state === "done" ? null : s.dot}>
            {stateLabel(t)}
          </Chip>
        }
      >
        <Link className="btn btn-line btn-s" href={`/${t.slug}/beamer`}>
          <Ic name="screen" small />
          Beamer-Ansicht
        </Link>
        <Link className="btn btn-ink btn-s" href={`/${t.slug}`}>
          <Ic name="eye" small />
          Turnierseite
        </Link>
      </PageHead>
      <div className="tabbar" role="tablist" aria-label="Verwalten">
        {tabs.map(([k, label]) => (
          <button key={k} className={`tab${tab === k ? " on" : ""}`} role="tab" type="button" aria-selected={tab === k} onClick={() => router.replace(`/${t.slug}/verwalten?tab=${k}`, { scroll: false })}>
            {label}
            {k === "teilnehmer" ? <span className="c">{t.counts.confirmed}</span> : null}
            {k === "spiele" && v.matches.some((m) => m.disputed && !m.winner) ? (
              <span className="c err">
                {v.matches.filter((m) => m.disputed && !m.winner).length}
                <span className="sr"> umstritten</span>
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="sec" role="tabpanel">
        {tab === "uebersicht" ? <Overview v={v} /> : tab === "teilnehmer" ? <Entries v={v} /> : tab === "spiele" ? <Matches v={v} /> : tab === "stationen" ? <Stations key={v.stations.map((x) => x.id + x.name).join()} v={v} /> : <Settings key={t.id} v={v} />}
      </div>
    </>
  );
}

export default function ManagePage({ params }: PageProps<"/[slug]/verwalten">) {
  const { slug } = use(params);
  return (
    <SignInGate why="Verwalten können die Organisatoren, wenn sie angemeldet sind.">
      <Suspense fallback={<Sk h={520} />}>
        <Manage slug={slug} />
      </Suspense>
    </SignInGate>
  );
}
