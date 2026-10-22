import type { Metadata } from "next";
import { TournamentPage } from "./TournamentPage";

const API = process.env.NEXT_PUBLIC_TOURNAMENT_API || "https://tournament-api.planary.ch";

/** Title and description for shared links; the page itself loads in the browser (and live). */
export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${API}/t/${encodeURIComponent(slug)}`, { next: { revalidate: 60 } });
    if (!res.ok) return { title: "Turnier" };
    const v = (await res.json()) as { tournament: { name: string; game: string; venue: string; description: string; organisation: { name: string } | null; owner: { name: string } } };
    const t = v.tournament;
    const by = t.organisation?.name ?? t.owner.name;
    return {
      title: t.name,
      description: t.description.slice(0, 160) || `${t.game}${t.venue ? ` in ${t.venue}` : ""}, organisiert von ${by}. Bracket, Spielplan und Resultate live.`,
      openGraph: { title: t.name, description: `${t.game} · ${by}`, type: "website" },
    };
  } catch {
    return { title: "Turnier" };
  }
}

export default async function Page({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  return <TournamentPage slug={slug} />;
}
