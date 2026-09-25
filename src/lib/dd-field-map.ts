// Direct Debit parameter map for the "Dev hints" ⓘ icons (added 25-Sep-2026, Rabbani).
//
// One entry per front-end element. Each says which API the element talks to and, hop by hop,
// which parameter it becomes (or is read from):
//   BE API      — Geidea's own DD Backend API field (camelCase), per the Backend Stories S1–S7
//   Order Model — the Backend's stored field (snake_case), per Direct Debit - Order Model
//   DDS         — the DDS REST API v2.0 field, where the value continues on to DDS
//
// direction:
//   "push"   — the front end SENDS this value to the Backend (form submit / action)
//   "pull"   — the front end READS this value from the Backend (inquiry)
//   "config" — merchant configuration (PGW Config in MA / DD BE Config)
//
// Sources: Direct_Debit_Backend_Stories_S1-S7.docx (the requirement). Where a read-side endpoint
// isn't written yet (S10 Merchant Portal Views is "To write"), the response field name comes from
// George's Integration Document v2 (§5.2/§5.3/§5.7) and is marked as such. Anything the stories
// don't have yet is marked "proposed" so the devs know it needs agreeing first.

export type HintDirection = "push" | "pull" | "config";

export interface HintLine {
  system: "BE API" | "Order Model" | "DDS" | "Config";
  ref: string;
  note?: string;
}

export interface FieldHintDef {
  title: string;
  direction: HintDirection;
  endpoint?: string;
  lines: HintLine[];
  /** How the UI state maps onto the parameter value, e.g. "OFF → false · ON → true". */
  valueMap?: string;
  note?: string;
}

const CONFIG_ENDPOINT = "PUT /direct-debit/v1/admin/merchants/{merchantId}/config  ·  read: GET /direct-debit/v1/config";
const CREATE = "POST /direct-debit/v1/contracts";
const DDS_CREATE = "Create DDA";
const DETAIL = "GET /direct-debit/v1/contracts/{mandateId} (S10 not written — names per George v2 §5.3)";
const LIST = "POST /direct-debit/v1/contracts/search (S10 not written — names per George v2 §5.2)";
const COLLECTIONS = "Collections in GET /direct-debit/v1/contracts/{mandateId} (names per George v2 §5.3/§5.7)";

function toggle(title: string, field: string, def: string, note?: string): FieldHintDef {
  return {
    title,
    direction: "config",
    endpoint: CONFIG_ENDPOINT,
    lines: [{ system: "Config", ref: field, note: `default ${def}` }],
    valueMap: "OFF → false · ON → true",
    note,
  };
}

export const DD_FIELD_HINTS = {
  // ---------------- PGW Config in MA (S1 §3, §4) ----------------
  "cfg.enable": toggle("Enable Direct Debit", "enable_direct_debit", "false", "Master switch. false hides the DD menu and every DD API returns 403 DD_NOT_ENABLED. Switching to false also pauses every Active subscription (pause_reason = dd_disabled) — not modelled in this prototype yet."),
  "cfg.oic": {
    title: "OIC",
    direction: "config",
    endpoint: CONFIG_ENDPOINT,
    lines: [
      { system: "Config", ref: "oic_id", note: "must be an Active OIC with owner_type = Geidea" },
      { system: "Order Model", ref: "Mandate.oic", note: "snapshot copied onto each new mandate" },
    ],
    note: "Selects which DDS username/password make the call — never sent to DDS itself. Merchant-owned OIC is stored but not assignable in Phase 1 (S1 open point b).",
  },
  "cfg.disableCC": toggle("Disable Credit Card Instrument", "disable_credit_card_instrument", "false (card allowed)", "true → Create Contract / TBFC instrument returns 422 INSTRUMENT_NOT_ENABLED for Credit Card. Kept while DDS only accepts a clear PAN (PCI)."),
  "cfg.bulk": toggle("Enable Bulk Contract Upload", "enable_bulk_contract_upload", "false", "Shows/blocks bulk upload (S9). Also gated by the allow_bulk_upload action toggle."),
  "cfg.maxAmount": {
    title: "Maximum Contract Amount",
    direction: "config",
    endpoint: CONFIG_ENDPOINT,
    lines: [{ system: "Config", ref: "max_contract_amount", note: "AED, 2 dp · 1 – 100,000,000 · default 100,000,000" }],
    note: "Checked per contract (S2 rule V14: maxAmount ≤ this). No cap across all contracts.",
  },
  "cfg.leadTime": {
    title: "Minimum first-collection lead time",
    direction: "config",
    endpoint: CONFIG_ENDPOINT,
    lines: [{ system: "Config", ref: "min_first_collection_lead_working_days", note: "integer 0–30 · default 4" }],
    note: "S2 rule V15: firstCollectionDate ≥ today + this many working days → else FIRST_COLLECTION_TOO_SOON.",
  },
  "cfg.reviewExpiry": {
    title: "Contract review expiry (days)",
    direction: "config",
    endpoint: CONFIG_ENDPOINT,
    lines: [
      { system: "Config", ref: "contract_review_expiry_days", note: "integer 1–30 · default 7" },
      { system: "Order Model", ref: "Mandate.review_link_expires_at", note: "= created_at + this" },
    ],
  },
  "cfg.suppress": toggle("Suppress Geidea customer notifications", "suppress_customer_notifications", "false", "true → Geidea sends no SMS / email / WhatsApp (first send, resend, OTP). Create Contract then also returns signingUrl; resend returns 422 NOTIFICATIONS_SUPPRESSED."),
  "cfg.action.create": toggle("Create contract", "allow_create_contract", "true", "Checked in S2 pre-check 2.2 → 403 ACTION_NOT_ALLOWED."),
  "cfg.action.resend": toggle("Resend signing link", "allow_resend_signing_link", "true", "Checked in S3 §1.5."),
  "cfg.action.discard": toggle("Discard unsigned contract", "allow_discard_contract", "true", "Checked in S7 §3. Discard isn't built in this prototype yet."),
  "cfg.action.pauseResume": toggle("Pause / resume", "allow_pause_resume", "true", "Checked in S7 §1."),
  "cfg.action.edit": toggle("Amend a collection", "allow_edit_collection", "true", "Checked in S7 §2 (rule A1)."),
  "cfg.action.retry": toggle("Retry a rejected collection", "allow_retry_collection", "true", "Checked in S6 §1.1."),
  "cfg.action.cancel": toggle("Cancel contract", "allow_cancel_contract", "true", "Checked in S8 (parked)."),
  "cfg.action.bulk": toggle("Bulk contract upload", "allow_bulk_upload", "true", "Checked in S9."),

  // ---------------- DD BE Config (S1 §2) ----------------
  "be.username": {
    title: "DDS username",
    direction: "config",
    endpoint: "POST/PUT /direct-debit/v1/admin/oics/{oicId} (credentials held in the secrets vault)",
    lines: [
      { system: "Config", ref: "OIC → DDS username (per environment)" },
      { system: "DDS", ref: "HTTP Basic auth user", note: "every /v1/merchant/... call" },
    ],
    note: "Test: POST /direct-debit/v1/admin/oics/{oicId}/test-credentials → DDS Day-End report (200/404 = valid, 401 = wrong).",
  },
  "be.password": {
    title: "DDS password",
    direction: "config",
    endpoint: "POST/PUT /direct-debit/v1/admin/oics/{oicId}",
    lines: [
      { system: "Config", ref: "OIC → DDS password (vault)" },
      { system: "DDS", ref: "HTTP Basic auth password" },
    ],
    note: "API responses never return it — they show •••• and lastUpdatedAt.",
  },
  "be.cardKey": {
    title: "Card Encryption Public Key",
    direction: "config",
    endpoint: "OIC registry (S1 §2.4)",
    lines: [{ system: "Config", ref: "card encryption public key" }],
    note: "Used to encrypt the PAN before customerCreditCardNumber goes to DDS. Mechanics still open (S1 open point a).",
  },

  // ---------------- Create contract — step 1 (S2 §3a → §4b → §4c) ----------------
  "create.merchantReference": {
    title: "Merchant reference number",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "merchantReference", note: "M · 3–26 chars · unique per merchant (409 DUPLICATE_MERCHANT_REFERENCE)" },
      { system: "Order Model", ref: "Mandate.dda_reference_number" },
      { system: "DDS", ref: "ddaReferenceNumber", note: DDS_CREATE },
    ],
  },
  "create.contractDescription": {
    title: "Contract description",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "contractDescription", note: "O · max 500" },
      { system: "Order Model", ref: "Mandate.contract_description" },
    ],
    note: "Never sent to DDS. Shown to the customer on the verification and review pages, and in the SMS/email.",
  },
  "create.customerName": {
    title: "Customer full name",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "customerName", note: "M · max 100 chars, max 7 words" },
      { system: "Order Model", ref: "Mandate.customer_full_name" },
      { system: "DDS", ref: "customerFullName", note: DDS_CREATE },
    ],
  },
  "create.customerEmail": {
    title: "Customer email",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "customerEmail", note: "M · valid email, max 100" },
      { system: "Order Model", ref: "Mandate.customer_email" },
      { system: "DDS", ref: "customerEmail", note: DDS_CREATE },
    ],
  },
  "create.customerMobile": {
    title: "Mobile number",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "customerMobile", note: "M · 05XXXXXXXX" },
      { system: "Order Model", ref: "Mandate.customer_mobile_number" },
      { system: "DDS", ref: "customerMobileNumber", note: DDS_CREATE },
    ],
  },
  "create.emiratesId": {
    title: "Emirates ID number",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "emiratesId", note: "M · 15 digits, starts 784" },
      { system: "Order Model", ref: "Mandate.customer_id_number + Mandate.cust_nid" },
      { system: "DDS", ref: "customerIdNumber + custNid", note: "customerIdType = \"UAE Emirates Identity Card\"" },
    ],
  },
  "create.tbfc": {
    title: "To Be Filled By Customer",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "bankInfoFillByCustomer", note: "M · true / false" },
      { system: "Order Model", ref: "Mandate.instrument_provided_by", note: "customer | merchant" },
      { system: "Order Model", ref: "Mandate.mandate_creation_stage", note: "awaiting_customer_instrument when true" },
    ],
    valueMap: "unchecked → false · checked → true",
    note: "true → Backend holds the contract locally and does NOT call DDS Create DDA until the customer submits the instrument (S2 §4.1, S3 §5).",
  },
  "create.paymentMethodType": {
    title: "Payment instrument",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "paymentMethodType", note: "C · Bank Account | Credit Card · absent when TBFC" },
      { system: "Order Model", ref: "Mandate.instrument_type" },
      { system: "DDS", ref: "userPreferPaymentMethod", note: DDS_CREATE },
    ],
  },
  "create.bankName": {
    title: "Bank name",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "bankName", note: "C · must match GET /direct-debit/v1/banks" },
      { system: "Order Model", ref: "Mandate.bank_name" },
      { system: "DDS", ref: "customerAccountBankName", note: "spelled exactly as the DDS Banks Master Table" },
    ],
  },
  "create.accountHolderTitle": {
    title: "Account holder title",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "accountHolderTitle", note: "C · Bank Account · letters only, max 7 words" },
      { system: "Order Model", ref: "Mandate.account_title" },
      { system: "DDS", ref: "customerBankAccountTitle" },
    ],
  },
  "create.bankAccountType": {
    title: "Account type",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "bankAccountType", note: "C · Bank Account · Current | Savings" },
      { system: "Order Model", ref: "Mandate.account_type" },
      { system: "DDS", ref: "customerBankAccountType" },
    ],
  },
  "create.iban": {
    title: "IBAN",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "iban", note: "C · AE + 21 digits (23 chars)" },
      { system: "Order Model", ref: "Mandate.instrument_reference", note: "masked, last 4 only — full IBAN never stored" },
      { system: "DDS", ref: "customerBankAccountNumber", note: "full IBAN, in memory only" },
    ],
  },
  "create.cardHolderName": {
    title: "Card holder name",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "cardHolderName", note: "C · Credit Card · max 7 words" },
      { system: "Order Model", ref: "Mandate.credit_card_holder_name" },
      { system: "DDS", ref: "creditCardHolderName" },
    ],
  },
  "create.issuingBank": {
    title: "Issuing bank",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "bankName", note: "same field as Bank Account's bank name" },
      { system: "Order Model", ref: "Mandate.bank_name" },
      { system: "DDS", ref: "customerAccountBankName" },
    ],
  },
  "create.cardNumber": {
    title: "Card number",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "cardNumber", note: "C · 16 digits, Luhn" },
      { system: "Order Model", ref: "Mandate.instrument_reference", note: "masked, last 4 only" },
      { system: "DDS", ref: "customerCreditCardNumber", note: "clear PAN today — the reason Disable Credit Card exists" },
    ],
  },
  "create.startDate": {
    title: "Commences on",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "startDate", note: "M · YYYY-MM-DD · ≥ today (V1)" },
      { system: "Order Model", ref: "Mandate.commences_on" },
      { system: "DDS", ref: "commencesOn", note: "dd/MM/yyyy" },
    ],
  },
  "create.endDate": {
    title: "Expires on",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "endDate", note: "M · YYYY-MM-DD · > startDate (V1)" },
      { system: "Order Model", ref: "Mandate.expires_on (+ Subscription.subscription_end_date)" },
      { system: "DDS", ref: "expiresOn", note: "dd/MM/yyyy" },
    ],
  },
  "create.amountType": {
    title: "Amount type",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "amountType", note: "M · Fixed | Variable" },
      { system: "Order Model", ref: "Mandate.amount_type" },
      { system: "DDS", ref: "amountType" },
    ],
    note: "Fixed → amount = minAmount = maxAmount and rollover off (V11).",
  },
  "create.minAmount": {
    title: "Min amount",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "minAmount", note: "M · 2 dp · > 0" },
      { system: "Order Model", ref: "Mandate.min_amount" },
      { system: "DDS", ref: "minAmount" },
    ],
  },
  "create.maxAmount": {
    title: "Max amount",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "maxAmount", note: "M · ≤ max_contract_amount and ≤ 100,000,000 (V14)" },
      { system: "Order Model", ref: "Mandate.max_amount" },
      { system: "DDS", ref: "maxAmount" },
    ],
  },
  "create.frequencyCeiling": {
    title: "Payment frequency ceiling",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "frequencyCeiling", note: "M · DDS frequency values" },
      { system: "Order Model", ref: "Mandate.payment_frequency" },
      { system: "DDS", ref: "paymentFrequency" },
    ],
    note: "Drives DDS's minimum gap between two successful debits (V8) and the retry deadline.",
  },
  "create.notes": {
    title: "Notes",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "notes", note: "O · max 1,000" },
      { system: "Order Model", ref: "Mandate.notes" },
    ],
    note: "Merchant-only. Never shown to the customer, never sent to DDS.",
  },
  // step 2
  "create.frequency": {
    title: "Collection frequency",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "frequency", note: "M · rank ≥ frequencyCeiling's rank (V7)" },
      { system: "Order Model", ref: "Subscription.frequency" },
    ],
    note: "Not sent to DDS — DDS never sees the schedule.",
  },
  "create.firstCollectionDate": {
    title: "First collection date",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "firstCollectionDate", note: "M · YYYY-MM-DD · ≥ today + lead time (V15)" },
      { system: "Order Model", ref: "Subscription.subscription_start_date + day_of_month_anchor" },
    ],
  },
  "create.amount": {
    title: "Collection amount",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "amount (Fixed) · collections[].amount", note: "2 dp" },
      { system: "Order Model", ref: "Occurrence.amount + Occurrence.original_amount" },
    ],
  },
  "create.rolloverEnabled": {
    title: "Rollover",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "rollover.enabled", note: "M · Variable only" },
      { system: "Order Model", ref: "Subscription.rollover_enabled" },
    ],
    valueMap: "OFF → false · ON → true",
  },
  "create.rolloversAllowed": {
    title: "Rollovers allowed",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "rollover.maxConsecutive", note: "C · integer ≥ 1 · highest amount × (n+1) ≤ maxAmount (V13)" },
      { system: "Order Model", ref: "Subscription.rollovers_allowed" },
    ],
  },
  // step 3
  "create.collections": {
    title: "Collection schedule",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "collections[] = { dueDate, amount }", note: "M · rules V3–V10" },
      { system: "Order Model", ref: "Occurrence.sequence_number, due_date, amount, original_amount" },
    ],
    note: "Consecutive due dates must be ≥ the DDS minimum gap for the frequencyCeiling (V8).",
  },
  "create.submit": {
    title: "Create & Send Contract",
    direction: "push",
    endpoint: CREATE,
    lines: [
      { system: "BE API", ref: "201 → mandateId, ddaId, status, reviewUrl, reviewLinkExpiresAt, schedule[]" },
      { system: "DDS", ref: "POST /v1/merchant/direct-debit-authorities", note: "skipped when bankInfoFillByCustomer = true" },
    ],
    note: "Then Geidea sends the signing SMS/email/WhatsApp unless suppress_customer_notifications = true (S2 §7).",
  },

  // ---------------- Contract list / detail (pull) ----------------
  "view.merchantRef": {
    title: "Merchant reference",
    direction: "pull",
    endpoint: LIST,
    lines: [
      { system: "BE API", ref: "ddaReferenceNumber" },
      { system: "Order Model", ref: "Mandate.dda_reference_number" },
    ],
  },
  "view.mandateRef": {
    title: "Mandate reference",
    direction: "pull",
    endpoint: DETAIL,
    lines: [
      { system: "BE API", ref: "data.mandate.ddaId" },
      { system: "Order Model", ref: "Mandate.dda_id" },
      { system: "DDS", ref: "ddaId", note: "returned by Create DDA 201" },
    ],
    note: "The DD-YYYY-##### format here is a prototype placeholder — the real ddaId is DDS's number (e.g. 164132). Empty under TBFC until the customer submits the instrument.",
  },
  "view.customerName": {
    title: "Customer name",
    direction: "pull",
    endpoint: DETAIL,
    lines: [
      { system: "BE API", ref: "data.mandate.customerFullName" },
      { system: "Order Model", ref: "Mandate.customer_full_name" },
    ],
  },
  "view.emiratesId": {
    title: "Emirates ID",
    direction: "pull",
    endpoint: DETAIL,
    lines: [
      { system: "BE API", ref: "data.mandate.emiratesId" },
      { system: "Order Model", ref: "Mandate.customer_id_number" },
    ],
  },
  "view.status": {
    title: "Contract status",
    direction: "pull",
    endpoint: DETAIL,
    lines: [
      { system: "BE API", ref: "data.mandate.status / statusLabel" },
      { system: "Order Model", ref: "Mandate.status_code + status_label" },
      { system: "DDS", ref: "Get Status of a DDA → status", note: "PNDG / SUBP / APRP / ACCP / RJCT / …" },
    ],
    note: "Local-only labels: Awaiting Customer Details, Link Expired, Discarded, Cancelled — <reason> (terminal refusal, S6 §2.1).",
  },
  "view.subscriptionStatus": {
    title: "Subscription status",
    direction: "pull",
    endpoint: DETAIL,
    lines: [
      { system: "BE API", ref: "data.subscriptions[].status" },
      { system: "Order Model", ref: "Subscription.status (+ pause_reason)" },
    ],
  },
  "view.createdOn": {
    title: "Created on",
    direction: "pull",
    endpoint: DETAIL,
    lines: [
      { system: "BE API", ref: "data.mandate.createdAt" },
      { system: "Order Model", ref: "Mandate.created_at" },
    ],
  },
  "view.validity": {
    title: "Validity",
    direction: "pull",
    endpoint: DETAIL,
    lines: [
      { system: "BE API", ref: "data.mandate.commencesOn / expiresOn" },
      { system: "Order Model", ref: "Mandate.commences_on / expires_on" },
    ],
  },
  "view.frequency": {
    title: "Frequency",
    direction: "pull",
    endpoint: DETAIL,
    lines: [
      { system: "BE API", ref: "data.mandate.paymentFrequency" },
      { system: "Order Model", ref: "Mandate.payment_frequency" },
    ],
  },
  "view.amountType": {
    title: "Amount type",
    direction: "pull",
    endpoint: DETAIL,
    lines: [
      { system: "BE API", ref: "data.mandate.amountType" },
      { system: "Order Model", ref: "Mandate.amount_type" },
    ],
  },
  "view.minMax": {
    title: "Min / Max amount",
    direction: "pull",
    endpoint: DETAIL,
    lines: [
      { system: "BE API", ref: "data.mandate.minAmount / maxAmount" },
      { system: "Order Model", ref: "Mandate.min_amount / max_amount" },
    ],
  },
  "view.instrument": {
    title: "Payment method",
    direction: "pull",
    endpoint: DETAIL,
    lines: [
      { system: "BE API", ref: "data.mandate.paymentMethodType + bankName + iban (masked)" },
      { system: "Order Model", ref: "Mandate.instrument_type + bank_name + instrument_reference" },
    ],
  },
  "view.rollover": {
    title: "Rollover",
    direction: "pull",
    endpoint: DETAIL,
    lines: [
      { system: "BE API", ref: "data.subscriptions[].isRollOverEnabled / rollOversAllowed" },
      { system: "Order Model", ref: "Subscription.rollover_enabled / rollovers_allowed" },
    ],
    note: "\"Left in the current run\" is derived: rollovers_allowed − Occurrences marked rolled_over since the last Paid one (S6 §3.1).",
  },
  "view.notes": {
    title: "Notes",
    direction: "pull",
    endpoint: DETAIL,
    lines: [
      { system: "BE API", ref: "notes · update: PUT /direct-debit/v1/contracts/{mandateId}/notes" },
      { system: "Order Model", ref: "Mandate.notes" },
    ],
  },
  "view.scheduleVersion": {
    title: "Schedule version",
    direction: "pull",
    endpoint: DETAIL,
    lines: [
      { system: "BE API", ref: "scheduleVersion", note: "proposed read field — S7 §2.3 returns it after an amend" },
      { system: "Order Model", ref: "Subscription.schedule_version" },
    ],
  },
  // collections table columns
  "col.seq": {
    title: "#",
    direction: "pull",
    endpoint: COLLECTIONS,
    lines: [
      { system: "BE API", ref: "collections[].sequenceNumber" },
      { system: "Order Model", ref: "Occurrence.sequence_number" },
    ],
  },
  "col.dueDate": {
    title: "Due date",
    direction: "pull",
    endpoint: COLLECTIONS,
    lines: [
      { system: "BE API", ref: "collections[].dueDate" },
      { system: "Order Model", ref: "Occurrence.due_date" },
    ],
  },
  "col.amount": {
    title: "Amount",
    direction: "pull",
    endpoint: COLLECTIONS,
    lines: [
      { system: "BE API", ref: "collections[].currentAmount (+ originalAmount, amountSource)" },
      { system: "Order Model", ref: "Occurrence.amount / original_amount / amount_source" },
    ],
  },
  "col.status": {
    title: "Collection status",
    direction: "pull",
    endpoint: COLLECTIONS,
    lines: [
      { system: "BE API", ref: "collections[].status + reasonCode" },
      { system: "Order Model", ref: "Occurrence.status (+ skip_reason) · Payment.current_status + reason_code" },
      { system: "DDS", ref: "Bulk Payment Requests Status Report → status, reasonCode" },
    ],
    note: "Rejected = can still be retried. Failed = final. Representment Pending (Payment RPND) = a retry is with DDS.",
  },
  "col.rolledOver": {
    title: "Rolled over",
    direction: "pull",
    endpoint: COLLECTIONS,
    lines: [
      { system: "BE API", ref: "collections[].rolledOver" },
      { system: "Order Model", ref: "Occurrence.rolled_over (+ rolled_over_to_occurrence_id)" },
    ],
    note: "none / rolled_over / blocked_by_ceiling / exhausted / no_destination — automatic only (S6 §3).",
  },
  "col.retryDeadline": {
    title: "Retry deadline",
    direction: "pull",
    endpoint: COLLECTIONS,
    lines: [
      { system: "BE API", ref: "collections[].retryDeadline", note: "new — S6 §1.2 / S7 §2.3" },
      { system: "Order Model", ref: "Occurrence.retry_deadline" },
    ],
    note: "= next collection's due date − DDS min gap − 1 working day (last collection: expires_on). Recalculated whenever this or the next collection's date changes.",
  },
  "col.payoutStatus": {
    title: "Payout status",
    direction: "pull",
    endpoint: COLLECTIONS,
    lines: [{ system: "BE API", ref: "collections[].payoutStatus", note: "APEX-derived; no Order Model field yet" }],
  },
  "col.collectedOn": {
    title: "Collected on",
    direction: "pull",
    endpoint: COLLECTIONS,
    lines: [
      { system: "BE API", ref: "collections[].collectedAt" },
      { system: "Order Model", ref: "Payment.debit_date", note: "actual debit date from Day-End report (S5 §3.4)" },
    ],
  },

  // ---------------- Merchant actions (push) ----------------
  "act.retry": {
    title: "Retry",
    direction: "push",
    endpoint: "POST /direct-debit/v1/contracts/{contractId}/collections/{collectionId}/retry (no body)",
    lines: [
      { system: "Order Model", ref: "Payment.retry_count + 1 · current_status = RPND · last_retry_at" },
      { system: "DDS", ref: "POST /v1/merchant/payments/{dds_payment_id}/represent" },
    ],
    note: "Refused with NOT_RETRYABLE / RETRIES_EXHAUSTED / RETRY_WINDOW_CLOSED / CONTRACT_NOT_ACTIVE / SUBSCRIPTION_PAUSED (S6 §1.1).",
  },
  "act.pause": {
    title: "Pause",
    direction: "push",
    endpoint: "POST /direct-debit/v1/subscriptions/{subscriptionId}/pause",
    lines: [
      { system: "BE API", ref: "{ reason }", note: "O · max 500" },
      { system: "Order Model", ref: "Subscription.status = Paused · paused_at · pause_reason" },
    ],
    note: "Geidea-only — DDS is not told.",
  },
  "act.resume": {
    title: "Resume",
    direction: "push",
    endpoint: "POST /direct-debit/v1/subscriptions/{subscriptionId}/resume",
    lines: [{ system: "Order Model", ref: "Subscription.status = Active · resumed_at" }],
  },
  "act.cancel": {
    title: "Cancel mandate",
    direction: "push",
    endpoint: "POST /direct-debit/v1/contracts/{mandateId}/cancel (S8 — parked)",
    lines: [
      { system: "BE API", ref: "{ reasonCode, originatorComments }" },
      { system: "DDS", ref: "POST /v1/merchant/direct-debit-authorities/{ddaId}/cancellation" },
    ],
  },
  "act.amend": {
    title: "Amend schedule",
    direction: "push",
    endpoint: "PATCH /direct-debit/v1/subscriptions/{subscriptionId}/collections",
    lines: [
      { system: "BE API", ref: "{ scheduleVersion, reason?, changes[]: { collectionId, newDueDate?, newAmount? } }" },
      { system: "Order Model", ref: "Occurrence.due_date / amount / amount_source = merchant_edited / amend_reason · Subscription.schedule_version + 1" },
    ],
    note: "One call for the whole subscription — validates the resulting schedule (A0–A13) and saves all-or-nothing. Not sent to DDS.",
  },
  "act.resend": {
    title: "Resend signing link",
    direction: "push",
    endpoint: "POST /direct-debit/v1/contracts/{mandateId}/resend-signing-link",
    lines: [
      { system: "Order Model", ref: "Mandate.signing_notification_count + 1 · signing_notification_sent_at · signing_notification_channels" },
    ],
    note: "Allowed while awaiting_customer_instrument or PNDG · max 5 resends · 422 NOTIFICATIONS_SUPPRESSED when suppressed. Link-expiry extension is not in this prototype yet.",
  },

  // ---------------- Customer verification + review (S3) ----------------
  "cust.access": {
    title: "Page state",
    direction: "pull",
    endpoint: "GET /direct-debit/v1/sign/{mandateId}/access",
    lines: [{ system: "BE API", ref: "pageState", note: "NOT_AVAILABLE | ALREADY_SIGNED | EXPIRED | OTP_REQUIRED | READY" }],
  },
  "cust.merchantName": {
    title: "Merchant name",
    direction: "pull",
    endpoint: "GET /direct-debit/v1/sign/{mandateId}/access",
    lines: [
      { system: "BE API", ref: "merchantDisplayName" },
      { system: "Order Model", ref: "Merchant profile → display name (by Mandate.merchant_id)" },
    ],
    note: "The only way the customer learns which merchant the contract is from — DDS always shows Geidea (our OIC).",
  },
  "cust.description": {
    title: "Contract description",
    direction: "pull",
    endpoint: "GET /direct-debit/v1/sign/{mandateId}/access",
    lines: [
      { system: "BE API", ref: "contractDescription", note: "proposed — S3 §2 returns it only after OTP today" },
      { system: "Order Model", ref: "Mandate.contract_description" },
    ],
  },
  "cust.name": {
    title: "Customer name",
    direction: "pull",
    endpoint: "GET /direct-debit/v1/sign/{mandateId}/access",
    lines: [
      { system: "BE API", ref: "customerName", note: "proposed — S3 §2 returns it only after OTP today" },
      { system: "Order Model", ref: "Mandate.customer_full_name" },
    ],
  },
  "cust.maskedEid": {
    title: "Emirates ID (masked)",
    direction: "pull",
    endpoint: "GET /direct-debit/v1/sign/{mandateId}/access",
    lines: [
      { system: "BE API", ref: "maskedEmiratesId", note: "proposed" },
      { system: "Order Model", ref: "Mandate.customer_id_number" },
    ],
  },
  "cust.maskedEmail": {
    title: "Email (masked)",
    direction: "pull",
    endpoint: "GET /direct-debit/v1/sign/{mandateId}/access",
    lines: [
      { system: "BE API", ref: "maskedEmail", note: "proposed" },
      { system: "Order Model", ref: "Mandate.customer_email" },
    ],
  },
  "cust.maskedMobile": {
    title: "Mobile (masked)",
    direction: "pull",
    endpoint: "GET /direct-debit/v1/sign/{mandateId}/access",
    lines: [
      { system: "BE API", ref: "maskedMobile", note: "in S3 §2 today, e.g. 05•••••64" },
      { system: "Order Model", ref: "Mandate.customer_mobile_number" },
    ],
  },
  "cust.otpChannel": {
    title: "Send OTP to",
    direction: "push",
    endpoint: "POST /direct-debit/v1/sign/{mandateId}/send-otp (proposed)",
    lines: [{ system: "BE API", ref: "{ channel: \"SMS\" | \"EMAIL\" }", note: "proposed" }],
    note: "Replaces S3 §3a (customer types the full mobile, OTP by SMS only) — S3 needs updating if this design is kept. OTP: 6 digits, 5 min, resend after 60 s, max 3 per 30 min.",
  },
  "cust.otp": {
    title: "OTP",
    direction: "push",
    endpoint: "POST /direct-debit/v1/sign/{mandateId}/verify-otp",
    lines: [
      { system: "BE API", ref: "{ otp }", note: "6 digits" },
      { system: "BE API", ref: "→ review session token (30 min)", note: "OTP_INVALID / OTP_EXPIRED · lock after 5 wrong" },
    ],
    note: "Prototype accepts 123456.",
  },
  "cust.contractDetails": {
    title: "Contract details",
    direction: "pull",
    endpoint: "GET /direct-debit/v1/sign/{mandateId}/getCustomerContractDetails (review session required)",
    lines: [
      { system: "Order Model", ref: "contract_description, customer_full_name, customer_id_number (masked), instrument, commences_on–expires_on, amount_type, min/max, Subscription.frequency, Occurrences, review_link_expires_at" },
    ],
    note: "Never returned: notes, full IBAN/card, uaepass_signing_url.",
  },
  "cust.instrument": {
    title: "Customer instrument (TBFC)",
    direction: "push",
    endpoint: "POST /direct-debit/v1/sign/{mandateId}/instrument",
    lines: [
      { system: "BE API", ref: "paymentMethodType, bankName, accountHolderTitle, bankAccountType, iban | cardNumber, cardHolderName", note: "same rules as S2 §3a" },
      { system: "DDS", ref: "Create DDA — called now for the first time", note: "S2 §4c mapping" },
    ],
  },
  "cust.sign": {
    title: "Sign with UAE PASS",
    direction: "push",
    endpoint: "POST /direct-debit/v1/sign/{mandateId}/start-signing",
    lines: [
      { system: "BE API", ref: "→ uaepass_signing_url", note: "only when status_code = PNDG and link not expired" },
      { system: "DDS", ref: "{DDS}/appApi/v1/customer/uaepass-signer-process?mode=web&ddarId={ddar_id}&redirectUrl=…" },
    ],
  },

  // ---------------- Notifications (S2 §7, S3 §1) ----------------
  "notif.template": {
    title: "Signing notification",
    direction: "pull",
    endpoint: "Sent by the Backend after Create Contract (S2 §7) and on resend (S3 §1)",
    lines: [
      { system: "Order Model", ref: "Merchant display name · Mandate.contract_description · review URL · Mandate.review_link_expires_at" },
      { system: "Order Model", ref: "Mandate.signing_notification_sent_at / signing_notification_channels" },
    ],
    note: "Channels: SMS, email and WhatsApp, Arabic + English. Review URL = https://<portal-host>/contracts/review/{mandateId}.",
  },
} satisfies Record<string, FieldHintDef>;

export type HintKey = keyof typeof DD_FIELD_HINTS;
