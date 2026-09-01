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

export type DDOccurrenceStatus = "Paid" | "Failed" | "Scheduled";

export interface DirectDebitOccurrence {
  seq: number;
  dueDate: string; // "05 Sep 2026"
  amount: number;
  status: DDOccurrenceStatus;
  /** null = not yet resolved (Scheduled); only meaningful once an occurrence has actually settled */
  rolledOver: boolean | null;
  collectedOn?: string;
  note?: string;
}

export interface DirectDebitContract {
  id: string;
  ref: string; // DDS mandate reference shown to the merchant, e.g. DD-2026-00142
  merchantRef: string; // dda_reference_number — merchant-typed, see Order Model
  notes?: string;
  customerName: string;
  instrumentType: DDInstrumentType;
  commencesOn: string; // "05 Sep 2026" — mandate validity start
  expiresOn: string; // mandate validity end
  frequency: DDFrequency; // contract frequency ceiling
  prevDeduction?: { amount: number; date: string; ok: boolean };
  nextDue?: { amount: number; date: string };
  rolloversAllowed: number; // rollover_count_remaining
  status: DDContractStatus;
  statusNote?: string;
  occurrences: DirectDebitOccurrence[];
  emptyNote?: string;
  cancelledNote?: string;
}
