"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";
import Modal from "./Modal";

const SCHEMES = [
  "Visa",
  "Mastercard",
  "Amex",
  "JCB",
  "Diners",
  "UnionPay",
  "Mada",
  "RuPay",
  "Tabby",
  "Tamara",
  "WeChat Pay",
  "Jaywan",
  "Alipay+",
];

function Chip({
  label,
  selected,
  onClick,
  dot,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  dot?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
        selected
          ? "border-brand-blue bg-brand-blue/5 text-brand-blue"
          : "border-border-color text-text-primary hover:border-text-muted"
      )}
    >
      {dot && <span className={clsx("h-2 w-2 rounded-full", dot)} />}
      {label}
    </button>
  );
}

export default function FiltersButton() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-brand-blue px-4 py-2.5 text-sm font-medium text-brand-blue"
      >
        <SlidersHorizontal size={16} />
        Filters
      </button>
      <Modal open={open} onClose={() => setOpen(false)} widthClass="max-w-2xl">
        <div className="p-8">
          <h2 className="mb-6 text-xl font-bold text-text-primary">Filters</h2>

          <div className="mb-6">
            <div className="mb-2 text-sm font-semibold text-text-primary">
              Transaction amount
            </div>
            <div className="flex items-center gap-3">
              <input
                placeholder="Min"
                className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
              />
              <span className="text-text-muted">—</span>
              <input
                placeholder="Max"
                className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
              />
            </div>
          </div>

          <div className="mb-6">
            <div className="mb-2 text-sm font-semibold text-text-primary">
              Dynamic currency conversion
            </div>
            <div className="flex gap-2">
              <Chip
                label="Local currency"
                selected={selected.has("local")}
                onClick={() => toggle("local")}
              />
              <Chip
                label="Foreign currency"
                selected={selected.has("foreign")}
                onClick={() => toggle("foreign")}
              />
            </div>
          </div>

          <div className="mb-6">
            <div className="mb-2 text-sm font-semibold text-text-primary">
              Payment method
            </div>
            <div className="flex gap-2">
              <Chip
                label="Online transactions"
                selected={selected.has("online")}
                onClick={() => toggle("online")}
              />
              <Chip
                label="Terminal transactions"
                selected={selected.has("terminal")}
                onClick={() => toggle("terminal")}
              />
            </div>
          </div>

          <div className="mb-6">
            <div className="mb-2 text-sm font-semibold text-text-primary">Type</div>
            <div className="flex flex-wrap gap-2">
              {[
                "Purchase",
                "Refund",
                "Purchase reversal",
                "Refund reversal",
                "Authorized purchase",
              ].map((t) => (
                <Chip
                  key={t}
                  label={t}
                  selected={selected.has(t)}
                  onClick={() => toggle(t)}
                />
              ))}
            </div>
          </div>

          <div className="mb-6">
            <div className="mb-2 text-sm font-semibold text-text-primary">
              Status
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ["Pending", "bg-status-pending"],
                ["Submitted", "bg-status-submitted"],
                ["Declined", "bg-status-declined"],
                ["Approved", "bg-status-approved"],
                ["Completed", "bg-status-completed"],
              ].map(([label, dot]) => (
                <Chip
                  key={label}
                  label={label}
                  dot={dot}
                  selected={selected.has(label)}
                  onClick={() => toggle(label)}
                />
              ))}
            </div>
          </div>

          <div className="mb-8">
            <div className="mb-2 text-sm font-semibold text-text-primary">
              Scheme
            </div>
            <div className="grid grid-cols-6 gap-2">
              {SCHEMES.map((s) => (
                <button
                  key={s}
                  onClick={() => toggle(s)}
                  className={clsx(
                    "flex h-11 items-center justify-center rounded-lg border px-2 text-xs font-semibold",
                    selected.has(s)
                      ? "border-brand-blue text-brand-blue"
                      : "border-border-color text-text-secondary"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-4">
            <button
              onClick={() => setSelected(new Set())}
              className="text-sm font-medium text-text-secondary"
            >
              Clear
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
            >
              Apply
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
