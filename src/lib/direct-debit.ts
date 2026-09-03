import { DD_FREQUENCIES, DDAmountType, DDFrequency, DirectDebitContract, DirectDebitOccurrence } from "./types";

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

const MONTH_LABELS = [
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

/** Minimum day-gap a moved due date must keep from its neighbors, given the collection frequency. */
export function minGapDays(frequency: DDFrequency): number {
  return Math.max(1, Math.round((FREQ_MONTHS[frequency] || 1) * 30) - 4);
}

export function formatMoneyAED(amount: number): string {
  return `AED ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---- Rollover eligibility (added Sep 2026 — manual rollover for Skipped occurrences) ----
//
// rolloversAllowed caps how many times in a row an occurrence's amount can fold onto the next
// one before the combined total risks breaching the contract's max_amount — it is NOT a
// lifetime budget for the whole contract (see Direct Debit.md: max_amount is sized to cover
// "regular installment × rollovers permitted", i.e. a single worst-case stack, not a running
// total across the contract's life). So the count of rollovers "used" is the length of the
// unbroken run of rolled-over occurrences immediately preceding this one — it resets the
// moment any occurrence on the subscription is actually collected (Paid), because a
// successful collection clears whatever had stacked up.

/** How many CONSECUTIVE rollovers have already been used in the run leading up to (but not
 *  including) `beforeSeq` — walks backward until it hits a Paid occurrence or the start of the
 *  schedule. A Paid occurrence breaks the streak; anything else that isn't itself rolled-over
 *  also breaks it (there's nothing to chain). */
export function rolloverStreakUsed(occurrences: DirectDebitOccurrence[], beforeSeq: number): number {
  let used = 0;
  for (let seq = beforeSeq - 1; seq >= 1; seq--) {
    const o = occurrences.find((x) => x.seq === seq);
    if (!o) break;
    if (o.status === "Paid") break;
    if (o.rolledOver === "rolled_over") {
      used++;
      continue;
    }
    break;
  }
  return used;
}

export type RolloverBlockedReason = "exhausted" | "blocked_by_ceiling" | "no_future_occurrence" | "rollover_disabled";

export interface RolloverEligibility {
  allowed: boolean;
  reason?: RolloverBlockedReason;
}

/** Whether the occurrence at `seq` can have its amount rolled onto the next occurrence right
 *  now — used both for the automatic Failed-occurrence path and the manual Skipped-occurrence
 *  Rollover button. Checks, in order: a future occurrence exists to receive it; rollover is
 *  enabled on the contract at all; the current consecutive streak hasn't used up
 *  `rolloversAllowed`; and folding the amount forward wouldn't push the destination past
 *  `maxAmount`. */
export function canRolloverOccurrence(
  contract: Pick<DirectDebitContract, "rolloverEnabled" | "rolloversAllowed" | "maxAmount">,
  occurrences: DirectDebitOccurrence[],
  seq: number
): RolloverEligibility {
  const source = occurrences.find((o) => o.seq === seq);
  const dest = occurrences.find((o) => o.seq === seq + 1);
  if (!source || !dest) return { allowed: false, reason: "no_future_occurrence" };
  if (!contract.rolloverEnabled) return { allowed: false, reason: "rollover_disabled" };

  const used = rolloverStreakUsed(occurrences, seq);
  if (used >= contract.rolloversAllowed) return { allowed: false, reason: "exhausted" };

  if (dest.amount + source.amount > contract.maxAmount) {
    return { allowed: false, reason: "blocked_by_ceiling" };
  }
  return { allowed: true };
}

/** Whether a previously-applied rollover on `seq` can still be undone — only while its
 *  destination occurrence hasn't itself been submitted yet (Order Model: `payment_created`
 *  locks an occurrence from further amount/date edits the instant a Payment row exists for
 *  it). Scheduled AND Skipped both mean "no Payment row was ever created for this occurrence"
 *  — a Skipped destination just means the pause is still going and the combined amount hasn't
 *  had a chance to be collected yet, which is exactly the case a rollover chain (one Skipped
 *  occurrence rolling onto the next) produces. Only Paid/Failed means it was actually
 *  submitted, which is when it locks. */
export function canUndoRollover(occurrences: DirectDebitOccurrence[], seq: number): boolean {
  const dest = occurrences.find((o) => o.rolledOverFrom === seq);
  if (!dest) return false;
  return dest.status === "Scheduled" || dest.status === "Skipped";
}
