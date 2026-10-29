"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { LockedFeature, TeamsLimit, type Upgrade } from "./PlanLimits";
import { Ic } from "./ui";
import { fromLocalInput, toLocalInput } from "@/lib/fmt";
import { GAMES } from "@/lib/games";
import type { TournamentInfo } from "@/lib/types";

export interface FormValues {
  name: string;
  game: string;
  description: string;
  mode: "knockout" | "group" | "both";
  groupCount: number;
  matchFormat: "bo1" | "bo3" | "bo5";
  entryType: "solo" | "team";
  teamSize: number;
  maxTeams: number;
  startsAt: string;
  endsAt: string;
  venue: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  checkIn: boolean;
  checkInMinutes: number;
  waitingList: boolean;
  confirmResults: boolean;
  matchMinutes: number;
  breakMinutes: number;
  isPublic: boolean;
  slug: string;
}

export const EMPTY_FORM: FormValues = {
  name: "",
  game: "",
  description: "",
  mode: "knockout",
  groupCount: 2,
  matchFormat: "bo1",
  entryType: "team",
  teamSize: 5,
  maxTeams: 16,
  startsAt: "",
  endsAt: "",
  venue: "",
  registrationOpensAt: "",
  registrationClosesAt: "",
  checkIn: false,
  checkInMinutes: 60,
  waitingList: false,
  confirmResults: false,
  matchMinutes: 30,
  breakMinutes: 5,
  isPublic: true,
  slug: "",
};

export function formFrom(t: TournamentInfo): FormValues {
  return {
    name: t.name,
    game: t.game,
    description: t.description,
    mode: t.mode,
    groupCount: t.groupCount,
    matchFormat: t.matchFormat,
    entryType: t.entryType,
    teamSize: t.teamSize,
    maxTeams: t.maxTeams,
    startsAt: toLocalInput(t.startsAt),
    endsAt: toLocalInput(t.endsAt),
    venue: t.venue,
    registrationOpensAt: toLocalInput(t.registrationOpensAt),
    registrationClosesAt: toLocalInput(t.registrationClosesAt),
    checkIn: t.checkIn,
    checkInMinutes: t.checkInMinutes,
    waitingList: t.waitingList,
    confirmResults: t.confirmResults,
    matchMinutes: t.matchMinutes,
    breakMinutes: t.breakMinutes,
    isPublic: t.isPublic,
    slug: t.slug,
  };
}

/** What the API takes. */
export function bodyFrom(v: FormValues) {
  return {
    name: v.name.trim(),
    game: v.game.trim(),
    description: v.description,
    mode: v.mode,
    groupCount: v.groupCount,
    matchFormat: v.matchFormat,
    entryType: v.entryType,
    teamSize: v.entryType === "team" ? v.teamSize : 1,
    maxTeams: v.maxTeams,
    startsAt: fromLocalInput(v.startsAt),
    endsAt: fromLocalInput(v.endsAt),
    venue: v.venue,
    registrationOpensAt: fromLocalInput(v.registrationOpensAt),
    registrationClosesAt: fromLocalInput(v.registrationClosesAt),
    checkIn: v.checkIn,
    checkInMinutes: v.checkInMinutes,
    waitingList: v.waitingList,
    confirmResults: v.confirmResults,
    matchMinutes: v.matchMinutes,
    breakMinutes: v.breakMinutes,
    isPublic: v.isPublic,
    ...(v.slug ? { slug: v.slug.trim().toLowerCase() } : {}),
  };
}

export interface PlanInfo {
  name: string;
  maxTeams: number;
  checkIn: boolean;
  waitingList: boolean;
}

/**
 * The size of the field as a stepper. The cap is always said under it; at the cap the + carries
 * a dot, and pressing it says how to get more room (when there is a way up).
 */
function Teams({ value, onChange, cap, planName, word, disabled, upgrade, panel, setPanel }: { value: number; onChange: (n: number) => void; cap: number; planName: string; word: string; disabled?: boolean; upgrade?: Upgrade | null; panel: boolean; setPanel: (open: boolean) => void }) {
  const atCap = value >= cap && !!upgrade;
  const set = (n: number) => onChange(Math.max(2, Math.min(cap, n)));
  return (
    <div className="f">
      <label className="f-l" htmlFor="tf-max">
        Anzahl {word}
      </label>
      <div className={`stepper${atCap ? " at-cap" : ""}`}>
        <button type="button" aria-label={`Ein ${word === "Teams" ? "Team" : "Spieler"} weniger`} disabled={disabled || value <= 2} onClick={() => set(value - 1)}>
          <span aria-hidden="true">−</span>
        </button>
        <input id="tf-max" type="number" inputMode="numeric" min={2} max={cap} value={Number.isFinite(value) ? value : ""} disabled={disabled} aria-describedby="tf-max-h" onChange={(e) => onChange(Number.parseInt(e.target.value, 10))} />
        <button
          type="button"
          aria-label={atCap ? `Mehr als ${cap}: so geht es` : `Ein ${word === "Teams" ? "Team" : "Spieler"} mehr`}
          aria-expanded={atCap ? panel : undefined}
          disabled={disabled || (value >= cap && !upgrade)}
          onClick={() => (value >= cap ? setPanel(true) : set(value + 1))}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <span id="tf-max-h" className="f-h">
        bis {cap} bei {planName}
      </span>
    </div>
  );
}

function Pills<T extends string>({ label, value, options, onChange, disabled }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <fieldset className="f" style={{ border: 0, padding: 0, margin: 0 }} disabled={disabled}>
      <legend className="f-l" style={{ marginBottom: 8 }}>
        {label}
      </legend>
      <div className="pills">
        {options.map(([k, l]) => (
          <button key={k} className="pill" type="button" aria-pressed={value === k} onClick={() => onChange(k)}>
            {l}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({ label, hint, checked, onChange, disabled, locked }: { label: string; hint: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; locked?: string }) {
  return (
    <label className={`tgl${disabled ? " off" : ""}`}>
      <span className={`sw${checked ? " on" : ""}`} aria-hidden="true" />
      <input className="sr" type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <b>
          {label}
          {locked ? <span className="chip chip-line plan-chip">{locked}</span> : null}
        </b>
        <span className="s">{hint}</span>
      </span>
    </label>
  );
}

function Num({ id, label, value, min, max, onChange, hint, disabled }: { id: string; label: string; value: number; min: number; max: number; onChange: (n: number) => void; hint?: string; disabled?: boolean }) {
  return (
    <div className="f">
      <label className="f-l" htmlFor={id}>
        {label}
      </label>
      <input id={id} className="inp" type="number" inputMode="numeric" min={min} max={max} value={Number.isFinite(value) ? value : ""} disabled={disabled} onChange={(e) => onChange(Number.parseInt(e.target.value, 10))} />
      {hint ? <span className="f-h">{hint}</span> : null}
    </div>
  );
}

/**
 * Every setting of a tournament, in four boxes. `started` locks the format and size, `plan`
 * decides the team cap and which features can be switched on.
 */
export function TournamentForm({
  value,
  onChange,
  plan,
  started = false,
  hasEntries = false,
  showSlug = false,
  errors = {},
  extra,
  upgrade = null,
}: {
  value: FormValues;
  onChange: (v: FormValues) => void;
  plan: PlanInfo;
  started?: boolean;
  hasEntries?: boolean;
  showSlug?: boolean;
  errors?: Partial<Record<keyof FormValues, string>>;
  extra?: ReactNode;
  /** The ways up from this plan; null when there is none (Plus, or a pass already). */
  upgrade?: Upgrade | null;
}) {
  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) => onChange({ ...value, [k]: v });
  const [teamsPanel, setTeamsPanel] = useState(false);
  const gameOpen = useId();
  const err = (k: keyof FormValues) =>
    errors[k] ? (
      <span id={`tf-${k}-e`} className="f-err">
        {errors[k]}
      </span>
    ) : null;
  const aria = (k: keyof FormValues) => (errors[k] ? { "aria-invalid": true, "aria-describedby": `tf-${k}-e` } : {});
  const word = value.entryType === "team" ? "Teams" : "Spieler";

  return (
    <div className="stack">
      <section className="box form" aria-labelledby="tf-a">
        <h2 id="tf-a" className="box-t">
          Turnier
        </h2>
        <div className="form-2">
          <div className="f">
            <label className="f-l" htmlFor="tf-name">
              Name
            </label>
            <input id="tf-name" className="inp" type="text" placeholder="Gurten LAN" value={value.name} maxLength={80} onChange={(e) => set("name", e.target.value)} {...aria("name")} />
            {err("name")}
          </div>
          <div className="f">
            <label className="f-l" htmlFor="tf-game">
              Spiel oder Sportart
            </label>
            <input id="tf-game" className="inp" type="text" list={gameOpen} placeholder="Counter-Strike 2" value={value.game} maxLength={60} onChange={(e) => set("game", e.target.value)} {...aria("game")} />
            <datalist id={gameOpen}>
              {GAMES.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
            {err("game")}
          </div>
        </div>
        <div className="f">
          <label className="f-l" htmlFor="tf-desc">
            Beschreibung (freiwillig)
          </label>
          <textarea id="tf-desc" className="ta" placeholder="Regeln, Preise, was mitzubringen ist." value={value.description} maxLength={4000} onChange={(e) => set("description", e.target.value)} />
        </div>
        {extra}
      </section>

      <section className="box form" aria-labelledby="tf-b">
        <h2 id="tf-b" className="box-t">
          Format
        </h2>
        {started ? <p className="box-s">Das Turnier läuft schon: Format und Grösse bleiben, wie sie sind.</p> : null}
        <Pills
          label="Modus"
          value={value.mode}
          disabled={started}
          onChange={(v) => set("mode", v)}
          options={[
            ["knockout", "K.-o."],
            ["group", "Gruppenphase"],
            ["both", "Gruppen, dann K.-o."],
          ]}
        />
        {value.mode !== "knockout" ? (
          <Num id="tf-groups" label="Anzahl Gruppen" value={value.groupCount} min={1} max={32} disabled={started} onChange={(n) => set("groupCount", n)} hint={value.mode === "both" ? "Die Besten jeder Gruppe spielen danach K.-o." : undefined} />
        ) : null}
        <Pills
          label="Spiele"
          value={value.matchFormat}
          disabled={started}
          onChange={(v) => set("matchFormat", v)}
          options={[
            ["bo1", "Best of 1"],
            ["bo3", "Best of 3"],
            ["bo5", "Best of 5"],
          ]}
        />
        <Pills
          label="Wer spielt"
          value={value.entryType}
          disabled={started || hasEntries}
          onChange={(v) => set("entryType", v)}
          options={[
            ["team", "Teams"],
            ["solo", "Einzelspieler"],
          ]}
        />
        <div className="form-2">
          {value.entryType === "team" ? <Num id="tf-size" label="Spieler pro Team" value={value.teamSize} min={2} max={30} disabled={started} onChange={(n) => set("teamSize", n)} /> : <span />}
          <Teams value={value.maxTeams} onChange={(n) => set("maxTeams", n)} cap={plan.maxTeams} planName={plan.name} word={word} disabled={started} upgrade={upgrade} panel={teamsPanel} setPanel={setTeamsPanel} />
        </div>
        {teamsPanel && upgrade ? <TeamsLimit cap={plan.maxTeams} upgrade={upgrade} onKeep={() => setTeamsPanel(false)} /> : null}
        {err("maxTeams")}
      </section>

      <section className="box form" aria-labelledby="tf-c">
        <h2 id="tf-c" className="box-t">
          Wann und wo
        </h2>
        <div className="form-2">
          <div className="f">
            <label className="f-l" htmlFor="tf-start">
              Beginn
            </label>
            <input id="tf-start" className="inp" type="datetime-local" value={value.startsAt} onChange={(e) => set("startsAt", e.target.value)} {...aria("startsAt")} />
            {err("startsAt")}
          </div>
          <div className="f">
            <label className="f-l" htmlFor="tf-end">
              Ende (freiwillig)
            </label>
            <input id="tf-end" className="inp" type="datetime-local" value={value.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
          </div>
        </div>
        <div className="f">
          <label className="f-l" htmlFor="tf-venue">
            Ort (freiwillig)
          </label>
          <input id="tf-venue" className="inp" type="text" placeholder="Gurtenpark, Bern" value={value.venue} maxLength={120} onChange={(e) => set("venue", e.target.value)} />
        </div>
        <div className="form-2">
          <div className="f">
            <label className="f-l" htmlFor="tf-ro">
              Anmeldung öffnet (freiwillig)
            </label>
            <input id="tf-ro" className="inp" type="datetime-local" value={value.registrationOpensAt} onChange={(e) => set("registrationOpensAt", e.target.value)} />
          </div>
          <div className="f">
            <label className="f-l" htmlFor="tf-rc">
              Anmeldung schliesst (freiwillig)
            </label>
            <input id="tf-rc" className="inp" type="datetime-local" value={value.registrationClosesAt} onChange={(e) => set("registrationClosesAt", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="box form" aria-labelledby="tf-d">
        <h2 id="tf-d" className="box-t">
          Ablauf
        </h2>
        <Toggle
          label="Check-in vor Ort"
          hint={`Wer bis zum Start nicht eingecheckt ist, spielt nicht mit; die Warteliste rückt nach. Öffnet ${value.checkInMinutes} Minuten vor dem Beginn.`}
          checked={value.checkIn && plan.checkIn}
          disabled={!plan.checkIn || started}
          locked={plan.checkIn ? undefined : "Pass oder Plus"}
          onChange={(v) => set("checkIn", v)}
        />
        {value.checkIn && plan.checkIn ? <Num id="tf-cim" label="Check-in öffnet so viele Minuten vor dem Beginn" value={value.checkInMinutes} min={10} max={240} onChange={(n) => set("checkInMinutes", n)} /> : null}
        {!plan.waitingList && upgrade && !started ? (
          <LockedFeature title="Warteliste" hint="Ist das Turnier voll, rücken Nachzügler bei Absagen nach." what="Die Warteliste gibt es mit dem Turnier-Pass oder mit Plus." upgrade={upgrade} />
        ) : (
          <Toggle
            label="Warteliste"
            hint="Ist das Turnier voll, rücken Nachzügler bei Absagen nach."
            checked={value.waitingList && plan.waitingList}
            disabled={!plan.waitingList || started}
            locked={plan.waitingList ? undefined : "Pass oder Plus"}
            onChange={(v) => set("waitingList", v)}
          />
        )}
        <Toggle
          label="Teams melden ihr Resultat"
          hint="Eine Seite meldet, die andere bestätigt."
          checked={value.confirmResults}
          onChange={(v) => set("confirmResults", v)}
        />
        <div className="form-2">
          <Num id="tf-mm" label="Spieldauer in Minuten" value={value.matchMinutes} min={5} max={240} onChange={(n) => set("matchMinutes", n)} hint="Für den Spielplan. Dauert ein Spiel länger, verschiebt sich der Rest." />
          <Num id="tf-bm" label="Pause zwischen Spielen" value={value.breakMinutes} min={0} max={60} onChange={(n) => set("breakMinutes", n)} />
        </div>
      </section>

      <section className="box form" aria-labelledby="tf-e">
        <h2 id="tf-e" className="box-t">
          Sichtbarkeit
        </h2>
        <Toggle
          label="In der Liste der öffentlichen Turniere"
          hint="Aus: Nur wer den Link hat, findet das Turnier."
          checked={value.isPublic}
          onChange={(v) => set("isPublic", v)}
        />
        {showSlug ? (
          <div className="f">
            <label className="f-l" htmlFor="tf-slug">
              Adresse
            </label>
            <div className="slug">
              <span aria-hidden="true">tournament.planary.ch/</span>
              <input id="tf-slug" className="inp" type="text" spellCheck={false} value={value.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} {...aria("slug")} />
            </div>
            {err("slug")}
          </div>
        ) : null}
      </section>
    </div>
  );
}

/** Points at the field the API complained about. */
export function fieldOf(code: string | undefined): keyof FormValues | null {
  const map: Record<string, keyof FormValues> = {
    invalid_name: "name",
    invalid_game: "game",
    plan_team_limit: "maxTeams",
    too_many_entries: "maxTeams",
    invalid_time: "startsAt",
    invalid_slug: "slug",
    slug_taken: "slug",
  };
  return code ? map[code] ?? null : null;
}

export function PlanNote({ children }: { children: ReactNode }) {
  return (
    <p className="alert info">
      <Ic name="info" />
      <span className="grow">{children}</span>
    </p>
  );
}
