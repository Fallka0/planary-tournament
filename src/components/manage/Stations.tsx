"use client";

import { useState } from "react";
import { Ic } from "../ui";
import { useRun } from "./useRun";
import type { TournamentView } from "@/lib/types";

export function Stations({ v }: { v: TournamentView }) {
  const { run, busy } = useRun();
  const [list, setList] = useState(v.stations.map((s) => ({ id: s.id as string | undefined, name: s.name })));
  const [name, setName] = useState("");
  const dirty = JSON.stringify(list) !== JSON.stringify(v.stations.map((s) => ({ id: s.id, name: s.name })));
  const move = (i: number, d: number) => {
    const next = [...list];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    setList(next);
  };
  return (
    <div className="g3">
      <section className="box form" aria-labelledby="sta-h">
        <h2 id="sta-h" className="box-t">
          Stationen
        </h2>
        <p className="box-s">Tische, Konsolen oder Felder. Jedes Spiel bekommt die nächste freie.</p>
        {list.length ? (
          <ol className="stl">
            {list.map((s, i) => (
              <li key={s.id ?? `new-${i}`}>
                <label className="sr" htmlFor={`stn-${i}`}>
                  Name der Station {i + 1}
                </label>
                <input id={`stn-${i}`} className="inp" type="text" maxLength={40} value={s.name} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <button className="ib" type="button" aria-label="Nach oben" disabled={i === 0} onClick={() => move(i, -1)}>
                  <Ic name="chev-l" small />
                </button>
                <button className="ib" type="button" aria-label="Nach unten" disabled={i === list.length - 1} onClick={() => move(i, 1)}>
                  <Ic name="chev-r" small />
                </button>
                <button className="ib" type="button" aria-label={`${s.name} entfernen`} onClick={() => setList(list.filter((_, j) => j !== i))}>
                  <Ic name="trash" small />
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="box-s">Ohne Stationen laufen beliebig viele Spiele gleichzeitig.</p>
        )}
        <form
          className="stl-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            setList([...list, { id: undefined, name: name.trim() }]);
            setName("");
          }}
        >
          <label className="sr" htmlFor="stn-new">
            Neue Station
          </label>
          <input id="stn-new" className="inp" type="text" maxLength={40} placeholder={`Tisch ${list.length + 1}`} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-line" type="submit">
            <Ic name="plus" small />
            Hinzufügen
          </button>
        </form>
        <div className="acts-row">
          <button className="btn btn-ink" type="button" disabled={busy || !dirty || list.some((s) => !s.name.trim())} onClick={() => run(`/t/${v.tournament.id}/stations`, { stations: list.map((s) => ({ id: s.id, name: s.name.trim() })) }, "Stationen gespeichert.")}>
            Speichern
          </button>
          {dirty ? (
            <button className="btn btn-ghost" type="button" onClick={() => setList(v.stations.map((s) => ({ id: s.id, name: s.name })))}>
              Verwerfen
            </button>
          ) : null}
        </div>
      </section>
      <section className="box" aria-labelledby="sx-h">
        <h2 id="sx-h" className="box-t">
          Schnell anlegen
        </h2>
        <p className="box-s" style={{ margin: "8px 0 12px" }}>
          Gleich mehrere auf einmal.
        </p>
        <div className="acts-row">
          {[2, 4, 8].map((n) => (
            <button key={n} className="btn btn-line btn-s" type="button" onClick={() => setList(Array.from({ length: n }, (_, i) => list[i] ?? { id: undefined, name: `Tisch ${i + 1}` }))}>
              {n} Tische
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
