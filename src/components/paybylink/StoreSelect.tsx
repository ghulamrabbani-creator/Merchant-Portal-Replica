"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { dummyStores } from "@/lib/mock-data";

export default function StoreSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (storeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = dummyStores.find((s) => s.id === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-border-color px-3 py-2.5 text-left text-sm"
      >
        <span className={selected ? "text-text-primary" : "text-text-muted"}>
          {selected ? selected.label : "Select"}
        </span>
        <ChevronDown size={16} className="text-text-muted" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-border-color bg-white p-1 shadow-lg">
          {dummyStores.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                onChange(s.id);
                setOpen(false);
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-text-primary hover:bg-page-bg"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
