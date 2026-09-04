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

// UAE bank list, per DDS REST API documentation's "Banks Master Table" (Direct Debit
// Marketplace / Central Bank bank registry). Used to populate the bank-selection dropdown
// on contract creation (Bank Account name + Credit Card issuing bank). Alphabetized for
// the picker; the DDS table itself is keyed by an internal bank id we don't need here.
// Excludes "DDS Market Place(DDMP) NBF" — a platform/system entry in the master table,
// not a real customer bank.
export const DDS_BANKS = [
  "Abu Dhabi Commercial Bank",
  "Abu Dhabi Islamic Bank",
  "Ajman Bank",
  "Al Ahli Bank Of Kuwait K.S.C.",
  "Al Ain Finance PJSC",
  "Al Hilal Bank",
  "Al Khaliji France S.A.",
  "Al Maryah Community Bank",
  "Al Masraf",
  "AMEX (Middle East) - B.S.C",
  "Arab African International Bank",
  "Arab Bank",
  "Arab Emirates Investment Bank",
  "Banque Banorient France",
  "Banque Misr",
  "Bank Melli Iran",
  "Bank of Baroda",
  "Bank of Sharjah",
  "Bank Saderat Iran",
  "Barclays Bank",
  "BNP Paribas",
  "BOK International Bank",
  "Calyon Investment and Corporate Bank",
  "Citibank NA",
  "Commercial Bank International PSC",
  "Commercial Bank of Dubai",
  "Doha Bank",
  "Dubai First PJSC",
  "Dubai Islamic Bank",
  "El Nilein Bank",
  "Emirates Development Bank",
  "Emirates Islamic Bank PJSC",
  "Emiratesnbd Bank PJSC",
  "Finance House",
  "Finance House LLC",
  "First Abu Dhabi Bank",
  "Gulf International Bank",
  "Habib Bank AG Zurich",
  "Habib Bank Limited",
  "HSBC Middle East",
  "Industrial and Commercial Bank of China",
  "Investbank PSC",
  "Janata Bank",
  "MAF Finance",
  "Mashreqbank PSC",
  "National Bank of Fujairah",
  "National Bank Of Bahrain",
  "National Bank of Kuwait",
  "National Bank of Oman",
  "National Bank of Umm Al Qaiwain",
  "RAK Bank",
  "Rafidain Bank",
  "Ruya Community Islamic Bank LLC",
  "Samaa Finance PSC",
  "Sharjah Islamic Bank",
  "Siraj Finance",
  "Standard Chartered Bank",
  "The Saudi National Bank",
  "United Arab Bank",
  "United Bank Ltd.",
  "Wio Bank PJSC",
  "ZAND BANK",
] as const;

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

// "Skipped" (added Sep 2026): an occurrence whose due date passed while the subscription was
// Paused, so it was never included in a payment file — distinct from Failed (which means it
// WAS submitted and the bank rejected/errored it). Terminal, like Failed, but carries no
// retryCount and is never eligible for Retry — only for a merchant-initiated Rollover (see
// DDRolloverState and canRolloverOccurrence in lib/direct-debit.ts). Set at the T-1 payment-file
// build step, not at the moment Pause is clicked, so a Resume before the due date arrives lets
// the occurrence proceed normally instead of being pre-marked.
export type DDOccurrenceStatus = "Paid" | "Failed" | "Scheduled" | "Skipped";

/** Per-occurrence flag, independent of `status` — status says WHY an occurrence didn't happen
 *  as originally due (Failed vs Skipped), rolledOver says WHETHER its amount got folded onto a
 *  future occurrence. Set on the occurrence whose amount moved — not on the destination that
 *  received it (that one is only cross-referenced via `rolledOverFrom`). See Direct Debit.md
 *  backlog: "Rolled Over Yes is on the wrong row."
 *  - "rolled_over": amount successfully folded onto the next occurrence — automatically, once
 *    retries are exhausted, for a Failed occurrence; via the Rollover/Undo rollover button, for
 *    a Skipped one.
 *  - "blocked_by_ceiling": a rollover was attempted but would have pushed the destination
 *    occurrence's amount past the contract's max_amount.
 *  - "exhausted": rollovers_allowed has already been used up by the current CONSECUTIVE streak
 *    of rolled-over occurrences (see canRolloverOccurrence) — the streak resets the moment any
 *    occurrence on the subscription is next collected in full (Paid), so this is not a
 *    lifetime cap, only a per-streak one.
 *  - "none": not rolled over (default / not yet decided, for a Skipped occurrence awaiting the
 *    merchant's choice).
 */
export type DDRolloverState = "none" | "rolled_over" | "blocked_by_ceiling" | "exhausted";

export interface DirectDebitOccurrence {
  seq: number;
  dueDate: string; // "05 Sep 2026"
  amount: number;
  status: DDOccurrenceStatus;
  rolledOver: DDRolloverState;
  /** Set on the destination occurrence only: seq(s) of the occurrence(s) whose amount rolled in
   *  here. An ARRAY (changed Sep 2026) — once the merchant can choose any upcoming Scheduled
   *  occurrence as a rollover destination (see canRolloverOccurrence in lib/direct-debit.ts),
   *  more than one Skipped/Failed occurrence can land on the SAME destination (e.g. two
   *  consecutive Skipped occurrences both rolled onto the next real collection date). A single
   *  `number` couldn't represent that — rolling a second source into an already-received-into
   *  destination silently overwrote the first source's reference, which also broke Undo for that
   *  first source (canUndoRollover looks up the destination by matching seq inside this array).
   *  Bug found by Rabbani testing DD-2026-00085, Sep 2026. */
  rolledOverFrom?: number[];
  /** Times Payment Representment has been called for this occurrence, capped at 3 (see Order Model `Payment.retry_count`). Not applicable to Skipped occurrences — nothing was ever submitted, so there's nothing to retry. */
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
  /** Mandate.contract_description (added Sep 2026) — a short, plain-language description of
   *  what the contract is for, captured alongside the merchant reference at contract creation.
   *  Distinct from `notes`: this one IS shown to the customer, on the contract review & sign
   *  page, since the only context they otherwise get is the merchant name and a meaningless
   *  numeric contract reference. See Notes/Projects/Direct Debit.md. */
  contractDescription?: string;
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
  rolloversAllowed: number; // max CONSECUTIVE rollovers before the ceiling blocks another — see canRolloverOccurrence; resets after any Paid occurrence, not a lifetime total
  rolloverRemaining: number; // display-only snapshot for the Mandate details card; the live Rollover-button decision is derived from occurrence history (canRolloverOccurrence), not read from this field
  status: DDContractStatus;
  subscriptionStatus: DDSubscriptionStatus;
  statusNote?: string;
  occurrences: DirectDebitOccurrence[];
  emptyNote?: string;
  cancelledNote?: string;
  pausedNote?: string;
}
