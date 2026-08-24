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
