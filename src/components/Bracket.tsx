import type { BracketRound, BracketSide } from "@/lib/bracket-view";

function pairs<T>(list: T[]) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += 2) out.push(list.slice(i, i + 2));
  return out;
}

function Row({ side, seeds }: { side: BracketSide; seeds: boolean }) {
  return (
    <span className={`bm-r ${side.cls}`}>
      {seeds && <span className="sd">{side.seed}</span>}
      <span className="nm">{side.name}</span>
      <span className="sc">
        {side.sc}
        {side.cls === "win" ? <span className="sr"> Sieg</span> : null}
      </span>
    </span>
  );
}

/**
 * The bracket as on planary.ch: a column per round, match boxes with a header and two rows,
 * 1 px connectors. Always ink. With `onPick` every match is a toggle button.
 */
export function Bracket({ rounds, seeds = true, selected, onPick }: { rounds: BracketRound[]; seeds?: boolean; selected?: string | null; onPick?: (id: string) => void }) {
  return (
    <div className="bk">
      {rounds.map((r) => (
        <div className="bk-r" key={r.name}>
          <div className="bk-rh">
            <b>{r.name}</b>
            <span>{r.sub}</span>
          </div>
          <div className="bk-b">
            {pairs(r.ms).map((p) => (
              <div className="bk-p" key={p[0].id}>
                {p.map((m) => {
                  const head = (
                    <span className="bm-h">
                      <span>{m.code}</span>
                      {m.live ? <span className="lv">{m.liveLabel}</span> : <span>{m.when}</span>}
                    </span>
                  );
                  const cls = `bm${m.live ? " is-live" : ""}`;
                  return (
                    <div className="bk-s" key={m.id}>
                      {onPick ? (
                        <button className={`${cls}${selected === m.id ? " sel" : ""}`} type="button" aria-pressed={selected === m.id} onClick={() => onPick(m.id)}>
                          {head}
                          <Row side={m.a} seeds={seeds} />
                          <Row side={m.b} seeds={seeds} />
                        </button>
                      ) : (
                        <div className={cls}>
                          {head}
                          <Row side={m.a} seeds={seeds} />
                          <Row side={m.b} seeds={seeds} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
