"use client";

// Direct Debit backend config (added Sep 2026, Rabbani) — the "DD BE Config" modal reachable
// from the ChangeLogBar. Reference-only in the real product (maintained at DD BE, not the
// merchant portal) but surfaced here so the full picture — merchant config + backend config —
// lives in one build. Shown with sample values, editable and saved into DDConfigContext like
// everything else in this prototype (in-memory only, resets on reload).
//
// No Private Key field: checked DDS's REST_API_DOC v2.0 in full (Create DDA response, Get
// Status of a DDA, Bulk Payment upload/status, Payment Representment, Bounce Memo, Day-End
// Reconciliation) — none of DDS's API responses return a card number back to Geidea, so there's
// currently no inbound-card-number flow that would need a Geidea-side private key to decrypt.
// The only card-number field anywhere in that doc is the outbound Create DDA request's
// customerCreditCardNumber, sent as cleartext with no encryption mechanism documented yet.
// Revisit if DDS's own forthcoming PAN-encryption change introduces a response that echoes it
// back.

import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useDDConfig, DEFAULT_BE_CONFIG } from "@/lib/dd-config-context";

const inputClass =
  "w-full rounded-lg border border-border-color px-3 py-2.5 text-sm font-mono outline-none focus:border-brand-blue";

export default function DDBEConfigModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { beConfig, setBeConfig, resetBeConfig } = useDDConfig();

  const [draft, setDraft] = useState(beConfig);
  const [saved, setSaved] = useState(false);

  function save() {
    setBeConfig(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function handleReset() {
    resetBeConfig();
    setDraft(DEFAULT_BE_CONFIG);
    setSaved(false);
  }

  return (
    <Modal open={open} onClose={onClose} widthClass="max-w-2xl">
      <div className="p-8">
        <div className="mb-1 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold text-text-primary">DD BE Config</h2>
          <button
            onClick={handleReset}
            className="mt-1 flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-text-muted hover:text-brand-blue"
            title="Clear persisted config and restore the fields below to their sample defaults"
          >
            <RotateCcw size={12} strokeWidth={2.5} />
            Reset to defaults
          </button>
        </div>
        <p className="mb-6 text-[13px] text-text-muted">
          Backend configuration maintained at DD BE — not part of the merchant-portal screen.
          Shown here with sample values so the full picture is in one place. Saved values persist
          locally in this browser across refreshes (use Reset to defaults above to clear them).
        </p>

        <div className="mb-6 rounded-lg border border-border-color bg-page-bg px-4 py-3.5">
          <div className="mb-1 text-[13.5px] font-semibold text-text-primary">Username &amp; Password</div>
          <div className="mb-3 text-[12px] leading-relaxed text-text-muted">
            Used for API authentication between Geidea and DDS.{" "}
            <span className="font-semibold text-text-secondary">
              These credentials are tied to OIC
            </span>{" "}
            — this pair is used when PGW Config in MA has &quot;Geidea OIC&quot; selected. A
            merchant on &quot;Merchant OIC&quot; authenticates with its own credentials instead
            (captured on that screen, not here).
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Username
              </label>
              <input
                value={draft.username}
                onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Password
              </label>
              <input
                type="password"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="mb-2 rounded-lg border border-border-color bg-page-bg px-4 py-3.5">
          <div className="mb-1 text-[13.5px] font-semibold text-text-primary">Card Encryption Public Key</div>
          <div className="mb-3 text-[12px] leading-relaxed text-text-muted">
            Used to encrypt the card number sent in the DDS contract-creation API.{" "}
            <span className="font-semibold text-text-secondary">
              Generic for contract creation
            </span>{" "}
            — one key, applied to every Credit Card contract regardless of which OIC it settles
            under (unlike the credentials above, this isn&apos;t OIC-specific).
          </div>
          <textarea
            value={draft.cardEncryptionPublicKey}
            onChange={(e) => setDraft({ ...draft, cardEncryptionPublicKey: e.target.value })}
            rows={4}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div className="mb-6 rounded-lg border border-dashed border-border-color px-4 py-3 text-[12px] text-text-muted">
          No Private Key field here — checked DDS&apos;s REST API documentation and found no
          endpoint that returns a card number back to Geidea, so there&apos;s currently no
          inbound flow that would need one to decrypt. Worth adding if DDS&apos;s own
          forthcoming encryption change introduces one.
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={save}
            className="flex items-center gap-1.5 rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
          >
            {saved && <Check size={14} strokeWidth={3} />}
            {saved ? "Saved" : "Save"}
          </button>
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
