"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { stateLabel, teamsWord, TOURNAMENT_STATE } from "./status";
import { Chip, Empty, Sk } from "./ui";
import { tourDate } from "@/lib/fmt";
import type { Summary } from "@/lib/types";

/** Pages that need an account say so instead of failing. */
export function SignInGate({ children, why }: { children: ReactNode; why: string }) {
  const { user, signIn } = useAuth();
  if (user === undefined) return <Sk h={240} />;
  if (!user) {
    return (
      <Empty
        icon="user"
        title="Melde dich an"
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <button className="btn btn-ink btn-s" type="button" onClick={() => signIn()}>
              Anmelden
            </button>
            <button className="btn btn-line btn-s" type="button" onClick={() => signIn("signup")}>
              Konto erstellen
            </button>
          </div>
        }
      >
        {why} Mit deinem Planary-Konto, demselben wie für Casino und Wishlist.
      </Empty>
    );
  }
  return <>{children}</>;
}

export function TournamentRow({ t, now }: { t: Summary; now: number }) {
  const s = TOURNAMENT_STATE[t.state];
  const done = t.state === "done";
  return (
    <Link className="trow" href={`/${t.slug}`}>
      <b>{t.name}</b>
      <Chip chip={done ? "" : s.chip} dot={done ? null : s.dot}>
        {stateLabel(t)}
      </Chip>
      <span className="s">
        {[tourDate(t.startsAt, t.endsAt, now), t.game, t.venue, `${t.teams} / ${t.maxTeams} ${teamsWord(t.entryType, t.maxTeams)}`, t.organisation?.name ?? t.owner.name].filter(Boolean).join(" · ")}
      </span>
    </Link>
  );
}
