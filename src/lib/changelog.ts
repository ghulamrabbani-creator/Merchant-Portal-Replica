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

export const LAST_UPDATED = "09 Sep 2026";

// Full history below covers Direct Debit specifically, back to its first release on the portal
// (01 Sep 2026) — compiled 09 Sep 2026 from the repo's commit history across every session so far.
// Only shipped, user-visible features/changes are listed here; internal notes, refactors with no
// behavior change, and lint/build fixes are deliberately left out.
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "09 Sep 2026",
    description:
      "Direct Debit TBFC: added a second demo contract (Credit Card) so both instrument types are reachable from the Contract List — the only prior TBFC demo record was Bank Account, which made the Sign page's credit-card fields (card holder name, issuing bank, card number) impossible to see without hand-building a new contract.",
  },
  {
    date: "09 Sep 2026",
    description:
      "Direct Debit TBFC: the merchant still picks Bank Account vs Credit Card up front — only the account/card details themselves are deferred to the customer. (Encryption is handled backend-side; no field-level representation needed here.)",
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
