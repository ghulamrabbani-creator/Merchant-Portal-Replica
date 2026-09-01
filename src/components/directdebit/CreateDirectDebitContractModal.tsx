"use client";

import { useMemo, useState } from "react";
import { X, ChevronDown, Check, AlertCircle, Pencil } from "lucide-react";
import clsx from "clsx";
import {
  DD_FREQUENCIES,
  buildOccurrenceSchedule,
  collectionFrequencyOptions,
  formatDateNice,
  formatMoneyAED,
  minGapDays,
  OccurrenceOverride,
  parseDateStr,
  toDateInputValue,
} from "@/lib/direct-debit";
import { DDAmountType, DDFrequency, DDInstrumentType } from "@/lib/types";

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS: { n: Step; label: string }[] = [
  { n: 1, label: "Customer & Mandate" },
  { n: 2, label: "Subscription Schedule" },
  { n: 3, label: "Collection Preview" },
  { n: 4, label: "Review & Sign" },
];

export default function CreateDirectDebitContractModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [maxStepReached, setMaxStepReached] = useState<Step>(1);

  const [instrumentType, setInstrumentType] = useState<DDInstrumentType>("Bank Account");
  const [amountType, setAmountType] = useState<DDAmountType>("Variable");
  const [frequencyCeiling, setFrequencyCeiling] = useState<DDFrequency>("Monthly");
  const [collectionFrequency, setCollectionFrequency] = useState<DDFrequency>("Monthly");

  const [merchantRef, setMerchantRef] = useState("INV-2026-08421");
  const [notes, setNotes] = useState("");

  // Mandate validity window (contract-level)
  const [commencesOn, setCommencesOn] = useState("2026-08-25");
  const [expiresOn, setExpiresOn] = useState("2027-08-25");
  // Subscription start (First Collection Date) — see Order Model: subscription_start_date is
  // distinct from mandate.commencesOn; subscription_end_date currently always mirrors expiresOn.
  const [firstCollectionDate, setFirstCollectionDate] = useState("2026-09-05");

  const [rolloverEnabled, setRolloverEnabled] = useState(true);
  const [rolloversAllowed, setRolloversAllowed] = useState(2);
  const [installment, setInstallment] = useState(4000);
  const [maxAmount, setMaxAmount] = useState(20000);

  const [editingSeq, setEditingSeq] = useState<number | null>(null);
  const [draftDate, setDraftDate] = useState("");
  const [draftAmount, setDraftAmount] = useState(0);
  const [draftError, setDraftError] = useState("");
  const [overrides, setOverrides] = useState<Record<number, OccurrenceOverride>>({});
  const [acknowledged, setAcknowledged] = useState(true);

  const fixedActive = amountType === "Fixed";
  const bankActive = instrumentType === "Bank Account";
  const effectiveRolloverEnabled = rolloverEnabled && !fixedActive;

  // Estimate off Commences On until Step 2 (First Collection Date) has actually been reached —
  // mirrors the panel's progressive disclosure below.
  const subscriptionStartDate = maxStepReached >= 2 ? firstCollectionDate : commencesOn;

  const built = useMemo(
    () =>
      buildOccurrenceSchedule({
        anchorDate: subscriptionStartDate,
        endDate: expiresOn,
        frequency: collectionFrequency,
        installment,
        amountType,
        overrides,
      }),
    [subscriptionStartDate, expiresOn, collectionFrequency, installment, amountType, overrides]
  );

  const collectionFreqOptions = collectionFrequencyOptions(frequencyCeiling);
  const requiredMax = installment * (rolloversAllowed + 1);
  const rolloverOk = requiredMax <= maxAmount;
  const gapDays = minGapDays(collectionFrequency);
  const firstOcc = built.list[0];

  if (!open) return null;

  const goTo = (n: Step) => {
    setStep(n);
    setEditingSeq(null);
    setMaxStepReached((m) => (m >= n ? m : n));
  };
  const prevStep = () => {
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
    setEditingSeq(null);
  };
  const nextStep = () => {
    const n = (step < 4 ? step + 1 : step) as Step;
    setStep(n);
    setEditingSeq(null);
    setMaxStepReached((m) => (m >= n ? m : n));
  };

  const setFixed = () => {
    setAmountType("Fixed");
    setRolloverEnabled(false);
  };

  const onCeilingChange = (val: DDFrequency) => {
    setFrequencyCeiling(val);
    // If the current collection frequency is now more frequent than the new ceiling, bump it up.
    const FREQ_ORDER = DD_FREQUENCIES;
    const monthsOf = (f: DDFrequency) =>
      ({
        Daily: 1 / 30, Weekly: 7 / 30, Monthly: 1, "Every Two Months": 2,
        Quarterly: 3, "Every Four Months": 4, "Half-yearly": 6, Annually: 12, "One Time Only": 999,
      } as Record<DDFrequency, number>)[f];
    if (monthsOf(collectionFrequency) < monthsOf(val)) setCollectionFrequency(val);
    void FREQ_ORDER;
  };

  const startEdit = (seq: number, date: Date, amount: number) => {
    setEditingSeq(seq);
    setDraftDate(toDateInputValue(date));
    setDraftAmount(amount);
    setDraftError("");
  };

  const saveEdit = (seq: number, idx: number) => {
    const newDate = parseDateStr(draftDate);
    const prev = built.list[idx - 1];
    const next = built.list[idx + 1];
    const gapPrevOk = !prev || Math.abs((newDate.getTime() - prev.date.getTime()) / 86400000) >= gapDays;
    const gapNextOk = !next || Math.abs((next.date.getTime() - newDate.getTime()) / 86400000) >= gapDays;
    if (!gapPrevOk || !gapNextOk) {
      setDraftError(`Must stay at least ~${gapDays} days from the neighboring collection.`);
      return;
    }
    setOverrides((prevOverrides) => ({
      ...prevOverrides,
      [seq]: { date: draftDate, amount: fixedActive ? undefined : draftAmount },
    }));
    setEditingSeq(null);
    setDraftError("");
  };

  const validityLabel = `${formatDateNice(parseDateStr(commencesOn))} – ${formatDateNice(parseDateStr(expiresOn))}`;
  const instrumentSummary = bankActive ? "Bank Account" : "Credit Card";
  const amountTypeSummary = fixedActive ? "Fixed" : "Variable";
  const collectionTypeSummary = fixedActive
    ? `Fixed · AED ${installment.toLocaleString("en-US")} / ${collectionFrequency}`
    : "Variable";
  const rolloverSummary = effectiveRolloverEnabled ? `${rolloversAllowed} rollovers allowed` : "Rollover disabled";
  const panelFrequency = maxStepReached >= 2 ? collectionFrequency : frequencyCeiling;
  const showRolloverInPanel = maxStepReached >= 2;
  const showFirstCollection = maxStepReached >= 3;
  const showNotesInPanel = !!notes.trim();

  const pillActive = "flex-1 rounded-lg py-2.5 text-center text-sm font-semibold bg-brand-orange text-white cursor-pointer";
  const pillInactive = "flex-1 rounded-lg py-2.5 text-center text-sm font-semibold text-text-secondary cursor-pointer";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-color px-8 py-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-extrabold text-brand-orange">g</span>
          <span className="text-text-muted">|</span>
          <span className="font-semibold text-text-primary">Create Direct Debit Contract</span>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <X size={22} />
        </button>
      </div>

      {/* Step rail */}
      <div className="flex items-center justify-center gap-0 border-b border-border-color bg-page-bg py-[18px]">
        {STEP_LABELS.map((s) => {
          const isActive = step === s.n;
          const isDone = step > s.n;
          return (
            <div key={s.n} className="flex items-center">
              <button
                onClick={() => goTo(s.n)}
                className="flex items-center gap-2.5 px-5 py-0"
              >
                <span
                  className={clsx(
                    "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold",
                    isActive || isDone
                      ? "border-brand-blue bg-brand-blue text-white"
                      : "border-border-color bg-white text-text-muted"
                  )}
                >
                  {isDone ? <Check size={14} strokeWidth={3} /> : s.n}
                </span>
                <span
                  className={clsx(
                    "text-xs font-medium",
                    isActive ? "font-semibold text-text-primary" : "text-text-muted"
                  )}
                >
                  {s.label}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div className="grid flex-1 grid-cols-[1.5fr_1fr] overflow-hidden">
        {/* Left: form */}
        <div className="overflow-y-auto border-r border-border-color px-10 py-7">
          {step === 1 && (
            <div>
              <h2 className="mb-1.5 text-xl font-bold text-text-primary">Customer &amp; Mandate Details</h2>
              <p className="mb-5 text-[13px] text-text-muted">
                Contract terms are captured together with the schedule in one guided flow — a signed contract
                with no schedule can&apos;t happen.
              </p>

              <div className="mb-4">
                <Label>Merchant reference number</Label>
                <input
                  value={merchantRef}
                  onChange={(e) => setMerchantRef(e.target.value)}
                  className="w-full max-w-xs rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                />
                <Help>Your own reference for this contract (order/invoice number, etc.)</Help>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3.5">
                <div>
                  <Label>Customer full name</Label>
                  <input defaultValue="Sara Ibrahim" className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none" />
                </div>
                <div>
                  <Label>Customer email</Label>
                  <input defaultValue="sara.ibrahim@example.com" className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none" />
                </div>
                <div>
                  <Label>Mobile number</Label>
                  <input defaultValue="0501234567" className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none" />
                  <Help>Registered on UAE PASS</Help>
                </div>
                <div>
                  <Label>Emirates ID number</Label>
                  <input defaultValue="784-1990-1234567-1" className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none" />
                </div>
              </div>

              <Label>Payment instrument</Label>
              <div className="mb-4 flex rounded-xl bg-page-bg p-1">
                <button onClick={() => setInstrumentType("Bank Account")} className={bankActive ? pillActive : pillInactive}>
                  Bank Account
                </button>
                <button onClick={() => setInstrumentType("Credit Card")} className={!bankActive ? pillActive : pillInactive}>
                  Credit Card
                </button>
              </div>

              {bankActive ? (
                <div className="mb-4 grid grid-cols-2 gap-3.5">
                  <div>
                    <Label>Bank name</Label>
                    <input defaultValue="Emirates NBD" className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none" />
                  </div>
                  <div>
                    <Label>Account holder title</Label>
                    <input defaultValue="Sara Ibrahim" className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none" />
                  </div>
                  <div className="col-span-2">
                    <Label>IBAN</Label>
                    <input defaultValue="AE07 0331 2345 6789 0123 456" className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none" />
                  </div>
                </div>
              ) : (
                <div className="mb-4 grid grid-cols-2 gap-3.5">
                  <div>
                    <Label>Card holder name</Label>
                    <input defaultValue="Sara Ibrahim" className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none" />
                  </div>
                  <div>
                    <Label>Issuing bank</Label>
                    <input defaultValue="Emirates NBD" className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none" />
                  </div>
                  <div className="col-span-2">
                    <Label>Card number</Label>
                    <input defaultValue="4242 4242 4242 4242" className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none" />
                  </div>
                </div>
              )}

              <div className="mb-4 grid grid-cols-2 gap-3.5">
                <div>
                  <Label>Commences on</Label>
                  <input
                    type="date"
                    value={commencesOn}
                    onChange={(e) => setCommencesOn(e.target.value)}
                    className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                  />
                </div>
                <div>
                  <Label>Expires on</Label>
                  <input
                    type="date"
                    value={expiresOn}
                    onChange={(e) => setExpiresOn(e.target.value)}
                    className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                  />
                </div>
              </div>

              <Label>Amount type</Label>
              <div className="mb-4 flex max-w-[280px] rounded-xl bg-page-bg p-1">
                <button onClick={setFixed} className={fixedActive ? pillActive : pillInactive}>
                  Fixed
                </button>
                <button onClick={() => setAmountType("Variable")} className={!fixedActive ? pillActive : pillInactive}>
                  Variable
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3.5">
                <div>
                  <Label>Min amount (AED)</Label>
                  <input defaultValue="4000" className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none" />
                </div>
                <div>
                  <Label>Max amount (AED)</Label>
                  <input
                    type="number"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                  />
                  <Help>Must cover the highest planned installment or full rollover total</Help>
                </div>
                <div>
                  <Label>Payment frequency ceiling</Label>
                  <SelectField value={frequencyCeiling} onChange={(v) => onCeilingChange(v as DDFrequency)} options={DD_FREQUENCIES} />
                  <Help>DDS allows no more than one collection per this period</Help>
                </div>
              </div>

              <div className="mt-4">
                <Label>Notes (optional)</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[70px] w-full resize-y rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                />
                <Help>Internal note for your team — not shown to the customer</Help>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="mb-1.5 text-xl font-bold text-text-primary">Subscription Schedule</h2>
              <p className="mb-5 text-[13px] text-text-muted">
                Collection cadence can be no more frequent than the contract&apos;s payment frequency ceiling.
              </p>

              <div className="mb-4 grid grid-cols-2 gap-3.5">
                <div>
                  <Label>Collection frequency</Label>
                  <SelectField
                    value={collectionFrequency}
                    onChange={(v) => setCollectionFrequency(v as DDFrequency)}
                    options={collectionFreqOptions}
                  />
                  <Help>Frequencies more frequent than the ceiling ({frequencyCeiling}) are hidden</Help>
                </div>
                <div>
                  <Label>First collection date</Label>
                  <input
                    type="date"
                    value={firstCollectionDate}
                    onChange={(e) => setFirstCollectionDate(e.target.value)}
                    className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                  />
                  <Help>Sets the recurring collection day — can differ from Commences On</Help>
                </div>
              </div>

              <div className="mb-5">
                <Label>Collection amount (AED)</Label>
                <input
                  type="number"
                  value={installment}
                  onChange={(e) => setInstallment(parseFloat(e.target.value) || 0)}
                  className="w-full max-w-[220px] rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                />
                <Help>First and last collection can be customized in the next step</Help>
              </div>

              <div className="mb-3.5 flex items-center justify-between border-t border-border-color pt-[18px]">
                <div>
                  <div className="text-[13.5px] font-semibold text-text-primary">Rollover</div>
                  {!fixedActive ? (
                    <div className="mt-0.5 text-[11.5px] text-text-muted">
                      Fold a failed collection&apos;s amount onto a future occurrence, capped by the contract&apos;s max amount
                    </div>
                  ) : (
                    <div className="mt-0.5 text-[11.5px] text-status-declined">
                      Requires Variable amount type — switch amount type on the previous step to enable
                    </div>
                  )}
                </div>
                <button
                  onClick={() => !fixedActive && setRolloverEnabled((v) => !v)}
                  className={clsx(
                    "flex h-6 w-11 items-center rounded-full px-0.5 transition-colors",
                    effectiveRolloverEnabled ? "justify-end bg-brand-blue" : "justify-start",
                    fixedActive ? "cursor-not-allowed bg-border-color opacity-50" : "cursor-pointer bg-border-color"
                  )}
                >
                  <span className="h-5 w-5 rounded-full bg-white shadow" />
                </button>
              </div>

              {effectiveRolloverEnabled && (
                <>
                  <div className="mb-4 flex items-center gap-3.5">
                    <Label noMargin>Rollovers allowed</Label>
                    <div className="flex items-center gap-2.5 rounded-lg border border-border-color px-2 py-1">
                      <button
                        onClick={() => setRolloversAllowed((v) => Math.max(0, v - 1))}
                        className="flex h-[22px] w-[22px] items-center justify-center text-sm font-bold text-text-secondary"
                      >
                        −
                      </button>
                      <span className="min-w-[16px] text-center text-[13.5px] font-semibold">{rolloversAllowed}</span>
                      <button
                        onClick={() => setRolloversAllowed((v) => v + 1)}
                        className="flex h-[22px] w-[22px] items-center justify-center text-sm font-bold text-text-secondary"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div
                    className={clsx(
                      "flex items-start gap-2 rounded-lg px-3 py-2.5 text-[12.5px]",
                      rolloverOk ? "bg-[#e9f7ed] text-[#1f5c33]" : "bg-[#fbeeee] text-[#8a3030]"
                    )}
                  >
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold">
                        AED {installment.toLocaleString("en-US")} × ({rolloversAllowed} + 1) = AED{" "}
                        {requiredMax.toLocaleString("en-US")} required headroom
                      </div>
                      <div className="mt-0.5">
                        {rolloverOk
                          ? `Within the contract max of AED ${maxAmount.toLocaleString("en-US")}.`
                          : `Exceeds the contract max of AED ${maxAmount.toLocaleString("en-US")} — raise the max amount or reduce rollovers allowed.`}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="mb-1.5 text-xl font-bold text-text-primary">Collection Preview</h2>
              <p className="mb-5 text-[13px] text-text-muted">
                Every collection generated from the schedule above. {fixedActive ? "Edit the due date" : "Edit the due date or amount"} of
                any collection — a new due date must stay clear of neighboring collections by the collection frequency.
              </p>

              <div className="overflow-hidden rounded-lg border border-border-color">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-page-bg text-left text-text-secondary">
                      <th className="px-3.5 py-2.5 font-medium">#</th>
                      <th className="px-3.5 py-2.5 font-medium">Due Date</th>
                      <th className="px-3.5 py-2.5 font-medium">Amount</th>
                      <th className="px-3.5 py-2.5 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {built.list.map((o, idx) => {
                      const isEditing = editingSeq === o.seq;
                      return (
                        <>
                          <tr key={o.seq} className="border-t border-border-color align-top">
                            <td className="px-3.5 py-2.5 text-text-muted">{o.seq}</td>
                            <td className="px-3.5 py-2.5">
                              {isEditing ? (
                                <input
                                  type="date"
                                  value={draftDate}
                                  onChange={(e) => setDraftDate(e.target.value)}
                                  className="rounded-md border border-brand-blue px-2 py-1.5 text-sm outline-none"
                                />
                              ) : (
                                formatDateNice(o.date)
                              )}
                            </td>
                            <td className="px-3.5 py-2.5">
                              {!fixedActive && isEditing ? (
                                <input
                                  type="number"
                                  value={draftAmount}
                                  onChange={(e) => setDraftAmount(parseFloat(e.target.value) || 0)}
                                  className="w-[110px] rounded-md border border-brand-blue px-2 py-1.5 text-sm outline-none"
                                />
                              ) : (
                                <span className="font-semibold">{formatMoneyAED(o.amount)}</span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 text-right">
                              {isEditing ? (
                                <button
                                  onClick={() => saveEdit(o.seq, idx)}
                                  className="text-xs font-semibold text-brand-blue"
                                >
                                  Done
                                </button>
                              ) : (
                                <button
                                  onClick={() => startEdit(o.seq, o.date, o.amount)}
                                  className="text-text-muted"
                                >
                                  <Pencil size={15} />
                                </button>
                              )}
                            </td>
                          </tr>
                          {isEditing && draftError && (
                            <tr>
                              <td />
                              <td colSpan={3} className="px-3.5 pb-2.5 text-[11.5px] text-status-declined">
                                {draftError}
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {built.trueCount > built.displayCount && (
                <div className="mt-2.5 text-[11.5px] text-text-muted">
                  Showing the first {built.displayCount} of {built.trueCount} collections generated for this schedule.
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="mb-1.5 text-xl font-bold text-text-primary">Review &amp; Send for Signature</h2>
              <p className="mb-5 text-[13px] text-text-muted">
                The customer receives a signing link by SMS and email and signs via UAE PASS — there&apos;s no in-app option.
              </p>

              <div className="flex flex-col gap-3">
                <ReviewRow label="Customer" value="Sara Ibrahim · 784-1990-1234567-1" />
                <ReviewRow label="Merchant reference" value={merchantRef} />
                <ReviewRow label="Payment instrument" value={instrumentSummary} />
                {bankActive ? (
                  <ReviewRow label="IBAN" value="AE07 0331 2345 6789 0123 456" />
                ) : (
                  <ReviewRow label="Card number" value="•••• •••• •••• 4242" />
                )}
                <ReviewRow label="Validity" value={validityLabel} />
                <ReviewRow label="Collection type" value={collectionTypeSummary} />
                <ReviewRow label="Rollover" value={rolloverSummary} />
                <ReviewRow label="Total Collections" value={`${built.trueCount} collections`} />
              </div>

              <div className="mt-5 flex items-start gap-2.5">
                <button
                  onClick={() => setAcknowledged((v) => !v)}
                  className={clsx(
                    "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px]",
                    acknowledged ? "border-brand-blue bg-brand-blue" : "border-border-color bg-white"
                  )}
                >
                  {acknowledged && <Check size={12} strokeWidth={3} className="text-white" />}
                </button>
                <div className="text-[12.5px] text-text-secondary">
                  I confirm these terms match what was agreed with the customer. Once sent, terms can only be
                  changed by cancelling and creating a new contract.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: summary preview */}
        <div className="overflow-y-auto bg-page-bg px-8 py-7">
          <h3 className="mb-3.5 text-[15px] font-bold text-text-primary">Contract Summary</h3>
          <div className="rounded-2xl bg-[#eef0fb] p-[18px]">
            <div className="rounded-xl bg-white p-[18px] shadow-sm">
              <div className="text-[12.5px] font-semibold text-text-secondary">Direct Debit Contract</div>
              <div className="mt-0.5 text-[13px] text-text-muted">Reference assigned after signature</div>

              <div className="mt-4 flex flex-col gap-2.5 border-t border-border-color pt-3.5 text-[13px]">
                <SummaryRow label="Customer" value="Sara Ibrahim" />
                <SummaryRow label="Merchant ref" value={merchantRef} />
                <SummaryRow label="Instrument" value={instrumentSummary} />
                <SummaryRow label="Amount type" value={amountTypeSummary} />
                <SummaryRow label="Frequency" value={panelFrequency} />
                {showRolloverInPanel && <SummaryRow label="Rollover" value={rolloverSummary} />}
                {showFirstCollection && firstOcc && (
                  <SummaryRow label="First collection" value={`${formatDateNice(firstOcc.date)} · ${formatMoneyAED(firstOcc.amount)}`} />
                )}
                {showNotesInPanel && <SummaryRow label="Notes" value={notes} />}
                <div className="flex justify-between border-t border-border-color pt-2.5">
                  <span className="text-text-secondary">Collections</span>
                  <span className="font-bold">{built.trueCount} scheduled</span>
                </div>
              </div>
            </div>
            <div className="mt-3 text-center text-[11.5px] text-text-muted">
              Powered by <span className="font-bold text-brand-orange">geidea</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-border-color px-8 py-4">
        <button
          onClick={prevStep}
          className="rounded-lg border border-brand-blue px-[22px] py-2.5 text-[13.5px] font-semibold text-brand-blue"
        >
          Back
        </button>
        {step === 4 ? (
          <button
            onClick={onClose}
            disabled={!acknowledged}
            className="rounded-lg bg-brand-blue px-[26px] py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create &amp; Send Contract
          </button>
        ) : (
          <button
            onClick={nextStep}
            className="rounded-lg bg-brand-blue px-[26px] py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-blue-hover"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

function Label({ children, noMargin }: { children: React.ReactNode; noMargin?: boolean }) {
  return <div className={clsx("text-[12.5px] font-semibold text-text-primary", !noMargin && "mb-1.5")}>{children}</div>;
}

function Help({ children }: { children: React.ReactNode }) {
  return <div className="mt-1.5 text-[11.5px] text-text-muted">{children}</div>;
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-lg border border-border-color bg-white px-3 py-2.5 pr-8 text-sm outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border-color px-4 py-3.5">
      <span className="text-text-secondary">{label}</span>
      <span className="font-semibold text-text-primary">{value}</span>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="shrink-0 text-text-secondary">{label}</span>
      <span className="text-right font-semibold text-text-primary">{value}</span>
    </div>
  );
}
