import {
  Transaction,
  Payout,
  PaymentLink,
  StaticLink,
  RecurringPayment,
  BulkUpload,
  DirectDebitContract,
  DirectDebitOccurrence,
  DDFrequency,
} from "./types";
import { occurrenceBaseDate, formatDateNice, ddToday, addDays, toDateInputValue, formatCreatedOn, parseDateStr } from "./direct-debit";

export const STORE_NAME = "Acme Retail Demo LLC";

export interface DummyStore {
  id: string;
  label: string;
}

export const dummyStores: DummyStore[] = [
  { id: "st-10010001", label: "Acme Retail Demo LLC - 10010001" },
  { id: "st-10010002", label: "Acme Retail Demo LLC - 10010002" },
  { id: "st-10010003", label: "Acme Express Store - 10010003" },
];

export interface DummyCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

export const dummyCustomers: DummyCustomer[] = [
  { id: "cu-1", firstName: "Sam", lastName: "Carter", email: "sam.carter@example.com" },
  { id: "cu-2", firstName: "Alex", lastName: "Morgan", email: "alex.morgan@example.com" },
  { id: "cu-3", firstName: "Jordan", lastName: "Lee", phone: "+971500000001" },
];

export const transactions: Transaction[] = [
  {
    id: "t1",
    reference: "8f2a11b4-91c2-4a3e-9b10-11ac2fe8d001",
    date: "2026-08-22T19:29:00",
    store: STORE_NAME,
    paymentMethod: "Online",
    terminalId: "E0000089",
    scheme: "Mastercard",
    amount: 1.0,
    currency: "USD",
    type: "Purchase",
    status: "Pending",
    cardClass: "Premium",
    cardSegment: "Credit",
    cardOrigin: "International",
    maskedCard: "512345******2345",
    approvalCode: "031190",
    rrn: "623415303018",
    commission: 0.03,
    vat: 0,
    netAmount: 0.97,
    exchangeRate: 3.6725,
    isDcc: true,
    tags: ["DCC"],
  },
  {
    id: "t2",
    reference: "9a1b22c5-82d3-4b4f-8c21-22bd3fe9d002",
    date: "2026-08-22T19:04:00",
    store: STORE_NAME,
    paymentMethod: "Online",
    terminalId: "E0000089",
    scheme: "Visa",
    amount: 5.0,
    currency: "USD",
    type: "Purchase",
    status: "Approved",
    cardClass: "Premium",
    cardSegment: "Credit",
    cardOrigin: "International",
    maskedCard: "424242******4242",
    approvalCode: "118820",
    rrn: "623415303019",
    commission: 0.1,
    vat: 0,
    netAmount: 4.9,
  },
  {
    id: "t3",
    reference: "ab2c33d6-73e4-4c5a-7d32-33ce4fa0e003",
    date: "2026-08-19T14:58:00",
    store: STORE_NAME,
    paymentMethod: "Online",
    terminalId: "00202",
    scheme: "Jaywan",
    amount: 0.27,
    currency: "USD",
    type: "Purchase",
    status: "Completed",
    cardClass: "Standard",
    cardSegment: "Debit",
    cardOrigin: "Domestic",
    maskedCard: "630420******0091",
    approvalCode: "774411",
    rrn: "623415303020",
    commission: 0.01,
    vat: 0,
    netAmount: 0.26,
    exchangeRate: 3.6725,
    isDcc: true,
    tags: ["DCC"],
  },
  {
    id: "t4",
    reference: "bc3d44e7-64f5-4d6b-6e43-44df5ab1f004",
    date: "2026-08-19T14:57:00",
    store: STORE_NAME,
    paymentMethod: "Online",
    terminalId: "00202",
    scheme: "Jaywan",
    amount: 0.54,
    currency: "USD",
    type: "Purchase",
    status: "Completed",
    cardClass: "Standard",
    cardSegment: "Debit",
    cardOrigin: "Domestic",
    maskedCard: "630420******0092",
    approvalCode: "774412",
    rrn: "623415303021",
    commission: 0.02,
    vat: 0,
    netAmount: 0.52,
    exchangeRate: 3.6725,
    isDcc: true,
    tags: ["DCC"],
  },
  {
    id: "t5",
    reference: "cd4e55f8-55a6-4e7c-5f54-55ea6bc2f005",
    date: "2026-08-18T17:26:00",
    store: STORE_NAME,
    paymentMethod: "Online",
    terminalId: "E0000089",
    scheme: "Mastercard",
    amount: 1.0,
    currency: "AED",
    type: "Purchase",
    status: "Completed",
    cardClass: "Premium",
    cardSegment: "Debit",
    cardOrigin: "Domestic",
    maskedCard: "512345******2346",
    approvalCode: "551239",
    rrn: "623415303022",
    commission: 0.03,
    vat: 0,
    netAmount: 0.97,
  },
  {
    id: "t6",
    reference: "de5f66a9-46b7-4f8d-4a65-66fb7cd3f006",
    date: "2026-08-15T09:40:00",
    store: STORE_NAME,
    paymentMethod: "Online",
    terminalId: "E0000089",
    scheme: "Mastercard",
    amount: 0.1,
    currency: "AED",
    type: "Refund",
    status: "Completed",
    cardClass: "Premium",
    cardSegment: "Debit",
    cardOrigin: "Domestic",
    maskedCard: "512345******2347",
    approvalCode: "551240",
    rrn: "623415303023",
    commission: 0.0,
    vat: 0,
    netAmount: -0.1,
  },
  {
    id: "t7",
    reference: "ef6a77ba-37c8-4a9e-3b76-77ac8de4f007",
    date: "2026-08-15T09:38:00",
    store: STORE_NAME,
    paymentMethod: "Online",
    terminalId: "E0000089",
    scheme: "Visa",
    amount: 1.0,
    currency: "AED",
    type: "Purchase",
    status: "Completed",
    cardClass: "Premium",
    cardSegment: "Debit",
    cardOrigin: "Domestic",
    maskedCard: "424242******4243",
    approvalCode: "118821",
    rrn: "623415303024",
    commission: 0.03,
    vat: 0,
    netAmount: 0.97,
  },
];

export const chartSeries = [
  { date: "25 Jul", today: 0, last: 400 },
  { date: "27", today: -400, last: 300 },
  { date: "29", today: 2100, last: 600 },
  { date: "31", today: 900, last: 500 },
  { date: "2", today: 700, last: 900 },
  { date: "4", today: 1400, last: 700 },
  { date: "6", today: 2300, last: 1600 },
  { date: "8", today: 300, last: 300 },
  { date: "10", today: 700, last: 400 },
  { date: "12", today: 500, last: 500 },
  { date: "14", today: 400, last: 400 },
  { date: "16", today: 500, last: 300 },
  { date: "18", today: 300, last: 500 },
  { date: "20", today: 1200, last: 1900 },
  { date: "22", today: 2400, last: 700 },
];

export const topSchemes = [
  { name: "Mastercard", value: 6100 },
  { name: "Jaywan", value: 3200 },
  { name: "Visa", value: 2100 },
];

export const transactionTypeBreakdown = [
  { name: "Purchase", value: 155000 },
  { name: "Authorized purchase", value: 900 },
  { name: "Purchase reversal", value: 500 },
  { name: "Refund", value: -42000 },
];

export const payouts: Payout[] = [
  {
    id: "p1",
    date: "2026-08-23T00:00:00",
    store: STORE_NAME,
    iban: "AE770260000101427XXXXX",
    numTransactions: 2,
    netPayout: 5.82,
    currency: "USD",
    grossAmount: 0.0,
    feesDeducted: 0.13,
    refundAndChargeback: 0,
  },
  {
    id: "p2",
    date: "2026-08-19T00:00:00",
    store: STORE_NAME,
    iban: "AE770260000101427XXXXX",
    numTransactions: 1,
    netPayout: 0.99,
    currency: "AED",
    grossAmount: 1.0,
    feesDeducted: 0.01,
    refundAndChargeback: 0,
  },
  {
    id: "p3",
    date: "2026-08-16T00:00:00",
    store: STORE_NAME,
    iban: "AE770260000101427XXXXX",
    numTransactions: 1,
    netPayout: 1.09,
    currency: "AED",
    grossAmount: 1.1,
    feesDeducted: 0.01,
    refundAndChargeback: 0,
  },
];

export const paymentLinks: PaymentLink[] = [
  {
    id: "l1",
    linkNumber: "927787087534",
    customerName: "Sam Carter",
    store: STORE_NAME,
    amount: 1.0,
    currency: "USD",
    creationDate: "2026-08-22T19:15:00",
    status: "Paid",
    activationDate: "2026-08-22",
    expiryDate: "2026-09-21",
    language: "English",
    phone: "+971500000000",
    email: "sam.carter@example.com",
  },
  {
    id: "l2",
    linkNumber: "346814857400",
    customerName: "Sam Carter",
    store: STORE_NAME,
    amount: 5.0,
    currency: "USD",
    creationDate: "2026-08-22T19:01:00",
    status: "Paid",
    activationDate: "2026-08-22",
    expiryDate: "2026-09-21",
    language: "English",
  },
  {
    id: "l3",
    linkNumber: "539475409411",
    customerName: "Sam Carter",
    store: STORE_NAME,
    reference: "Chasis number 3gf474y37tg3",
    amount: 2.08,
    currency: "AED",
    creationDate: "2026-08-19T12:11:00",
    status: "Preauthorized",
    activationDate: "2026-08-19",
    expiryDate: "2026-09-18",
    language: "English",
  },
  {
    id: "l4",
    linkNumber: "985544466385",
    customerName: "Sam Carter",
    store: STORE_NAME,
    amount: 1.0,
    currency: "AED",
    creationDate: "2026-08-19T12:07:00",
    status: "Created",
    activationDate: "2026-08-19",
    expiryDate: "2026-09-18",
    language: "English",
  },
];

export const staticLinks: StaticLink[] = [
  {
    id: "s1",
    linkNumber: "953127025853",
    title: "test",
    store: STORE_NAME,
    amount: 1.05,
    currency: "AED",
    creationDate: "2026-07-10T03:09:00",
    status: "Expired",
  },
  {
    id: "s2",
    linkNumber: "198443415794",
    title: "t shirt",
    store: STORE_NAME,
    amount: 105.0,
    currency: "AED",
    creationDate: "2026-06-26T14:15:00",
    status: "Expired",
  },
  {
    id: "s3",
    linkNumber: "145977210717",
    title: "test",
    store: STORE_NAME,
    amount: 1.06,
    currency: "AED",
    creationDate: "2026-06-16T22:21:00",
    status: "Max Order Reached",
  },
];

export const recurringPayments: RecurringPayment[] = [
  {
    id: "r1",
    recurringId: "376728582575",
    customerName: "Alex Morgan",
    store: STORE_NAME,
    reference: "demo",
    paymentMethod: "Auto-recurring",
    creationDate: "2026-07-21T12:55:00",
    nextPayment: "2026-07-22T04:00:00",
    status: "AutoCancelled",
  },
  {
    id: "r2",
    recurringId: "215515946214",
    customerName: "Sam Carter",
    store: STORE_NAME,
    reference: "demo",
    paymentMethod: "Auto-recurring",
    creationDate: "2026-07-21T12:45:00",
    nextPayment: "2026-07-21T04:00:00",
    status: "Cancelled",
  },
  {
    id: "r3",
    recurringId: "290398048161",
    customerName: "Sam Carter",
    store: STORE_NAME,
    reference: "demo",
    paymentMethod: "Recurring manually",
    creationDate: "2026-07-01T17:10:00",
    nextPayment: "2026-07-01T04:00:00",
    status: "AutoCancelled",
  },
  {
    id: "r4",
    recurringId: "300986039347",
    customerName: "Sam Carter",
    store: STORE_NAME,
    reference: "demo",
    paymentMethod: "Auto-recurring",
    creationDate: "2026-07-01T16:18:00",
    nextPayment: "2026-07-02T04:00:00",
    status: "Active",
  },
];

export const bulkUploads: BulkUpload[] = [
  {
    id: "b1",
    fileName: "demo-links.csv",
    uploadId: "1cc1c7d5-be47-43a9-c305-08deec86d471",
    dateAdded: "2026-07-28T13:01:00",
    dateProcessed: "2026-07-28T13:02:00",
    numberOfLinks: 4,
    status: "Processed",
  },
  {
    id: "b2",
    fileName: "basic.csv",
    uploadId: "5718ef1b-2575-49a0-5f60-08ddd01d8186",
    dateAdded: "2025-07-31T14:32:00",
    dateProcessed: "2025-07-31T14:32:00",
    numberOfLinks: 2,
    status: "Processed",
  },
  {
    id: "b3",
    fileName: "basic.csv",
    uploadId: "7d9759fe-afd9-4682-78d1-08ddb3dab22b",
    dateAdded: "2025-06-25T15:23:00",
    dateProcessed: "2025-06-25T15:24:00",
    numberOfLinks: 2,
    status: "Processed",
  },
];

// ---- Direct Debit ----
//
// Occurrence generation: each contract's occurrence count is derived from its own
// commencesOn -> expiresOn term at its frequency (Direct Debit.md backlog: "Occurrence count
// doesn't match the contract's own term"). `genOccurrences` takes the ISO anchor date each
// contract's occurrences actually start from plus an explicit count — the count is chosen per
// contract below to match that contract's own stated period, not hardcoded to a year across
// the board (dd1: 6mo/6, dd2: ~1yr/12, dd4: 4mo/4, dd5: 2yr/24, dd7: ~1yr/12, dd9: 8mo/8,
// dd10: 6mo/6). The one legitimate exception is a Cancelled contract (dd8): cancellation stops
// the schedule early, so its occurrence count reflects the contract's actual life, not its
// original nominal term.
// Relative-date helpers (added 25-Sep-2026). The retry-deadline, terminal-code and amend demos
// only make sense relative to today (a retry window is a few days wide), so those demo contracts
// are anchored on ddToday() — UAE "today" — instead of fixed dates. Everything else keeps its
// fixed dates.
const TODAY = ddToday();
/** ISO date `days` from today (negative = past). */
function relIso(days: number): string {
  return toDateInputValue(addDays(TODAY, days));
}
/** ISO date one or more months before/after `iso`, same day of month. */
function shiftMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toDateInputValue(new Date(y, m - 1 + months, d));
}
function nice(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return formatDateNice(new Date(y, m - 1, d));
}

// dd1 — Rejected #2 inside its retry window (due 3 days ago).
const DD1_P2 = relIso(-3);
const DD1_START = shiftMonthsIso(DD1_P2, -1);
// dd12 — terminal refusal closed the contract.
const DD12_P2 = relIso(-10);
const DD12_START = shiftMonthsIso(DD12_P2, -1);
// dd13 — Weekly; #2's retry window closed, auto-rolled onto #3 (due today, already submitted).
const DD13_START = relIso(-14);
// dd14 — amend demo: #1 paid 20 days ago, 11 upcoming collections to amend.
const DD14_START = relIso(-20);

function genOccurrences(
  isoStart: string,
  frequency: DDFrequency,
  count: number,
  amount: number,
  overrides: Record<number, Partial<DirectDebitOccurrence>> = {}
): DirectDebitOccurrence[] {
  const list: DirectDebitOccurrence[] = [];
  for (let i = 0; i < count; i++) {
    const seq = i + 1;
    const date = occurrenceBaseDate(isoStart, frequency, i);
    const base: DirectDebitOccurrence = {
      seq,
      dueDate: formatDateNice(date),
      amount,
      status: "Scheduled",
      rolledOver: "none",
    };
    list.push({ ...base, ...(overrides[seq] || {}) });
  }
  return list;
}

export const directDebitContracts: DirectDebitContract[] = [
  {
    id: "dd1",
    ref: "DD-2026-00142",
    merchantRef: "INV-2026-08421",
    notes: "Residential lease — Building 12, Unit 304",
    contractDescription: "Monthly rent collection — Building 12, Unit 304, for the 2026/27 tenancy term.",
    createdOn: formatCreatedOn(addDays(parseDateStr(DD1_START), -6)),
    customerName: "Retry Pending", // demo: #2 Rejected (insufficient funds), 1 of 3 retries used, still inside its retry deadline
    customerIdType: "Emirates ID",
    customerIdNumber: "784-1990-1234567-1",
    customerEmail: "sara.ibrahim@example.com",
    customerMobile: "0501234567",
    instrumentType: "Bank Account",
    bankName: "Emiratesnbd Bank PJSC",
    maskedInstrumentRef: "•••4821",
    commencesOn: nice(shiftMonthsIso(DD1_START, 0)),
    expiresOn: nice(shiftMonthsIso(DD1_START, 6)), // 6-month term
    frequency: "Monthly",
    amountType: "Fixed",
    minAmount: 4000,
    maxAmount: 4000,
    prevDeduction: { amount: 4000, date: nice(DD1_P2), ok: false },
    nextDue: { amount: 4000, date: nice(shiftMonthsIso(DD1_P2, 1)) },
    rolloverEnabled: false,
    rolloversAllowed: 0,
    rolloverRemaining: 0,
    status: "Active",
    subscriptionStatus: "Active",
    scheduleVersion: 1,
    occurrences: genOccurrences(DD1_START, "Monthly", 6, 4000, {
      1: { status: "Paid", rolledOver: "none", collectedOn: nice(DD1_START), payoutStatus: "Settled", reasonCode: "0" },
      2: { status: "Rejected", rolledOver: "none", retryCount: 1, payoutStatus: "—", reasonCode: "I", note: "Rejected again after retry 1 of 3" },
    }),
  },
  {
    id: "dd2",
    ref: "DD-2026-00139",
    merchantRef: "INV-2026-08144",
    contractDescription: "Monthly membership fee for your annual subscription plan.",
    createdOn: "25 Aug 2026, 02:30 PM",
    customerName: "Retries Exhausted", // demo: retries exhausted, rollover disabled on this contract
    customerIdType: "Emirates ID",
    customerIdNumber: "784-1988-2345678-2",
    instrumentType: "Credit Card",
    maskedInstrumentRef: "•••7734",
    commencesOn: "01 Sep 2026",
    expiresOn: "01 Aug 2027", // 12 monthly occurrences
    frequency: "Monthly",
    amountType: "Fixed",
    minAmount: 6200,
    maxAmount: 6200,
    prevDeduction: { amount: 6200, date: "01 Sep 2026", ok: false },
    nextDue: { amount: 6200, date: "01 Oct 2026" },
    rolloverEnabled: false,
    rolloversAllowed: 0,
    rolloverRemaining: 0,
    status: "Active",
    subscriptionStatus: "Active",
    occurrences: genOccurrences("2026-09-01", "Monthly", 12, 6200, {
      1: { status: "Failed", rolledOver: "none", retryCount: 3, payoutStatus: "—", reasonCode: "I", note: "Final — 3 of 3 retries used (rollover is off on this contract)" },
    }),
  },
  {
    id: "dd3",
    ref: "DD-2026-00135",
    merchantRef: "INV-2026-07998",
    contractDescription: "Quarterly service charge for your maintenance agreement.",
    createdOn: "18 Aug 2026, 11:00 AM",
    customerName: "Pending Approval", // demo: mandate Pending Bank Approval, no occurrences generated yet
    customerIdType: "Emirates ID",
    customerIdNumber: "784-1992-3456789-3",
    instrumentType: "Bank Account",
    bankName: "Mashreq",
    maskedInstrumentRef: "•••2290",
    commencesOn: "20 Aug 2026",
    expiresOn: "20 May 2027", // 9-month term, quarterly -> 4 occurrences once active
    frequency: "Quarterly",
    amountType: "Fixed",
    minAmount: 15000,
    maxAmount: 15000,
    nextDue: { amount: 15000, date: "20 Nov 2026" },
    rolloverEnabled: true,
    rolloversAllowed: 3,
    rolloverRemaining: 3,
    status: "Pending Bank Approval",
    subscriptionStatus: "Active",
    occurrences: [],
    emptyNote: "No collections yet — contract is pending bank approval. Once Active, 4 quarterly occurrences will be generated through 20 May 2027.",
  },
  {
    id: "dd4",
    ref: "DD-2026-00128",
    merchantRef: "INV-2026-07711",
    contractDescription: "Monthly installment for your 4-month payment plan.",
    createdOn: "10 Jul 2026, 04:45 PM",
    customerName: "Rollover Blocked", // demo: rollover blocked — ceiling equals the installment itself
    customerIdType: "Emirates ID",
    customerIdNumber: "784-1985-4567890-4",
    instrumentType: "Bank Account",
    bankName: "First Abu Dhabi Bank",
    maskedInstrumentRef: "•••5013",
    commencesOn: "15 Jul 2026",
    expiresOn: "15 Oct 2026", // 4-month term
    frequency: "Monthly",
    amountType: "Fixed",
    minAmount: 3500,
    maxAmount: 3500, // ceiling equals the installment itself — any rollover attempt is necessarily blocked
    prevDeduction: { amount: 3500, date: "15 Aug 2026", ok: false },
    nextDue: { amount: 3500, date: "15 Sep 2026" },
    rolloverEnabled: true,
    rolloversAllowed: 1,
    rolloverRemaining: 1, // unchanged — a block never decrements this (Order Model: only an actual successful roll does)
    status: "Active", // fixed from "Suspended": a failed collection must not suspend the contract
    subscriptionStatus: "Active",
    occurrences: genOccurrences("2026-07-15", "Monthly", 4, 3500, {
      1: { status: "Paid", rolledOver: "none", collectedOn: "15 Jul 2026", payoutStatus: "Settled" },
      2: { status: "Failed", rolledOver: "blocked_by_ceiling", retryCount: 3, payoutStatus: "—", reasonCode: "I", note: "Final — 3 of 3 retries used. Automatic rollover blocked: it would exceed the contract's max amount" },
    }),
  },
  {
    id: "dd5",
    ref: "DD-2026-00121",
    merchantRef: "INV-2026-07340",
    contractDescription: "Monthly subscription fee for your 2-year service plan.",
    createdOn: "05 Jul 2026, 09:00 AM",
    customerName: "Paused Skipped", // demo: subscription Paused, occurrence #3 Skipped, 24-occurrence/2yr cap
    customerIdType: "Emirates ID",
    customerIdNumber: "784-1990-5678901-5",
    instrumentType: "Credit Card",
    maskedInstrumentRef: "•••9042",
    commencesOn: "10 Jul 2026",
    expiresOn: "10 Jun 2028", // 2-year term -> 24 occurrences (the guided flow's own display cap)
    frequency: "Monthly",
    amountType: "Fixed",
    minAmount: 5000,
    maxAmount: 5000,
    prevDeduction: { amount: 5000, date: "10 Aug 2026", ok: true },
    rolloverEnabled: true,
    rolloversAllowed: 1,
    rolloverRemaining: 1,
    status: "Active",
    subscriptionStatus: "Paused",
    pausedNote: "Subscription paused on 15 Aug 2026 — mandate remains Active. Occurrence #3 came due during the pause and was marked Skipped (reason: paused). Its amount is not collected automatically — manual rollover is out of MVP scope. To recover it, resume and amend an upcoming collection's amount (Variable contracts only).",
    occurrences: genOccurrences("2026-07-10", "Monthly", 24, 5000, {
      1: { status: "Paid", rolledOver: "none", collectedOn: "10 Jul 2026", payoutStatus: "Settled" },
      2: { status: "Paid", rolledOver: "none", collectedOn: "10 Aug 2026", payoutStatus: "Settled" },
      3: { status: "Skipped", rolledOver: "none", skipReason: "paused" },
    }),
  },
  {
    id: "dd6",
    ref: "DD-2026-00114",
    merchantRef: "INV-2026-06905",
    contractDescription: "Monthly membership fee collection.",
    createdOn: "28 May 2026, 01:20 PM",
    customerName: "Mandate Rejected", // demo: mandate Rejected — Invalid Payer Account
    customerIdType: "Emirates ID",
    customerIdNumber: "784-1979-6789012-6",
    instrumentType: "Bank Account",
    bankName: "Abu Dhabi Commercial Bank",
    maskedInstrumentRef: "•••3387",
    commencesOn: "01 Jun 2026",
    expiresOn: "01 Jun 2027",
    frequency: "Monthly",
    amountType: "Fixed",
    minAmount: 5200,
    maxAmount: 5200,
    rolloverEnabled: false,
    rolloversAllowed: 0,
    rolloverRemaining: 0,
    status: "Rejected",
    subscriptionStatus: "Active",
    statusNote: "Invalid Payer Account",
    occurrences: [],
    emptyNote: "No collections — mandate was rejected (Invalid Payer Account). Subscription never activates for a rejected mandate.",
  },
  {
    id: "dd7",
    ref: "DD-2026-00109",
    merchantRef: "INV-2026-06552",
    notes: "Service subscription — annual maintenance contract",
    contractDescription: "Annual maintenance contract — monthly service fee, billed based on usage.",
    createdOn: "10 May 2026, 10:10 AM",
    customerName: "Rollover Recovered", // demo: occurrence #2 rolled over then fully recovered on #3
    customerIdType: "Emirates ID",
    customerIdNumber: "784-1991-7890123-7",
    instrumentType: "Bank Account",
    bankName: "National Bank of Fujairah",
    maskedInstrumentRef: "•••1095",
    commencesOn: "15 May 2026",
    expiresOn: "15 Apr 2027", // 12 monthly occurrences
    frequency: "Monthly",
    amountType: "Variable",
    minAmount: 4800,
    maxAmount: 12000,
    prevDeduction: { amount: 4800, date: "15 Aug 2026", ok: true },
    nextDue: { amount: 4800, date: "15 Sep 2026" },
    rolloverEnabled: true,
    rolloversAllowed: 2,
    rolloverRemaining: 1,
    status: "Active",
    subscriptionStatus: "Active",
    occurrences: genOccurrences("2026-05-15", "Monthly", 12, 4800, {
      1: { status: "Paid", rolledOver: "none", collectedOn: "15 May 2026", payoutStatus: "Settled" },
      2: { status: "Failed", rolledOver: "rolled_over", retryCount: 3, payoutStatus: "—", reasonCode: "I", note: "Final — 3 of 3 retries used. Amount rolled automatically onto #3" },
      3: { status: "Paid", amount: 9600, amountSource: "rollover_adjusted", rolledOverFrom: [2], collectedOn: "15 Jul 2026", payoutStatus: "Settled", note: "Includes AED 4,800.00 recovered from 15 Jun 2026 (occurrence #2)" },
      4: { status: "Paid", rolledOver: "none", collectedOn: "15 Aug 2026", payoutStatus: "Settled" },
    }),
  },
  {
    id: "dd8",
    ref: "DD-2026-00098",
    merchantRef: "INV-2026-06103",
    contractDescription: "Monthly subscription fee collection.",
    createdOn: "20 Mar 2026, 03:15 PM",
    customerName: "Contract Cancelled", // demo: Cancelled mid-term, occurrence count reflects the shortened life
    customerIdType: "Emirates ID",
    customerIdNumber: "784-1983-8901234-8",
    instrumentType: "Bank Account",
    bankName: "Dubai Islamic Bank",
    maskedInstrumentRef: "•••6650",
    commencesOn: "05 Apr 2026",
    expiresOn: "05 Apr 2027", // original nominal term — cut short by cancellation below
    frequency: "Monthly",
    amountType: "Fixed",
    minAmount: 4500,
    maxAmount: 4500,
    prevDeduction: { amount: 4500, date: "05 Jun 2026", ok: true },
    rolloverEnabled: false,
    rolloversAllowed: 0,
    rolloverRemaining: 0,
    status: "Cancelled",
    subscriptionStatus: "Active",
    // Only 3 of the nominal 12 monthly occurrences were ever generated — cancellation on
    // 20 Jun 2026 stopped the schedule early. This is the one legitimate case where occurrence
    // count is less than the full term implies (see file-level comment above).
    occurrences: genOccurrences("2026-04-05", "Monthly", 3, 4500, {
      1: { status: "Paid", rolledOver: "none", collectedOn: "05 Apr 2026", payoutStatus: "Settled" },
      2: { status: "Paid", rolledOver: "none", collectedOn: "05 May 2026", payoutStatus: "Settled" },
      3: { status: "Paid", rolledOver: "none", collectedOn: "05 Jun 2026", payoutStatus: "Settled" },
    }),
    cancelledNote: "Contract cancelled on 20 Jun 2026 — no further collections.",
  },
  // dd9 — new (Sep 2026): rollover allowance is a CONSECUTIVE-streak cap, not a lifetime one.
  // #2 rolls onto #3 (streak 1 of 2), #3 fails too and rolls onto #4 (streak 2 of 2 — now
  // exhausted), #4 fails but CANNOT roll any further (rolledOver: "exhausted") and is written off
  // per the existing failure-handling design (proof-of-failure, no further rollover). #5 collects
  // cleanly, which resets the streak, so #6 is free to roll onto #7 again even though the
  // contract's lifetime rollover count is well past 2 by then.
  {
    id: "dd9",
    ref: "DD-2026-00091",
    merchantRef: "INV-2026-05877",
    notes: "Equipment lease — consecutive-failure / rollover-exhaustion scenario",
    contractDescription: "Monthly equipment lease payment, billed based on usage.",
    createdOn: "12 Feb 2026, 10:40 AM",
    customerName: "Rollover Exhausted", // demo: consecutive-streak rollover cap hit, then reset after a Paid occurrence
    customerIdType: "Emirates ID",
    customerIdNumber: "784-1987-9012345-9",
    instrumentType: "Bank Account",
    bankName: "RAK Bank",
    maskedInstrumentRef: "•••7420",
    commencesOn: "15 Feb 2026",
    expiresOn: "15 Oct 2026", // 8 monthly occurrences
    frequency: "Monthly",
    amountType: "Variable",
    minAmount: 3000,
    maxAmount: 20000, // sized generously so the ceiling itself never blocks this scenario — it's about the streak cap, not the amount cap
    rolloverEnabled: true,
    rolloversAllowed: 2,
    rolloverRemaining: 0, // snapshot as of the last occurrence below — see canRolloverOccurrence for the live, derived figure
    status: "Active",
    subscriptionStatus: "Active",
    occurrences: genOccurrences("2026-02-15", "Monthly", 8, 3000, {
      1: { status: "Paid", rolledOver: "none", collectedOn: "15 Feb 2026", payoutStatus: "Settled" },
      2: { status: "Failed", rolledOver: "rolled_over", retryCount: 3, payoutStatus: "—", reasonCode: "I", note: "Final — amount rolled automatically onto #3 (1 of 2 rollovers used)" },
      3: { status: "Failed", amount: 6000, rolledOverFrom: [2], rolledOver: "rolled_over", retryCount: 3, payoutStatus: "—", reasonCode: "I", note: "Includes AED 3,000.00 carried from #2. Final — rolled automatically onto #4 (2 of 2 rollovers used)" },
      4: { status: "Failed", amount: 9000, rolledOverFrom: [3], rolledOver: "exhausted", retryCount: 3, payoutStatus: "—", reasonCode: "I", note: "Includes AED 6,000.00 carried from #3. Final — no rollover left (2 of 2 used in this run); bounce memo is the proof of failure." },
      5: { status: "Paid", rolledOver: "none", collectedOn: "15 Jun 2026", payoutStatus: "Settled", note: "Collected in full — this resets the rollover streak for anything that fails after it." },
      6: { status: "Failed", rolledOver: "rolled_over", retryCount: 3, payoutStatus: "—", reasonCode: "I", note: "Final — rolled automatically onto #7 (fresh allowance: the streak reset after #5 was paid)" },
      7: { status: "Paid", amount: 6000, rolledOverFrom: [6], collectedOn: "15 Aug 2026", payoutStatus: "Settled", note: "Includes AED 3,000.00 recovered from 15 Jul 2026 (occurrence #6)" },
      8: { status: "Scheduled" },
    }),
  },
  // dd10 — reworked 25-Sep-2026: manual rollover (Rollover / destination picker / Undo) is OUT of
  // MVP scope (Backend Stories S7), so this record no longer demos it. It now shows collections
  // Skipped during a pause — their amounts stay uncollected; the merchant's route to recover
  // them is amending an upcoming collection (S7 §2), not a manual rollover.
  {
    id: "dd10",
    ref: "DD-2026-00085",
    merchantRef: "INV-2026-05412",
    notes: "Community charges — paused mid-term, three collections skipped",
    contractDescription: "Monthly community service charges, billed based on usage.",
    createdOn: "02 Jan 2026, 03:50 PM",
    customerName: "Pause Skips", // demo: collections Skipped (paused) — no manual rollover in MVP
    customerIdType: "Emirates ID",
    customerIdNumber: "784-1993-0123456-0",
    instrumentType: "Bank Account",
    bankName: "Sharjah Islamic Bank",
    maskedInstrumentRef: "•••3308",
    commencesOn: "10 Jan 2026",
    expiresOn: "10 Jul 2026", // 6 monthly occurrences
    frequency: "Monthly",
    amountType: "Variable",
    minAmount: 4000,
    maxAmount: 12000,
    rolloverEnabled: true,
    rolloversAllowed: 2,
    rolloverRemaining: 2,
    status: "Active",
    subscriptionStatus: "Paused",
    pausedNote: "Subscription paused on 08 Mar 2026 — mandate remains Active. #2–#4 came due during the pause and were Skipped (reason: paused). Skips caused by a pause are not rolled over automatically, and manual rollover is out of MVP scope — the merchant recovers an amount by amending an upcoming collection after resuming.",
    occurrences: genOccurrences("2026-01-10", "Monthly", 6, 4000, {
      1: { status: "Paid", rolledOver: "none", collectedOn: "10 Jan 2026", payoutStatus: "Settled" },
      2: { status: "Skipped", rolledOver: "none", skipReason: "paused" },
      3: { status: "Skipped", rolledOver: "none", skipReason: "paused" },
      4: { status: "Skipped", rolledOver: "none", skipReason: "paused" },
    }),
  },
  // dd11 — To Be Filled By Customer (TBFC). Merchant leaves the ENTIRE instrument decision to the
  // customer (Rabbani, 09-Sep-2026: type included, not just the account/card details — see
  // instrumentType being left unset below, and the type picker on the Sign page's instrument
  // step). Geidea holds the contract/subscription/occurrence schedule locally only — Create DDA
  // is not called, so no DDS mandate reference exists yet. See Notes/Projects/Direct Debit.md,
  // "To Be Filled By Customer (TBFC) instrument flow." Opening this contract's Sign link (or its
  // Detail screen) is how a fresh session can see the awaiting-instrument state without having
  // to create one by hand. (A second demo record, dd12, briefly existed to demo the credit-card
  // side of the Sign page's instrument fields — removed once instrument TYPE moved to the
  // customer's own choice, since either path is now reachable from this one record.)
  {
    id: "dd11",
    ref: "", // no DDS reference yet — see PENDING_INSTRUMENT_REF_LABEL
    merchantRef: "INV-2026-08890",
    notes: "TBFC demo — instrument deferred to customer's own review-and-sign step",
    contractDescription: "Monthly gym membership fee collection.",
    createdOn: "08 Sep 2026, 04:20 PM",
    customerName: "Awaiting Instrument", // demo: TBFC — no instrument chosen or supplied yet
    customerIdType: "Emirates ID",
    customerIdNumber: "784-1994-1122334-4",
    customerEmail: "omar.haddad@example.com",
    customerMobile: "0559876543",
    signingNotificationCount: 1,
    signingNotificationSentAt: "08 Sep 2026, 04:21 PM",
    // instrumentType intentionally omitted — the customer hasn't chosen one yet (see types.ts).
    maskedInstrumentRef: "", // not yet supplied
    commencesOn: "15 Sep 2026",
    expiresOn: "15 Sep 2027", // 12 monthly occurrences once the customer completes their step
    frequency: "Monthly",
    amountType: "Fixed",
    minAmount: 250,
    maxAmount: 250,
    rolloverEnabled: false,
    rolloversAllowed: 0,
    rolloverRemaining: 0,
    status: "Awaiting Customer Details",
    subscriptionStatus: "Active",
    instrumentProvidedBy: "customer",
    mandateCreationStage: "awaiting_customer_instrument",
    awaitingInstrumentNote:
      "Waiting on the customer to choose a payment instrument (bank account or credit card) and supply its details on the contract sign page before this mandate can be submitted to DDS. Nothing has been sent to DDS yet — no reference exists until that step completes.",
    // Schedule generated and held locally so the customer's review page has something to show —
    // per the confirmed design, Subscription/Occurrence creation isn't gated on a dda_id existing.
    occurrences: genOccurrences("2026-09-15", "Monthly", 12, 250),
  },
  // dd12 — new 25-Sep-2026: terminal refusal (Backend Stories S6 §2.1). #2 came back RJCT with
  // reason A (Account closed) — a terminal code, so it went straight to Failed (no retry, no
  // rollover) and the contract was closed locally as "Cancelled — Account closed". Remaining
  // collections are Cancelled. Not cancelled at DDS (that needs the customer's signature, S8).
  {
    id: "dd12",
    ref: "DD-2026-00151",
    merchantRef: "INV-2026-08977",
    contractDescription: "Monthly tuition fee instalments for the 2026/27 academic year.",
    createdOn: formatCreatedOn(addDays(parseDateStr(DD12_START), -7)),
    customerName: "Terminal Refusal", // demo: reason code A closes the contract
    customerIdType: "Emirates ID",
    customerIdNumber: "784-1989-5566778-2",
    customerEmail: "layla.m@example.com",
    customerMobile: "0524455667",
    instrumentType: "Bank Account",
    bankName: "Abu Dhabi Islamic Bank",
    maskedInstrumentRef: "•••6041",
    commencesOn: nice(DD12_START),
    expiresOn: nice(shiftMonthsIso(DD12_START, 10)),
    frequency: "Monthly",
    amountType: "Fixed",
    minAmount: 3000,
    maxAmount: 3000,
    prevDeduction: { amount: 3000, date: nice(DD12_P2), ok: false },
    rolloverEnabled: false,
    rolloversAllowed: 0,
    rolloverRemaining: 0,
    status: "Cancelled",
    closureReasonCode: "A",
    subscriptionStatus: "Cancelled",
    statusNote: "Closed by Geidea after a terminal bank refusal — not cancelled at DDS",
    occurrences: genOccurrences(DD12_START, "Monthly", 10, 3000, {
      1: { status: "Paid", rolledOver: "none", collectedOn: nice(DD12_START), payoutStatus: "Settled", reasonCode: "0" },
      2: { status: "Failed", rolledOver: "none", payoutStatus: "—", reasonCode: "A", note: "Terminal code — no retry, no rollover. Contract closed." },
      ...Object.fromEntries(
        [3, 4, 5, 6, 7, 8, 9, 10].map((n) => [n, { status: "Cancelled" as const, rolledOver: "none" as const }])
      ),
    }),
    cancelledNote: "Contract closed after #2 was refused with reason A (Account closed) — every later collection is Cancelled.",
  },
  // dd13 — new 25-Sep-2026: retry deadline on a Weekly contract (S6 §1.2). Weekly's DDS minimum gap
  // is 4 days, so #2's retry window is only ~2 days wide. #2 was retried once, rejected again, and
  // the window closed — the 07:00 job marked it Failed and rolled its amount onto #3 automatically.
  {
    id: "dd13",
    ref: "DD-2026-00148",
    merchantRef: "INV-2026-08806",
    contractDescription: "Weekly cleaning service — 3 visits a week.",
    createdOn: formatCreatedOn(addDays(parseDateStr(DD13_START), -8)),
    customerName: "Retry Window Closed", // demo: weekly retry deadline passed → Failed + auto rollover
    customerIdType: "Emirates ID",
    customerIdNumber: "784-1995-3344556-7",
    customerEmail: "k.nair@example.com",
    customerMobile: "0567788990",
    instrumentType: "Bank Account",
    bankName: "Mashreqbank PSC",
    maskedInstrumentRef: "•••9914",
    commencesOn: nice(DD13_START),
    expiresOn: nice(toDateInputValue(addDays(parseDateStr(DD13_START), 7 * 11))),
    frequency: "Weekly",
    amountType: "Variable",
    minAmount: 500,
    maxAmount: 3000,
    prevDeduction: { amount: 1000, date: nice(relIso(-7)), ok: false },
    nextDue: { amount: 2000, date: nice(relIso(0)) },
    rolloverEnabled: true,
    rolloversAllowed: 2,
    rolloverRemaining: 1,
    status: "Active",
    subscriptionStatus: "Active",
    collectionFrequency: "Weekly",
    scheduleVersion: 1,
    occurrences: genOccurrences(DD13_START, "Weekly", 12, 1000, {
      1: { status: "Paid", rolledOver: "none", collectedOn: nice(DD13_START), payoutStatus: "Settled", reasonCode: "0" },
      2: { status: "Failed", rolledOver: "rolled_over", retryCount: 1, payoutStatus: "—", reasonCode: "I", note: "Retry window closed with the collection still Rejected — marked Failed by the 07:00 job and rolled onto #3" },
      3: { status: "Submitted", amount: 2000, originalAmount: 1000, amountSource: "rollover_adjusted", rolledOverFrom: [2], payoutStatus: "—", note: "Includes AED 1,000.00 rolled over from #2 — in today's payment file" },
    }),
  },
  // dd14 — new 25-Sep-2026: schedule amend demo (S7 §2). Variable monthly contract with 11 upcoming
  // Scheduled collections — use "Amend schedule" on Contract Detail to move dates / change amounts
  // and see the A-rule validation (gap from previous / to next, contract period, min/max …).
  {
    id: "dd14",
    ref: "DD-2026-00155",
    merchantRef: "INV-2026-09012",
    notes: "Amend demo — try moving one date alone (GAP_TO_NEXT), then move the next one too in the same save",
    contractDescription: "Monthly service fee for your 12-month facilities management plan.",
    createdOn: formatCreatedOn(addDays(parseDateStr(DD14_START), -10)),
    customerName: "Amend Schedule", // demo: schedule amend with validation
    customerIdType: "Emirates ID",
    customerIdNumber: "784-1986-7788990-3",
    customerEmail: "hassan.q@example.com",
    customerMobile: "0543322110",
    instrumentType: "Bank Account",
    bankName: "First Abu Dhabi Bank",
    maskedInstrumentRef: "•••2276",
    commencesOn: nice(relIso(-25)),
    expiresOn: nice(shiftMonthsIso(DD14_START, 12)),
    frequency: "Monthly",
    amountType: "Variable",
    minAmount: 1000,
    maxAmount: 15000,
    prevDeduction: { amount: 5000, date: nice(DD14_START), ok: true },
    nextDue: { amount: 5000, date: nice(shiftMonthsIso(DD14_START, 1)) },
    rolloverEnabled: true,
    rolloversAllowed: 2,
    rolloverRemaining: 2,
    status: "Active",
    subscriptionStatus: "Active",
    collectionFrequency: "Monthly",
    scheduleVersion: 3,
    occurrences: genOccurrences(DD14_START, "Monthly", 12, 5000, {
      1: { status: "Paid", rolledOver: "none", collectedOn: nice(DD14_START), payoutStatus: "Settled", reasonCode: "0" },
    }),
  },
];
