"use client";

// Dev hints ⓘ icon (added 25-Sep-2026, Rabbani). Sits next to a Direct Debit field, column or
// button and, on hover/focus, shows which Backend / Order Model / DDS parameter the element is
// sent to (push) or read from (pull) — see src/lib/dd-field-map.ts for every mapping.
//
// Renders nothing unless the "Dev hints" switch is on (ChangeLogBar, or the floating switch on
// full-screen pages). Off by default, so demos look like the real product.
//
// The tooltip is rendered into document.body through a portal with fixed positioning, because
// most of these icons live inside tables, modals and scroll panes with overflow: hidden/auto that
// would otherwise clip it.

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info, Code2 } from "lucide-react";
import clsx from "clsx";
import { useDDConfig } from "@/lib/dd-config-context";
import { DD_FIELD_HINTS, FieldHintDef, HintKey, HintDirection } from "@/lib/dd-field-map";

const DIRECTION_LABEL: Record<HintDirection, string> = {
  push: "Sent to Backend",
  pull: "Read from Backend",
  config: "Merchant configuration",
};

const DIRECTION_CLASS: Record<HintDirection, string> = {
  push: "bg-emerald-500/20 text-emerald-300",
  pull: "bg-sky-500/20 text-sky-300",
  config: "bg-amber-500/20 text-amber-300",
};

const SYSTEM_CLASS: Record<string, string> = {
  "BE API": "text-emerald-300",
  "Order Model": "text-violet-300",
  DDS: "text-sky-300",
  Config: "text-amber-300",
};

const TOOLTIP_WIDTH = 380;

export default function FieldHint({
  k,
  value,
  className,
}: {
  k: HintKey;
  /** Live value of the parameter right now, e.g. "false" — shown as "Current value". */
  value?: string;
  className?: string;
}) {
  const { devHints } = useDDConfig();
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null);

  if (!devHints) return null;
  const def: FieldHintDef = DD_FIELD_HINTS[k];

  function show() {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left - 12, window.innerWidth - TOOLTIP_WIDTH - 8));
    const above = r.bottom + 260 > window.innerHeight && r.top > 260;
    setPos({ left, top: above ? r.top - 6 : r.bottom + 6, above });
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        onMouseEnter={show}
        onMouseLeave={() => setPos(null)}
        onFocus={show}
        onBlur={() => setPos(null)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        aria-label={`Parameter: ${def.title}`}
        className={clsx(
          "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full align-middle text-fuchsia-600 hover:text-fuchsia-800",
          className
        )}
        data-dev-hint={k}
      >
        <Info size={13} strokeWidth={2.4} />
      </button>
      {pos &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              width: TOOLTIP_WIDTH,
              transform: pos.above ? "translateY(-100%)" : undefined,
              zIndex: 1000,
            }}
            className="pointer-events-none rounded-lg bg-slate-900 p-3 text-left text-[11.5px] font-normal normal-case leading-snug tracking-normal text-slate-200 shadow-xl"
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="font-semibold text-white">{def.title}</span>
              <span className={clsx("rounded px-1.5 py-0.5 text-[10px] font-semibold", DIRECTION_CLASS[def.direction])}>
                {DIRECTION_LABEL[def.direction]}
              </span>
            </div>
            {def.endpoint && (
              <div className="mb-2 flex items-start gap-1.5 font-mono text-[10.5px] text-slate-400">
                <Code2 size={11} className="mt-0.5 shrink-0" />
                <span>{def.endpoint}</span>
              </div>
            )}
            <div className="flex flex-col gap-1">
              {def.lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[78px_1fr] gap-2">
                  <span className={clsx("text-[10px] font-semibold uppercase tracking-wide", SYSTEM_CLASS[l.system])}>
                    {l.system}
                  </span>
                  <span>
                    <span className="font-mono text-white">{l.ref}</span>
                    {l.note && <span className="text-slate-400"> — {l.note}</span>}
                  </span>
                </div>
              ))}
            </div>
            {def.valueMap && (
              <div className="mt-2 font-mono text-[10.5px] text-slate-300">{def.valueMap}</div>
            )}
            {value !== undefined && (
              <div className="mt-1.5 rounded bg-slate-800 px-2 py-1 font-mono text-[10.5px]">
                <span className="text-slate-400">Current value: </span>
                <span className="text-fuchsia-300">{value}</span>
              </div>
            )}
            {def.note && <div className="mt-2 text-slate-400">{def.note}</div>}
          </div>,
          document.body
        )}
    </>
  );
}

/** Floating "Dev hints" switch for full-screen pages that cover the ChangeLogBar (contract
 *  creation, contract submitted, customer pages). */
export function DevHintsFloatingToggle() {
  const { devHints, setDevHints } = useDDConfig();
  return (
    <button
      onClick={() => setDevHints(!devHints)}
      className={clsx(
        "fixed bottom-4 left-4 z-[60] flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold shadow-md",
        devHints ? "border-fuchsia-600 bg-fuchsia-600 text-white" : "border-border-color bg-white text-text-secondary"
      )}
      title="Show which Backend / DDS parameter each field maps to"
      data-testid="dev-hints-floating"
    >
      <Info size={13} strokeWidth={2.4} />
      Dev hints {devHints ? "ON" : "OFF"}
    </button>
  );
}
