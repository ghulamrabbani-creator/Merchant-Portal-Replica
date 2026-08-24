"use client";

import { Calendar } from "lucide-react";
import { useState } from "react";

const PRESETS = ["Today", "Yesterday", "Last 7 days", "Last 30 days", "Custom"];

export default function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-[230px] items-center justify-between gap-2 rounded-lg border border-border-color bg-white px-3 py-2.5 text-sm text-text-primary"
      >
        {value}
        <Calendar size={16} className="text-text-muted" />
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-56 rounded-xl border border-border-color bg-white p-2 shadow-lg">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => {
                onChange(p === "Today" ? "23 Aug 2026" : p);
                setOpen(false);
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-text-primary hover:bg-page-bg"
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
