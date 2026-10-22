"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useAuth } from "../AuthProvider";
import { useToast } from "../Shell";
import { bodyFrom, fieldOf, formFrom, TournamentForm, type FormValues } from "../TournamentForm";
import { Dialog, Ic } from "../ui";
import { useRun } from "./useRun";
import { type ApiError, download, useAction } from "@/lib/api";
import { PORTAL_URL } from "@/lib/auth";
import { initials } from "@/lib/fmt";
import type { TournamentView } from "@/lib/types";

function Branding({ v }: { v: TournamentView }) {
  const t = v.tournament;
  const act = useAction();
  const toast = useToast();
  const { run, busy } = useRun();
  const file = useRef<HTMLInputElement>(null);
  const [color, setColor] = useState(t.brand?.color ?? "#1f1b3a");
  const allowed = !!v.limits?.branding;
  const upload = async (f: File | undefined) => {
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) return toast("Logos müssen PNG, JPG oder WebP sein.", "err");
    if (f.size > 5 * 1024 * 1024) return toast("Logos dürfen bis 5 MB gross sein.", "err");
    const form = new FormData();
    form.set("file", f);
    try {
      await act(`/t/${t.id}/logo`, form);
      toast("Logo gespeichert.");
    } catch (e) {
      toast((e as ApiError).message, "err");
    }
  };
  return (
    <section className="box form" aria-labelledby="br-h">
      <div className="box-h">
        <h2 id="br-h" className="box-t">
          Logo und Farbe
        </h2>
        {!allowed ? <span className="chip chip-line">ab Plan Event</span> : null}
      </div>
      <p className="box-s">Auf der Turnierseite und dem Beamer.</p>
      {allowed ? (
        <>
          <div className="logo-up">
            <span className="logo logo-xl" style={t.brand?.color ? { background: t.brand.color } : undefined}>
              {t.brand?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.brand.logoUrl} alt={`Logo von ${t.name}`} />
              ) : (
                t.name.slice(0, 2).toUpperCase()
              )}
            </span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-line btn-s" type="button" onClick={() => file.current?.click()}>
                <Ic name="upload" small />
                Logo hochladen
              </button>
              {t.brand?.logoUrl ? (
                <button className="btn btn-ghost btn-s" type="button" disabled={busy} onClick={() => run(`/t/${t.id}/logo`, {}, "Logo entfernt.", "DELETE")}>
                  Entfernen
                </button>
              ) : null}
              <input ref={file} className="sr" type="file" accept="image/png,image/jpeg,image/webp" tabIndex={-1} aria-hidden="true" onChange={(e) => void upload(e.target.files?.[0])} />
            </div>
          </div>
          <div className="f">
            <label className="f-l" htmlFor="br-c">
              Farbe
            </label>
            <div className="color-r">
              <input id="br-c" className="color" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              <span className="mono-t">{color}</span>
              <button className="btn btn-line btn-s" type="button" disabled={busy || color === t.brand?.color} onClick={() => run(`/t/${t.id}`, { brandColor: color }, "Farbe gespeichert.")}>
                Speichern
              </button>
              {t.brand?.color ? (
                <button className="btn btn-ghost btn-s" type="button" disabled={busy} onClick={() => run(`/t/${t.id}`, { brandColor: null }, "Farbe entfernt.")}>
                  Entfernen
                </button>
              ) : null}
            </div>
            <span className="f-h">Für Akzente auf dem Beamer. Dunkle Farben lesen sich am besten.</span>
          </div>
        </>
      ) : (
        <a className="btn btn-line btn-s" href={t.organisation ? `${PORTAL_URL}/abrechnung` : `${PORTAL_URL}/neu`}>
          {t.organisation ? "Plan im Portal wechseln" : "Organisation im Portal anlegen"}
          <Ic name="arrow-ur" small />
        </a>
      )}
    </section>
  );
}

function Organisers({ v }: { v: TournamentView }) {
  const t = v.tournament;
  const { user } = useAuth();
  const { run, busy } = useRun();
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"admin" | "scorer">("scorer");
  const runs = v.me?.role === "owner" || v.me?.role === "admin";
  const max = v.limits?.maxOrganisers ?? 1;
  return (
    <section className="box form" aria-labelledby="og-h">
      <div className="box-h">
        <h2 id="og-h" className="box-t">
          Wer das Turnier leitet
        </h2>
        <span className="box-s">
          {v.organisers.length} von {max}
        </span>
      </div>
      <ul>
        {v.organisers.map((o) => (
          <li className="list-r" key={o.id}>
            <span className="av">{initials(o.name)}</span>
            <div className="grow">
              <b>
                {o.name}
                {o.id === user?.id ? " (du)" : ""}
              </b>
              <span className="s">{o.role === "owner" ? "hat es erstellt, leitet" : o.role === "admin" ? "leitet mit" : "trägt Resultate ein"}</span>
            </div>
            {o.role !== "owner" && (runs || o.id === user?.id) ? (
              <button className="ib" type="button" aria-label={`${o.name} entfernen`} disabled={busy} onClick={() => run(`/t/${t.id}/organisers/${o.id}`, {}, `${o.name} entfernt.`, "DELETE")}>
                <Ic name="trash" small />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {t.organisation ? <p className="box-s">Mitglieder von {t.organisation.name} leiten das Turnier ohnehin mit.</p> : null}
      {runs ? (
        v.organisers.length >= max ? (
          <p className="box-s">Im Plan {v.limits?.planName ?? "Gratis"} {max === 1 ? "leitest du allein" : `leiten bis ${max} Personen`}. Mehr gibt es im Plan Verein.</p>
        ) : (
          <form
            className="form-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run(`/t/${t.id}/organisers`, { username: username.trim(), role }, "Hinzugefügt.")) setUsername("");
            }}
          >
            <div className="f">
              <label className="f-l" htmlFor="og-u">
                Benutzername
              </label>
              <input id="og-u" className="inp" type="text" placeholder="noa-brunner" value={username} onChange={(e) => setUsername(e.target.value)} />
              <span className="f-h">Steht in Tournament unter Profil.</span>
            </div>
            <div className="f">
              <label className="f-l" htmlFor="og-r">
                Rolle
              </label>
              <select id="og-r" className="sel" value={role} onChange={(e) => setRole(e.target.value as "admin" | "scorer")}>
                <option value="scorer">Trägt Resultate ein</option>
                <option value="admin">Leitet mit</option>
              </select>
            </div>
            <div>
              <button className="btn btn-ink btn-s" type="submit" disabled={busy || !username.trim()}>
                Hinzufügen
              </button>
            </div>
          </form>
        )
      ) : null}
    </section>
  );
}

function Export({ v }: { v: TournamentView }) {
  const t = v.tournament;
  const { accessToken } = useAuth();
  const toast = useToast();
  const allowed = !!v.limits?.export;
  const get = (path: string, name: string) => download(accessToken, path, name).catch((e: ApiError) => toast(e.message, "err"));
  return (
    <section className="box" aria-labelledby="ex-h">
      <div className="box-h">
        <h2 id="ex-h" className="box-t">
          Export
        </h2>
        {!allowed ? <span className="chip chip-line">ab Plan Event</span> : null}
      </div>
      <p className="box-s" style={{ marginBottom: 12 }}>
        Für die Vereinsseite, das Archiv oder die Siegerehrung. Die CSV-Dateien öffnen sich direkt in Excel.
      </p>
      <div className="acts-row">
        <button className="btn btn-line btn-s" type="button" disabled={!allowed} onClick={() => get(`/t/${t.id}/export.csv?what=entries`, `${t.slug}-anmeldungen.csv`)}>
          <Ic name="download" small />
          Anmeldungen (CSV)
        </button>
        <button className="btn btn-line btn-s" type="button" disabled={!allowed || !v.matches.length} onClick={() => get(`/t/${t.id}/export.csv`, `${t.slug}-resultate.csv`)}>
          <Ic name="download" small />
          Resultate (CSV)
        </button>
        <button className="btn btn-line btn-s" type="button" disabled={!allowed || !v.matches.length} onClick={() => get(`/t/${t.id}/export.pdf`, `${t.slug}-resultate.pdf`)}>
          <Ic name="file" small />
          Resultate (PDF)
        </button>
      </div>
    </section>
  );
}

function Danger({ v }: { v: TournamentView }) {
  const router = useRouter();
  const { run, busy } = useRun();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const t = v.tournament;
  if (v.me?.role !== "owner") return null;
  return (
    <section className="danger" aria-labelledby="dz-h">
      <div>
        <h2 id="dz-h">Turnier löschen</h2>
        <p>Löscht das Turnier mit allen Anmeldungen und Resultaten, sofort.</p>
      </div>
      <button className="btn btn-danger btn-s" type="button" onClick={() => setOpen(true)}>
        Turnier löschen
      </button>
      {open ? (
        <Dialog
          title="Turnier löschen?"
          onClose={() => setOpen(false)}
          actions={
            <>
              <button className="btn btn-ghost btn-s" type="button" onClick={() => setOpen(false)}>
                Abbrechen
              </button>
              <button
                className="btn btn-danger btn-s"
                type="button"
                disabled={busy || confirm.trim() !== t.name}
                onClick={async () => {
                  if (await run(`/t/${t.id}`, {}, "Gelöscht.", "DELETE")) router.push("/meine");
                }}
              >
                Löschen
              </button>
            </>
          }
        >
          <div className="f">
            <label className="f-l" htmlFor="del-c">
              Tipp zur Bestätigung „{t.name}“ ein
            </label>
            <input id="del-c" className="inp" type="text" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}

export function Settings({ v }: { v: TournamentView }) {
  const t = v.tournament;
  const act = useAction();
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState<FormValues>(() => formFrom(t));
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [busy, setBusy] = useState(false);
  const started = t.state === "live" || t.state === "done";
  const plan = { name: v.limits?.planName ?? "Gratis", maxTeams: v.limits?.maxTeams ?? 16, checkIn: !!v.limits?.checkIn, waitingList: !!v.limits?.waitingList };
  const dirty = JSON.stringify(bodyFrom(form)) !== JSON.stringify(bodyFrom(formFrom(t)));

  const save = async () => {
    setBusy(true);
    try {
      const body = bodyFrom(form);
      await act(`/t/${t.id}`, body);
      toast("Gespeichert.");
      setErrors({});
      if (body.slug && body.slug !== t.slug) router.replace(`/${body.slug}/verwalten?tab=einstellungen`);
    } catch (e) {
      const err = e as ApiError;
      const f = fieldOf(err.code);
      if (f) setErrors({ [f]: err.message });
      toast(err.message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="g3">
      <div className="stack">
        <TournamentForm value={form} onChange={setForm} plan={plan} started={started} hasEntries={v.entries.length > 0} showSlug errors={errors} />
        <div className="savebar">
          <button className="btn btn-ink" type="button" disabled={busy || !dirty} onClick={save}>
            Änderungen speichern
          </button>
          {dirty ? (
            <button className="btn btn-ghost" type="button" onClick={() => setForm(formFrom(t))}>
              Verwerfen
            </button>
          ) : (
            <span className="box-s">Alles gespeichert.</span>
          )}
        </div>
      </div>
      <div className="stack">
        <Branding v={v} />
        <Organisers v={v} />
        <Export v={v} />
        <Danger v={v} />
      </div>
    </div>
  );
}
