"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { resetTestData, testDataSummary } from "@/lib/dd-contract-store";

// Reset test data (19-Nov-2026). Mounted only while open (same pattern as the config modals), so
// the summary is read from localStorage at click time.
export default function ResetTestDataModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [summary] = useState(testDataSummary);
  const [includeSettings, setIncludeSettings] = useState(false);

  return (
    <Modal open={open} onClose={onClose} widthClass="max-w-lg">
      <div className="p-8" data-testid="reset-test-data-modal">
        <h2 className="mb-1 text-xl font-bold text-text-primary">Reset Direct Debit test data?</h2>
        <p className="mb-5 text-[13px] leading-relaxed text-text-muted">
          Puts the prototype back to its starting test set in this browser. Other people using the
          link keep their own data.
        </p>

        <ul className="mb-5 flex flex-col gap-2 text-[13px] text-text-secondary">
          <li>
            <span className="font-semibold text-text-primary">Contracts you created:</span>{" "}
            {summary.created} — removed
          </li>
          <li>
            <span className="font-semibold text-text-primary">Cancellation requests:</span>{" "}
            {summary.cancellations} contract{summary.cancellations === 1 ? "" : "s"} — cleared
          </li>
          <li>
            <span className="font-semibold text-text-primary">Demo contracts:</span> back to their
            starting state (pause, retry, amend, discard and other actions undone), dated from today
          </li>
        </ul>

        <label className="mb-6 flex cursor-pointer items-start gap-2.5 rounded-md border border-border-color p-3 text-[13px] text-text-secondary">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={includeSettings}
            onChange={(e) => setIncludeSettings(e.target.checked)}
            data-testid="reset-include-settings"
          />
          <span>
            Also reset settings to defaults — PGW Config in MA, DD BE Config, prototype role and Dev
            hints{summary.settings > 0 ? ` (${summary.settings} saved)` : ""}
          </span>
        </label>

        <p className="mb-6 text-[12.5px] text-text-muted">
          Close any other prototype tabs (customer review or cancellation pages) first — they still
          hold the old data until reloaded.
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md border border-border-color px-4 py-2 text-[13px] font-medium text-text-secondary hover:bg-page-bg"
          >
            Cancel
          </button>
          <button
            onClick={() => resetTestData(includeSettings)}
            className="rounded-md bg-red-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-red-700"
            data-testid="reset-test-data-confirm"
          >
            Reset test data
          </button>
        </div>
      </div>
    </Modal>
  );
}
