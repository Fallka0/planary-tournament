"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { SignInGate } from "@/components/common";
import { openCheckout, PlanChip, RunningLimit, useBackFromCheckout, type Upgrade } from "@/components/PlanLimits";
import { useToast } from "@/components/Shell";
import { bodyFrom, EMPTY_FORM, fieldOf, PlanNote, TournamentForm, type FormValues } from "@/components/TournamentForm";
import { ErrorCard, Ic, Loading, PageHead, Sk } from "@/components/ui";
import { type ApiError, useAction, useApi } from "@/lib/api";
import { PORTAL_URL } from "@/lib/auth";
import { checkoutUrl, PASS, PLANS, PRICE, wantedFrom } from "@/lib/plans";
import type { LimitsInfo, MeResponse } from "@/lib/types";

function Create() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const act = useAction();
  const { data: me, error, reload } = useApi<MeResponse>("/me");
  const wanted = wantedFrom(params.get("plan"));
  const [orgPick, setOrgPick] = useState<string | null>(params.get("org"));
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);

  // With Plus in mind, the organisation that has it; otherwise what was asked for, else private.
  const orgs = me?.orgs ?? [];
  const orgId = orgPick ?? (wanted === "plus" ? orgs.find((o) => o.plan === "plus")?.id : undefined) ?? (orgs.length === 1 ? orgs[0].id : "");
  const org = orgs.find((o) => o.id === orgId) ?? null;
  const { data: info, reload: reloadLimits } = useApi<LimitsInfo>(me ? `/limits${org ? `?org=${encodeURIComponent(org.id)}` : ""}` : null);

  // Back from paying in the portal: the plan may have changed; the form stays as it is.
  const back = useCallback(() => {
    reload();
    reloadLimits();
  }, [reload, reloadLimits]);
  useBackFromCheckout(back);

  if (error && !me) return <ErrorCard title="Dein Konto hat nicht geladen" error={error} onRetry={reload} />;
  if (!me) {
    return (
      <Loading label="Wird geladen">
        <Sk h={520} />
      </Loading>
    );
  }

  const planId = info?.plan ?? (org?.plan === "plus" ? "plus" : "gratis");
  const base = PLANS[planId];
  const plan = info ? { ...base, ...info.limits, name: info.planName } : base;
  const name = form.name.trim() || "dieses Turnier";

  /** Checks what the API would refuse anyway, and points at the first field. */
  const valid = () => {
    const next: typeof errors = {};
    if (form.name.trim().length < 3) next.name = "Der Name hat mindestens 3 Zeichen.";
    if (!form.game.trim()) next.game = "Welches Spiel oder welche Sportart?";
    if (form.maxTeams > plan.maxTeams) next.maxTeams = `Bei ${plan.name} bis ${plan.maxTeams}.`;
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) document.getElementById(`tf-${first === "maxTeams" ? "max" : first}`)?.focus();
    return !first;
  };

  const create = (extra: Record<string, unknown>) =>
    act<{ id: string; slug: string; queued?: boolean }>("/tournaments", { ...bodyFrom(form), ...extra, ...(org ? { organisationId: org.id, organisationName: org.name } : {}) });

  const fail = (e: unknown) => {
    const err = e as ApiError;
    if (err.code === "plan_running_limit") {
      setRunning(true);
      reloadLimits();
    } else {
      const f = fieldOf(err.code);
      if (f) setErrors({ [f]: err.message });
      else toast(err.message, "err");
    }
    setBusy(false);
  };

  const submit = async (publish: boolean, whenFree = false) => {
    if (!valid()) return;
    if (publish && !whenFree && info && !info.canRun) {
      setRunning(true);
      requestAnimationFrame(() => document.getElementById("running-limit")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    setBusy(true);
    try {
      const { slug, queued } = await create({ publish, publishWhenFree: whenFree });
      toast(queued ? `Gespeichert. Es geht raus, sobald ${info?.live[0]?.name ?? "das laufende Turnier"} fertig ist.` : publish ? "Erstellt. Die Anmeldung ist offen." : "Als Entwurf gespeichert.");
      router.push(`/${slug}/verwalten`);
    } catch (e) {
      fail(e);
    }
  };

  // The pass belongs to one tournament: it's saved as a draft first, then paid for, and the
  // organiser continues on the draft's settings with everything as it was.
  const upgrade: Upgrade | null =
    planId === "plus" || info?.pass
      ? null
      : {
          tournament: name,
          plus: () => openCheckout(checkoutUrl("plus", { org: org?.id, back: window.location.href })),
          pass: () => {
            if (!valid()) return;
            setBusy(true);
            const draft = create({ publish: false });
            void openCheckout(
              draft.then(
                ({ id, slug }) => checkoutUrl("pass", { org: org?.id, tournament: id, back: `${window.location.origin}/${slug}/verwalten?tab=einstellungen` }),
                () => null,
              ),
            );
            draft.then(
              ({ slug }) => {
                toast("Als Entwurf gespeichert. Der Pass gilt für dieses Turnier.");
                router.push(`/${slug}/verwalten?tab=einstellungen`);
              },
              fail,
            );
          },
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
            {o.name} · {PLANS[o.plan]?.name ?? "Gratis"}
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

  const shown = info?.pass ? PASS : plan;
  return (
    <>
      <PageHead
        title={
          <>
            Turnier erstellen <PlanChip name={info?.pass ? "Turnier-Pass" : plan.name} />
          </>
        }
      />
      <div className="g3">
        <div className="stack">
          <TournamentForm value={form} onChange={setForm} plan={shown} errors={errors} extra={orgField} showSlug upgrade={upgrade} />
          {running && upgrade ? (
            <div id="running-limit">
              <RunningLimit running={info?.live[0]?.name ?? "Ein anderes Turnier"} upgrade={upgrade} busy={busy} onLater={() => submit(true, true)} />
            </div>
          ) : null}
        </div>
        <div className="stack sticky">
          <section className="box" aria-labelledby="pl-h">
            <h2 id="pl-h" className="box-t">
              {plan.name}
            </h2>
            <ul className="tips" style={{ marginTop: 12 }}>
              <li>
                <Ic name="check" small />
                <span>Bis {shown.maxTeams} Teams pro Turnier</span>
              </li>
              <li>
                <Ic name="check" small />
                <span>Check-in vor Ort</span>
              </li>
              <li>
                <Ic name={shown.waitingList ? "check" : "lock"} small />
                <span>Warteliste{shown.waitingList ? "" : ": Pass oder Plus"}</span>
              </li>
              <li>
                <Ic name={shown.branding ? "check" : "lock"} small />
                <span>Eigenes Logo und Farbe auf dem Beamer{shown.branding ? "" : ": Pass oder Plus"}</span>
              </li>
              <li>
                <Ic name={shown.export ? "check" : "lock"} small />
                <span>Export als CSV und PDF{shown.export ? "" : ": Pass oder Plus"}</span>
              </li>
            </ul>
            {wanted && upgrade ? (
              <PlanNote>
                {wanted === "pass"
                  ? `Der Turnier-Pass (${PRICE.pass}, einmal) gilt für ein Turnier. Füll es aus, dann holst du ihn mit "Pass holen" bei der Anzahl Teams.`
                  : `Plus (${PRICE.plus} pro Jahr) gilt für die ganze Organisation und alle Turniere.`}{" "}
                {wanted === "plus" ? (
                  <button className="btn btn-line btn-s" type="button" style={{ marginTop: 8 }} onClick={upgrade.plus}>
                    Zu Plus wechseln
                  </button>
                ) : null}
              </PlanNote>
            ) : null}
          </section>
          <section className="box form" aria-label="Speichern">
            {running ? null : (
              <button className="btn btn-ink" type="button" disabled={busy} onClick={() => submit(true)}>
                <Ic name="check" small />
                Erstellen und Anmeldung öffnen
              </button>
            )}
            <button className="btn btn-line" type="button" disabled={busy} onClick={() => submit(false)}>
              Als Entwurf speichern
            </button>
            <p className="box-s">Einen Entwurf siehst nur du.</p>
          </section>
        </div>
      </div>
    </>
  );
}

export default function NewPage() {
  return (
    <SignInGate why="Turniere erstellst du mit deinem Konto.">
      <Suspense fallback={<Sk h={520} />}>
        <Create />
      </Suspense>
    </SignInGate>
  );
}
