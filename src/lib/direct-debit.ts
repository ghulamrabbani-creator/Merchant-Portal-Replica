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

export type RolloverBlockedReason =
  | "exhausted"
  | "blocked_by_ceiling"
  | "no_future_occurrence"
  | "rollover_disabled"
  | "subscription_paused";

export interface RolloverEligibility {
  allowed: boolean;
  reason?: RolloverBlockedReason;
}

export interface RolloverDestinationOption {
  seq: number;
  dueDate: string;
  resultingAmount: number;
  wouldBreachCeiling: boolean;
}

/** Every upcoming occurrence `seq` COULD roll onto right now, in schedule order, each flagged
 *  with whether picking it would push its amount past `maxAmount`. Only `Scheduled` occurrences
 *  qualify as a destination — a Skipped or Failed occurrence isn't collectible either, so folding
 *  onto one of those would just recreate the laddering problem this exists to avoid (merchant
 *  feedback, reference contract DD-2026-00085: hardcoding the destination to `seq + 1` meant a
 *  Skipped occurrence often rolled onto another Skipped occurrence, chaining through several
 *  months and hitting `maxAmount` before reaching anything collectible). See Direct Debit.md,
 *  "Skipped occurrences & manual rollover." */
export function rolloverDestinationOptions(
  contract: Pick<DirectDebitContract, "maxAmount">,
  occurrences: DirectDebitOccurrence[],
  seq: number
): RolloverDestinationOption[] {
  const source = occurrences.find((o) => o.seq === seq);
  if (!source) return [];
  return occurrences
    .filter((o) => o.seq > seq && o.status === "Scheduled")
    .sort((a, b) => a.seq - b.seq)
    .map((dest) => ({
      seq: dest.seq,
      dueDate: dest.dueDate,
      resultingAmount: dest.amount + source.amount,
      wouldBreachCeiling: dest.amount + source.amount > contract.maxAmount,
    }));
}

/** Whether the occurrence at `seq` can be rolled over right now — used both for the automatic
 *  Failed-occurrence path and the manual Skipped-occurrence Rollover button. Checks, in order:
 *  rollover is enabled on the contract at all; the subscription isn't currently Paused (rolling
 *  onto an occurrence while still paused risks folding onto one that itself gets marked Skipped
 *  before the merchant Resumes — the merchant should pick a destination only once the schedule is
 *  live again); the current consecutive streak hasn't used up `rolloversAllowed`; and at least
 *  one upcoming `Scheduled` occurrence exists that wouldn't breach `maxAmount`.
 *
 *  Pass `destSeq` to validate one SPECIFIC chosen destination (from `rolloverDestinationOptions`)
 *  instead of asking "does any valid destination exist" — this is the guard `handleRollover`
 *  re-runs right before committing, since the merchant picks the destination from a dropdown. */
export function canRolloverOccurrence(
  contract: Pick<DirectDebitContract, "rolloverEnabled" | "rolloversAllowed" | "maxAmount">,
  subscriptionStatus: DDSubscriptionStatus,
  occurrences: DirectDebitOccurrence[],
  seq: number,
  destSeq?: number
): RolloverEligibility {
  if (!contract.rolloverEnabled) return { allowed: false, reason: "rollover_disabled" };
  if (subscriptionStatus === "Paused") return { allowed: false, reason: "subscription_paused" };

  const used = rolloverStreakUsed(occurrences, seq);
  if (used >= contract.rolloversAllowed) return { allowed: false, reason: "exhausted" };

  const options = rolloverDestinationOptions(contract, occurrences, seq);
  if (options.length === 0) return { allowed: false, reason: "no_future_occurrence" };

  if (destSeq != null) {
    const chosen = options.find((o) => o.seq === destSeq);
    if (!chosen) return { allowed: false, reason: "no_future_occurrence" };
    if (chosen.wouldBreachCeiling) return { allowed: false, reason: "blocked_by_ceiling" };
    return { allowed: true };
  }

  if (options.every((o) => o.wouldBreachCeiling)) return { allowed: false, reason: "blocked_by_ceiling" };
  return { allowed: true };
}

/** Whether a previously-applied rollover on `seq` can still be undone — only while its
 *  destination occurrence hasn't itself been submitted yet (Order Model: `payment_created`
 *  locks an occurrence from further amount/date edits the instant a Payment row exists for
 *  it). Scheduled AND Skipped both mean "no Payment row was ever created for this occurrence"
 *  — a Skipped destination just means the pause is still going and the combined amount hasn't
 *  had a chance to be collected yet, which is exactly the case a rollover chain (one Skipped
 *  occurrence rolling onto the next) produces. Only Paid/Failed means it was actually
 *  submitted, which is when it locks.
 *
 *  Deliberately independent of `Subscription.status`: unlike initiating a new rollover (blocked
 *  while Paused, see `canRolloverOccurrence`), undoing one just reverses the merchant's own prior
 *  choice and doesn't depend on the schedule being live — so Undo stays available even while the
 *  subscription is Paused. */
export function canUndoRollover(occurrences: DirectDebitOccurrence[], seq: number): boolean {
  const dest = occurrences.find((o) => o.rolledOverFrom === seq);
  if (!dest) return false;
  return dest.status === "Scheduled" || dest.status === "Skipped";
}
