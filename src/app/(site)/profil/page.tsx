"use client";

import Link from "next/link";
import { useState } from "react";
import { SignInGate } from "@/components/common";
import { ImagePick } from "@/components/ImagePick";
import { useToast } from "@/components/Shell";
import { ErrorCard, Ic, Loading, PageHead, Sk } from "@/components/ui";
import { type ApiError, useAction, useApi } from "@/lib/api";
import type { MeResponse } from "@/lib/types";

function Form({ me }: { me: MeResponse["me"] }) {
  const act = useAction();
  const toast = useToast();
  const [v, setV] = useState({ username: me.username, name: me.name, bio: me.bio, website: me.links.website, x: me.links.x, github: me.links.github });
  const [err, setErr] = useState<{ field?: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const field = (k: keyof typeof v, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="f">
      <label className="f-l" htmlFor={`pf-${k}`}>
        {label}
      </label>
      <input id={`pf-${k}`} className="inp" value={v[k]} onChange={(e) => setV({ ...v, [k]: k === "username" ? e.target.value.toLowerCase() : e.target.value })} aria-invalid={err?.field === k} {...extra} />
      {err?.field === k ? <span className="f-err">{err.text}</span> : null}
    </div>
  );
  return (
    <form
      className="box form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await act("/me", v);
          toast("Gespeichert.");
          setErr(null);
        } catch (x) {
          const a = x as ApiError;
          const f = a.code === "invalid_username" || a.code === "username_taken" ? "username" : a.code === "invalid_url" ? (a.message.includes("X") ? "x" : a.message.includes("GitHub") ? "github" : "website") : undefined;
          setErr({ field: f, text: a.message });
          if (!f) toast(a.message, "err");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="box-t">Profil</h2>
      <div className="form-2">
        {field("name", "Name", { maxLength: 80 })}
        <div className="f">
          <label className="f-l" htmlFor="pf-username">
            Benutzername
          </label>
          <div className="slug">
            <span aria-hidden="true">/veranstalter/</span>
            <input id="pf-username" className="inp" value={v.username} spellCheck={false} onChange={(e) => setV({ ...v, username: e.target.value.toLowerCase() })} aria-invalid={err?.field === "username"} />
          </div>
          {err?.field === "username" ? <span className="f-err">{err.text}</span> : <span className="f-h">Damit fügt man dich als Mit-Organisator hinzu.</span>}
        </div>
      </div>
      <div className="f">
        <label className="f-l" htmlFor="pf-bio">
          Über dich (freiwillig)
        </label>
        <textarea id="pf-bio" className="ta" maxLength={500} value={v.bio} onChange={(e) => setV({ ...v, bio: e.target.value })} />
      </div>
      <div className="form-2">
        {field("website", "Website (freiwillig)", { type: "url", placeholder: "https://" })}
        {field("x", "X (freiwillig)", { type: "url", placeholder: "https://x.com/…" })}
      </div>
      {field("github", "GitHub (freiwillig)", { type: "url", placeholder: "https://github.com/…" })}
      <div className="acts-row">
        <button className="btn btn-ink" type="submit" disabled={busy}>
          Speichern
        </button>
        <Link className="alink" href={`/veranstalter/${me.username}`}>
          Öffentliche Seite ansehen
          <Ic name="arrow-r" small />
        </Link>
      </div>
    </form>
  );
}

function Profile() {
  const { data, error, reload } = useApi<MeResponse>("/me");
  if (error && !data) return <ErrorCard title="Dein Profil hat nicht geladen" error={error} onRetry={reload} />;
  if (!data) {
    return (
      <Loading label="Profil wird geladen">
        <Sk h={420} />
      </Loading>
    );
  }
  const me = data.me;
  return (
    <div className="g3">
      <Form key={me.username + me.name} me={me} />
      <div className="stack">
        <section className="box form" aria-labelledby="pic-h">
          <h2 id="pic-h" className="box-t">
            Bilder
          </h2>
          <div className="logo-up">
            <span className="logo logo-xl" style={{ borderRadius: 999 }}>
              {me.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.avatarUrl} alt="Dein Profilbild" />
              ) : (
                me.name.slice(0, 2).toUpperCase()
              )}
            </span>
            <ImagePick path="/me/avatar" label="Profilbild" has={!!me.avatarUrl} />
          </div>
          <div className="f">
            <span className="f-l">Titelbild für deine Veranstalterseite</span>
            <ImagePick path="/me/banner" label="Titelbild" has={!!me.bannerUrl} />
          </div>
        </section>
        <section className="box" aria-labelledby="acc-h">
          <h2 id="acc-h" className="box-t" style={{ marginBottom: 8 }}>
            Planary-Konto
          </h2>
          <p className="box-s" style={{ marginBottom: 12 }}>
            Angemeldet als {me.email}. E-Mail und Passwort änderst du im Planary-Konto.
          </p>
          <a className="btn btn-line btn-s" href="https://auth.planary.ch">
            Konto öffnen
            <Ic name="arrow-ur" small />
          </a>
        </section>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <>
      <PageHead title="Profil" />
      <SignInGate why="Dein Profil siehst du, wenn du angemeldet bist.">
        <Profile />
      </SignInGate>
    </>
  );
}
