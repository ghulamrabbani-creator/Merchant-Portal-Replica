"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { LAST_UPDATED, CHANGELOG } from "@/lib/changelog";

// Dev-reference banner (added Sep 2026, Rabbani) — spans the full width above the portal's own
// chrome (sidebar + Topbar) so it reads as meta-information about this build, not part of the
// merchant-facing product it replicates. Black background / red text is deliberate: it should
// stand out from the portal's own visual language, not blend into it.
export default function ChangeLogBar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex h-9 w-full shrink-0 items-center justify-center gap-2.5 bg-black px-4 text-[12.5px] font-medium text-red-400">
        <span>Last update date: {LAST_UPDATED}</span>
        <span className="text-red-400/40">|</span>
        <button
          onClick={() => setOpen(true)}
          className="underline underline-offset-2 hover:text-red-300"
        >
          Change Log
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} widthClass="max-w-xl">
        <div className="p-8">
          <h2 className="mb-1 text-xl font-bold text-text-primary">Change Log</h2>
          <p className="mb-6 text-[13px] text-text-muted">
            Material changes made to this reference build — most recent first. Keep this in mind
            when picking up development against it.
          </p>
          <div className="flex flex-col gap-4">
            {CHANGELOG.map((entry, i) => (
              <div key={i} className="border-l-2 border-red-300 pl-4">
                <div className="text-[12.5px] font-semibold text-text-primary">{entry.date}</div>
                <div className="mt-0.5 text-[13px] leading-relaxed text-text-secondary">
                  {entry.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}
