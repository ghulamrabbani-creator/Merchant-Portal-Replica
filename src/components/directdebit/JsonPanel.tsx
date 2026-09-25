"use client";

// Read-only JSON viewer for the Contract submitted page (added 25-Sep-2026). Top-level keys can
// be linked across two panels: hovering a Backend field highlights the DDS field it becomes (and
// the other way round), per the S2 §4c mapping passed in by the page.

import clsx from "clsx";

function renderValue(v: unknown): string {
  return JSON.stringify(v, null, 2);
}

export default function JsonPanel({
  data,
  activeKeys,
  onHoverKey,
  testId,
}: {
  data: Record<string, unknown>;
  /** Keys to highlight in this panel right now. */
  activeKeys?: string[];
  onHoverKey?: (key: string | null) => void;
  testId?: string;
}) {
  const entries = Object.entries(data);
  return (
    <pre
      className="overflow-x-auto rounded-lg bg-slate-900 p-4 font-mono text-[11.5px] leading-[1.55] text-slate-200"
      data-testid={testId}
    >
      <span className="text-slate-400">{"{"}</span>
      {entries.map(([k, v], i) => {
        const val = renderValue(v).split("\n").join("\n  ");
        const active = activeKeys?.includes(k);
        return (
          <div
            key={k}
            onMouseEnter={() => onHoverKey?.(k)}
            onMouseLeave={() => onHoverKey?.(null)}
            className={clsx("rounded px-1 -mx-1", onHoverKey && "cursor-default", active && "bg-fuchsia-500/25")}
          >
            {"  "}
            <span className="text-sky-300">&quot;{k}&quot;</span>
            <span className="text-slate-400">: </span>
            <span className={typeof v === "string" ? "text-emerald-300" : v === null ? "text-slate-500" : "text-amber-200"}>
              {val}
            </span>
            {i < entries.length - 1 && <span className="text-slate-400">,</span>}
          </div>
        );
      })}
      <span className="text-slate-400">{"}"}</span>
    </pre>
  );
}
