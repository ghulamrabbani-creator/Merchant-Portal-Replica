"use client";

// Direct Debit merchant config screen (added Sep 2026, Rabbani) — the "PGW Config in MA" modal
// reachable from the ChangeLogBar. Functional build of the wireframe iterated with Rabbani
// (https://claude.ai/code/artifact/a63f1c84-a3b7-4093-bcc9-3a7f54c70d0f), collapsed per his
// feedback into one flat screen rather than per-instrument sub-tabs. Every field here writes to
// DDConfigContext, which is what the rest of the Direct Debit UI (Sidebar, contract creation,
// the Sign page, the summary screen's Bulk Upload button) reads live — so a change here takes
// effect immediately, no save-and-reload needed except where noted.
//
// OIC is captured here but deliberately inert: there's no other surface in this prototype that
// could visibly react to "which OIC does this contract settle under," so selecting Merchant OIC
// only reveals its own input fields — it doesn't change anything elsewhere yet.

import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useDDConfig } from "@/lib/dd-config-context";
import FieldHint from "@/components/directdebit/FieldHint";
import { HintKey } from "@/lib/dd-field-map";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
      {children}
    </div>
  );
}

function FieldRow({
  name,
  desc,
  hint,
  hintValue,
  children,
}: {
  name: string;
  desc: string;
  hint?: HintKey;
  hintValue?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[220px_1fr] gap-5 border-b border-border-color py-5 last:border-b-0">
      <div>
        <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-text-primary">
          {name}
          {hint && <FieldHint k={hint} value={hintValue} />}
        </div>
        <div className="mt-1 text-[12px] leading-relaxed text-text-muted">{desc}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full border-[1.5px] transition-colors ${
        on ? "border-brand-blue bg-brand-blue" : "border-border-color bg-white"
      }`}
      aria-pressed={on}
    >
      <span
        className={`absolute top-[2px] h-[17px] w-[17px] rounded-full bg-white shadow transition-all ${
          on ? "left-[22px] bg-white" : "left-[2px] bg-text-muted"
        }`}
      />
    </button>
  );
}

function ToggleRow({ on, onClick, label }: { on: boolean; onClick: () => void; label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Toggle on={on} onClick={onClick} />
      <span className={`text-[11px] font-semibold ${on ? "text-brand-blue" : "text-text-muted"}`}>
        {label ?? (on ? "ON" : "OFF")}
      </span>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none focus:border-brand-blue";

/** A numeric setting with its own Save, range-checked the same way the Backend's admin config
 *  endpoint would (S1 §3). Seeds its draft once on mount — the modal is mounted on open (see
 *  ChangeLogBar), so this always starts from the hydrated, persisted value. */
function NumberSetting({
  value,
  min,
  max,
  unit,
  unitAfter,
  defaultLabel,
  onSave,
  testId,
}: {
  value: number;
  min: number;
  max: number;
  unit?: string;
  unitAfter?: string;
  defaultLabel: string;
  onSave: (n: number) => void;
  testId?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function save() {
    const parsed = Number(draft.replace(/,/g, ""));
    if (Number.isNaN(parsed) || parsed < min || parsed > max) {
      setError(`Enter a value between ${min.toLocaleString("en-US")} and ${max.toLocaleString("en-US")}.`);
      return;
    }
    setError("");
    onSave(parsed);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        {unit && <span className="text-sm text-text-muted">{unit}</span>}
        <input value={draft} onChange={(e) => setDraft(e.target.value)} className={inputClass} data-testid={testId} />
        {unitAfter && <span className="shrink-0 text-sm text-text-muted">{unitAfter}</span>}
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <button
          onClick={save}
          className="flex items-center gap-1.5 rounded-lg bg-brand-blue px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-blue-hover"
        >
          {saved && <Check size={13} strokeWidth={3} />}
          {saved ? "Saved" : "Save"}
        </button>
        <span className="text-[11px] text-text-muted">{defaultLabel}</span>
      </div>
      {error && <div className="mt-1.5 text-[11.5px] text-status-expired">{error}</div>}
    </div>
  );
}

export default function PGWConfigModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { config, setConfig, resetMerchantConfig } = useDDConfig();
  // Bumped on Reset so the NumberSetting drafts remount and re-seed from the defaults.
  const [resetKey, setResetKey] = useState(0);

  function handleReset() {
    resetMerchantConfig();
    setResetKey((k) => k + 1);
  }

  return (
    <Modal open={open} onClose={onClose} widthClass="max-w-2xl">
      <div className="p-8">
        <div className="mb-1 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold text-text-primary">PGW Config in MA</h2>
          <button
            onClick={handleReset}
            className="mt-1 flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-text-muted hover:text-brand-blue"
            title="Clear persisted config and restore all fields above to their defaults"
          >
            <RotateCcw size={12} strokeWidth={2.5} />
            Reset to defaults
          </button>
        </div>
        <p className="mb-6 text-[13px] text-text-muted">
          Direct Debit Config — merchant-level configuration, editable per Merchant Account
          (Backend Stories S1 §3–§4). Changes below apply immediately across this portal and persist
          locally in this browser across refreshes (use Reset to defaults above to clear them).
          Turn on Dev hints in the top bar to see the Backend field behind each setting.
        </p>

        <SectionTitle>Visibility</SectionTitle>
        <FieldRow
          name="Enable Direct Debit"
          desc="Shows or hides Direct Debit as a menu item on the menu pane in the merchant portal."
          hint="cfg.enable"
          hintValue={`enable_direct_debit = ${config.featureEnabled}`}
        >
          <ToggleRow
            on={config.featureEnabled}
            onClick={() => setConfig({ featureEnabled: !config.featureEnabled })}
          />
        </FieldRow>

        <div className="mt-6" />
        <SectionTitle>Settlement authentication</SectionTitle>
        <FieldRow
          name="OIC"
          desc="The OIC this merchant's contracts settle under."
          hint="cfg.oic"
          hintValue="oic_id = 569000143 (Geidea)"
        >
          <div className="rounded-lg bg-page-bg px-3.5 py-3 text-[12px] text-text-muted" data-testid="oic-readonly">
            <b className="text-text-primary">Geidea OIC (569000143)</b> — the only option in the MVP. DDS API calls
            authenticate with Geidea&apos;s own credentials, maintained in DD BE Config. Merchant OIC is Phase 2
            (removed from this screen 14-Oct-2026).
          </div>
        </FieldRow>

        <div className="mt-6" />
        <SectionTitle>Instrument</SectionTitle>
        <FieldRow
          name="Disable Credit Card Instrument"
          desc="Off by default — Credit Card is selectable. Switching this on removes it from both contract creation and the TBFC flow."
          hint="cfg.disableCC"
          hintValue={`disable_credit_card_instrument = ${config.disableCreditCard}`}
        >
          <ToggleRow
            on={config.disableCreditCard}
            onClick={() => setConfig({ disableCreditCard: !config.disableCreditCard })}
          />
          {config.disableCreditCard && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-status-declined/40 bg-status-declined/10 px-3.5 py-3 text-[12px] text-text-secondary">
              <span className="mt-0.5 font-semibold text-status-declined">!</span>
              <span>
                Credit Card removed from instrument selection everywhere — the contract creation
                picker and the customer&apos;s TBFC step both drop to Bank Account only.
              </span>
            </div>
          )}
        </FieldRow>

        <div className="mt-6" />
        <SectionTitle>Customer journey</SectionTitle>
        <FieldRow
          name="Contract review expiry"
          desc="How long the customer's review & signing link stays valid after the contract is created."
          hint="cfg.reviewExpiry"
          hintValue={`contract_review_expiry_days = ${config.contractReviewExpiryDays}`}
        >
          <NumberSetting
            key={`exp-${resetKey}`}
            value={config.contractReviewExpiryDays}
            min={1}
            max={30}
            unitAfter="days"
            defaultLabel="Default 7 · 1–30"
            onSave={(n) => setConfig({ contractReviewExpiryDays: n })}
            testId="cfg-review-expiry"
          />
        </FieldRow>

        <div className="mt-6" />
        <SectionTitle>Contract creation</SectionTitle>
        <FieldRow
          name="Minimum first-collection lead time"
          desc="The first collection must be at least this many working days after contract creation — leaves time for bank approval (up to 3 working days) and the 20:00 file cut-off."
          hint="cfg.leadTime"
          hintValue={`min_first_collection_lead_working_days = ${config.minFirstCollectionLeadWorkingDays}`}
        >
          <NumberSetting
            key={`lead-${resetKey}`}
            value={config.minFirstCollectionLeadWorkingDays}
            min={0}
            max={30}
            unitAfter="working days"
            defaultLabel="Default 4 · 0–30"
            onSave={(n) => setConfig({ minFirstCollectionLeadWorkingDays: n })}
            testId="cfg-lead-time"
          />
        </FieldRow>
        <FieldRow
          name="Enable Bulk Contract Upload"
          desc={'Off by default. When on, adds a "Bulk Upload" button next to "+ Add Contract" on the Direct Debit summary screen.'}
          hint="cfg.bulk"
          hintValue={`enable_bulk_contract_upload = ${config.enableBulkUpload}`}
        >
          <ToggleRow
            on={config.enableBulkUpload}
            onClick={() => setConfig({ enableBulkUpload: !config.enableBulkUpload })}
          />
        </FieldRow>

        <div className="mt-6" />
        <SectionTitle>Limits</SectionTitle>
        <FieldRow
          name="Maximum Contract Amount"
          desc="Ceiling on a single contract's max amount for this merchant, set by Risk. Enforced at contract creation."
          hint="cfg.maxAmount"
          hintValue={`max_contract_amount = ${config.maxContractAmount}`}
        >
          <NumberSetting
            key={`max-${resetKey}`}
            value={config.maxContractAmount}
            min={1}
            max={100_000_000}
            unit="AED"
            defaultLabel="Default 100,000,000 · DDS scheme cap"
            onSave={(n) => setConfig({ maxContractAmount: n })}
            testId="cfg-max-amount"
          />
        </FieldRow>

        <div className="mt-6" />
        <SectionTitle>Who can do what</SectionTitle>
        <p className="mb-2 rounded-lg bg-page-bg px-3.5 py-3 text-[12px] text-text-muted">
          The per-merchant action switches were removed on 14-Oct-2026 (MP Backlog v2, US-02). Who may create,
          resend, discard, pause, amend, retry or bulk-upload is now a <b>per-user permission</b> in the Portal&apos;s
          role framework. In this prototype, use the <b>Role (prototype)</b> switcher in the top bar to try each role.
        </p>

        <div className="mt-8 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-border-color px-6 py-2.5 text-sm font-semibold text-text-primary hover:bg-page-bg"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
