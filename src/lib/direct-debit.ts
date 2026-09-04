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

/** How many rollovers are currently active on this subscription — i.e. how many occurrences are
 *  flagged `rolled_over` since the most recent Paid occurrence (by sequence number). Resets the
 *  moment ANY occurrence on the subscription is collected in full, per the agreed Sep 2026
 *  mechanics ("a successful collection clears whatever had stacked up") — deliberately global,
 *  not scoped to one particular rollover chain, even once a merchant-chosen destination means two
 *  unrelated rollovers can be in flight toward two different future occurrences at once.
 *
 *  CHANGED Sep 2026 (bug found by Rabbani testing DD-2026-00085): this used to walk backward
 *  through PHYSICALLY ADJACENT sequence numbers immediately preceding a given occurrence, which
 *  only worked because rollovers always used to chain onto `seq + 1`. Once the merchant can pick
 *  any upcoming Scheduled occurrence as the destination (see canRolloverOccurrence below), that
 *  adjacency assumption breaks — rolling #2 onto #6 and #3 onto #5 are two independent rollovers
 *  that an adjacency walk starting from #3 would never see #2 through (their destinations aren't
 *  next to each other), so the old function silently undercounted and let more rollovers through
 *  than `rolloversAllowed` permits. Counting every currently-unresolved `rolled_over` flag since
 *  the last Paid occurrence — regardless of which destination each one targets — is what actually
 *  matches the documented "consecutive-streak-with-reset" rule now that destinations are free-form. */
export function rolloverStreakUsed(occurrences: DirectDebitOccurrence[]): number {
  const lastPaidSeq = occurrences.reduce((max, o) => (o.status === "Paid" && o.seq > max ? o.seq : max), 0);
  return occurrences.filter((o) => o.seq > lastPaidSeq && o.rolledOver === "rolled_over").length;
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

  const used = rolloverStreakUsed(occurrences);
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
 *  subscription is Paused.
 *
 *  `rolledOverFrom` is an array (changed Sep 2026) since a destination can now receive more than
 *  one source — find the destination that has THIS seq among its sources, not the single field a
 *  seq+1-only world used to allow. */
export function canUndoRollover(occurrences: DirectDebitOccurrence[], seq: number): boolean {
  const dest = occurrences.find((o) => (o.rolledOverFrom ?? []).includes(seq));
  if (!dest) return false;
  return dest.status === "Scheduled" || dest.status === "Skipped";
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
