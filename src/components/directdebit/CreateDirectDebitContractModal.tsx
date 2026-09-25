"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, ChevronDown, Check, AlertCircle, Pencil, Table2 } from "lucide-react";
import clsx from "clsx";
import { useDDConfig } from "@/lib/dd-config-context";
import {
  DD_FREQUENCIES,
  DDS_FREQUENCY_TABLE,
  addDays,
  addWorkingDays,
  buildOccurrenceSchedule,
  ddToday,
  diffDays,
  collectionFrequencyOptions,
  formatCreatedOn,
  formatDateNice,
  formatMoneyAED,
  maskInstrumentRef,
  minGapDays,
  nextContractRef,
  newContractId,
  OccurrenceOverride,
  parseDateStr,
  toDateInputValue,
} from "@/lib/direct-debit";
import {
  DDAmountType,
  DDBankAccountType,
  DDCreateContractRequest,
  DDFrequency,
  DDInstrumentType,
  DDS_BANKS,
  DirectDebitContract,
  DirectDebitOccurrence,
} from "@/lib/types";
import { directDebitContracts } from "@/lib/mock-data";
import { saveCreatedContract } from "@/lib/dd-contract-store";
import FieldHint, { DevHintsFloatingToggle } from "@/components/directdebit/FieldHint";
import { HintKey } from "@/lib/dd-field-map";

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
  const router = useRouter();
  const { config } = useDDConfig();

  const [step, setStep] = useState<Step>(1);
  const [maxStepReached, setMaxStepReached] = useState<Step>(1);

  // Only used when !tbfc — the merchant's own instrument choice. Under TBFC the customer makes
  // this choice instead, on the Sign page's instrument step (Rabbani, 09-Sep-2026: the whole
  // instrument decision — type included, not just the account/card details — is the customer's
  // to make once TBFC is checked; see instrumentType being left unset in that case below).
  const [instrumentType, setInstrumentType] = useState<DDInstrumentType>("Bank Account");
  // TBFC (To Be Filled By Customer, added Sep 2026): merchant defers the ENTIRE instrument
  // decision — which type, and its details — to the customer's own review-and-sign step.
  const [tbfc, setTbfc] = useState(false);

  // Disable Credit Card Instrument (PGW Config in MA, Sep 2026): derived, not synced via effect —
  // if switched on mid-session while Credit Card was already selected, this falls back to Bank
  // Account for every read of the instrument type without a second render pass.
  const effectiveInstrumentType: DDInstrumentType = config.disableCreditCard
    ? "Bank Account"
    : instrumentType;
  const [amountType, setAmountType] = useState<DDAmountType>("Variable");
  const [frequencyCeiling, setFrequencyCeiling] = useState<DDFrequency>("Monthly");
  const [collectionFrequency, setCollectionFrequency] = useState<DDFrequency>("Monthly");

  // Customer & Mandate — Step 1 identity/instrument fields (made controlled Sep 2026 so this
  // data is actually captured and can be carried forward to the Contract Review & Sign page,
  // rather than sitting in uncontrolled `defaultValue` inputs that were never read anywhere).
  // Dates default relative to today (25-Sep-2026) so the lead-time rule (V15) passes out of the
  // box: first collection = today + (lead time + 2) working days.
  const [today] = useState(() => ddToday());
  const [customerName, setCustomerName] = useState("Sara Ibrahim");
  const [customerEmail, setCustomerEmail] = useState("sara.ibrahim@example.com");
  const [customerMobile, setCustomerMobile] = useState("0501234567");
  const [customerIdNumber, setCustomerIdNumber] = useState("784-1990-1234567-1");

  const [bankName, setBankName] = useState<string>("Emiratesnbd Bank PJSC");
  const [accountHolderTitle, setAccountHolderTitle] = useState("Sara Ibrahim");
  const [bankAccountType, setBankAccountType] = useState<DDBankAccountType>("Current");
  const [iban, setIban] = useState("AE07 0331 2345 6789 0123 456");

  const [cardHolderName, setCardHolderName] = useState("Sara Ibrahim");
  const [issuingBank, setIssuingBank] = useState<string>("Emiratesnbd Bank PJSC");
  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");

  const [merchantRef, setMerchantRef] = useState("INV-2026-08421");
  // Customer-facing (Mandate.contract_description, added Sep 2026) — distinct from Notes below,
  // which stays merchant-only. Shown to the customer on the Contract review & sign page in place
  // of merchant reference number, which is meaningless to them. See Notes/Projects/Direct
  // Debit.md, "Mandate details section."
  const [contractDescription, setContractDescription] = useState("");
  const [notes, setNotes] = useState("");

  // Mandate validity window (contract-level)
  const [commencesOn, setCommencesOn] = useState(() => toDateInputValue(today));
  const [expiresOn, setExpiresOn] = useState(() =>
    toDateInputValue(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()))
  );
  // Subscription start (First Collection Date) — see Order Model: subscription_start_date is
  // distinct from mandate.commencesOn; subscription_end_date currently always mirrors expiresOn.
  const [firstCollectionDate, setFirstCollectionDate] = useState(() =>
    toDateInputValue(addWorkingDays(today, config.minFirstCollectionLeadWorkingDays + 2))
  );

  const [rolloverEnabled, setRolloverEnabled] = useState(true);
  const [rolloversAllowed, setRolloversAllowed] = useState(2);
  const [installment, setInstallment] = useState(4000);
  const [minAmount, setMinAmount] = useState(4000);
  const [maxAmount, setMaxAmount] = useState(20000);

  const [editingSeq, setEditingSeq] = useState<number | null>(null);
  const [draftDate, setDraftDate] = useState("");
  const [draftAmount, setDraftAmount] = useState(0);
  const [draftError, setDraftError] = useState("");
  const [overrides, setOverrides] = useState<Record<number, OccurrenceOverride>>({});
  const [acknowledged, setAcknowledged] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [stepErrors, setStepErrors] = useState<string[]>([]);

  const fixedActive = amountType === "Fixed";
  const bankActive = effectiveInstrumentType === "Bank Account";
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
  // V8 — the DDS minimum gap follows the MANDATE's payment frequency (frequencyCeiling), not the
  // collection frequency (Backend Stories S2 V8; DDS-confirmed 24-Sep-2026).
  const gapDays = minGapDays(frequencyCeiling);
  const firstOcc = built.list[0];

  if (!open) return null;

  const goTo = (n: Step) => {
    if (n > step) {
      const errs = validateStep(step);
      setStepErrors(errs);
      if (errs.length) return;
    } else setStepErrors([]);
    setStep(n);
    setEditingSeq(null);
    setMaxStepReached((m) => (m >= n ? m : n));
  };
  const prevStep = () => {
    setStepErrors([]);
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
    setEditingSeq(null);
  };
  // Contract × collections rules the portal can check before the Backend does (S2 §3b). The
  // Backend re-checks every one — this only saves the merchant a round trip.
  const leadDays = config.minFirstCollectionLeadWorkingDays;
  const earliestFirst = addWorkingDays(today, leadDays);
  const validateStep = (n: Step): string[] => {
    const errs: string[] = [];
    if (n >= 1) {
      if (maxAmount > config.maxContractAmount)
        errs.push(
          `MAX_AMOUNT_EXCEEDS_LIMIT (V14) — max amount ${formatMoneyAED(maxAmount)} is above this merchant's Maximum Contract Amount of ${formatMoneyAED(config.maxContractAmount)}.`
        );
      if (minAmount > maxAmount) errs.push("MAX_AMOUNT_EXCEEDS_LIMIT (V14) — min amount is above max amount.");
      if (parseDateStr(commencesOn) < today || parseDateStr(expiresOn) <= parseDateStr(commencesOn))
        errs.push("INVALID_CONTRACT_PERIOD (V1) — Commences on must be today or later, and Expires on after it.");
    }
    if (n >= 2) {
      const fc = parseDateStr(firstCollectionDate);
      if (diffDays(earliestFirst, fc) < 0)
        errs.push(
          `FIRST_COLLECTION_TOO_SOON (V15) — first collection must be on or after ${formatDateNice(earliestFirst)} (today + ${leadDays} working days, per this merchant's lead time).`
        );
      if (fc < parseDateStr(commencesOn) || fc > parseDateStr(expiresOn))
        errs.push("FIRST_COLLECTION_OUT_OF_PERIOD (V2) — first collection must fall inside the contract period.");
    }
    if (n >= 3) {
      for (let i = 1; i < built.list.length; i++) {
        const g = diffDays(built.list[i - 1].date, built.list[i].date);
        if (g < gapDays)
          errs.push(
            `COLLECTION_GAP_TOO_SHORT (V8) — #${built.list[i - 1].seq} → #${built.list[i].seq} is ${g} days; DDS needs at least ${gapDays} for a ${frequencyCeiling} mandate.`
          );
        if (built.list[i].date <= built.list[i - 1].date)
          errs.push(`COLLECTION_DATE_ORDER (V6) — #${built.list[i].seq} must be after #${built.list[i - 1].seq}.`);
      }
      if (!fixedActive) {
        const out = built.list.filter((o) => o.amount < minAmount || o.amount > maxAmount);
        if (out.length)
          errs.push(
            `COLLECTION_AMOUNT_OUT_OF_RANGE (V10) — #${out.map((o) => o.seq).join(", #")} outside ${formatMoneyAED(minAmount)} – ${formatMoneyAED(maxAmount)}.`
          );
      }
    }
    return errs;
  };

  const nextStep = () => {
    const errs = validateStep(step);
    setStepErrors(errs);
    if (errs.length) return;
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
      setDraftError(
        `COLLECTION_GAP_TOO_SHORT (V8) — must stay at least ${gapDays} days from the neighbouring collection (DDS minimum gap for a ${frequencyCeiling} mandate).`
      );
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
  const showDescriptionInPanel = !!contractDescription.trim();

  // Builds the full contract from everything captured across all 4 steps and hands it off to the
  // Contract Review & Sign page — see Notes/Projects/Direct Debit.md: all data captured within the
  // creation flow must carry forward to signing, not just the fields already wired to state.
  // No backend/global store exists yet, so — matching every other mutation in this prototype
  // (Pause/Resume/Retry/Rollover) — the shared `directDebitContracts` mock array is pushed to
  // directly and read back by id on the next page; it resets on a full reload, same as those.
  const handleCreateAndSend = () => {
    const errs = validateStep(4);
    setStepErrors(errs);
    if (errs.length) return;
    const id = newContractId();
    // The exact POST /direct-debit/v1/contracts body (Backend Stories S2 §3a) — kept on the
    // prototype record so the Contract submitted page can show it next to the DDS payload.
    const createRequest: DDCreateContractRequest = {
      merchantReference: merchantRef,
      contractDescription: contractDescription.trim() || undefined,
      notes: notes.trim() || undefined,
      customerName,
      customerEmail,
      customerMobile,
      emiratesId: customerIdNumber,
      bankInfoFillByCustomer: tbfc,
      paymentMethodType: tbfc ? undefined : effectiveInstrumentType,
      bankName: tbfc ? undefined : bankActive ? bankName : issuingBank,
      accountHolderTitle: !tbfc && bankActive ? accountHolderTitle : undefined,
      bankAccountType: !tbfc && bankActive ? bankAccountType : undefined,
      iban: !tbfc && bankActive ? iban.replace(/\s/g, "") : undefined,
      cardNumber: !tbfc && !bankActive ? cardNumber.replace(/\s/g, "") : undefined,
      cardHolderName: !tbfc && !bankActive ? cardHolderName : undefined,
      startDate: commencesOn,
      endDate: expiresOn,
      amountType,
      amount: fixedActive ? installment : undefined,
      minAmount,
      maxAmount,
      frequencyCeiling,
      frequency: collectionFrequency,
      firstCollectionDate,
      rollover: effectiveRolloverEnabled
        ? { enabled: true, maxConsecutive: rolloversAllowed }
        : { enabled: false },
      collections: built.list.map((o) => ({ dueDate: toDateInputValue(o.date), amount: o.amount })),
    };
    const occurrences: DirectDebitOccurrence[] = built.list.map((o) => ({
      seq: o.seq,
      dueDate: formatDateNice(o.date),
      amount: o.amount,
      originalAmount: o.amount,
      amountSource: "scheduled",
      status: "Scheduled",
      rolledOver: "none",
    }));
    const newContract: DirectDebitContract = {
      id,
      // TBFC: Create DDA hasn't been called, so DDS has issued nothing yet — no reference until
      // the customer completes the instrument step on the Sign page. See PENDING_INSTRUMENT_REF_LABEL.
      ref: tbfc ? "" : nextContractRef(directDebitContracts),
      merchantRef,
      notes: notes.trim() || undefined,
      contractDescription: contractDescription.trim() || undefined,
      createdOn: formatCreatedOn(new Date()),
      customerName,
      customerIdType: "Emirates ID",
      customerIdNumber,
      customerEmail,
      customerMobile,
      bankAccountType: !tbfc && bankActive ? bankAccountType : undefined,
      accountHolderTitle: !tbfc && bankActive ? accountHolderTitle : undefined,
      cardHolderName: !tbfc && !bankActive ? cardHolderName : undefined,
      collectionFrequency,
      scheduleVersion: 1,
      signingNotificationCount: config.suppressCustomerNotifications ? 0 : 1,
      signingNotificationSentAt: config.suppressCustomerNotifications ? undefined : formatCreatedOn(new Date()),
      reviewLinkExpiresAt: formatDateNice(addDays(today, config.contractReviewExpiryDays)),
      createRequest,
      // Under TBFC the customer picks the instrument TYPE too (not just its details) on the Sign
      // page's instrument step — left unset here rather than defaulting to the merchant's unused
      // pill selection, so the UI can tell "not yet chosen" apart from an actual choice.
      instrumentType: tbfc ? undefined : effectiveInstrumentType,
      bankName: tbfc ? undefined : bankActive ? bankName : issuingBank,
      maskedInstrumentRef: tbfc ? "" : maskInstrumentRef(bankActive ? iban : cardNumber),
      commencesOn: formatDateNice(parseDateStr(commencesOn)),
      expiresOn: formatDateNice(parseDateStr(expiresOn)),
      frequency: frequencyCeiling,
      amountType,
      minAmount,
      maxAmount,
      nextDue: occurrences[0] ? { amount: occurrences[0].amount, date: occurrences[0].dueDate } : undefined,
      rolloverEnabled: effectiveRolloverEnabled,
      rolloversAllowed,
      rolloverRemaining: rolloversAllowed,
      status: tbfc ? "Awaiting Customer Details" : "Pending Customer Sign",
      subscriptionStatus: "Active",
      instrumentProvidedBy: tbfc ? "customer" : "merchant",
      mandateCreationStage: tbfc ? "awaiting_customer_instrument" : "submitted_to_dds",
      awaitingInstrumentNote: tbfc
        ? "Waiting on the customer to choose a payment instrument (bank account or credit card) and supply its details on the contract sign page before this mandate can be submitted to DDS. Nothing has been sent to DDS yet — no reference exists until that step completes."
        : undefined,
      occurrences,
    };
    directDebitContracts.unshift(newContract);
    // Also stored in this browser so the review link can open in a new tab (dd-contract-store).
    saveCreatedContract(newContract);
    onClose();
    // New step (25-Sep-2026): the merchant lands on "Contract submitted" — payloads sent to the
    // DD Backend and DDS, plus the SMS / email the customer receives — instead of going straight
    // to the customer's review page.
    router.push(`/direct-debit/${id}/submitted`);
  };

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
                <Label hint="create.merchantReference" hintValue={JSON.stringify(merchantRef)}>Merchant reference number</Label>
                <input
                  value={merchantRef}
                  onChange={(e) => setMerchantRef(e.target.value)}
                  className="w-full max-w-xs rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                />
                <Help>Your own reference for this contract (order/invoice number, etc.)</Help>
              </div>

              <div className="mb-4">
                <Label hint="create.contractDescription">Contract description</Label>
                <input
                  value={contractDescription}
                  onChange={(e) => setContractDescription(e.target.value)}
                  placeholder="e.g. Monthly rent collection — Building 12, Unit 304"
                  maxLength={140}
                  className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                />
                <Help>
                  Shown to the customer on the contract signing page — this is the only context they get
                  beyond your company name, so make it plain language (not the internal Notes below).
                </Help>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3.5">
                <div>
                  <Label hint="create.customerName">Customer full name</Label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                  />
                </div>
                <div>
                  <Label hint="create.customerEmail">Customer email</Label>
                  <input
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                  />
                </div>
                <div>
                  <Label hint="create.customerMobile">Mobile number</Label>
                  <input
                    value={customerMobile}
                    onChange={(e) => setCustomerMobile(e.target.value)}
                    className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                  />
                  <Help>Registered on UAE PASS</Help>
                </div>
                <div>
                  <Label hint="create.emiratesId">Emirates ID number</Label>
                  <input
                    value={customerIdNumber}
                    onChange={(e) => setCustomerIdNumber(e.target.value)}
                    className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                  />
                </div>
              </div>

              <Label hint="create.paymentMethodType" hintValue={tbfc ? "absent (TBFC)" : JSON.stringify(effectiveInstrumentType)}>Payment instrument</Label>

              <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-border-color bg-page-bg px-3.5 py-3">
                <button
                  onClick={() => setTbfc((v) => !v)}
                  className={clsx(
                    "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px]",
                    tbfc ? "border-brand-blue bg-brand-blue" : "border-border-color bg-white"
                  )}
                >
                  {tbfc && <Check size={12} strokeWidth={3} className="text-white" />}
                </button>
                <div>
                  <div className="flex items-center gap-1.5 text-[13px] font-medium text-text-primary">
                    To Be Filled By Customer
                    <FieldHint k="create.tbfc" value={`bankInfoFillByCustomer = ${tbfc}`} />
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-text-muted">
                    Leave the instrument entirely to the customer — they&apos;ll choose Bank Account or Credit
                    Card and supply its details on their own review-and-sign step. Create DDA isn&apos;t called
                    until they complete that step.
                  </div>
                </div>
              </div>

              {!tbfc ? (
                <>
                  {!config.disableCreditCard && (
                    <div className="mb-4 flex rounded-xl bg-page-bg p-1">
                      <button onClick={() => setInstrumentType("Bank Account")} className={bankActive ? pillActive : pillInactive}>
                        Bank Account
                      </button>
                      <button onClick={() => setInstrumentType("Credit Card")} className={!bankActive ? pillActive : pillInactive}>
                        Credit Card
                      </button>
                    </div>
                  )}
                  {bankActive ? (
                    <div key="bank-account-fields" className="mb-4 grid grid-cols-2 gap-3.5">
                      <div>
                        <Label hint="create.bankName">Bank name</Label>
                        <select
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="w-full rounded-lg border border-border-color bg-white px-3 py-2.5 text-sm outline-none"
                        >
                          {DDS_BANKS.map((bank) => (
                            <option key={bank} value={bank}>
                              {bank}
                            </option>
                          ))}
                        </select>
                        <Help>Per the DDS Banks Master Table</Help>
                      </div>
                      <div>
                        <Label hint="create.accountHolderTitle">Account holder title</Label>
                        <input
                          value={accountHolderTitle}
                          onChange={(e) => setAccountHolderTitle(e.target.value)}
                          className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                        />
                      </div>
                      <div>
                        <Label hint="create.bankAccountType" hintValue={JSON.stringify(bankAccountType)}>Account type</Label>
                        <div className="flex rounded-xl bg-page-bg p-1">
                          {(["Current", "Savings"] as DDBankAccountType[]).map((t) => (
                            <button
                              key={t}
                              onClick={() => setBankAccountType(t)}
                              className={bankAccountType === t ? pillActive : pillInactive}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label hint="create.iban">IBAN</Label>
                        <input
                          value={iban}
                          onChange={(e) => setIban(e.target.value)}
                          className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div key="credit-card-fields" className="mb-4 grid grid-cols-2 gap-3.5">
                      <div>
                        <Label hint="create.cardHolderName">Card holder name</Label>
                        <input
                          value={cardHolderName}
                          onChange={(e) => setCardHolderName(e.target.value)}
                          className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                        />
                      </div>
                      <div>
                        <Label hint="create.issuingBank">Issuing bank</Label>
                        <select
                          value={issuingBank}
                          onChange={(e) => setIssuingBank(e.target.value)}
                          className="w-full rounded-lg border border-border-color bg-white px-3 py-2.5 text-sm outline-none"
                        >
                          {DDS_BANKS.map((bank) => (
                            <option key={bank} value={bank}>
                              {bank}
                            </option>
                          ))}
                        </select>
                        <Help>Per the DDS Banks Master Table</Help>
                      </div>
                      <div className="col-span-2">
                        <Label hint="create.cardNumber">Card number</Label>
                        <input
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="mb-4 rounded-lg border border-dashed border-border-color px-3.5 py-3 text-[12.5px] text-text-muted">
                  {config.disableCreditCard
                    ? "The customer will provide their Bank Account details on the contract sign page — nothing to enter here."
                    : "The customer will choose Bank Account or Credit Card and provide its details on the contract sign page — nothing to enter here."}
                </div>
              )}

              <div className="mb-4 grid grid-cols-2 gap-3.5">
                <div>
                  <Label hint="create.startDate">Commences on</Label>
                  <input
                    type="date"
                    value={commencesOn}
                    onChange={(e) => setCommencesOn(e.target.value)}
                    className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                  />
                </div>
                <div>
                  <Label hint="create.endDate">Expires on</Label>
                  <input
                    type="date"
                    value={expiresOn}
                    onChange={(e) => setExpiresOn(e.target.value)}
                    className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                  />
                </div>
              </div>

              <Label hint="create.amountType" hintValue={JSON.stringify(amountType)}>Amount type</Label>
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
                  <Label hint="create.minAmount">Min amount (AED)</Label>
                  <input
                    type="number"
                    value={minAmount}
                    onChange={(e) => setMinAmount(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                  />
                </div>
                <div>
                  <Label hint="create.maxAmount">Max amount (AED)</Label>
                  <input
                    type="number"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                  />
                  <Help>Must cover the highest planned installment or full rollover total</Help>
                </div>
                <div>
                  <Label hint="create.frequencyCeiling" hintValue={JSON.stringify(frequencyCeiling)}>Payment frequency ceiling</Label>
                  <SelectField value={frequencyCeiling} onChange={(v) => onCeilingChange(v as DDFrequency)} options={DD_FREQUENCIES} />
                  <Help>DDS allows no more than one collection per this period</Help>
                </div>
              </div>

              <div className="mt-4">
                <Label hint="create.notes">Notes (optional)</Label>
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
                  <Label hint="create.frequency" hintValue={JSON.stringify(collectionFrequency)}>Collection frequency</Label>
                  <SelectField
                    value={collectionFrequency}
                    onChange={(v) => setCollectionFrequency(v as DDFrequency)}
                    options={collectionFreqOptions}
                  />
                  <Help>Frequencies more frequent than the ceiling ({frequencyCeiling}) are hidden</Help>
                </div>
                <div>
                  <Label hint="create.firstCollectionDate" hintValue={JSON.stringify(firstCollectionDate)}>First collection date</Label>
                  <input
                    type="date"
                    value={firstCollectionDate}
                    onChange={(e) => setFirstCollectionDate(e.target.value)}
                    className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
                  />
                  <Help>
                    Sets the recurring collection day. Earliest allowed: {formatDateNice(earliestFirst)} (today +{" "}
                    {leadDays} working days — this merchant&apos;s lead time)
                  </Help>
                </div>
              </div>

              <div className="mb-5">
                <Label hint="create.amount">Collection amount (AED)</Label>
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
                  <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-text-primary">
                    Rollover
                    <FieldHint k="create.rolloverEnabled" value={`rollover.enabled = ${effectiveRolloverEnabled}`} />
                  </div>
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
                    <Label noMargin hint="create.rolloversAllowed" hintValue={String(rolloversAllowed)}>Rollovers allowed</Label>
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
              <h2 className="mb-1.5 flex items-center gap-1.5 text-xl font-bold text-text-primary">
                Collection Preview <FieldHint k="create.collections" />
              </h2>
              <p className="mb-3 text-[13px] text-text-muted">
                Every collection generated from the schedule above. {fixedActive ? "Edit the due date" : "Edit the due date or amount"} of
                any collection — two collections must stay at least <strong>{gapDays} days</strong> apart, DDS&apos;s
                minimum gap for a {frequencyCeiling} mandate.
              </p>
              <button
                onClick={() => setShowRules((v) => !v)}
                className="mb-4 flex items-center gap-1.5 text-[12px] font-semibold text-brand-blue"
              >
                <Table2 size={13} />
                {showRules ? "Hide" : "Show"} DDS minimum-gap table
              </button>
              {showRules && (
                <div className="mb-5 overflow-hidden rounded-lg border border-border-color" data-testid="min-gap-table">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="bg-page-bg text-left text-text-secondary">
                        <th className="px-3 py-2 font-medium">Payment frequency</th>
                        <th className="px-3 py-2 font-medium">DDS period (days)</th>
                        <th className="px-3 py-2 font-medium">Min gap between two successful debits (days)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DDS_FREQUENCY_TABLE.map((r) => (
                        <tr
                          key={r.frequency}
                          className={clsx(
                            "border-t border-border-color",
                            r.frequency === frequencyCeiling && "bg-brand-blue/5 font-semibold"
                          )}
                        >
                          <td className="px-3 py-1.5">{r.frequency}</td>
                          <td className="px-3 py-1.5">{r.periodDays ?? "—"}</td>
                          <td className="px-3 py-1.5">{r.minGapDays ?? "Not applicable (one collection)"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="border-t border-border-color bg-page-bg px-3 py-2 text-[11.5px] text-text-muted">
                    DDS-confirmed 24-Sep-2026. Counted from the actual debit date of the previous successful
                    claim — e.g. Monthly debited 15 Sep → next claim no earlier than 8 Oct. At creation only
                    due dates exist, so due dates are checked; the Backend re-checks against the real debit date
                    before each file.
                  </div>
                </div>
              )}

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
                        <Fragment key={o.seq}>
                          <tr className="border-t border-border-color align-top">
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
                        </Fragment>
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
                {config.suppressCustomerNotifications
                  ? "Geidea customer notifications are suppressed for this merchant — Geidea sends nothing; you share the review link (or the UAE PASS signing URL) with the customer from your own channels."
                  : "Geidea sends the customer a review & signing link by SMS, email and WhatsApp. They verify with an OTP, review the contract and sign via UAE PASS."}
              </p>

              <div className="flex flex-col gap-3">
                <ReviewRow label="Customer" value={`${customerName} · ${customerIdNumber}`} />
                <ReviewRow label="Merchant reference" value={merchantRef} />
                <ReviewRow
                  label="Contract description"
                  value={contractDescription.trim() || "Not set — customer will only see your company name"}
                />
                {tbfc ? (
                  <ReviewRow label="Payment instrument" value="To be chosen and completed by customer" />
                ) : (
                  <>
                    <ReviewRow label="Payment instrument" value={instrumentSummary} />
                    {bankActive ? (
                      <ReviewRow label="IBAN" value={iban} />
                    ) : (
                      <ReviewRow label="Card number" value={`•••• •••• •••• ${cardNumber.replace(/\D/g, "").slice(-4) || "0000"}`} />
                    )}
                  </>
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
                <SummaryRow label="Customer" value={customerName} />
                <SummaryRow label="Merchant ref" value={merchantRef} />
                {showDescriptionInPanel && (
                  <SummaryRow label="Description" value={contractDescription} />
                )}
                <SummaryRow
                  label="Instrument"
                  value={tbfc ? "Chosen by customer" : instrumentSummary}
                />
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

      {stepErrors.length > 0 && (
        <div className="border-t border-status-expired/40 bg-status-expired/5 px-8 py-3" data-testid="step-errors">
          {stepErrors.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-[12.5px] text-status-expired">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {e}
            </div>
          ))}
        </div>
      )}

      <DevHintsFloatingToggle />

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-border-color px-8 py-4">
        <button
          onClick={prevStep}
          className="rounded-lg border border-brand-blue px-[22px] py-2.5 text-[13.5px] font-semibold text-brand-blue"
        >
          Back
        </button>
        {step === 4 ? (
          <>
          <button
            onClick={handleCreateAndSend}
            disabled={!acknowledged}
            data-testid="create-and-send"
            className="rounded-lg bg-brand-blue px-[26px] py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create &amp; Send Contract
          </button>
          <FieldHint k="create.submit" />
          </>
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

function Label({
  children,
  noMargin,
  hint,
  hintValue,
}: {
  children: React.ReactNode;
  noMargin?: boolean;
  hint?: HintKey;
  hintValue?: string;
}) {
  return (
    <div className={clsx("flex items-center gap-1.5 text-[12.5px] font-semibold text-text-primary", !noMargin && "mb-1.5")}>
      {children}
      {hint && <FieldHint k={hint} value={hintValue} />}
    </div>
  );
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
