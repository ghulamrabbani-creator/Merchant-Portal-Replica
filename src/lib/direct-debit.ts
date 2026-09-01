import { DD_FREQUENCIES, DDAmountType, DDFrequency } from "./types";

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
