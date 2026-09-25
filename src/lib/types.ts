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

// Ordered by DDS rank, most to least frequent (Backend Stories S1 §5.2 "Frequency table") —
// reordered 25-Sep-2026 so every dropdown lists them in the same order DDS ranks them.
export const DD_FREQUENCIES = [
  "Daily",
  "Weekly",
  "Monthly",
  "Every Two Months",
  "Quarterly",
  "Every Four Months",
  "Half-yearly",
  "Annually",
  "One Time Only",
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
  | "Awaiting Customer Details"
  | "Pending Customer Sign"
  | "Pending Bank Approval"
  | "Suspended"
  | "Rejected"
  | "Cancelled";
// Note (25-Sep-2026): a contract closed by a terminal refusal keeps status "Cancelled" and carries
// the reason in `closureReasonCode` — the UI renders it as "Cancelled — <reason label>" per
// Backend Stories S6 §2.1 (Mandate.status_label).

/** Who supplies the payment instrument (IBAN/card) at contract-creation time — added Sep 2026
 *  for the To Be Filled By Customer (TBFC) flow. "merchant" is the existing path (unchanged
 *  default). "customer" means the merchant deliberately left instrument details blank and the
 *  customer supplies them during their own review-and-sign step — see `mandateCreationStage`
 *  and Notes/Projects/Direct Debit.md, "To Be Filled By Customer (TBFC) instrument flow." */
export type DDInstrumentProvidedBy = "merchant" | "customer";

/** Only meaningful when `instrumentProvidedBy === "customer"`. DDS confirmed (08-Sep-2026)
 *  Create DDA always requires the complete payload — there is no deferred-submission mode on
 *  their side — so under TBFC, Geidea holds everything locally and does NOT call Create DDA
 *  until the customer supplies their instrument. `status_code`/`ref` only exist from that point
 *  on; before it, the Merchant Portal needs its own stage label distinct from DDS's status
 *  table (see DDContractStatus: "Awaiting Customer Details"). */
export type DDMandateCreationStage = "awaiting_customer_instrument" | "submitted_to_dds";

/** Backend Stories S2 §3a — bankAccountType (Order Model Mandate.account_type, DDS
 *  customerBankAccountType). Added to the creation form 25-Sep-2026. */
export type DDBankAccountType = "Current" | "Savings";

/** Subscription-level only — independent of the Mandate's own DDContractStatus above.
 *  See Notes/Projects/Direct Debit.md, Contract Detail screen §Pause: Pause suspends the
 *  Subscription only, the Mandate stays Active throughout. */
export type DDSubscriptionStatus = "Active" | "Paused" | "Cancelled";

// Occurrence statuses (reworked 25-Sep-2026 to match Backend Stories S5/S6):
//  - Scheduled: not yet sent to DDS (payment_created = false). Only these can be amended (S7 §2).
//  - Submitted: sent to DDS, result pending — also used while a retry is in flight (Payment
//    status RPND "Representment Pending", S6 §1.3).
//  - Paid: ACCP.
//  - Rejected: the bank refused it (Payment RJCT) but it can still be retried — up to 3 times and
//    only until its retry deadline (S6 §1.2). Not final.
//  - Failed: final. Retries used up (F1), retry deadline passed (F2), terminal reason code (F3) or
//    mandate closed (F4). Automatic rollover runs at this moment (S6 §3).
//  - Skipped: never sent. `skipReason` says why (paused / min_gap / not_active_in_time /
//    missed_submission). min_gap skips also auto-roll (S5 §1.1). Manual rollover of Skipped
//    collections is OUT of MVP scope (S7) — removed from the prototype 25-Sep-2026.
//  - Cancelled: will never happen because the contract closed (S3 §10, S6 §2.1, S7 §3).
export type DDOccurrenceStatus =
  | "Scheduled"
  | "Submitted"
  | "Paid"
  | "Rejected"
  | "Failed"
  | "Skipped"
  | "Cancelled";

/** Occurrence.skip_reason (S5 check C3/C6, S7 §1). */
export type DDSkipReason = "paused" | "min_gap" | "not_active_in_time" | "missed_submission";

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
export type DDRolloverState = "none" | "rolled_over" | "blocked_by_ceiling" | "exhausted" | "no_destination";

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
  /** Payment.reason_code — DDS paid / not-paid reason code (S5 §3.3), e.g. "I" insufficient funds.
   *  A terminal code (S1 §5.5) makes the collection Failed immediately and closes the contract. */
  reasonCode?: string;
  /** Payment.current_status while a retry is in flight — "RPND" (Representment Pending). */
  paymentStatus?: "RPND";
  /** Occurrence.skip_reason — only set when status is Skipped. */
  skipReason?: DDSkipReason;
  /** Occurrence.original_amount — the amount as first scheduled; never changes (S2 §4a). */
  originalAmount?: number;
  /** Occurrence.amount_source (S2 §4b). */
  amountSource?: "scheduled" | "merchant_edited" | "rollover_adjusted";
  /** Occurrence.amend_reason (S7 §2.3). */
  amendReason?: string;
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
  /** Absent only while instrumentProvidedBy === "customer" and the customer hasn't reached the
   *  Sign page's instrument step yet (Rabbani, 09-Sep-2026: under TBFC the WHOLE instrument
   *  choice — type included, not just the account/card details — is the customer's to make, not
   *  the merchant's; the merchant makes no instrument decision at all when TBFC is checked). Set
   *  the moment the customer submits that step, same as every other instrument field. */
  instrumentType?: DDInstrumentType;
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
  /** Added Sep 2026 for TBFC. Absent/undefined is equivalent to "merchant" — every contract
   *  before this feature, and every contract created without checking the TBFC box, provides
   *  its own instrument up front exactly as today. */
  instrumentProvidedBy?: DDInstrumentProvidedBy;
  /** Only set when instrumentProvidedBy === "customer". See DDMandateCreationStage above. */
  mandateCreationStage?: DDMandateCreationStage;
  // ---- Added 25-Sep-2026 (Backend Stories S2/S3/S6/S7) ----
  /** Mandate.customer_email / customer_mobile_number — needed by the customer verification
   *  screen (masked) and the signing notification. Older demo records fall back to sample values. */
  customerEmail?: string;
  customerMobile?: string;
  /** Mandate.account_type (Bank Account only). */
  bankAccountType?: DDBankAccountType;
  /** Mandate.account_title / credit_card_holder_name. */
  accountHolderTitle?: string;
  cardHolderName?: string;
  /** Subscription.frequency — the collection cadence. `frequency` above is the mandate's
   *  payment_frequency ceiling. Absent on older records = same as `frequency`. */
  collectionFrequency?: DDFrequency;
  /** Subscription.schedule_version — bumped on every successful amend (S7 §2.3, A0). */
  scheduleVersion?: number;
  /** Mandate.closure_reason_code — set when a terminal refusal closed the contract (S6 §2.1). */
  closureReasonCode?: string;
  /** Mandate.signing_notification_count / signing_notification_sent_at (S3 §1). */
  signingNotificationCount?: number;
  signingNotificationSentAt?: string;
  /** Mandate.review_link_expires_at (S2 §6.2), display format. */
  reviewLinkExpiresAt?: string;
  /** Prototype only — the exact POST /direct-debit/v1/contracts body this contract was created
   *  with, kept so the "Contract submitted" page can show the payloads side by side. The real
   *  Backend never stores the full IBAN/PAN (S2 §4b); this lives in the viewer's browser only. */
  createRequest?: DDCreateContractRequest;
  /** Banner shown on the Contract Detail screen while mandateCreationStage is still
   *  "awaiting_customer_instrument" — mirrors pausedNote/cancelledNote's pattern above. */
  awaitingInstrumentNote?: string;
}

/** POST /direct-debit/v1/contracts request body — Backend Stories S2 §3a, field names exactly as
 *  specified there. Used by the prototype's payload view (Contract submitted page). */
export interface DDCreateContractRequest {
  merchantReference: string;
  contractDescription?: string;
  notes?: string;
  customerName: string;
  customerEmail: string;
  customerMobile: string;
  emiratesId: string;
  bankInfoFillByCustomer: boolean;
  paymentMethodType?: DDInstrumentType;
  bankName?: string;
  accountHolderTitle?: string;
  bankAccountType?: DDBankAccountType;
  iban?: string;
  cardNumber?: string;
  cardHolderName?: string;
  startDate: string;
  endDate: string;
  amountType: DDAmountType;
  amount?: number;
  minAmount: number;
  maxAmount: number;
  frequencyCeiling: DDFrequency;
  frequency: DDFrequency;
  firstCollectionDate: string;
  rollover: { enabled: boolean; maxConsecutive?: number };
  collections: { dueDate: string; amount: number }[];
}
