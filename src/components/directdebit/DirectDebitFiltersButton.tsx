"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";
import Modal from "@/components/ui/Modal";

const STATUSES: [string, string][] = [
  ["Active", "bg-status-approved"],
  ["Pending Customer Sign", "bg-status-pending"],
  ["Pending Bank Approval", "bg-status-pending"],
  ["Suspended", "bg-status-declined"],
  ["Rejected", "bg-status-declined"],
  ["Cancelled", "bg-status-declined"],
];

const INSTRUMENTS = ["Bank Account", "Credit Card"];

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

export default function DirectDebitFiltersButton() {
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
      <Modal open={open} onClose={() => setOpen(false)} widthClass="max-w-lg">
        <div className="p-8">
          <h2 className="mb-6 text-xl font-bold text-text-primary">Filters</h2>

          <div className="mb-6">
            <div className="mb-2 text-sm font-semibold text-text-primary">Status</div>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map(([label, dot]) => (
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
              Payment instrument
            </div>
            <div className="flex flex-wrap gap-2">
              {INSTRUMENTS.map((label) => (
                <Chip
                  key={label}
                  label={label}
                  selected={selected.has(label)}
                  onClick={() => toggle(label)}
                />
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
