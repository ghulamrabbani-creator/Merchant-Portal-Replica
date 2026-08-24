"use client";

import { ChevronDown } from "lucide-react";

export interface FeeAdjustment {
  label: string;
  type: "Percentage" | "Flat";
  value: string;
}

export default function FeeAdjustments({
  fee,
  onChange,
}: {
  fee: FeeAdjustment;
  onChange: (fee: FeeAdjustment) => void;
}) {
  return (
    <div className="mb-5 rounded-lg border border-border-color bg-page-bg p-4">
      <div className="mb-3 text-sm font-semibold text-text-primary">
        Extra charge details
      </div>
      <input
        value={fee.label}
        onChange={(e) => onChange({ ...fee, label: e.target.value })}
        placeholder="Charge Label (e.g. Convenience Fee)"
        className="mb-3 w-full rounded-lg border border-border-color bg-white px-3 py-2.5 text-sm outline-none"
      />
      <div className="flex gap-3">
        <input
          value={fee.value}
          onChange={(e) => onChange({ ...fee, value: e.target.value })}
          type="number"
          placeholder="Value"
          className="w-full rounded-lg border border-border-color bg-white px-3 py-2.5 text-sm outline-none"
        />
        <div className="relative w-full">
          <select
            value={fee.type}
            onChange={(e) =>
              onChange({ ...fee, type: e.target.value as "Percentage" | "Flat" })
            }
            className="w-full appearance-none rounded-lg border border-border-color bg-white px-3 py-2.5 text-sm outline-none"
          >
            <option value="Percentage">Percentage</option>
            <option value="Flat">Flat</option>
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-text-muted">
        This charge is added on top of the item subtotal and shown to the
        customer as a separate line at checkout.
      </p>
    </div>
  );
}
