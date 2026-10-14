"use client";

import { Search, ChevronDown } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

export default function SearchBar({
  scopes,
  placeholder = "Search",
  onChange,
}: {
  scopes: string[];
  placeholder?: string;
  /** Optional (added 14-Oct-2026 for Direct Debit search): called with the scope and text. */
  onChange?: (scope: string, text: string) => void;
}) {
  const [scope, setScope] = useState(scopes[0]);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-stretch">
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex h-full items-center gap-1 rounded-l-lg border border-r-0 border-border-color bg-white px-3 text-sm font-medium text-text-primary"
        >
          {scope.length > 10 ? scope.slice(0, 8) + "…" : scope}
          <ChevronDown size={14} className="text-text-muted" />
        </button>
        {open && (
          <div className="absolute z-20 mt-1 w-48 rounded-xl border border-border-color bg-white p-1 shadow-lg">
            {scopes.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setScope(s);
                  setOpen(false);
                  onChange?.(s, text);
                }}
                className={clsx(
                  "block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-page-bg",
                  s === scope
                    ? "bg-brand-orange-light text-brand-orange"
                    : "text-text-primary"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="relative">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onChange?.(scope, e.target.value);
          }}
          placeholder={placeholder}
          className="h-full w-[180px] rounded-r-lg border border-border-color px-3 py-2.5 text-sm outline-none placeholder:text-text-muted"
        />
        <Search
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
      </div>
    </div>
  );
}
