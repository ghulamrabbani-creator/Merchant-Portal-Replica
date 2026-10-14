// Contract-level merchant actions shared by the Contract List row menu and Contract Detail
// (added 14-Oct-2026, MP Backlog v2: US-15 Resend, US-34 Discard, US-35 Edit notes).
// Prototype: changes are written to the shared in-memory record (and to this browser's store for
// contracts created here), and each one is recorded in the contract's activity history (US-32).

import { useSyncExternalStore } from "react";
import { persistIfCreated } from "./dd-contract-store";
import { directDebitContracts } from "./mock-data";
import { activityEvent, canDiscard, isLinkExpired, isUnsigned, maskEmail, maskMobile, resendLinkExpiry } from "./direct-debit";
import { DirectDebitContract } from "./types";

export const MAX_RESENDS = 5;

function record(id: string): DirectDebitContract | undefined {
  return directDebitContracts.find((x) => x.id === id);
}

function log(c: DirectDebitContract, actor: string, text: string) {
  c.activity = [activityEvent(actor, text), ...(c.activity ?? [])];
}

/** Why Resend is not available right now, or null when it is. */
export function resendBlockedReason(c: DirectDebitContract, canManageUnsigned: boolean): string | null {
  if (!canManageUnsigned) return "Your role doesn't include the Manage Unsigned Contract permission.";
  if (!isUnsigned(c.status)) return "Resend is only for Awaiting Customer Details and DD Pending contracts.";
  if (isLinkExpired(c.reviewLinkExpiresAt)) return "The review link has expired — it can no longer be resent. Discard the contract and create a new one.";
  const resends = Math.max(0, (c.signingNotificationCount ?? 1) - 1);
  if (resends >= MAX_RESENDS) return `Maximum ${MAX_RESENDS} resends reached.`;
  return null;
}

/** US-15: resend the signing link; extends the link to end of day, today + 7 days, capped for
 *  DD Pending at 7 working days from creation (DDS's own expiry). Returns the confirmation text. */
export function resendSigningLink(id: string, reviewExpiryDays: number): string {
  const c = record(id);
  if (!c) return "";
  const n = (c.signingNotificationCount ?? 1) + 1;
  c.signingNotificationCount = n;
  c.reviewLinkExpiresAt = resendLinkExpiry(c.createdOn, c.status, reviewExpiryDays);
  const mobile = c.customerMobile ?? "0501234567";
  const email = c.customerEmail ?? "customer@example.com";
  log(c, "Merchant user", `Signing link resent (${n - 1} of ${MAX_RESENDS}); link now valid until ${c.reviewLinkExpiresAt}`);
  persistIfCreated(c);
  notifyContractsChanged();
  return `Signing link resent by SMS (${maskMobile(mobile)}) and email (${maskEmail(email)}) — resend ${n - 1} of ${MAX_RESENDS}. The link is now valid until ${c.reviewLinkExpiresAt}.`;
}

/** Why Discard is not available, or null. */
export function discardBlockedReason(c: DirectDebitContract, canManageUnsigned: boolean): string | null {
  if (!canManageUnsigned) return "Your role doesn't include the Manage Unsigned Contract permission.";
  if (!canDiscard(c.status)) return "Only a contract the customer has not signed can be discarded.";
  return null;
}

/** US-34: discard an unsigned contract. For DD Pending / DD Request Expired, Geidea discards the
 *  mandate at DDS first (simulated as successful here). */
export function discardContract(id: string): string {
  const c = record(id);
  if (!c) return "";
  const atDds = c.status === "Pending Customer Sign" || c.status === "Request Expired";
  c.status = "Discarded";
  c.subscriptionStatus = "Cancelled";
  c.occurrences = c.occurrences.map((o) => (o.status === "Scheduled" ? { ...o, status: "Cancelled" } : o));
  c.statusNote = "Discarded by the merchant — the review link now shows 'no longer available'.";
  log(c, "Merchant user", atDds ? "Contract discarded (DDS Discard DDA confirmed)" : "Contract discarded");
  persistIfCreated(c);
  notifyContractsChanged();
  return `Contract ${c.merchantRef} discarded${atDds ? " — DDS confirmed the mandate is discarded" : ""}. Its merchant reference stays used; a new contract needs a new reference.`;
}

/** US-35: edit merchant-only notes (any status, up to 1,000 characters). */
export function editNotes(id: string, notes: string): void {
  const c = record(id);
  if (!c) return;
  const before = c.notes ?? "";
  c.notes = notes;
  log(c, "Merchant user", `Notes edited (was: "${before || "—"}")`);
  persistIfCreated(c);
  notifyContractsChanged();
}

/** Records an action taken on the contract's subscription/collections (pause, amend, retry…). */
export function logActivity(id: string, actor: string, text: string): void {
  const c = record(id);
  if (!c) return;
  log(c, actor, text);
  persistIfCreated(c);
  notifyContractsChanged();
}

// ---- Re-render after an action (the records above are plain objects, not React state) ----
let version = 0;
const listeners = new Set<() => void>();
/** Call after any change to a contract record so open screens re-read it. */
export function notifyContractsChanged() {
  version++;
  listeners.forEach((l) => l());
}
/** Subscribe a screen to contract changes made through these actions. */
export function useContractsVersion(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
    () => 0
  );
}
