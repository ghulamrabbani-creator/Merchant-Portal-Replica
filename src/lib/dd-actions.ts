// Contract-level merchant actions shared by the Contract List row menu and Contract Detail
// (added 14-Oct-2026, MP Backlog v2: US-15 Resend, US-34 Discard, US-35 Edit notes).
// Prototype: changes are written to the shared in-memory record (and to this browser's store for
// contracts created here), and each one is recorded in the contract's activity history (US-32).

import { useSyncExternalStore } from "react";
import { applyCancellationOverlays, persistIfCreated, saveCancellationOverlay } from "./dd-contract-store";
import { directDebitContracts } from "./mock-data";
import {
  activityEvent,
  canDiscard,
  cancelReasonLabel,
  ddToday,
  formatCreatedOn,
  formatDateNice,
  isCancellationPending,
  isLinkExpired,
  isUnsigned,
  maskEmail,
  maskMobile,
  occurrencesAfterCancellation,
  resendLinkExpiry,
} from "./direct-debit";
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

/** Pause / Resume (US-20): records the subscription status on the contract and logs it. */
export function setSubscriptionPaused(id: string, paused: boolean, text: string): void {
  const c = record(id);
  if (!c) return;
  c.subscriptionStatus = paused ? "Paused" : "Active";
  log(c, "Merchant user", text);
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


// ---- Contract cancellation (15-Oct-2026 — Confluence S8; MP Backlog US-21, US-40, US-41) ----
// Prototype of POST /direct-debit/v1/contracts/{mandateId}/cancellation. DDS's DDA Cancellation
// call is simulated as successful (201 with ddcarid / ddcaid). Collections continue until the
// customer signs; they stop once signed; the daily status check closes the contract or, if the
// bank rejects, returns it to DD Active.
// 18-Nov-2026 (Confluence v2.7): every customer message about a cancellation is EMAIL ONLY (no
// SMS) — request (and resends), accepted, rejected. The link has no expiry; the merchant can
// resend it once per day. On cancellation ACCP Geidea cancels the mandate on its side at once (no
// separate DDA status inquiry); in-file payments run to the end, everything else stops.

/** Why Cancel Contract is not available, or null when it is (US-21). */
export function cancelBlockedReason(c: DirectDebitContract, canCancel: boolean): string | null {
  if (!canCancel) return "Your role doesn't include the Cancel Contract permission.";
  if (c.status !== "Active") return "Only a DD Active contract can be cancelled. An unsigned contract is discarded instead.";
  if (isCancellationPending(c)) return "A cancellation is already pending for this contract.";
  return null;
}

let ddcaSeq = 185612;

/** US-21: start a cancellation. Returns the confirmation text. */
export function requestCancellation(
  id: string,
  reasonCode: string,
  comments: string,
  pauseCollections: boolean
): string {
  const c = record(id);
  if (!c) return "";
  const n = ddcaSeq++;
  c.cancellation = {
    cancellationId: `${c.id}-cx${n}`,
    ddcaId: n,
    ddcarId: n - 12391,
    reasonCode,
    comments: comments || undefined,
    requestedBy: "Merchant user",
    requestedAt: formatCreatedOn(new Date()),
    stage: "awaiting_customer",
    pausedByCancellation: pauseCollections && c.subscriptionStatus === "Active",
    lastSentOn: formatDateNice(ddToday()),
    notificationCount: 1,
  };
  if (c.cancellation.pausedByCancellation) c.subscriptionStatus = "Paused";
  const reason = `${cancelReasonLabel(reasonCode)} (${reasonCode})${comments ? ` — ${comments}` : ""}`;
  log(c, "Merchant user", `Cancellation requested: ${reason}. DDS cancellation request ${n} created${c.cancellation.pausedByCancellation ? "; collections paused" : ""}`);
  log(c, "System", "Cancellation request email sent to the customer (link to review and sign; no expiry)");
  persistIfCreated(c);
  saveCancellationOverlay(c);
  notifyContractsChanged();
  const email = c.customerEmail ?? "customer@example.com";
  return `Cancellation request sent. The customer has been emailed a link (${maskEmail(email)}) to sign it with UAE PASS. ${
    c.cancellation.pausedByCancellation
      ? "Collections are paused."
      : "Collections continue until the customer signs — pause the subscription to stop them now."
  }`;
}

/** Why the cancellation link can't be resent, or null (US-40). Once per day (S8 §2.2, v2.7);
 *  no cap on the number of days and no expiry — the DDS request never expires. */
export function cancelResendBlockedReason(c: DirectDebitContract, canCancel: boolean): string | null {
  if (!canCancel) return "Your role doesn't include the Cancel Contract permission.";
  if (c.cancellation?.stage !== "awaiting_customer") return "The customer has already signed the cancellation.";
  if (c.cancellation.lastSentOn === formatDateNice(ddToday())) return "Already emailed today — the link can be resent once per day (RESEND_LIMIT_REACHED).";
  return null;
}

export function resendCancellationLink(id: string): string {
  const c = record(id);
  if (!c?.cancellation) return "";
  c.cancellation.notificationCount += 1;
  c.cancellation.lastSentOn = formatDateNice(ddToday());
  log(c, "Merchant user", "Cancellation link resent to the customer by email");
  persistIfCreated(c);
  saveCancellationOverlay(c);
  notifyContractsChanged();
  const email = c.customerEmail ?? "customer@example.com";
  return `Cancellation link emailed again to ${maskEmail(email)}. You can resend it once per day; the link works until the customer signs.`;
}

/** US-41: the customer signed the cancellation (callback finished, confirmed with DDS). */
export function cancellationSigned(id: string): void {
  const c = record(id);
  if (!c?.cancellation || c.cancellation.stage !== "awaiting_customer") return;
  c.cancellation.stage = "with_bank";
  c.cancellation.signedAt = formatCreatedOn(new Date());
  log(c, "Customer", "Cancellation signed via UAE PASS — collections stop while the bank decides");
  persistIfCreated(c);
  saveCancellationOverlay(c);
  notifyContractsChanged();
}

/** Prototype: the daily cancellation status check (S8 §5) — bank accepted (cancellation ACCP:
 *  Geidea cancels the mandate on its side at once, no DDA status inquiry) or rejected (RJCT). */
export function cancellationDecided(id: string, accepted: boolean, rejectReason = "Rejected by the customer's bank"): void {
  const c = record(id);
  if (!c?.cancellation || c.cancellation.stage !== "with_bank") return;
  c.cancellation.decidedAt = formatCreatedOn(new Date());
  if (accepted) {
    c.cancellation.stage = "accepted";
    c.status = "Cancelled";
    c.subscriptionStatus = "Cancelled";
    c.occurrences = occurrencesAfterCancellation(c.occurrences);
    c.statusNote = `Cancelled at the customer's request — ${cancelReasonLabel(c.cancellation.reasonCode)}. History and documents are kept.`;
    log(c, "DDS", "Cancellation accepted by the bank (ACCP) — Geidea cancels the mandate (CANC). Payments already in a payment file run to the end; every other open collection is cancelled");
    log(c, "System", "Email sent to the customer: direct debit cancelled");
  } else {
    c.cancellation.stage = "rejected";
    c.cancellation.rejectReason = rejectReason;
    log(c, "DDS", `Cancellation rejected: ${rejectReason}. Contract back to DD Active; collections resume${c.subscriptionStatus === "Paused" ? " once the subscription is resumed" : ""}`);
    log(c, "System", "Email sent to the customer: the bank rejected the cancellation — contact your bank for more information");
  }
  persistIfCreated(c);
  saveCancellationOverlay(c);
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
      // A cancellation signed on the customer page (another tab) shows here without a refresh.
      const onStorage = (e: StorageEvent) => {
        if (e.key !== "mpr:dd-cancellations:v1") return;
        applyCancellationOverlays();
        version++;
        l();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(l);
        window.removeEventListener("storage", onStorage);
      };
    },
    () => version,
    () => 0
  );
}
