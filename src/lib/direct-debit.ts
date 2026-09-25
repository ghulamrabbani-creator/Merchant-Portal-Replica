import { DD_FREQUENCIES, DDAmountType, DDFrequency, DDSubscriptionStatus, DirectDebitContract, DirectDebitOccurrence } from "./types";

// Ported from the Direct Debit Contracts design canvas (Create Contracts & Subscription flow).
// Central Bank rule: no more than one collection per the mandate's own payment_frequency period —
// see Notes/Projects/Direct Debit.md, "Technical flow" step 1.
export const FREQ_MONTHS: Record<DDFrequency, number> = {
  Daily: 1 / 30,
  Weekly: 7 / 30,
  Monthly: 1,
  "Every Two Months": 2,
  Quarterly: 3,
  "Every Four Months": 4,
  "Half-yearly": 6,
  Annually: 12,
  "One Time Only": 999,
};

export { DD_FREQUENCIES };

// Max Payment Representment attempts per Order Model (Payment.retry_count), mirroring
// UAE cheque-bounce rules: original attempt + up to 3 retries = 4 total attempts.
export const RETRY_CAP = 3;

export function parseDateStr(str: string): Date {
  if (!str) return new Date();
  const [y, m, d] = str.split("-").map((p) => parseInt(p, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
export function formatDateNice(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")} ${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
}

export function monthsBetween(startStr: string, endStr: string): number {
  const a = parseDateStr(startStr);
  const b = parseDateStr(endStr);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * Occurrence dates are anchored on `startStr` (the Subscription's own start date — i.e. the
 * First Collection Date, not the Mandate's commencesOn), with the recurring day-of-month
 * derived from that same date rather than a separate field. See Order Model, Subscription
 * section: `day_of_month_anchor` is derived from `subscription_start_date`.
 */
export function occurrenceBaseDate(startStr: string, freq: DDFrequency, i: number): Date {
  const base = parseDateStr(startStr);
  if (freq === "Daily") {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    return d;
  }
  if (freq === "Weekly") {
    const d = new Date(base);
    d.setDate(d.getDate() + i * 7);
    return d;
  }
  const step = FREQ_MONTHS[freq] || 1;
  return new Date(base.getFullYear(), base.getMonth() + Math.round(step) * i, base.getDate());
}

export interface OccurrenceOverride {
  date?: string;
  amount?: number;
}

export interface BuiltOccurrence {
  seq: number;
  date: Date;
  amount: number;
}

export interface BuildOccurrencesParams {
  anchorDate: string; // Subscription start (First Collection Date)
  endDate: string; // Subscription end (mirrors mandate.expiresOn for now)
  frequency: DDFrequency;
  installment: number;
  amountType: DDAmountType;
  overrides: Record<number, OccurrenceOverride>;
}

export function buildOccurrenceSchedule({
  anchorDate,
  endDate,
  frequency,
  installment,
  amountType,
  overrides,
}: BuildOccurrencesParams): { list: BuiltOccurrence[]; trueCount: number; displayCount: number } {
  const totalMonths = monthsBetween(anchorDate, endDate);
  const freqMonths = FREQ_MONTHS[frequency] || 1;
  let trueCount: number;
  if (frequency === "One Time Only") trueCount = 1;
  else trueCount = Math.max(1, Math.floor(totalMonths / freqMonths) + 1);
  const displayCount = Math.min(trueCount, 24);

  const list: BuiltOccurrence[] = [];
  for (let i = 0; i < displayCount; i++) {
    const seq = i + 1;
    const base = occurrenceBaseDate(anchorDate, frequency, i);
    const override = overrides[seq] || {};
    const date = override.date ? parseDateStr(override.date) : base;
    const amount = amountType === "Variable" && override.amount != null ? override.amount : installment;
    list.push({ seq, date, amount });
  }
  return { list, trueCount, displayCount };
}

/** Collection frequencies no more frequent than the contract's payment frequency ceiling. */
export function collectionFrequencyOptions(ceiling: DDFrequency): DDFrequency[] {
  return DD_FREQUENCIES.filter((f) => FREQ_MONTHS[f] >= FREQ_MONTHS[ceiling]);
}

// ---- DDS frequency table (Backend Stories S1 §5.2 / S2 V8 — DDS-confirmed 24-Sep-2026) ----
//
// DDS enforces a minimum number of days between two SUCCESSFUL debits on one mandate, based on the
// mandate's paymentFrequency (our frequencyCeiling), counted from the ACTUAL DEBIT DATE of the
// previous claim — not its due date. E.g. Monthly debited 15 Sep → next claim no earlier than
// 8 Oct (15 Sep + 23). Backend stores this as configuration (GET /direct-debit/v1/frequencies).
export interface DDSFrequencyRule {
  frequency: DDFrequency;
  rank: number; // 1 = most frequent
  periodDays: number | null;
  minGapDays: number | null; // null = not applicable (One Time Only)
}

export const DDS_FREQUENCY_TABLE: DDSFrequencyRule[] = [
  { frequency: "Daily", rank: 1, periodDays: 1, minGapDays: 0 },
  { frequency: "Weekly", rank: 2, periodDays: 7, minGapDays: 4 },
  { frequency: "Monthly", rank: 3, periodDays: 30, minGapDays: 23 },
  { frequency: "Every Two Months", rank: 4, periodDays: 60, minGapDays: 50 },
  { frequency: "Quarterly", rank: 5, periodDays: 90, minGapDays: 80 },
  { frequency: "Every Four Months", rank: 6, periodDays: 120, minGapDays: 100 },
  { frequency: "Half-yearly", rank: 7, periodDays: 180, minGapDays: 160 },
  { frequency: "Annually", rank: 8, periodDays: 360, minGapDays: 330 },
  { frequency: "One Time Only", rank: 9, periodDays: null, minGapDays: null },
];

/** Minimum days between two successful debits for a mandate with this payment frequency
 *  (the CONTRACT's frequencyCeiling — not the subscription's collection frequency). */
export function minGapDays(paymentFrequency: DDFrequency): number {
  return DDS_FREQUENCY_TABLE.find((r) => r.frequency === paymentFrequency)?.minGapDays ?? 0;
}

// ---- Dates: "today" in UAE time, working days (added 25-Sep-2026) ----

/** Today's date in UAE time (Asia/Dubai), as a local-midnight Date. Computed from the UAE
 *  calendar date rather than the browser's/server's own timezone so the server-rendered HTML and
 *  the client agree (avoids a hydration mismatch in the 4h/day when UTC and UAE dates differ). */
export function ddToday(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parseDateStr(parts);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function diffDays(a: Date, b: Date): number {
  // whole days from a to b (b - a), DST-safe via UTC
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

/** UAE weekend is Saturday + Sunday. Public holidays live in the Backend's UAE working-day
 *  calendar (S1 §5.3) — not modelled in this prototype. */
export function isWorkingDay(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

export function previousWorkingDay(d: Date): Date {
  let x = addDays(d, -1);
  while (!isWorkingDay(x)) x = addDays(x, -1);
  return x;
}

export function nextWorkingDayOnOrAfter(d: Date): Date {
  let x = new Date(d);
  while (!isWorkingDay(x)) x = addDays(x, 1);
  return x;
}

export function addWorkingDays(d: Date, n: number): Date {
  let x = new Date(d);
  let added = 0;
  while (added < n) {
    x = addDays(x, 1);
    if (isWorkingDay(x)) added++;
  }
  return x;
}

/** Parses the "05 Sep 2026" display format used throughout mock data. */
export function parseNiceDate(str: string): Date {
  const m = str.match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4})/);
  if (!m) return new Date(NaN);
  const month = MONTH_LABELS.indexOf(m[2]);
  return new Date(parseInt(m[3], 10), month, parseInt(m[1], 10));
}

// ---- TBFC (To Be Filled By Customer) helpers (added Sep 2026) ----

/** Shown wherever the DDS mandate reference or instrument would normally appear, for a
 *  contract still in the `awaiting_customer_instrument` stage — Create DDA hasn't been called
 *  yet, so DDS has issued nothing to show. See Notes/Projects/Direct Debit.md, TBFC section. */
export const PENDING_INSTRUMENT_REF_LABEL = "Not yet issued — awaiting customer details";

export function formatMoneyAED(amount: number): string {
  return `AED ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---- Rollover (reworked 25-Sep-2026) ----
//
// Manual rollover of Skipped collections (Rollover button, destination picker, Undo rollover) is
// OUT of MVP scope — Backend Stories S7, "Out of MVP scope" — and was removed from the prototype.
// Only AUTOMATIC rollover remains (S6 §3): when a collection becomes final Failed, or is Skipped by
// the minimum-gap safety net, its amount is added to the next Scheduled collection, subject to the
// max_amount ceiling and the consecutive-streak limit below. The prototype only DISPLAYS its
// outcome (rolledOver on each occurrence); the Backend runs it.

/** How many rollovers are active in the current streak — occurrences marked `rolled_over` since
 *  the most recent Paid one (S6 §3.1 rule 2). Resets whenever any collection is Paid. */
export function rolloverStreakUsed(occurrences: DirectDebitOccurrence[]): number {
  const lastPaidSeq = occurrences.reduce((max, o) => (o.status === "Paid" && o.seq > max ? o.seq : max), 0);
  return occurrences.filter((o) => o.seq > lastPaidSeq && o.rolledOver === "rolled_over").length;
}

// ---- New-contract helpers (added Sep 2026 — real Create & Send Contract flow) ----

/** Next sequential contract reference, one higher than the highest existing `DD-YYYY-#####`
 *  ref in the current year — mirrors the numbering already used across `dd1`-`dd10` in
 *  mock-data.ts (descending by recency, e.g. DD-2026-00142 is the most recent). */
export function nextContractRef(existing: { ref: string }[]): string {
  const year = new Date().getFullYear();
  const maxNum = existing.reduce((max, c) => {
    const m = c.ref.match(/DD-\d{4}-(\d+)/);
    const n = m ? parseInt(m[1], 10) : 0;
    return Math.max(max, n);
  }, 0);
  return `DD-${year}-${String(maxNum + 1).padStart(5, "0")}`;
}

/** Masks a raw IBAN or card number down to its last 4 digits, matching the "•••1095" style
 *  already used throughout mock-data.ts's `maskedInstrumentRef`. */
export function maskInstrumentRef(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const last4 = digits.slice(-4) || "0000";
  return `•••${last4}`;
}

/** "createdOn" timestamp in the same "28 Aug 2026, 10:15 AM" format used throughout mock data. */
export function formatCreatedOn(d: Date): string {
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${formatDateNice(d)}, ${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
}

// ---- Reason codes (added 25-Sep-2026) ----

/** DDS paid / not-paid reason codes with plain labels — Backend Stories S5 §3.3. */
export const DDS_REASON_CODES: Record<string, string> = {
  "0": "Paid in full",
  "1": "Partly paid",
  A: "Account closed",
  C: "Compliance issue",
  D: "Account holder deceased",
  E: "Card blocked",
  F: "Card expired",
  G: "Card cancelled",
  I: "Insufficient funds",
  L: "Card limit exceeded",
  M: "Refused at originator's request",
  N: "Dormant account",
  O: "Mandate cancelled",
  P: "Not honoured — customer to contact bank",
  R: "Details don't match mandate",
  S: "Payment stopped by customer",
  T: "Technical issue at customer's bank",
  U: "Amount not yet due",
  V: "Account closed (authority)",
  W: "Account closed (bank compliance)",
  X: "Account blocked (court)",
  Y: "Account blocked (law enforcement)",
  Z: "Account blocked (Central Bank)",
};

/** Terminal payment reason codes — Backend Stories S1 §5.5. The mandate can never be collected
 *  again: the collection goes straight to Failed (no retry, no rollover) and the contract is
 *  closed locally as "Cancelled — <reason>" (S6 §2.1). Held as configuration in the Backend. */
export const TERMINAL_REASON_CODES = ["A", "D", "E", "F", "G", "O", "V", "W", "X", "Y", "Z"] as const;

export function isTerminalReasonCode(code?: string): boolean {
  return !!code && (TERMINAL_REASON_CODES as readonly string[]).includes(code);
}

export function reasonLabel(code?: string): string {
  if (!code) return "";
  return DDS_REASON_CODES[code] ?? `Reason ${code}`;
}

/** "Cancelled — Account closed" (Mandate.status_label for a terminal-refusal closure). */
export function contractStatusLabel(c: Pick<DirectDebitContract, "status" | "closureReasonCode">): string {
  if (c.status === "Cancelled" && c.closureReasonCode) return `Cancelled — ${reasonLabel(c.closureReasonCode)}`;
  return c.status;
}

// ---- Retry deadline (Backend Stories S6 §1.2) ----
//
//   retry_deadline = next collection's due date − minimum gap days − 1 working day
//
// A successful retry is a debit, so DDS's minimum gap is counted from it. Retries must stop early
// enough that even a retry that succeeds still leaves the gap before the next collection.
//  - Next collection = next Occurrence in the same subscription (any status except Cancelled);
//    for the last collection, use the mandate's expires_on instead.
//  - Minimum gap = from the DDS frequency table, using the MANDATE's payment_frequency.
//  - −1 working day because DDS processes a representment on the next working day. If the result
//    lands on a non-working day, move it back to the previous working day.
// Examples (S6): Monthly 1 Sep → next 1 Oct → 7 Sep. Monthly 1 Feb → next 1 Mar → 5 Feb.
// Weekly Mon 7 Sep → next Mon 14 Sep → Wed 9 Sep.
export function retryDeadline(
  contract: Pick<DirectDebitContract, "frequency" | "expiresOn">,
  occurrences: DirectDebitOccurrence[],
  seq: number
): Date | null {
  const gap = minGapDays(contract.frequency);
  const next = occurrences
    .filter((o) => o.seq > seq && o.status !== "Cancelled")
    .sort((a, b) => a.seq - b.seq)[0];
  const anchor = next ? parseNiceDate(next.dueDate) : parseNiceDate(contract.expiresOn);
  if (isNaN(anchor.getTime())) return null;
  // "− 1 working day" = step back to the previous working day (which also covers the
  // "if it lands on a non-working day, move it back" rule).
  return previousWorkingDay(addDays(anchor, -gap));
}

export type RetryBlockedReason =
  | "ACTION_NOT_ALLOWED"
  | "NOT_RETRYABLE"
  | "TERMINAL_REASON"
  | "RETRY_IN_PROGRESS"
  | "RETRIES_EXHAUSTED"
  | "RETRY_WINDOW_CLOSED"
  | "CONTRACT_NOT_ACTIVE"
  | "SUBSCRIPTION_PAUSED";

/** S6 §1.1 — every check the Backend runs before accepting a retry, in the same order, so the
 *  portal can disable the button with the matching reason instead of letting it fail. */
export function retryEligibility(
  contract: Pick<DirectDebitContract, "status" | "frequency" | "expiresOn">,
  subscriptionStatus: DDSubscriptionStatus,
  occurrences: DirectDebitOccurrence[],
  o: DirectDebitOccurrence,
  allowRetryToggle: boolean,
  today: Date = ddToday()
): { allowed: boolean; reason?: RetryBlockedReason; deadline: Date | null } {
  const deadline = retryDeadline(contract, occurrences, o.seq);
  if (!allowRetryToggle) return { allowed: false, reason: "ACTION_NOT_ALLOWED", deadline };
  if (o.paymentStatus === "RPND") return { allowed: false, reason: "RETRY_IN_PROGRESS", deadline };
  if (o.status !== "Rejected") return { allowed: false, reason: "NOT_RETRYABLE", deadline };
  if (isTerminalReasonCode(o.reasonCode)) return { allowed: false, reason: "TERMINAL_REASON", deadline };
  if ((o.retryCount ?? 0) >= RETRY_CAP) return { allowed: false, reason: "RETRIES_EXHAUSTED", deadline };
  if (deadline && diffDays(today, deadline) < 0) return { allowed: false, reason: "RETRY_WINDOW_CLOSED", deadline };
  if (contract.status !== "Active") return { allowed: false, reason: "CONTRACT_NOT_ACTIVE", deadline };
  if (subscriptionStatus === "Paused") return { allowed: false, reason: "SUBSCRIPTION_PAUSED", deadline };
  return { allowed: true, deadline };
}

export const RETRY_BLOCKED_TEXT: Record<RetryBlockedReason, string> = {
  ACTION_NOT_ALLOWED: "Retry is switched off for this merchant (allow_retry_collection = false).",
  NOT_RETRYABLE: "Only a Rejected collection can be retried.",
  TERMINAL_REASON: "Terminal refusal reason — a retry cannot help. The contract has been closed.",
  RETRY_IN_PROGRESS: "A retry is already with DDS (Representment Pending).",
  RETRIES_EXHAUSTED: `All ${RETRY_CAP} retries have been used.`,
  RETRY_WINDOW_CLOSED: "The retry deadline has passed — a later retry could break DDS's minimum gap before the next collection.",
  CONTRACT_NOT_ACTIVE: "The contract is not Active.",
  SUBSCRIPTION_PAUSED: "The subscription is paused — resume it first.",
};

// ---- Schedule amend validation (Backend Stories S7 §2.2, rules A0–A13) ----

export interface AmendChange {
  seq: number;
  newDueDate?: string; // YYYY-MM-DD
  newAmount?: number;
}

export interface AmendError {
  seq: number | null; // null = whole-request error
  code: string;
  message: string;
}

/** 18:45 on the day before the due date — after that the 19:00 payment-file job may already be
 *  picking the collection up (S7 lock rule, A4). */
export function isCollectionLocked(dueDate: Date, now: Date = new Date()): boolean {
  const lock = addDays(dueDate, -1);
  lock.setHours(18, 45, 0, 0);
  return now.getTime() >= lock.getTime();
}

export function isAmendable(o: DirectDebitOccurrence, now: Date = new Date()): boolean {
  return o.status === "Scheduled" && !isCollectionLocked(parseNiceDate(o.dueDate), now);
}

/** Applies every change to a COPY of the schedule, then checks the resulting schedule — so
 *  changes that are only valid together (move Oct later AND Nov later) pass together. Returns
 *  all failures tagged by collection; the caller saves nothing if any exist (all-or-nothing). */
export function validateAmend(
  contract: Pick<DirectDebitContract, "amountType" | "minAmount" | "maxAmount" | "commencesOn" | "expiresOn" | "frequency" | "status">,
  subscriptionStatus: DDSubscriptionStatus,
  occurrences: DirectDebitOccurrence[],
  changes: AmendChange[],
  allowEditToggle: boolean,
  today: Date = ddToday(),
  now: Date = new Date()
): { errors: AmendError[]; result: DirectDebitOccurrence[] } {
  const errors: AmendError[] = [];
  const gap = minGapDays(contract.frequency);

  if (!allowEditToggle) errors.push({ seq: null, code: "ACTION_NOT_ALLOWED", message: "Amending collections is switched off for this merchant (allow_edit_collection = false)." });
  if (contract.status !== "Active" || subscriptionStatus === "Cancelled")
    errors.push({ seq: null, code: "CONTRACT_NOT_ACTIVE", message: "The contract must be Active and the subscription Active or Paused." });
  const ids = changes.map((c) => c.seq);
  if (new Set(ids).size !== ids.length) errors.push({ seq: null, code: "INVALID_COLLECTION", message: "Each collection can appear only once." });

  const result = occurrences.map((o) => ({ ...o }));
  const commences = parseNiceDate(contract.commencesOn);
  const expires = parseNiceDate(contract.expiresOn);

  for (const ch of changes) {
    const o = result.find((x) => x.seq === ch.seq);
    if (!o) {
      errors.push({ seq: ch.seq, code: "INVALID_COLLECTION", message: "Not a collection of this subscription." });
      continue;
    }
    const original = occurrences.find((x) => x.seq === ch.seq)!;
    if (original.status !== "Scheduled") {
      errors.push({ seq: ch.seq, code: "COLLECTION_NOT_EDITABLE", message: "Only a Scheduled collection that hasn't been sent to DDS can be amended." });
      continue;
    }
    if (isCollectionLocked(parseNiceDate(original.dueDate), now)) {
      errors.push({ seq: ch.seq, code: "COLLECTION_LOCKED", message: "Locked — it's past 18:45 on the day before this collection is due." });
      continue;
    }
    const dateChanged = !!ch.newDueDate && ch.newDueDate !== toDateInputValue(parseNiceDate(original.dueDate));
    const amountChanged = ch.newAmount != null && ch.newAmount !== original.amount;
    if (!dateChanged && !amountChanged) {
      errors.push({ seq: ch.seq, code: "NOTHING_TO_CHANGE", message: "Enter a new date or amount different from the current one." });
      continue;
    }
    if (amountChanged && contract.amountType === "Fixed") {
      errors.push({ seq: ch.seq, code: "FIXED_AMOUNT_NOT_EDITABLE", message: "Fixed-amount contract — only the date can change." });
    }
    if (amountChanged && (ch.newAmount! < contract.minAmount || ch.newAmount! > contract.maxAmount)) {
      errors.push({
        seq: ch.seq,
        code: "AMOUNT_OUT_OF_RANGE",
        message: `Amount must be between ${formatMoneyAED(contract.minAmount)} and ${formatMoneyAED(contract.maxAmount)}.`,
      });
    }
    if (dateChanged) {
      const nd = parseDateStr(ch.newDueDate!);
      if (nd < commences || nd > expires || diffDays(today, nd) < 2) {
        errors.push({
          seq: ch.seq,
          code: "DATE_OUTSIDE_CONTRACT",
          message: `Date must be inside the contract period (${contract.commencesOn} – ${contract.expiresOn}) and at least 2 days from today.`,
        });
      }
      o.dueDate = formatDateNice(nd);
    }
    if (amountChanged && contract.amountType !== "Fixed") o.amount = ch.newAmount!;
  }

  // Resulting-schedule checks (A9–A11), using the NEW neighbours.
  const live = result.filter((o) => o.status !== "Cancelled").sort((a, b) => a.seq - b.seq);
  const changed = new Set(changes.map((c) => c.seq));
  for (let i = 0; i < live.length; i++) {
    const o = live[i];
    if (!changed.has(o.seq)) continue;
    const d = parseNiceDate(o.dueDate);
    const prev = live[i - 1];
    const next = live[i + 1];
    if ((prev && parseNiceDate(prev.dueDate) >= d) || (next && parseNiceDate(next.dueDate) <= d)) {
      errors.push({ seq: o.seq, code: "DATE_ORDER", message: "Dates must stay in order — after the previous collection and before the next one." });
      continue;
    }
    if (prev) {
      // Reference = actual debit date if Paid (collectedOn), else the previous due date.
      const ref = prev.status === "Paid" && prev.collectedOn ? parseNiceDate(prev.collectedOn) : parseNiceDate(prev.dueDate);
      if (diffDays(ref, d) < gap) {
        errors.push({
          seq: o.seq,
          code: "GAP_FROM_PREVIOUS",
          message: `Only ${diffDays(ref, d)} days after #${prev.seq} (${formatDateNice(ref)}) — DDS needs at least ${gap} days for a ${contract.frequency} mandate.`,
        });
      }
    }
    if (next) {
      const nd = parseNiceDate(next.dueDate);
      const from = nextWorkingDayOnOrAfter(d);
      if (diffDays(from, nd) < gap) {
        errors.push({
          seq: o.seq,
          code: "GAP_TO_NEXT",
          message: `#${next.seq} (${next.dueDate}) would be only ${diffDays(from, nd)} days later — needs at least ${gap}. Move #${next.seq} too, in the same save.`,
        });
      }
    }
  }

  // A12 — a Rejected collection still inside its retry window must not lose that window because
  // the collection after it moved earlier.
  for (const o of occurrences) {
    if (o.status !== "Rejected") continue;
    const before = retryDeadline(contract, occurrences, o.seq);
    const after = retryDeadline(contract, result, o.seq);
    if (before && after && diffDays(today, before) >= 0 && diffDays(today, after) < 0) {
      const culprit = result.filter((x) => x.seq > o.seq && x.status !== "Cancelled").sort((a, b) => a.seq - b.seq)[0];
      errors.push({
        seq: culprit ? culprit.seq : null,
        code: "SHORTENS_PREVIOUS_RETRY_WINDOW",
        message: `Moving this earlier would close #${o.seq}'s retry window before today (Rejected, retry deadline ${formatDateNice(before)}).`,
      });
    }
  }

  return { errors, result };
}

// ---- Masking for the customer verification screen (added 25-Sep-2026) ----

/** 0501234567 → 05•••••567 */
export function maskMobile(mobile: string): string {
  const d = mobile.replace(/\D/g, "");
  if (d.length < 5) return "•••";
  return `${d.slice(0, 2)}${"•".repeat(Math.max(3, d.length - 5))}${d.slice(-3)}`;
}

/** sara.ibrahim@example.com → sa••••••••@ex•••••.com */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  const [host, ...tld] = domain.split(".");
  const mu = user.slice(0, 2) + "•".repeat(Math.max(3, user.length - 2));
  const mh = host.slice(0, 2) + "•".repeat(Math.max(3, host.length - 2));
  return `${mu}@${mh}${tld.length ? "." + tld.join(".") : ""}`;
}

/** 784-1990-1234567-1 → 784-••••-•••••67-1 (keeps the 784 prefix and last 3 digits). */
export function maskEmiratesId(eid: string): string {
  const d = eid.replace(/\D/g, "");
  if (d.length !== 15) return "784-••••-•••••••-•";
  return `${d.slice(0, 3)}-••••-•••••${d.slice(12, 14)}-${d.slice(14)}`;
}

// ---- Automatic rollover + retry state transitions (prototype, added 25-Sep-2026) ----

/** S6 §3.1 — runs when a collection becomes final Failed (or min_gap Skipped). Returns a new
 *  occurrences array with the outcome applied to the source (rolledOver) and destination. */
export function applyAutomaticRollover(
  contract: Pick<DirectDebitContract, "rolloverEnabled" | "rolloversAllowed" | "maxAmount">,
  occurrences: DirectDebitOccurrence[],
  seq: number
): DirectDebitOccurrence[] {
  if (!contract.rolloverEnabled) return occurrences;
  const next = occurrences.map((o) => ({ ...o }));
  const src = next.find((o) => o.seq === seq);
  if (!src) return occurrences;
  const dest = next.filter((o) => o.seq > seq && o.status === "Scheduled").sort((a, b) => a.seq - b.seq)[0];
  if (!dest) {
    src.rolledOver = "no_destination";
    return next;
  }
  if (rolloverStreakUsed(next) >= contract.rolloversAllowed) {
    src.rolledOver = "exhausted";
    return next;
  }
  if (dest.amount + src.amount > contract.maxAmount) {
    src.rolledOver = "blocked_by_ceiling";
    return next;
  }
  dest.originalAmount = dest.originalAmount ?? dest.amount;
  dest.amount = dest.amount + src.amount;
  dest.amountSource = "rollover_adjusted";
  dest.rolledOverFrom = [...(dest.rolledOverFrom ?? []), src.seq];
  src.rolledOver = "rolled_over";
  return next;
}

/** Merchant pressed Retry → Payment Representment accepted by DDS (S6 §1.3). */
export function applyRetrySubmitted(occurrences: DirectDebitOccurrence[], seq: number): DirectDebitOccurrence[] {
  return occurrences.map((o) => {
    if (o.seq !== seq) return o;
    const n = (o.retryCount ?? 0) + 1;
    return {
      ...o,
      retryCount: n,
      status: "Submitted",
      paymentStatus: "RPND",
      note: `Retry ${n} of ${RETRY_CAP} sent to DDS — Representment Pending`,
    };
  });
}

/** Prototype-only: simulate the DDS result of a retry that's in flight. */
export function applyRetryResult(
  contract: Pick<DirectDebitContract, "rolloverEnabled" | "rolloversAllowed" | "maxAmount">,
  occurrences: DirectDebitOccurrence[],
  seq: number,
  result: "ACCP" | "RJCT"
): DirectDebitOccurrence[] {
  const today = formatDateNice(ddToday());
  let next = occurrences.map((o) => {
    if (o.seq !== seq) return o;
    if (result === "ACCP")
      return { ...o, status: "Paid" as const, paymentStatus: undefined, reasonCode: "0", collectedOn: today, payoutStatus: "Pending settlement", note: `Paid on retry ${o.retryCount ?? 0} of ${RETRY_CAP}` };
    const n = o.retryCount ?? 0;
    if (n >= RETRY_CAP)
      return { ...o, status: "Failed" as const, paymentStatus: undefined, note: `Final — ${RETRY_CAP} of ${RETRY_CAP} retries used (F1)` };
    return { ...o, status: "Rejected" as const, paymentStatus: undefined, note: `Rejected again after retry ${n} of ${RETRY_CAP}` };
  });
  const after = next.find((o) => o.seq === seq);
  if (after?.status === "Failed") next = applyAutomaticRollover(contract, next, seq);
  return next;
}

/** Id for a contract created in this browser (time-based, like the original dd${Date.now()}). */
export function newContractId(): string {
  return `dd${Date.now()}`;
}
