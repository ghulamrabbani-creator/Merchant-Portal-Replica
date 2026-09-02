export type TxnStatus =
  | "Pending"
  | "Submitted"
  | "Declined"
  | "Approved"
  | "Completed";

export type TxnType =
  | "Purchase"
  | "Refund"
  | "Purchase reversal"
  | "Refund reversal"
  | "Authorized purchase";

export type Scheme = "Visa" | "Mastercard" | "Jaywan" | "Amex";

export interface Transaction {
  id: string;
  reference: string;
  date: string; // ISO
  store: string;
  paymentMethod: "Online" | "Terminal";
  terminalId: string;
  scheme: Scheme;
  amount: number;
  currency: string;
  tags?: "DCC"[];
  type: TxnType;
  status: TxnStatus;
  cardClass: "Premium" | "Standard";
  cardSegment: "Credit" | "Debit";
  cardOrigin: "Domestic" | "International";
  maskedCard: string;
  approvalCode: string;
  rrn: string;
  commission: number;
  vat: number;
  netAmount: number;
  exchangeRate?: number;
  isDcc?: boolean;
}

export interface Payout {
  id: string;
  date: string;
  store: string;
  iban: string;
  numTransactions: number;
  netPayout: number;
  currency: string;
  grossAmount: number;
  feesDeducted: number;
  refundAndChargeback: number;
}

export type LinkStatus =
  | "Paid"
  | "Preauthorized"
  | "Created"
  | "Expired"
  | "Cancelled";

export interface PaymentLink {
  id: string;
  linkNumber: string;
  customerName: string;
  store: string;
  reference?: string;
  amount: number;
  currency: string;
  creationDate: string;
  status: LinkStatus;
  activationDate: string;
  expiryDate: string;
  language: string;
  phone?: string;
  email?: string;
}

export interface StaticLink {
  id: string;
  linkNumber: string;
  title: string;
  store: string;
  reference?: string;
  amount: number;
  currency: string;
  creationDate: string;
  status: "Expired" | "Active" | "Max Order Reached";
}

export interface RecurringPayment {
  id: string;
  recurringId: string;
  customerName: string;
  store: string;
  reference: string;
  paymentMethod: "Auto-recurring" | "Recurring manually";
  creationDate: string;
  nextPayment: string;
  status: "Active" | "Cancelled" | "AutoCancelled";
}

export interface BulkUpload {
  id: string;
  fileName: string;
  uploadId: string;
  dateAdded: string;
  dateProcessed: string;
  numberOfLinks: number;
  status: "Processed" | "Processing" | "Failed";
}

// ---- Direct Debit ----
// See Notes/Projects/Direct Debit - Order Model.md for the full Mandate -> Subscription ->
// Occurrence -> Payment backend model this UI is a client of. Field names here map to that
// model's Mandate/Subscription/Occurrence rows, simplified/flattened for the replica's mock data.

export const DD_FREQUENCIES = [
  "Daily",
  "Weekly",
  "Monthly",
  "Quarterly",
  "Half-yearly",
  "Annually",
  "One Time Only",
  "Every Two Months",
  "Every Four Months",
] as const;
export type DDFrequency = (typeof DD_FREQUENCIES)[number];

export type DDInstrumentType = "Bank Account" | "Credit Card";
export type DDAmountType = "Fixed" | "Variable";

export type DDContractStatus =
  | "Active"
  | "Pending Customer Sign"
  | "Pending Bank Approval"
  | "Suspended"
  | "Rejected"
  | "Cancelled";

/** Subscription-level only — independent of the Mandate's own DDContractStatus above.
 *  See Notes/Projects/Direct Debit.md, Contract Detail screen §Pause: Pause suspends the
 *  Subscription only, the Mandate stays Active throughout. */
export type DDSubscriptionStatus = "Active" | "Paused";

export type DDOccurrenceStatus = "Paid" | "Failed" | "Scheduled";

/** Tri-state per Order Model `Occurrence.rolled_over`. Set on the occurrence that FAILED and
 *  had its amount folded forward — not on the destination occurrence that received it (that one
 *  is only cross-referenced via `rolledOverFrom`). See Direct Debit.md backlog: "Rolled Over Yes
 *  is on the wrong row." */
export type DDRolloverState = "none" | "rolled_over" | "blocked_by_ceiling";

export interface DirectDebitOccurrence {
  seq: number;
  dueDate: string; // "05 Sep 2026"
  amount: number;
  status: DDOccurrenceStatus;
  rolledOver: DDRolloverState;
  /** Set on the destination occurrence only: seq of the failed occurrence whose amount rolled in here. */
  rolledOverFrom?: number;
  /** Times Payment Representment has been called for this occurrence, capped at 3 (see Order Model `Payment.retry_count`). */
  retryCount?: number;
  payoutStatus?: string; // "Settled" | "Pending settlement" | "—" — Order Model has no dedicated field yet, backend/APEX-derived
  collectedOn?: string;
  note?: string;
}

export interface DirectDebitContract {
  id: string;
  ref: string; // DDS mandate reference shown to the merchant, e.g. DD-2026-00142
  merchantRef: string; // dda_reference_number — merchant-typed, see Order Model
  notes?: string; // Mandate.notes — merchant-only, never shown to the customer
  createdOn: string; // "28 Aug 2026, 10:15 AM"
  customerName: string;
  customerIdType: string; // e.g. "Emirates ID"
  customerIdNumber: string;
  instrumentType: DDInstrumentType;
  bankName?: string; // Bank Account only
  maskedInstrumentRef: string; // masked IBAN or card, e.g. "•••1095"
  commencesOn: string; // "05 Sep 2026" — mandate validity start
  expiresOn: string; // mandate validity end
  frequency: DDFrequency; // contract frequency ceiling
  amountType: DDAmountType;
  minAmount: number;
  maxAmount: number;
  prevDeduction?: { amount: number; date: string; ok: boolean };
  nextDue?: { amount: number; date: string };
  rolloverEnabled: boolean;
  rolloversAllowed: number; // max rollover events over the subscription's life
  rolloverRemaining: number; // counter, decremented only on an actual successful roll
  status: DDContractStatus;
  subscriptionStatus: DDSubscriptionStatus;
  statusNote?: string;
  occurrences: DirectDebitOccurrence[];
  emptyNote?: string;
  cancelledNote?: string;
  pausedNote?: string;
}
