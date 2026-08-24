"use client";

import { SlidersHorizontal, Calendar } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";
import Modal from "@/components/ui/Modal";

const STATUSES: [string, string][] = [
  ["Created", "bg-status-submitted"],
  ["Paid", "bg-status-completed"],
  ["Sent", "bg-status-approved"],
  ["Incomplete", "bg-status-pending"],
  ["Expired", "bg-status-declined"],
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

export default function PaymentLinkFiltersButton() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Set<string>>(new Set());

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
            <div className="mb-2 text-sm font-semibold text-text-primary">
              Amount
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
              Creation Date
            </div>
            <div className="relative">
              <input
                placeholder="Creation Date"
                readOnly
                className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
              />
              <Calendar
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
            </div>
          </div>

          <div className="mb-6">
            <div className="mb-2 text-sm font-semibold text-text-primary">
              Paid Date
            </div>
            <div className="relative">
              <input
                placeholder="Paid Date"
                readOnly
                className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
              />
              <Calendar
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
            </div>
          </div>

          <div className="mb-8">
            <div className="mb-2 text-sm font-semibold text-text-primary">
              Status
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map(([label, dot]) => (
                <Chip
                  key={label}
                  label={label}
                  dot={dot}
                  selected={status.has(label)}
                  onClick={() =>
                    setStatus((prev) => {
                      const next = new Set(prev);
                      if (next.has(label)) next.delete(label);
                      else next.add(label);
                      return next;
                    })
                  }
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-4">
            <button
              onClick={() => setStatus(new Set())}
              className="text-sm font-medium text-text-secondary"
            >
              Clear
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
            >
              Apply filters
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
