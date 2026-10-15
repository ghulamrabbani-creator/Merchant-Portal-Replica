// Build/changelog banner data (added Sep 2026, Rabbani) — shown in the black bar at the very
// top of the portal so anyone referencing this replica during development knows when the last
// material change went in and what it was. There's no backend/build pipeline here to read a real
// deploy timestamp from, so BOTH of these are maintained BY HAND:
//
//   1. Bump LAST_UPDATED to today's date whenever you push a change.
//   2. Prepend a new entry to CHANGELOG (most recent first) describing what changed and why —
//      written for a developer picking this repo back up, not as a commit message.
//
// Keep entries short (1-3 sentences). This is a dev-reference tool, not customer-facing, so
// there's no need to soften or generalize the language.

export interface ChangelogEntry {
  date: string; // "09 Sep 2026" — matches formatDateNice's output style elsewhere in the app
  description: string;
}

export const LAST_UPDATED = "15 Oct 2026";

// Full history below covers Direct Debit specifically, back to its first release on the portal
// (01 Sep 2026) — compiled 09 Sep 2026 from the repo's commit history across every session so far.
// Only shipped, user-visible features/changes are listed here; internal notes, refactors with no
// behavior change, and lint/build fixes are deliberately left out.
//
// Housekeeping note (10-Sep-2026): the two entries directly below were found reverted to describe
// the pre-correction "merchant still picks the type" behavior — likely lost in a manual tidy-up
// pass on GitHub. Corrected back to match the actual shipped code (customer picks under TBFC,
// confirmed live by Rabbani on 10-Sep-2026) rather than silently left stale.
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "15 Oct 2026",
    description:
      "Direct Debit aligned to DDS's answers of 15-Oct-2026 (MP Backlog v2.2, Confluence v2.5). (1) A collection in Error is no longer retried (DDS represents rejected payments only): it shows \"Payment validation error\", has no Retry and no bounce memo, and is re-set with Amend schedule — it becomes Scheduled again with a new payment reference (next unused number, e.g. …-000013); the earlier attempt stays in its history. Try it on \"Error Collection\". (2) DD Denied removed (banks don't support DENY); Declined = Rejected + Error. (3) Geidea reference code: a 5-digit code (48213 in the prototype) sits in front of every merchant reference; the merchant types up to 20 characters; shown read-only in PGW Config. (4) Collection rows show their payment reference once sent. (5) Customer signing outcomes follow DDS's UAE PASS Signature API v1.4 (finished / failed with the exact IBAN message / canceled / ddsError).",
  },
  {
    date: "14 Oct 2026",
    description:
      "Direct Debit aligned to MP Backlog v2 and Confluence v2.5. (1) Role (prototype) switcher in the top bar replaces the per-merchant action toggles — Business admin, Operator, Viewer, Bulk maker, Bulk checker; each button follows the role's permissions. PGW Config drops the OIC choice (Geidea OIC only), the notification-suppression switch and the action toggles. (2) Statuses: one DD-tagged list (DD Pending, DD Active, DD Rejected, DD Error…) plus Not Submitted, Pending System Submission, Link Expired and Discarded; Suspended and Completed removed. (3) Contract List: KPIs computed from the contracts in view (Total Collections = Paid only, Failed = Failed only, Declined = Rejected + Denied + Error) and hidden while searching; working search, filters (all DDS frequencies) and store selector (Store column when more than one store); row menu with View, Resend and Discard. (4) Contract Detail: Cancel mandate removed; Discard, Edit notes, Resend that extends the link, signed/unsigned contract download, contract description, store, Not Submitted banner and activity history added; Pause asks for an optional reason. (5) Collections: Error is retryable (checked against the DDS minimum gap), Failed is final; bounce memo download. (6) Create: field rules (reference 3–26 and unique, Emirates ID, mobile, name up to 7 words, IBAN, card Luhn), store picker, and a prototype DDS answer (Accepted / Refused / No answer → Not Submitted). (7) Customer page: signing lands on Pending System Submission, UAE PASS signing-password tip, four signing outcomes with Try again, signed-contract download. (8) Later the same day (Backlog v2.1 / Confluence v2.6): KPI cards always cover every contract in the selected stores (filters and search don't change them); the IBAN is shown in full everywhere, cards stay masked; Contract Detail is titled by the merchant reference (it is the DDS reference) and shows the Central Bank reference once DD Active.",
  },
  {
    date: "25 Sep 2026",
    description:
      "Direct Debit aligned to Backend Stories S1–S7. (1) Dev hints: a new \"Dev hints\" switch in this bar (off by default) shows an ⓘ next to every DD field, column and action — hover to see the BE API field, Order Model field and DDS field it's sent to or read from, with the live value. (2) PGW Config in MA adds Suppress Geidea customer notifications, first-collection lead time (4 working days), contract review expiry (7 days) and the 8 per-action toggles; Maximum Contract Amount and lead time are now enforced at contract creation. (3) After Create & Send, a new Contract submitted page shows the Portal → DD Backend and DD Backend → DDS (Create DDA) payloads side by side, plus the SMS and email the customer receives (hidden when notifications are suppressed). (4) The customer link now opens /contracts/review/{id} in a new tab: a verification screen (merchant name, description, masked EID/email/mobile, OTP by SMS or email — 123456 in the prototype) before the existing review & sign page. Created contracts are stored in this browser's localStorage so the new tab can find them.",
  },
  {
    date: "25 Sep 2026",
    description:
      "Direct Debit collections: manual rollover (Rollover button, destination picker, Undo) removed — out of MVP scope; only automatic rollover is shown. New statuses Rejected (retryable) vs Failed (final), Representment Pending while a retry is with DDS, and DDS reason codes. Retry now follows the retry deadline (next due date − DDS minimum gap − 1 working day) and is blocked for terminal reason codes, which close the contract as \"Cancelled — <reason>\". Collection Preview uses the DDS minimum-gap table (by payment frequency ceiling). Contract Detail gets Amend schedule (subscription-level, validated against rules A0–A13) and Resend signing link. New demo contracts: Terminal Refusal, Retry Window Closed, Amend Schedule.",
  },
  {
    date: "10 Sep 2026",
    description:
      "Direct Debit: PGW Config in MA and DD BE Config now persist to this browser's localStorage instead of resetting on refresh — the prior in-memory-only behavior made a couple of the demo scenarios (Disable Credit Card, Bulk Upload) hard to show since any refresh silently reverted them. Each modal now has a \"Reset to defaults\" link to clear the persisted config on demand. Hydration is SSR-safe (defaults render first, then the persisted value loads in a mount effect) so there's no server/client mismatch. Note: DD BE Config's password and encryption key are stored in plaintext in localStorage — acceptable for this dev-reference tool, flagged here for visibility.",
  },
  {
    date: "10 Sep 2026",
    description:
      "Direct Debit: added the \"PGW Config in MA\" and \"DD BE Config\" screens, reachable as buttons in the top ChangeLogBar (functional build of the wireframe iterated with Rabbani). PGW Config in MA covers Enable Direct Debit (Sidebar visibility), OIC choice (Geidea/Merchant — config-only, not wired to any visible behavior yet), Disable Credit Card Instrument, Enable Bulk Contract Upload, and Maximum Contract Amount. Toggling Disable Credit Card now actually removes Credit Card from both the contract-creation instrument picker and the customer's TBFC step; Enable Bulk Contract Upload adds a \"Bulk Upload\" button (coming-soon placeholder) next to \"+ Add Contract\" on the Contract List. All config lives in a new DDConfigContext — in-memory only, same reset-on-reload pattern as the rest of this prototype.",
  },
  {
    date: "09 Sep 2026",
    description:
      "Direct Debit TBFC: corrected — the ENTIRE instrument decision (which type, not just its account/card details) is the customer's to make, not the merchant's. The merchant makes no instrument choice at all when TBFC is checked; the customer gets the same Bank Account / Credit Card selector the merchant used to see, on the Sign page's instrument step.",
  },
  {
    date: "09 Sep 2026",
    description:
      "Direct Debit TBFC: added a second demo contract (Credit Card) so both instrument types are reachable from the Contract List — the only prior TBFC demo record was Bank Account, which made the Sign page's credit-card fields (card holder name, issuing bank, card number) impossible to see without hand-building a new contract. (Removed again the same day — one demo record now covers both, since the customer picks the type live.)",
  },
  {
    date: "09 Sep 2026",
    description:
      "Direct Debit: added the To Be Filled By Customer (TBFC) flow — merchant can defer instrument details to the customer's own review-and-sign step, which now has a dedicated instrument-capture step before Review & Sign. Contract List's first column changed from the DDS mandate reference to Merchant Reference (merchant-facing screen; the DDS reference has nothing to show while a TBFC contract is still pending).",
  },
  {
    date: "09 Sep 2026",
    description:
      "Direct Debit: demo contracts on the Contract List were relabeled from generic dummy names to short scenario descriptions in the first/last name fields (e.g. \"Rollover Exhausted\", \"Paused Skipped\", \"Mandate Rejected\") so each record's purpose is clear at a glance instead of needing to be opened first.",
  },
  {
    date: "04 Sep 2026",
    description:
      "Direct Debit: occurrence schedules now generate the full term at the contract's own frequency (previously hardcoded), with not-yet-due occurrences shown as Scheduled instead of omitted. Added a Resume action mirroring Pause on the Contract Detail screen.",
  },
  {
    date: "04 Sep 2026",
    description:
      "Direct Debit: added the Review & Sign contract-signing flow (multi-step review, then e-sign). Added a rollover destination-picker so a failed occurrence can be redirected to a specific chosen upcoming occurrence rather than always the next one. Contract creation now also captures a free-text contract description, shown in the review step.",
  },
  {
    date: "03 Sep 2026",
    description:
      "Direct Debit: added retry-attempt tracking (capped at a maximum retry count) on the Contract List and Detail screens, and a Skipped occurrence status for occurrences deliberately bypassed — e.g. while a subscription is paused — kept distinct from a Failed one.",
  },
  {
    date: "02 Sep 2026",
    description:
      "Direct Debit: added the Contract Detail screen, bank selection on contract creation (per the DDS Banks Master Table), and success/failure collection summary counts on the Contract List.",
  },
  {
    date: "01 Sep 2026",
    description:
      "Direct Debit: initial release — Contract List added to the portal with the contract/subscription/occurrence data model and demo contract data.",
  },
];
