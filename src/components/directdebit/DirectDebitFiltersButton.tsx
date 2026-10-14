"use client";

// Contract list filters (reworked 14-Oct-2026, MP Backlog v2 US-05): the status options are the
// ONE status list (DD-tagged DDS statuses + Geidea-only statuses — "Completed" and "Suspended"
// removed), frequency covers every DDS frequency, and the filter now actually applies to the list
// and the KPI cards (and would apply to the export).

import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";
import Modal from "@/components/ui/Modal";
import { DD_STATUS_FILTER } from "@/lib/direct-debit";
import { DD_FREQUENCIES, DDContractStatus, DDFrequency, DDInstrumentType } from "@/lib/types";

export interface DDListFilters {
  statuses: DDContractStatus[];
  frequencies: DDFrequency[];
  instruments: DDInstrumentType[];
}

export const EMPTY_FILTERS: DDListFilters = { statuses: [], frequencies: [], instruments: [] };

const INSTRUMENTS: DDInstrumentType[] = ["Bank Account", "Credit Card"];

function dotFor(label: string) {
  if (label === "DD Active") return "bg-status-approved";
  if (label.startsWith("DD Pending") || label === "Awaiting Customer Details") return "bg-status-pending";
  if (label === "Discarded") return "bg-status-submitted";
  return "bg-status-declined";
}

function Chip({ label, selected, onClick, dot }: { label: string; selected: boolean; onClick: () => void; dot?: string }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
        selected ? "border-brand-blue bg-brand-blue/5 text-brand-blue" : "border-border-color text-text-primary hover:border-text-muted"
      )}
    >
      {dot && <span className={clsx("h-2 w-2 rounded-full", dot)} />}
      {label}
    </button>
  );
}

function toggleIn<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export default function DirectDebitFiltersButton({ value, onApply }: { value: DDListFilters; onApply: (f: DDListFilters) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DDListFilters>(value);
  const count = value.statuses.length + value.frequencies.length + value.instruments.length;

  return (
    <>
      <button
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
        className="flex items-center gap-2 rounded-lg border border-brand-blue px-4 py-2.5 text-sm font-medium text-brand-blue"
        data-testid="filters-open"
      >
        <SlidersHorizontal size={16} />
        Filters{count > 0 ? ` (${count})` : ""}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} widthClass="max-w-2xl">
        <div className="p-8">
          <h2 className="mb-6 text-xl font-bold text-text-primary">Filters</h2>

          <div className="mb-6">
            <div className="mb-2 text-sm font-semibold text-text-primary">Contract status</div>
            <div className="flex flex-wrap gap-2">
              {DD_STATUS_FILTER.map(({ status, label }) => (
                <Chip
                  key={status}
                  label={label}
                  dot={dotFor(label)}
                  selected={draft.statuses.includes(status)}
                  onClick={() => setDraft((d) => ({ ...d, statuses: toggleIn(d.statuses, status) }))}
                />
              ))}
            </div>
          </div>

          <div className="mb-6">
            <div className="mb-2 text-sm font-semibold text-text-primary">Frequency</div>
            <div className="flex flex-wrap gap-2">
              {DD_FREQUENCIES.map((f) => (
                <Chip key={f} label={f} selected={draft.frequencies.includes(f)} onClick={() => setDraft((d) => ({ ...d, frequencies: toggleIn(d.frequencies, f) }))} />
              ))}
            </div>
          </div>

          <div className="mb-8">
            <div className="mb-2 text-sm font-semibold text-text-primary">Payment instrument</div>
            <div className="flex flex-wrap gap-2">
              {INSTRUMENTS.map((i) => (
                <Chip key={i} label={i} selected={draft.instruments.includes(i)} onClick={() => setDraft((d) => ({ ...d, instruments: toggleIn(d.instruments, i) }))} />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-4">
            <button onClick={() => setDraft(EMPTY_FILTERS)} className="text-sm font-medium text-text-secondary">
              Clear
            </button>
            <button
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
              className="rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
              data-testid="filters-apply"
            >
              Apply
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
