import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Empty } from "@/components/ui";

export default function NotFound() {
  return (
    <Shell>
      <Empty icon="search" title="Seite nicht gefunden" action={<Link className="btn btn-line btn-s" href="/">Alle Turniere</Link>}>
        Diese Adresse gibt es in Tournament nicht.
      </Empty>
    </Shell>
  );
}
