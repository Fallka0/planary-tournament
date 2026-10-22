"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { SignInGate } from "@/components/common";
import { useToast } from "@/components/Shell";
import { bodyFrom, EMPTY_FORM, fieldOf, PlanNote, TournamentForm, type FormValues } from "@/components/TournamentForm";
import { ErrorCard, Ic, Loading, PageHead, Sk } from "@/components/ui";
import { type ApiError, useAction, useApi } from "@/lib/api";
import { PORTAL_URL } from "@/lib/auth";
import { isPlan, PLANS } from "@/lib/plans";
import type { MeResponse, PlanId } from "@/lib/types";

function Create() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const act = useAction();
  const { data: me, error, reload } = useApi<MeResponse>("/me");
  const wanted: PlanId | null = isPlan(params.get("plan")) ? (params.get("plan") as PlanId) : null;
  const [orgPick, setOrgPick] = useState<string | null>(params.get("org"));
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [busy, setBusy] = useState(false);

  if (error && !me) return <ErrorCard title="Dein Konto hat nicht geladen" error={error} onRetry={reload} />;
  if (!me) {
    return (
      <Loading label="Wird geladen">
        <Sk h={520} />
      </Loading>
    );
  }

  // With Verein in mind, the organisation that has it; otherwise what was asked for, else private.
  const orgs = me.orgs;
  const orgId = orgPick ?? (wanted === "verein" ? orgs.find((o) => o.plan === "verein")?.id : undefined) ?? (orgs.length === 1 ? orgs[0].id : "");
  const org = orgs.find((o) => o.id === orgId) ?? null;
  const planId: PlanId = org?.plan === "verein" ? "verein" : "gratis";
  const plan = PLANS[planId];

  const submit = async (publish: boolean) => {
    const next: typeof errors = {};
    if (form.name.trim().length < 3) next.name = "Der Name hat mindestens 3 Zeichen.";
    if (!form.game.trim()) next.game = "Welches Spiel oder welche Sportart?";
    if (form.maxTeams > plan.maxTeams) next.maxTeams = `Im Plan ${plan.name} bis ${plan.maxTeams}.`;
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(`tf-${Object.keys(next)[0] === "maxTeams" ? "max" : Object.keys(next)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const { slug } = await act<{ id: string; slug: string }>("/tournaments", { ...bodyFrom(form), publish, ...(org ? { organisationId: org.id, organisationName: org.name } : {}) });
      toast(publish ? "Erstellt. Die Anmeldung ist offen." : "Als Entwurf gespeichert.");
      router.push(`/${slug}/verwalten`);
    } catch (e) {
      const err = e as ApiError;
      const f = fieldOf(err.code);
      if (f) setErrors({ [f]: err.message });
      else toast(err.message, "err");
      setBusy(false);
    }
  };

  const orgField = (
    <div className="f">
      <label className="f-l" htmlFor="tf-org">
        Im Namen von
      </label>
      <select id="tf-org" className="sel" value={orgId} onChange={(e) => setOrgPick(e.target.value)}>
        <option value="">Nur ich (ohne Organisation)</option>
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} · Plan {PLANS[o.plan].name}
          </option>
        ))}
      </select>
      <span className="f-h">
        Mit einer Organisation leitet ihr das Turnier zu mehreren, und ihr Plan gilt.{" "}
        <a className="ul" href={`${PORTAL_URL}/neu`}>
          Organisation erstellen
        </a>
      </span>
    </div>
  );

  return (
    <div className="g3">
      <TournamentForm value={form} onChange={setForm} plan={plan} errors={errors} extra={orgField} showSlug />
      <div className="stack sticky">
        <section className="box" aria-labelledby="pl-h">
          <h2 id="pl-h" className="box-t">
            Plan {plan.name}
          </h2>
          <ul className="tips" style={{ marginTop: 12 }}>
            <li>
              <Ic name="check" small />
              <span>Bis {plan.maxTeams} Teams pro Turnier</span>
            </li>
            <li>
              <Ic name={plan.checkIn ? "check" : "x"} small />
              <span>Check-in und Warteliste{plan.checkIn ? "" : " ab Plan Event"}</span>
            </li>
            <li>
              <Ic name={plan.branding ? "check" : "x"} small />
              <span>Eigenes Logo und Farbe auf dem Beamer{plan.branding ? "" : " ab Plan Event"}</span>
            </li>
            <li>
              <Ic name={plan.export ? "check" : "x"} small />
              <span>Export als CSV und PDF{plan.export ? "" : " ab Plan Event"}</span>
            </li>
          </ul>
          {wanted === "event" && planId !== "verein" ? (
            <PlanNote>
              Plan Event gilt für ein Turnier. Erstell es zuerst; danach kaufst du den Plan im Portal unter Abrechnung, mit Karte oder TWINT. Dafür braucht es eine Organisation.
            </PlanNote>
          ) : null}
          {wanted === "verein" && planId !== "verein" ? (
            <PlanNote>
              Plan Verein gilt für eine ganze Organisation. Leg sie im{" "}
              <a className="ul" href={`${PORTAL_URL}/neu`}>
                Portal
              </a>{" "}
              an und wechsle dort unter Abrechnung den Plan, mit Karte oder auf Rechnung.
            </PlanNote>
          ) : null}
        </section>
        <section className="box form" aria-label="Speichern">
          <button className="btn btn-ink" type="button" disabled={busy} onClick={() => submit(true)}>
            <Ic name="check" small />
            Erstellen und Anmeldung öffnen
          </button>
          <button className="btn btn-line" type="button" disabled={busy} onClick={() => submit(false)}>
            Als Entwurf speichern
          </button>
          <p className="box-s">Einen Entwurf siehst nur du. Teams und Station legst du danach unter Verwalten fest.</p>
        </section>
      </div>
    </div>
  );
}

export default function NewPage() {
  return (
    <>
      <PageHead title="Turnier erstellen" />
      <SignInGate why="Turniere erstellst du mit deinem Konto.">
        <Suspense fallback={<Sk h={520} />}>
          <Create />
        </Suspense>
      </SignInGate>
    </>
  );
}
