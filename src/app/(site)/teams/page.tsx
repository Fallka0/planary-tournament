"use client";

import { useState } from "react";
import { SignInGate } from "@/components/common";
import { ImagePick } from "@/components/ImagePick";
import { useToast } from "@/components/Shell";
import { Dialog, Empty, ErrorCard, Ic, Loading, PageHead, Sk } from "@/components/ui";
import { type ApiError, useAction, useApi } from "@/lib/api";
import type { Team } from "@/lib/types";

interface Draft {
  id: string | null;
  name: string;
  tag: string;
  description: string;
  members: string;
}

const toDraft = (t?: Team): Draft => ({ id: t?.id ?? null, name: t?.name ?? "", tag: t?.tag ?? "", description: t?.description ?? "", members: (t?.members ?? []).join("\n") });

function Editor({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const act = useAction();
  const toast = useToast();
  const [d, setD] = useState(draft);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!d.name.trim()) return setErr("Wie heisst das Team?");
    setBusy(true);
    try {
      await act(d.id ? `/teams/${d.id}` : "/teams", { name: d.name.trim(), tag: d.tag.trim(), description: d.description, members: d.members.split(/\n|,/).map((m) => m.trim()).filter(Boolean) });
      toast(d.id ? "Gespeichert." : "Team angelegt.");
      onClose();
    } catch (e) {
      setErr((e as ApiError).message);
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={d.id ? "Team bearbeiten" : "Neues Team"}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost btn-s" type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn btn-ink btn-s" type="button" disabled={busy} onClick={save}>
            Speichern
          </button>
        </>
      }
    >
      <div className="form">
        <div className="form-2">
          <div className="f">
            <label className="f-l" htmlFor="tm-n">
              Name
            </label>
            <input id="tm-n" className="inp" type="text" maxLength={60} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          </div>
          <div className="f">
            <label className="f-l" htmlFor="tm-t">
              Kürzel (freiwillig)
            </label>
            <input id="tm-t" className="inp" type="text" maxLength={8} value={d.tag} onChange={(e) => setD({ ...d, tag: e.target.value.toUpperCase() })} />
          </div>
        </div>
        <div className="f">
          <label className="f-l" htmlFor="tm-m">
            Spieler
          </label>
          <textarea id="tm-m" className="ta" placeholder={"Eine Person pro Zeile"} value={d.members} onChange={(e) => setD({ ...d, members: e.target.value })} />
          <span className="f-h">Turniere verlangen eine Mindestzahl Spieler.</span>
        </div>
        <div className="f">
          <label className="f-l" htmlFor="tm-d">
            Beschreibung (freiwillig)
          </label>
          <textarea id="tm-d" className="ta" style={{ minHeight: 70 }} maxLength={500} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
        </div>
        {err ? <p className="f-err">{err}</p> : null}
      </div>
    </Dialog>
  );
}

function Teams() {
  const { data, error, reload } = useApi<{ teams: Team[] }>("/teams");
  const act = useAction();
  const toast = useToast();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<Team | null>(null);
  if (error && !data) return <ErrorCard title="Deine Teams haben nicht geladen" error={error} onRetry={reload} />;
  if (!data) {
    return (
      <Loading label="Teams werden geladen">
        <Sk h={300} />
      </Loading>
    );
  }
  return (
    <>
      <div className="acts-row" style={{ marginBottom: 16 }}>
        <button className="btn btn-ink" type="button" onClick={() => setEdit(toDraft())}>
          <Ic name="plus" small />
          Neues Team
        </button>
      </div>
      {data.teams.length ? (
        <div className="team-grid">
          {data.teams.map((t) => (
            <article className="box team-c" key={t.id}>
              <div className="team-h">
                <span className="logo logo-l">
                  {t.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.avatarUrl} alt="" />
                  ) : (
                    (t.tag || t.name).slice(0, 2).toUpperCase()
                  )}
                </span>
                <div className="grow">
                  <h2 className="box-t">{t.name}</h2>
                  <span className="box-s">
                    {t.tag ? `${t.tag} · ` : ""}
                    {t.members.length} Spieler
                  </span>
                </div>
              </div>
              {t.members.length ? <p className="box-s">{t.members.join(", ")}</p> : null}
              <div className="acts-row">
                <button className="btn btn-line btn-s" type="button" onClick={() => setEdit(toDraft(t))}>
                  <Ic name="edit" small />
                  Bearbeiten
                </button>
                <ImagePick path={`/teams/${t.id}/avatar`} label="Bild" has={!!t.avatarUrl} />
                <button className="ib" type="button" aria-label={`${t.name} löschen`} onClick={() => setRemoving(t)}>
                  <Ic name="trash" small />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty icon="users" title="Noch keine Teams" action={<button className="btn btn-ink btn-s" type="button" onClick={() => setEdit(toDraft())}>Team anlegen</button>}>
          Leg dein Team einmal an und melde es bei jedem Turnier mit einem Klick an.
        </Empty>
      )}
      {edit ? <Editor draft={edit} onClose={() => setEdit(null)} /> : null}
      {removing ? (
        <Dialog
          title={`${removing.name} löschen?`}
          onClose={() => setRemoving(null)}
          actions={
            <>
              <button className="btn btn-ghost btn-s" type="button" onClick={() => setRemoving(null)}>
                Abbrechen
              </button>
              <button
                className="btn btn-danger btn-s"
                type="button"
                onClick={() =>
                  act(`/teams/${removing.id}`, {}, "DELETE").then(
                    () => {
                      toast("Gelöscht.");
                      setRemoving(null);
                    },
                    (e: ApiError) => toast(e.message, "err"),
                  )
                }
              >
                Löschen
              </button>
            </>
          }
        >
          <p className="box-s">Angemeldete Turniere behalten Name und Spieler.</p>
        </Dialog>
      ) : null}
    </>
  );
}

export default function TeamsPage() {
  return (
    <>
      <PageHead title="Teams" />
      <SignInGate why="Deine Teams siehst du, wenn du angemeldet bist.">
        <Teams />
      </SignInGate>
    </>
  );
}
