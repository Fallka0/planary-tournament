"use client";

import Link from "next/link";
import { SignInGate, TournamentRow } from "@/components/common";
import { Empty, ErrorCard, Ic, Loading, PageHead, Sk } from "@/components/ui";
import { useApi } from "@/lib/api";
import { useNow } from "@/lib/now";
import type { Summary } from "@/lib/types";

function Mine() {
  const { data, error, reload } = useApi<{ organising: Summary[]; playing: Summary[] }>("/tournaments?mine=1", 30_000);
  const now = useNow();
  if (error && !data) return <ErrorCard title="Deine Turniere haben nicht geladen" error={error} onRetry={reload} />;
  if (!data) {
    return (
      <Loading label="Deine Turniere werden geladen">
        <div className="g2">
          <Sk h={300} />
          <Sk h={300} />
        </div>
      </Loading>
    );
  }
  return (
    <div className="g2">
      <section className="box" aria-labelledby="org-h">
        <div className="box-h">
          <h2 id="org-h" className="box-t">
            Du leitest
          </h2>
        </div>
        {data.organising.length ? (
          <div>
            {data.organising.map((t) => (
              <TournamentRow key={t.id} t={t} now={now} />
            ))}
          </div>
        ) : (
          <Empty icon="trophy" title="Noch keine Turniere" action={<Link className="btn btn-ink btn-s" href="/neu">Turnier erstellen</Link>}>
            Turniere, die du erstellst oder mitleitest, stehen hier. Auch die deiner Organisation.
          </Empty>
        )}
      </section>
      <section className="box" aria-labelledby="pl-h">
        <div className="box-h">
          <h2 id="pl-h" className="box-t">
            Du spielst
          </h2>
        </div>
        {data.playing.length ? (
          <div>
            {data.playing.map((t) => (
              <TournamentRow key={t.id} t={t} now={now} />
            ))}
          </div>
        ) : (
          <Empty icon="users" title="Noch nirgends angemeldet" action={<Link className="btn btn-line btn-s" href="/">Turniere ansehen</Link>}>
            Wenn du dich für ein Turnier anmeldest, findest du es hier wieder.
          </Empty>
        )}
      </section>
    </div>
  );
}

export default function MinePage() {
  return (
    <>
      <PageHead title="Meine Turniere">
        <Link className="btn btn-ink" href="/neu">
          <Ic name="plus" small />
          Turnier erstellen
        </Link>
      </PageHead>
      <SignInGate why="Deine Turniere siehst du, wenn du angemeldet bist.">
        <Mine />
      </SignInGate>
    </>
  );
}
