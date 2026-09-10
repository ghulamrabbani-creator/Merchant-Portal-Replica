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
import { useDDConfig, DEFAULT_MERCHANT_CONFIG } from "@/lib/dd-config-context";

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
  children,
}: {
  name: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[220px_1fr] gap-5 border-b border-border-color py-5 last:border-b-0">
      <div>
        <div className="text-[13.5px] font-semibold text-text-primary">{name}</div>
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

function RadioOpt({
  checked,
  onClick,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5">
      <span
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
          checked ? "border-brand-blue" : "border-border-color"
        }`}
      >
        {checked && <span className="h-[9px] w-[9px] rounded-full bg-brand-blue" />}
      </span>
      <span className={`text-[13.5px] ${checked ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
        {label}
      </span>
    </button>
  );
}

const inputClass =
  "w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none focus:border-brand-blue";

export default function PGWConfigModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { config, setConfig, setMerchantOIC, resetMerchantConfig } = useDDConfig();

  const [amountDraft, setAmountDraft] = useState(String(config.maxContractAmount));
  const [amountSaved, setAmountSaved] = useState(false);

  function saveAmount() {
    const parsed = Number(amountDraft.replace(/[^0-9]/g, ""));
    if (!Number.isNaN(parsed) && parsed > 0) {
      setConfig({ maxContractAmount: parsed });
      setAmountSaved(true);
      setTimeout(() => setAmountSaved(false), 1500);
    }
  }

  function handleReset() {
    resetMerchantConfig();
    setAmountDraft(String(DEFAULT_MERCHANT_CONFIG.maxContractAmount));
    setAmountSaved(false);
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
          Direct Debit Config — merchant-level configuration, editable per Merchant Account. Changes
          below apply immediately across this portal and persist locally in this browser across
          refreshes (use Reset to defaults above to clear them).
        </p>

        <SectionTitle>Visibility</SectionTitle>
        <FieldRow
          name="Enable Direct Debit"
          desc="Shows or hides Direct Debit as a menu item on the menu pane in the merchant portal."
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
          desc="Which OIC — and whose DDS API credentials — this merchant's contracts settle and authenticate under."
        >
          <div className="flex flex-col gap-2.5">
            <RadioOpt
              checked={config.oicMode === "geidea"}
              onClick={() => setConfig({ oicMode: "geidea" })}
              label="Geidea OIC"
            />
            <RadioOpt
              checked={config.oicMode === "merchant"}
              onClick={() => setConfig({ oicMode: "merchant" })}
              label="Merchant OIC"
            />
          </div>

          {config.oicMode === "geidea" ? (
            <div className="mt-3 rounded-lg bg-page-bg px-3.5 py-3 text-[12px] text-text-muted">
              Default. DDS API calls authenticate with Geidea&apos;s own OIC and credentials —
              maintained in DD BE Config, not entered here.
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-3 rounded-lg border border-dashed border-border-color bg-page-bg px-3.5 py-3.5">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  OIC
                </label>
                <input
                  value={config.merchantOIC.oic}
                  onChange={(e) => setMerchantOIC({ oic: e.target.value })}
                  placeholder="e.g. 5712 03392"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  Username
                </label>
                <input
                  value={config.merchantOIC.username}
                  onChange={(e) => setMerchantOIC({ username: e.target.value })}
                  placeholder="merchant.dds.user"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  Password
                </label>
                <input
                  type="password"
                  value={config.merchantOIC.password}
                  onChange={(e) => setMerchantOIC({ password: e.target.value })}
                  placeholder="••••••••••"
                  className={inputClass}
                />
              </div>
              <div className="text-[11px] text-text-muted">
                Used as the authentication credentials in DDS API calls for this merchant&apos;s
                contracts.
              </div>
            </div>
          )}
        </FieldRow>

        <div className="mt-6" />
        <SectionTitle>Instrument</SectionTitle>
        <FieldRow
          name="Disable Credit Card Instrument"
          desc="Off by default — Credit Card is selectable. Switching this on removes it from both contract creation and the TBFC flow."
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
        <SectionTitle>Contract creation</SectionTitle>
        <FieldRow
          name="Enable Bulk Contract Upload"
          desc={'Off by default. When on, adds a "Bulk Upload" button next to "+ Add Contract" on the Direct Debit summary screen.'}
        >
          <ToggleRow
            on={config.enableBulkUpload}
            onClick={() => setConfig({ enableBulkUpload: !config.enableBulkUpload })}
          />
        </FieldRow>

        <div className="mt-6" />
        <SectionTitle>Limits</SectionTitle>
        <FieldRow name="Maximum Contract Amount" desc="Ceiling on a single contract's max_amount for this merchant.">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-muted">AED</span>
            <input
              value={amountDraft}
              onChange={(e) => setAmountDraft(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="mt-2.5 flex items-center gap-3">
            <button
              onClick={saveAmount}
              className="flex items-center gap-1.5 rounded-lg bg-brand-blue px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-blue-hover"
            >
              {amountSaved && <Check size={13} strokeWidth={3} />}
              {amountSaved ? "Saved" : "Save"}
            </button>
            <span className="text-[11px] text-text-muted">Default 100,000,000 — editable per merchant</span>
          </div>
        </FieldRow>

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
