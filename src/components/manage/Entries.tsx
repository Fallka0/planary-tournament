"use client";

import { useState } from "react";
import { Chip, Dialog, Empty, Ic, Table, Td } from "../ui";
import { useRun } from "./useRun";
import { initials } from "@/lib/fmt";
import type { Entry, TournamentView } from "@/lib/types";

export function Entries({ v }: { v: TournamentView }) {
  const t = v.tournament;
  const { run, busy } = useRun();
  const [name, setName] = useState("");
  const [members, setMembers] = useState("");
  const [renaming, setRenaming] = useState<Entry | null>(null);
  const [newName, setNewName] = useState("");
  const [removing, setRemoving] = useState<Entry | null>(null);
  const before = t.state === "draft" || t.state === "open";
  const team = t.entryType === "team";
  const confirmed = v.entries.filter((e) => e.status === "confirmed");
  const waiting = v.entries.filter((e) => e.status === "waiting");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const ok = await run(`/t/${t.id}/entries`, { name: name.trim(), members: members.split(",").map((m) => m.trim()).filter(Boolean) }, `${name.trim()} ist angemeldet.`);
    if (ok) {
      setName("");
      setMembers("");
    }
  };

  const rows = (list: Entry[], waitingList: boolean) =>
    list.map((e, i) => (
      <tr className="dt-r" key={e.id}>
        <Td>
          <span className="who">
            <span className="av">{waitingList ? i + 1 : initials(e.name)}</span>
            <span>
              <b>{e.name}</b>
              <span>{e.members.length ? e.members.join(", ") : waitingList ? "Warteliste" : new Date(e.createdAt).toLocaleDateString("de-CH")}</span>
            </span>
          </span>
        </Td>
        <Td hide>{t.checkIn ? <Chip chip={e.checkedIn ? "ok" : ""} dot={e.checkedIn ? "ok" : ""}>{e.checkedIn ? "Eingecheckt" : "Nicht da"}</Chip> : null}</Td>
        <Td r>
          <span className="row-acts">
            {before && t.checkIn ? (
              <button className="btn btn-line btn-s" type="button" disabled={busy} onClick={() => run(`/t/${t.id}/entries/${e.id}/check-in`, { checkedIn: !e.checkedIn }, e.checkedIn ? `${e.name} ausgecheckt.` : `${e.name} eingecheckt.`)}>
                {e.checkedIn ? "Auschecken" : "Einchecken"}
              </button>
            ) : null}
            {before && waitingList ? (
              <button className="btn btn-line btn-s" type="button" disabled={busy || t.full} onClick={() => run(`/t/${t.id}/entries/${e.id}/promote`, {}, `${e.name} ist im Turnier.`)}>
                Ins Turnier
              </button>
            ) : null}
            <button
              className="ib"
              type="button"
              aria-label={`${e.name} umbenennen`}
              onClick={() => {
                setRenaming(e);
                setNewName(e.name);
              }}
            >
              <Ic name="edit" small />
            </button>
            {before ? (
              <button className="ib" type="button" aria-label={`${e.name} entfernen`} onClick={() => setRemoving(e)}>
                <Ic name="trash" small />
              </button>
            ) : null}
          </span>
        </Td>
      </tr>
    ));

  return (
    <div className="g3">
      <div className="stack">
        <section className="box" aria-labelledby="en-h">
          <div className="box-h">
            <h2 id="en-h" className="box-t">
              {before ? "Angemeldet" : "Im Turnier"} · {confirmed.length} / {t.maxTeams}
            </h2>
            {t.checkIn && before ? <span className="box-s">{t.counts.checkedIn} eingecheckt</span> : null}
          </div>
          {confirmed.length ? (
            <Table label={before ? "Angemeldet" : "Im Turnier"} cols="minmax(0,1fr) 130px auto" colsS="minmax(0,1fr) auto" head={[{ h: "Name" }, { h: t.checkIn ? "Check-in" : "", hide: true }, { h: "", r: true }]}>
              {rows(confirmed, false)}
            </Table>
          ) : (
            <Empty icon="users" title="Noch niemand angemeldet">
              Teile den Link zum Turnier oder trag {team ? "Teams" : "Spieler"} rechts von Hand ein.
            </Empty>
          )}
        </section>
        {waiting.length ? (
          <section className="box" aria-labelledby="wl-h">
            <div className="box-h">
              <h2 id="wl-h" className="box-t">
                {before ? "Warteliste" : "Nicht im Turnier"} · {waiting.length}
              </h2>
              {before ? <span className="box-s">rückt in dieser Reihenfolge nach</span> : null}
            </div>
            <Table label="Warteliste" cols="minmax(0,1fr) 130px auto" colsS="minmax(0,1fr) auto" head={[{ h: "Name" }, { h: t.checkIn ? "Check-in" : "", hide: true }, { h: "", r: true }]}>
              {rows(waiting, true)}
            </Table>
          </section>
        ) : null}
      </div>
      {before ? (
        <form className="box form" onSubmit={add} aria-labelledby="add-h">
          <h2 id="add-h" className="box-t">
            Von Hand eintragen
          </h2>
          <p className="box-s">Für alle ohne Planary-Konto. {t.full ? (t.waitingList ? "Das Turnier ist voll: neue Einträge kommen auf die Warteliste." : "Das Turnier ist voll.") : ""}</p>
          <div className="f">
            <label className="f-l" htmlFor="add-n">
              {team ? "Teamname" : "Name"}
            </label>
            <input id="add-n" className="inp" type="text" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {team ? (
            <div className="f">
              <label className="f-l" htmlFor="add-m">
                Spieler (freiwillig)
              </label>
              <input id="add-m" className="inp" type="text" placeholder="Mit Kommas getrennt" value={members} onChange={(e) => setMembers(e.target.value)} />
            </div>
          ) : null}
          <button className="btn btn-ink" type="submit" disabled={busy || !name.trim() || (t.full && !t.waitingList)}>
            <Ic name="plus" small />
            Eintragen
          </button>
        </form>
      ) : (
        <section className="box">
          <p className="box-s">Das Turnier läuft, die Teilnehmer stehen fest.</p>
        </section>
      )}
      {renaming ? (
        <Dialog
          title="Umbenennen"
          onClose={() => setRenaming(null)}
          actions={
            <>
              <button className="btn btn-ghost btn-s" type="button" onClick={() => setRenaming(null)}>
                Abbrechen
              </button>
              <button
                className="btn btn-ink btn-s"
                type="button"
                disabled={busy || !newName.trim()}
                onClick={async () => {
                  if (await run(`/t/${t.id}/entries/${renaming.id}/rename`, { name: newName.trim() }, "Umbenannt.")) setRenaming(null);
                }}
              >
                Speichern
              </button>
            </>
          }
        >
          <div className="f">
            <label className="f-l" htmlFor="rn">
              Neuer Name
            </label>
            <input id="rn" className="inp" type="text" maxLength={60} value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
        </Dialog>
      ) : null}
      {removing ? (
        <Dialog
          title={`${removing.name} entfernen?`}
          onClose={() => setRemoving(null)}
          actions={
            <>
              <button className="btn btn-ghost btn-s" type="button" onClick={() => setRemoving(null)}>
                Abbrechen
              </button>
              <button
                className="btn btn-danger btn-s"
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (await run(`/t/${t.id}/entries/${removing.id}`, {}, `${removing.name} entfernt.`, "DELETE")) setRemoving(null);
                }}
              >
                Entfernen
              </button>
            </>
          }
        >
          <p className="box-s">{removing.status === "confirmed" && t.waitingList && waiting.length ? `Der Platz geht an ${waiting[0].name} von der Warteliste.` : "Die Anmeldung wird gelöscht."}</p>
        </Dialog>
      ) : null}
    </div>
  );
}
