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

export const CHANGELOG: ChangelogEntry[] = [
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
    date: "04 Sep 2026",
    description:
      "Direct Debit: occurrence schedules now generate the full term at the contract's own frequency (previously hardcoded), with not-yet-due occurrences shown as Scheduled instead of omitted. Added a Resume action mirroring Pause on the Contract Detail screen.",
  },
];
