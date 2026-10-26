"use client";

// Contract Review & Sign — the customer-facing page (moved here 25-Sep-2026 from
// app/direct-debit/[id]/sign/page.tsx, which now redirects). Rendered by
// app/contracts/review/[id]/page.tsx AFTER the customer passes the OTP verification screen
// (CustomerVerification.tsx) — Backend Stories S3 §4–§7. Review URL per S2 §6.1:
// https://<portal-host>/contracts/review/{mandateId}.

import { useEffect, useState } from "react";
import { Landmark, CreditCard, ShieldCheck, CheckCircle2, Loader2, FileText } from "lucide-react";
import clsx from "clsx";
import { directDebitContracts, STORE_NAME } from "@/lib/mock-data";
import {
  formatMoneyAED,
  maskEmiratesId,
  maskInstrumentRef,
  instrumentRefFor,
  formatInstrumentRef,
  maskMobile,
  nextContractRef,
  activityEvent,
  validateCardNumber,
  validateIban,
  validateName,
} from "@/lib/direct-debit";
import { DDBankAccountType, DDInstrumentType, DDS_BANKS, DirectDebitContract } from "@/lib/types";
import { useDDConfig } from "@/lib/dd-config-context";
import { persistIfCreated } from "@/lib/dd-contract-store";
import FieldHint from "@/components/directdebit/FieldHint";
import { CustomerPageHeader } from "@/components/directdebit/CustomerVerification";

// "instrument" (added Sep 2026, TBFC): inserted before "review" when the merchant left
// instrument details for the customer to supply — see Notes/Projects/Direct Debit.md, "To Be
// Filled By Customer (TBFC) instrument flow." Create DDA is only called once this step commits,
// which is also when a real mandate reference first exists (see PENDING_INSTRUMENT_REF_LABEL).
// 14-Oct-2026 (MP Backlog v2 US-33): signing now ends in one of four outcomes (simulated with the
// dev picker on the "unsigned" step) and a successful signature lands on Pending System Submission
// (Geidea submits the signed contract to DDS; DD Pending Bank Approval follows), not straight on
// Pending Bank Approval.
type SignStep = "instrument" | "review" | "fetching" | "unsigned" | "signing" | "signed" | "sign_failed" | "iban_failed" | "not_completed";
// 15-Oct-2026: outcomes follow DDS's UAE PASS Signature API v1.4 — callback status finished /
// failed (with statusMsg) / canceled / ddsError. IBAN validation runs at DDS before UAE PASS opens.
type SignOutcome = "finished" | "iban_format" | "iban_bank" | "iban_details" | "iban_eid" | "failed_other" | "canceled" | "ddsError";
const IBAN_MSG: Record<string, { statusMsg: string; text: string }> = {
  iban_format: { statusMsg: "iban validation failed : Invalid format", text: "Your bank account details are not in a valid format." },
  iban_bank: { statusMsg: "iban validation failed : DDS could'nt find bank", text: "Your bank is not available for direct debit." },
  iban_details: { statusMsg: "iban validation failed : DDS could'nt find details", text: "Your bank account details could not be found." },
  iban_eid: { statusMsg: "iban validation failed : DDS could'nt match the details when idType = EI", text: "Your Emirates ID does not match this bank account." },
};

export default function ContractReviewSign({ contract }: { contract: DirectDebitContract }) {
  const id = contract.id;
  const found = contract;
  const { config } = useDDConfig();
  const [step, setStep] = useState<SignStep>(
    found?.mandateCreationStage === "awaiting_customer_instrument" ? "instrument" : "review"
  );
  const [outcome, setOutcome] = useState<SignOutcome>("finished");

  // TBFC instrument-capture form state. Corrected 09-Sep-2026 (Rabbani): under TBFC the whole
  // instrument choice — which TYPE, not just its account/card details — belongs to the customer,
  // not the merchant. The merchant makes no instrument decision at all when TBFC is checked (see
  // contract.instrumentType being left unset in that case, in types.ts), so the type picker below
  // mirrors CreateDirectDebitContractModal's own Step 1 pill selector, just on this side of the
  // hand-off. Defaults to Bank Account the same way the merchant-side picker does.
  const [custInstrumentType, setCustInstrumentType] = useState<DDInstrumentType>("Bank Account");
  const [instBankName, setInstBankName] = useState<string>(DDS_BANKS[0]);
  const [instAccountHolderTitle, setInstAccountHolderTitle] = useState(found?.customerName ?? "");
  const [instIban, setInstIban] = useState("");
  const [instAccountType, setInstAccountType] = useState<DDBankAccountType>("Current");
  const [instCardHolderName, setInstCardHolderName] = useState(found?.customerName ?? "");
  const [instIssuingBank, setInstIssuingBank] = useState<string>(DDS_BANKS[0]);
  const [instCardNumber, setInstCardNumber] = useState("");

  // Disable Credit Card Instrument (PGW Config in MA, Sep 2026): derived, not synced via effect —
  // matches the same approach in CreateDirectDebitContractModal. Falls back to Bank Account for
  // every read if switched on mid-session while Credit Card was already selected here.
  const effectiveCustInstrumentType: DDInstrumentType = config.disableCreditCard
    ? "Bank Account"
    : custInstrumentType;

  useEffect(() => {
    if (step === "fetching") {
      const t = setTimeout(() => setStep("unsigned"), 1100);
      return () => clearTimeout(t);
    }
    if (step === "signing") {
      const t = setTimeout(() => {
        const next: SignStep =
          outcome === "finished" ? "signed" : outcome in IBAN_MSG ? "iban_failed" : outcome === "canceled" ? "not_completed" : "sign_failed";
        setStep(next);
        if (next !== "signed") return;
        // After a successful signature: Pending System Submission (14-Oct-2026, US-33/US-14).
        const target = directDebitContracts.find((x) => x.id === id);
        if (target) {
          target.status = "Pending System Submission";
          target.activity = [activityEvent("Customer", "Contract signed via UAE PASS"), ...(target.activity ?? [])];
          persistIfCreated(target);
        }
      }, 1600);
      return () => clearTimeout(t);
    }
  }, [step, id, outcome]);

  const c = found;

  // Commits the customer-supplied instrument and simulates Create DDA being called for the
  // first time — this is the moment DDS actually issues a mandate reference under TBFC (see
  // the confirmed design in Direct Debit.md: "Geidea calls Create DDA in real time, for the
  // first time, now with a complete payload"). Mutates the shared mock-data object directly,
  // matching every other mutation on this page/screen set (Pause/Resume/Retry/Rollover, and the
  // status flip on successful signing just below).
  function handleSubmitInstrument() {
    const target = directDebitContracts.find((x) => x.id === id);
    if (!target) return;
    target.instrumentType = effectiveCustInstrumentType;
    if (effectiveCustInstrumentType === "Bank Account") {
      target.bankName = instBankName;
      target.bankAccountType = instAccountType;
      target.accountHolderTitle = instAccountHolderTitle;
      target.maskedInstrumentRef = instrumentRefFor("Bank Account", instIban);
    } else {
      target.bankName = instIssuingBank;
      target.maskedInstrumentRef = maskInstrumentRef(instCardNumber);
    }
    target.ref = nextContractRef(directDebitContracts);
    target.mandateCreationStage = "submitted_to_dds";
    target.status = "Pending Customer Sign";
    persistIfCreated(target);
    setStep("review");
  }

  // Field rules (14-Oct-2026, US-33): IBAN = AE + 21 digits; card number passes the Luhn check;
  // names up to 7 words.
  const instError =
    effectiveCustInstrumentType === "Bank Account"
      ? (instIban.trim() && validateIban(instIban)) || (instAccountHolderTitle.trim() && validateName(instAccountHolderTitle, "Account title"))
      : (instCardNumber.trim() && validateCardNumber(instCardNumber)) || (instCardHolderName.trim() && validateName(instCardHolderName, "Card holder name"));
  const instrumentValid =
    !instError &&
    (effectiveCustInstrumentType === "Bank Account"
      ? instIban.trim() && instAccountHolderTitle.trim()
      : instCardNumber.trim() && instCardHolderName.trim());

  return (
    <div>
      <div>
        <CustomerPageHeader />

        <h1 className="mb-1.5 flex items-center gap-1.5 text-xl font-bold text-text-primary">
          Direct Debit Contract – Review & Sign <FieldHint k="cust.contractDetails" />
        </h1>
        <p className="mb-5 text-[13px] text-text-secondary">
          <strong className="text-text-primary">{STORE_NAME}</strong> has sent you this mandate to review and
          sign. Read the terms and schedule below, then continue to sign digitally via UAE PASS.
        </p>

        {c.contractDescription && (
          <div className="mb-4 flex items-start gap-2.5 rounded-[10px] bg-[#F3F4F6] px-4 py-3.5">
            <FileText size={15} className="mt-0.5 shrink-0 text-text-muted" />
            <div>
              <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Contract Description
              </div>
              <div className="text-[13px] leading-relaxed text-text-secondary">{c.contractDescription}</div>
            </div>
          </div>
        )}

        {/* Parties */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border-color bg-white p-5">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Requested by
            </div>
            <div className="text-sm font-semibold text-text-primary">{STORE_NAME}</div>
          </div>
          <div className="rounded-xl border border-border-color bg-white p-5">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Customer</div>
            <div className="text-sm font-semibold text-text-primary">{c.customerName}</div>
            <div className="mt-0.5 text-xs text-text-muted">
              {c.customerIdType}: {maskEmiratesId(c.customerIdNumber)}
            </div>
            <div className="mt-0.5 text-xs text-text-muted">Mobile: {maskMobile(c.customerMobile ?? "0501234567")}</div>
          </div>
        </div>

        {/* Contract terms */}
        <div className="mb-4 rounded-xl border border-border-color bg-white p-5">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Contract terms
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
            <Row label="Merchant reference" value={c.merchantRef} />
            <Row label="Contract duration" value={`${c.commencesOn} – ${c.expiresOn}`} />
            <Row label="Collection frequency" value={c.collectionFrequency ?? c.frequency} />
            <Row
              label={c.amountType === "Fixed" ? "Amount per collection" : "Amount range"}
              value={
                c.amountType === "Fixed"
                  ? formatMoneyAED(c.minAmount)
                  : `${formatMoneyAED(c.minAmount)} – ${formatMoneyAED(c.maxAmount)}`
              }
            />
            <Row
              label="Payment instrument"
              value={
                c.maskedInstrumentRef ? (
                  <span className="inline-flex items-center gap-1.5">
                    {c.instrumentType === "Bank Account" ? <Landmark size={13} /> : <CreditCard size={13} />}
                    {c.instrumentType} {formatInstrumentRef(c.maskedInstrumentRef)}
                    {c.bankName ? `, ${c.bankName}` : ""}
                  </span>
                ) : (
                  "To be provided by you, below"
                )
              }
            />
            <Row
              label="Rollover"
              value={c.rolloverEnabled ? `Enabled — up to ${c.rolloversAllowed} consecutive` : "Disabled"}
            />
            {c.reviewLinkExpiresAt && <Row label="Link valid until" value={c.reviewLinkExpiresAt} />}
          </div>
        </div>

        {/* Occurrences */}
        <div className="mb-6 overflow-hidden rounded-xl border border-border-color bg-white">
          <div className="border-b border-border-color px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Collection schedule — {c.occurrences.length} occurrence{c.occurrences.length !== 1 ? "s" : ""}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-color bg-page-bg text-left text-text-secondary">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Due date</th>
                <th className="px-4 py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {c.occurrences.slice(0, 12).map((o) => (
                <tr key={o.seq} className="border-t border-border-color">
                  <td className="px-4 py-2 text-text-muted">{o.seq}</td>
                  <td className="px-4 py-2 text-text-primary">{o.dueDate}</td>
                  <td className="px-4 py-2 font-semibold text-text-primary">{formatMoneyAED(o.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {c.occurrences.length > 12 && (
            <div className="border-t border-border-color px-5 py-2.5 text-[11.5px] text-text-muted">
              Showing the first 12 of {c.occurrences.length} occurrences.
            </div>
          )}
        </div>

        {/* Action / state machine */}
        <div className="rounded-xl border border-border-color bg-white p-6 text-center">
          {step === "instrument" && (
            <div className="text-left">
              <p className="mb-4 text-center text-sm text-text-secondary">
                {STORE_NAME} has left the payment instrument for this contract up to you.{" "}
                {config.disableCreditCard
                  ? "Enter your bank account details below to continue"
                  : "Choose an account type and enter its details below to continue"}{" "}
                — this contract won&apos;t be submitted for approval until you do.
              </p>

              <label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-text-primary">
                Payment instrument <FieldHint k="cust.instrument" />
              </label>
              {!config.disableCreditCard && (
                <div className="mb-4 flex rounded-xl bg-page-bg p-1">
                  <button
                    onClick={() => setCustInstrumentType("Bank Account")}
                    className={clsx(
                      "flex-1 rounded-lg py-2.5 text-center text-sm font-semibold",
                      custInstrumentType === "Bank Account"
                        ? "cursor-pointer bg-brand-orange text-white"
                        : "cursor-pointer text-text-secondary"
                    )}
                  >
                    Bank Account
                  </button>
                  <button
                    onClick={() => setCustInstrumentType("Credit Card")}
                    className={clsx(
                      "flex-1 rounded-lg py-2.5 text-center text-sm font-semibold",
                      custInstrumentType === "Credit Card"
                        ? "cursor-pointer bg-brand-orange text-white"
                        : "cursor-pointer text-text-secondary"
                    )}
                  >
                    Credit Card
                  </button>
                </div>
              )}

              {effectiveCustInstrumentType === "Bank Account" ? (
                <>
                  <div className="mb-3.5">
                    <label className="mb-1.5 block text-[12.5px] font-semibold text-text-primary">Bank name</label>
                    <select
                      value={instBankName}
                      onChange={(e) => setInstBankName(e.target.value)}
                      className="w-full rounded-lg border border-border-color bg-white px-3 py-2.5 text-sm outline-none"
                    >
                      {DDS_BANKS.map((bank) => (
                        <option key={bank} value={bank}>
                          {bank}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3.5">
                    <label className="mb-1.5 block text-[12.5px] font-semibold text-text-primary">
                      Account holder title
                    </label>
                    <input
                      value={instAccountHolderTitle}
                      onChange={(e) => setInstAccountHolderTitle(e.target.value)}
                      className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                    />
                  </div>
                  <div className="mb-3.5">
                    <label className="mb-1.5 block text-[12.5px] font-semibold text-text-primary">Account type</label>
                    <div className="flex rounded-xl bg-page-bg p-1">
                      {(["Current", "Savings"] as DDBankAccountType[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => setInstAccountType(t)}
                          className={clsx(
                            "flex-1 rounded-lg py-2 text-center text-sm font-semibold",
                            instAccountType === t ? "bg-brand-orange text-white" : "text-text-secondary"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mb-5">
                    <label className="mb-1.5 block text-[12.5px] font-semibold text-text-primary">IBAN</label>
                    <input
                      value={instIban}
                      onChange={(e) => setInstIban(e.target.value)}
                      placeholder="AE07 0331 2345 6789 0123 456"
                      className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-3.5">
                    <label className="mb-1.5 block text-[12.5px] font-semibold text-text-primary">
                      Card holder name
                    </label>
                    <input
                      value={instCardHolderName}
                      onChange={(e) => setInstCardHolderName(e.target.value)}
                      className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                    />
                  </div>
                  <div className="mb-3.5">
                    <label className="mb-1.5 block text-[12.5px] font-semibold text-text-primary">
                      Issuing bank
                    </label>
                    <select
                      value={instIssuingBank}
                      onChange={(e) => setInstIssuingBank(e.target.value)}
                      className="w-full rounded-lg border border-border-color bg-white px-3 py-2.5 text-sm outline-none"
                    >
                      {DDS_BANKS.map((bank) => (
                        <option key={bank} value={bank}>
                          {bank}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-5">
                    <label className="mb-1.5 block text-[12.5px] font-semibold text-text-primary">
                      Card number
                    </label>
                    <input
                      value={instCardNumber}
                      onChange={(e) => setInstCardNumber(e.target.value)}
                      placeholder="4242 4242 4242 4242"
                      className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                    />
                  </div>
                </>
              )}
              {instError && <p className="mb-3 text-[12.5px] text-status-declined" data-testid="instrument-error">{instError}</p>}
              <button
                onClick={handleSubmitInstrument}
                disabled={!instrumentValid}
                className="w-full rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue to Review &amp; Sign
              </button>
            </div>
          )}
          {step === "review" && (
            <>
              <p className="mb-4 text-sm text-text-secondary">
                Review the details above, then continue to view the full contract and sign it digitally.
              </p>
              <button
                onClick={() => setStep("fetching")}
                className="rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
              >
                View & Sign Contract
              </button>
            </>
          )}
          {step === "fetching" && (
            <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
              <Loader2 size={16} className="animate-spin" />
              Fetching your unsigned contract…
            </div>
          )}
          {step === "unsigned" && (
            <>
              <p className="mb-1 text-sm font-medium text-text-primary">Your contract is ready to sign.</p>
              <p className="mb-2 text-[12.5px] text-text-muted">
                You&apos;ll be redirected to UAE PASS to complete your digital signature.
              </p>
              <p className="mx-auto mb-4 max-w-md rounded-lg bg-page-bg px-3 py-2 text-[12.5px] text-text-secondary">
                Tip: UAE PASS asks for your <b>signing password</b> (set up in the UAE PASS app for digital
                signatures) — it isn&apos;t your UAE PASS login PIN.
              </p>
              <a
                href={`data:text/plain;charset=utf-8,${encodeURIComponent(`UNSIGNED CONTRACT (prototype)\nMerchant reference: ${c.merchantRef}\nCustomer: ${c.customerName}`)}`}
                download={`${c.merchantRef}-unsigned.txt`}
                className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-blue hover:underline"
              >
                <FileText size={14} /> Download unsigned contract
              </a>
              <div className="mx-auto mb-4 flex max-w-md items-center gap-2 rounded-lg border border-dashed border-fuchsia-400 px-3 py-2 text-[12px] text-fuchsia-700">
                Prototype — simulate UAE PASS result:
                <select value={outcome} onChange={(e) => setOutcome(e.target.value as SignOutcome)} className="rounded border border-fuchsia-300 bg-white px-1 py-0.5" data-testid="sign-outcome">
                  <option value="finished">finished — signed</option>
                  <option value="iban_format">failed — IBAN: invalid format</option>
                  <option value="iban_bank">failed — IBAN: bank not found</option>
                  <option value="iban_details">failed — IBAN: details not found</option>
                  <option value="iban_eid">failed — IBAN: Emirates ID doesn&apos;t match</option>
                  <option value="failed_other">failed — other UAE PASS error</option>
                  <option value="canceled">canceled — customer left</option>
                  <option value="ddsError">ddsError</option>
                </select>
              </div>
              <div className="inline-flex items-center gap-1.5">
                <button
                  onClick={() => setStep("signing")}
                  className="inline-flex items-center gap-2 rounded-lg bg-black px-6 py-2.5 text-sm font-semibold text-white hover:bg-black/85"
                >
                  <ShieldCheck size={16} />
                  Sign with UAE PASS
                </button>
                <FieldHint k="cust.sign" />
              </div>
            </>
          )}
          {step === "signing" && (
            <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
              <Loader2 size={16} className="animate-spin" />
              Redirecting to UAE PASS…
            </div>
          )}
          {step === "signed" && (
            <div className="flex flex-col items-center gap-2 text-status-completed">
              <CheckCircle2 size={28} />
              <div className="text-sm font-semibold text-text-primary">Contract signed successfully</div>
              <div className="text-[12.5px] text-text-muted">
                We&apos;re sending it to your bank, which reviews it within up to 3 working days. You can close this page.
              </div>
              <a
                href={`data:text/plain;charset=utf-8,${encodeURIComponent(`SIGNED CONTRACT (prototype)\nMerchant reference: ${c.merchantRef}\nCustomer: ${c.customerName}`)}`}
                download={`${c.merchantRef}-signed.txt`}
                className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-blue hover:underline"
              >
                <FileText size={14} /> Download signed contract
              </a>
            </div>
          )}
          {(step === "sign_failed" || step === "iban_failed" || step === "not_completed") && (
            <div className="flex flex-col items-center gap-2" data-testid={`sign-${step}`}>
              {step === "iban_failed" && (
                <div className="font-mono text-[10.5px] text-fuchsia-700">statusMsg: {IBAN_MSG[outcome]?.statusMsg}</div>
              )}
              <div className="text-sm font-semibold text-text-primary">
                {step === "sign_failed"
                  ? "Signing didn't go through."
                  : step === "iban_failed"
                    ? "Your bank account couldn't be verified."
                    : "Signing wasn't completed."}
              </div>
              <div className="max-w-md text-[12.5px] text-text-muted">
                {step === "sign_failed"
                  ? outcome === "ddsError"
                    ? "Something went wrong on our side. Nothing has been signed — please try again."
                    : "Something went wrong with UAE PASS. Nothing has been signed — please try again."
                  : step === "iban_failed"
                    ? `${IBAN_MSG[outcome]?.text ?? "Your bank details could not be verified."} Please contact ${STORE_NAME}.`
                    : "You left UAE PASS before signing. Your link is still valid — you can sign whenever you're ready."}
              </div>
              {step !== "iban_failed" && (
                <button onClick={() => setStep("unsigned")} className="mt-1 rounded-lg bg-brand-blue px-5 py-2 text-sm font-semibold text-white hover:bg-brand-blue-hover">
                  Try again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border-color/60 py-1.5 last:border-0">
      <span className="text-text-secondary">{label}</span>
      <span className="text-right font-medium text-text-primary">{value}</span>
    </div>
  );
}
