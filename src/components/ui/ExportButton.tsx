"use client";

import { Upload, ChevronDown } from "lucide-react";
import { useState } from "react";

export default function ExportButton() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-brand-blue px-4 py-2.5 text-sm font-medium text-brand-blue"
      >
        <Upload size={16} />
        Export
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-32 rounded-xl border border-border-color bg-white p-1 shadow-lg">
          {["CSV", "PDF"].map((f) => (
            <button
              key={f}
              onClick={() => setOpen(false)}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-text-primary hover:bg-page-bg"
            >
              {f}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
