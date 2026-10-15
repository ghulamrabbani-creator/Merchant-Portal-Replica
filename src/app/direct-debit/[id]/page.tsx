"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  PauseCircle,
  PlayCircle,
  Trash2,
  Pencil,
  Download,
  History,
  Landmark,
  CreditCard,
  RotateCw,
  Send,
  CalendarClock,
  ExternalLink,
  FileJson,
  CheckCircle2,
  Loader2,
  Ban,
  FileText,
  AlertTriangle,
} from "lucide-react";
import clsx from "clsx";
import {
  formatMoneyAED,
  rolloverStreakUsed,
  applyRetryResult,
  applyRetrySubmitted,
  contractStatusLabel,
  isAmendable,
  isUnsigned,
  outstandingAmount,
  paymentRef,
  centralBankRef,
  formatInstrumentRef,
  DD_CANCEL_REASONS,
  cancelReasonLabel,
  isCancellationPending,
  isCancellationSigned,
} from "@/lib/direct-debit";
import { useContract } from "@/lib/dd-contract-store";
import {
  MAX_RESENDS,
  discardBlockedReason,
  discardContract,
  editNotes,
  logActivity,
  resendBlockedReason as resendWhy,
  resendSigningLink,
  useContractsVersion,
  cancelBlockedReason,
  cancelResendBlockedReason,
  requestCancellation,
  resendCancellationLink,
  cancellationSigned,
  cancellationDecided,
  setSubscriptionPaused,
} from "@/lib/dd-actions";
import { useDDConfig } from "@/lib/dd-config-context";
import { HintKey } from "@/lib/dd-field-map";
import StatCard from "@/components/ui/StatCard";
import StatusDot from "@/components/ui/StatusDot";
import Modal from "@/components/ui/Modal";
import CollectionTable from "@/components/directdebit/CollectionTable";
import AmendScheduleModal from "@/components/directdebit/AmendScheduleModal";
import FieldHint from "@/components/directdebit/FieldHint";
import { DDSubscriptionStatus, DirectDebitContract, DirectDebitOccurrence } from "@/lib/types";

// 14-Oct-2026 (MP Backlog v2): Cancel mandate removed (cancellation is a placeholder, US-21);
// Discard (US-34), Edit notes (US-35), Resend with expiry extension (US-15), document download
// (US-17/US-33) and activity history (US-32) added; every action is gated by status AND the role's
// permissions (US-02 — role switcher in the top bar). Failed = Failed only; Outstanding excludes
// rolled-over amounts.
// 15-Oct-2026 (Confluence S8; US-21 / US-40): Cancel contract is back, permission-controlled
// (Cancel Contract), with DDS's reason codes, a note that collections continue until the customer
// signs, an optional pause, a cancellation panel (resend link, forms) and prototype controls to
// simulate the customer signing and the bank's decision.

function Field({ label, value, hint }: { label: React.ReactNode; value: React.ReactNode; hint?: HintKey }) {
  return (
    <div className="flex items-center justify-between border-b border-border-color py-2.5 last:border-0">
      <span className="inline-flex items-center gap-1 text-sm text-text-secondary">
        {label}
        {hint && <FieldHint k={hint} />}
      </span>
      <span className="text-right text-sm font-medium text-text-primary">{value}</span>
    </div>
  );
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mt-5 rounded-xl border border-border-color bg-card-bg p-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-base font-bold text-text-primary">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

/** Resolves the contract (demo data, or created in this browser) before mounting the screen, so
 *  the screen's local state is seeded from the real record — see dd-contract-store. */
export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { contract, ready } = useContract(id);
  if (!contract) {
    if (!ready)
      return (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 size={16} className="animate-spin" /> Loading contract…
        </div>
      );
    return notFound();
  }
  return <ContractDetail key={contract.id} c={contract} />;
}

function ContractDetail({ c }: { c: DirectDebitContract }) {
  const { config, can } = useDDConfig();
  useContractsVersion(); // re-render after Discard / Resend / Edit notes

  // Local, in-memory copy so Pause/Resume/Retry/Amend can update the view without mutating the
  // shared mock-data module. Not persisted for demo records.
  const [subscriptionStatus, setSubscriptionStatus] = useState<DDSubscriptionStatus>(c.subscriptionStatus);
  const [occurrences, setOccurrences] = useState<DirectDebitOccurrence[]>(c.occurrences);
  const [scheduleVersion, setScheduleVersion] = useState(c.scheduleVersion ?? 1);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState(c.notes ?? "");
  const [amendOpen, setAmendOpen] = useState(false);
  const [amendNotice, setAmendNotice] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const resendCount = c.signingNotificationCount ?? 0;
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelComments, setCancelComments] = useState("");
  const [cancelPause, setCancelPause] = useState(false);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);

  const summary = useMemo(() => {
    const paid = occurrences.filter((o) => o.status === "Paid");
    const failed = occurrences.filter((o) => o.status === "Failed");
    const scheduled = occurrences.filter((o) => o.status === "Scheduled");
    const collected = paid.reduce((sum, o) => sum + o.amount, 0);
    const outstanding = outstandingAmount(occurrences);
    // TB-16 / US-17: before activation the first collection is shown as planned.
    const next = scheduled[0];
    const last = [...paid, ...failed].sort((a, b) => a.seq - b.seq).pop();
    return { paid, failed, scheduled, collected, outstanding, next, last };
  }, [occurrences]);

  const liveRolloverRemaining = Math.max(0, c.rolloversAllowed - rolloverStreakUsed(occurrences));

  const isPendingSign = isUnsigned(c.status);
  const signedDoc = !isPendingSign && !["Awaiting Customer Details", "Not Submitted", "Link Expired", "Discarded"].includes(c.status);
  const canAmendAny = occurrences.some((o) => isAmendable(o));
  const mobile = c.customerMobile ?? "0501234567";
  const email = c.customerEmail ?? "customer@example.com";

  function handleResend() {
    if (resendBlockedReason) return;
    setResendNotice(resendSigningLink(c.id, config.contractReviewExpiryDays));
  }
  const resendBlockedReason = resendWhy(c, can("manageUnsigned"));
  const discardWhy = discardBlockedReason(c, can("manageUnsigned"));
  const cancelWhy = cancelBlockedReason(c, can("cancel"));
  const cx = c.cancellation;
  const cxPending = isCancellationPending(c);
  const cxSigned = isCancellationSigned(c);
  const cxResendWhy = cxPending ? cancelResendBlockedReason(c, can("cancel")) : null;
  const cancelValid = !!cancelReason && (cancelReason !== "P99" || cancelComments.trim().length > 0);

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-text-muted">
        <Link href="/direct-debit" className="hover:text-text-primary hover:underline">
          Direct Debit
        </Link>
        <span>/</span>
        <span>{c.merchantRef}</span>
      </div>

      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/direct-debit" className="mt-1.5 text-text-secondary hover:text-text-primary">
            <ArrowLeft size={22} />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-text-primary">{c.merchantRef}</h1>
              <StatusDot status={contractStatusLabel(c)} />
              <FieldHint k="view.status" value={contractStatusLabel(c)} />
              {subscriptionStatus === "Paused" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-status-pending px-2.5 py-1 text-xs font-medium text-status-pending">
                  <PauseCircle size={12} />
                  Subscription paused
                </span>
              )}
            </div>
            {c.statusNote && <div className="mt-1 text-sm text-text-muted">{c.statusNote}</div>}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          {isPendingSign && (
            <>
              <a
                href={`/contracts/review/${c.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-border-color bg-white px-4 py-2.5 text-sm font-medium text-text-primary hover:border-text-muted"
              >
                <ExternalLink size={15} />
                Open customer review page
              </a>
              <span className="inline-flex items-center gap-1">
                <button
                  onClick={handleResend}
                  disabled={!!resendBlockedReason}
                  title={resendBlockedReason ?? "Send the review & signing link to the customer again"}
                  className="flex items-center gap-2 rounded-lg border border-brand-blue px-4 py-2.5 text-sm font-medium text-brand-blue disabled:cursor-not-allowed disabled:border-border-color disabled:text-text-muted"
                  data-testid="resend-link"
                >
                  <Send size={15} />
                  Resend signing link
                </button>
                <FieldHint k="act.resend" value={`signing_notification_count = ${resendCount}`} />
              </span>
            </>
          )}
          {!discardWhy && (
            <button
              onClick={() => setDiscardOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-status-declined px-4 py-2.5 text-sm font-medium text-status-declined"
              data-testid="discard-open"
            >
              <Trash2 size={15} />
              Discard
            </button>
          )}
          {c.status === "Active" && (
            <span className="inline-flex items-center gap-1">
              <button
                onClick={() => {
                  setAmendNotice(null);
                  setAmendOpen(true);
                }}
                disabled={!can("amend") || !canAmendAny || cxSigned}
                title={
                  !can("amend")
                    ? "Your role doesn't include the Amend Collection permission."
                    : cxSigned
                      ? "The customer has signed the cancellation — no changes while the bank decides."
                    : !canAmendAny
                      ? "No upcoming Scheduled collection, or collection in Error, that can still be changed."
                        : "Change the date or amount of upcoming collections"
                }
                className="flex items-center gap-2 rounded-lg border border-border-color bg-white px-4 py-2.5 text-sm font-medium text-text-primary hover:border-text-muted disabled:cursor-not-allowed disabled:text-text-muted"
                data-testid="amend-open"
              >
                <CalendarClock size={16} />
                Amend schedule
              </button>
              <FieldHint k="act.amend" />
            </span>
          )}
          {c.status === "Active" && (
            <span className="inline-flex items-center gap-1">
              {subscriptionStatus === "Active" ? (
                <button
                  onClick={() => setPauseModalOpen(true)}
                  disabled={!can("pauseResume") || cxSigned}
                  title={can("pauseResume") ? undefined : "Your role doesn't include the Pause / Resume permission."}
                  className="flex items-center gap-2 rounded-lg border border-border-color bg-white px-4 py-2.5 text-sm font-medium text-text-primary hover:border-text-muted disabled:cursor-not-allowed disabled:text-text-muted"
                >
                  <PauseCircle size={16} />
                  Pause
                </button>
              ) : (
                <button
                  onClick={() => {
                    setSubscriptionStatus("Active");
                    setSubscriptionPaused(c.id, false, "Collections resumed");
                  }}
                  disabled={!can("pauseResume") || cxSigned}
                  title={can("pauseResume") ? undefined : "Your role doesn't include the Pause / Resume permission."}
                  className="flex items-center gap-2 rounded-lg border border-brand-blue px-4 py-2.5 text-sm font-medium text-brand-blue disabled:cursor-not-allowed disabled:border-border-color disabled:text-text-muted"
                >
                  <PlayCircle size={16} />
                  Resume
                </button>
              )}
              <FieldHint k={subscriptionStatus === "Active" ? "act.pause" : "act.resume"} />
            </span>
          )}
          {/* US-21: permission-controlled — hidden for users without Cancel Contract. */}
          {can("cancel") && c.status === "Active" && !cxPending && (
            <span className="inline-flex items-center gap-1">
              <button
                onClick={() => {
                  setCancelReason("");
                  setCancelComments("");
                  setCancelPause(false);
                  setCancelOpen(true);
                }}
                disabled={!!cancelWhy}
                title={cancelWhy ?? "Cancel the direct debit — the customer signs the cancellation with UAE PASS"}
                className="flex items-center gap-2 rounded-lg border border-status-declined px-4 py-2.5 text-sm font-medium text-status-declined disabled:cursor-not-allowed disabled:border-border-color disabled:text-text-muted"
                data-testid="cancel-open"
              >
                <Ban size={15} />
                Cancel contract
              </button>
            </span>
          )}
          <a
            href={`data:text/plain;charset=utf-8,${encodeURIComponent(`${signedDoc ? "SIGNED" : "UNSIGNED"} CONTRACT (prototype)
Merchant reference: ${c.merchantRef}
Customer: ${c.customerName}`)}`}
            download={`${c.merchantRef}-${signedDoc ? "signed" : "unsigned"}.txt`}
            className={clsx(
              "flex items-center gap-2 rounded-lg border border-border-color bg-white px-4 py-2.5 text-sm font-medium text-text-primary hover:border-text-muted",
              (c.status === "Awaiting Customer Details" || c.status === "Not Submitted" || c.status === "Discarded" || c.status === "Link Expired") && "hidden"
            )}
            data-testid="download-contract"
          >
            <Download size={15} />
            {signedDoc ? "Signed contract" : "Unsigned contract"}
          </a>
        </div>
      </div>

      {resendNotice && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-status-completed/50 bg-status-completed/10 px-4 py-2.5 text-sm text-text-primary" data-testid="resend-notice">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-status-completed" />
          {resendNotice}
        </div>
      )}
      {amendNotice && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-status-completed/50 bg-status-completed/10 px-4 py-2.5 text-sm text-text-primary" data-testid="amend-notice">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-status-completed" />
          {amendNotice}
        </div>
      )}

      {cancelNotice && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-status-completed/50 bg-status-completed/10 px-4 py-2.5 text-sm text-text-primary" data-testid="cancel-notice">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-status-completed" />
          {cancelNotice}
        </div>
      )}

      {cx && (cxPending || cx.stage === "rejected") && (
        <div
          className={clsx(
            "mb-5 rounded-lg border px-4 py-3 text-sm text-text-primary",
            cx.stage === "rejected" ? "border-status-declined/60 bg-status-declined/5" : "border-status-pending bg-status-pending/10"
          )}
          data-testid="cancellation-panel"
        >
          <div className="mb-1 flex flex-wrap items-center gap-2 font-semibold">
            <Ban size={15} />
            {cx.stage === "awaiting_customer" && "Cancellation pending — awaiting customer signature"}
            {cx.stage === "with_bank" && "Cancellation pending — with the bank"}
            {cx.stage === "rejected" && "Cancellation rejected by the bank"}
          </div>
          <div className="text-[13px] text-text-secondary">
            Reason: {cancelReasonLabel(cx.reasonCode)} ({cx.reasonCode}){cx.comments ? ` — ${cx.comments}` : ""} · Requested by {cx.requestedBy}, {cx.requestedAt}
            {cx.pausedByCancellation ? " · collections paused at the same time" : ""}
            {cx.signedAt ? ` · signed by the customer ${cx.signedAt}` : ""}
            {cx.stage === "rejected" && cx.rejectReason ? ` · ${cx.rejectReason}` : ""}
          </div>
          {cx.stage === "awaiting_customer" && (
            <div className="mt-1.5 text-[13px]">
              {subscriptionStatus === "Paused" ? (
                <b>Collections are paused.</b>
              ) : (
                <>
                  <b>Collections continue until the customer signs.</b> To stop them now, pause the subscription.
                </>
              )}{" "}
              Link sent {cx.notificationCount}× (max {MAX_RESENDS} resends) · valid until {cx.linkExpiresAt}. A cancellation request can&apos;t be withdrawn.
            </div>
          )}
          {cx.stage === "with_bank" && (
            <div className="mt-1.5 text-[13px]">
              The customer signed the cancellation. No collections are sent while the bank decides (up to 1 working day); Pause / Resume, Amend and Retry are disabled.
            </div>
          )}
          {cx.stage === "rejected" && (
            <div className="mt-1.5 text-[13px]">The contract is DD Active again and collections resume{subscriptionStatus === "Paused" ? " once you resume the subscription" : ""}. Collections skipped meanwhile can be recovered with Amend schedule.</div>
          )}
          {cxPending && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
              {cx.stage === "awaiting_customer" && (
                <>
                  <a
                    href={`/contracts/cancel/${c.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-border-color bg-white px-3 py-1.5 text-[13px] font-medium"
                  >
                    <ExternalLink size={13} /> Open customer cancellation page
                  </a>
                  <button
                    onClick={() => setCancelNotice(resendCancellationLink(c.id, config.contractReviewExpiryDays))}
                    disabled={!!cxResendWhy}
                    title={cxResendWhy ?? "Send the cancellation link to the customer again"}
                    className="flex items-center gap-1.5 rounded-lg border border-brand-blue bg-white px-3 py-1.5 text-[13px] font-medium text-brand-blue disabled:cursor-not-allowed disabled:border-border-color disabled:text-text-muted"
                    data-testid="cancel-resend"
                  >
                    <Send size={13} /> Resend cancellation link
                  </button>
                </>
              )}
              <a
                href={`data:text/plain;charset=utf-8,${encodeURIComponent(`${cx.stage === "with_bank" ? "SIGNED" : "UNSIGNED"} CANCELLATION FORM (prototype)\nMerchant reference: ${c.merchantRef}\nDDS cancellation request: ${cx.ddcaId}\nReason: ${cx.reasonCode}`)}`}
                download={`${c.merchantRef}-cancellation-${cx.stage === "with_bank" ? "signed" : "unsigned"}.txt`}
                className="flex items-center gap-1.5 rounded-lg border border-border-color bg-white px-3 py-1.5 text-[13px] font-medium"
              >
                <FileText size={13} /> {cx.stage === "with_bank" ? "Signed" : "Unsigned"} cancellation form
              </a>
              <span className="flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-fuchsia-400 px-2.5 py-1 text-[12px] text-fuchsia-700">
                Prototype:
                {cx.stage === "awaiting_customer" && (
                  <button onClick={() => cancellationSigned(c.id)} className="underline" data-testid="sim-cx-signed">
                    customer signs
                  </button>
                )}
                {cx.stage === "with_bank" && (
                  <>
                    <button
                      onClick={() => {
                        cancellationDecided(c.id, true);
                        setSubscriptionStatus("Cancelled");
                        setOccurrences((prev) => prev.map((o) => (o.status === "Scheduled" ? { ...o, status: "Cancelled" } : o)));
                      }}
                      className="underline"
                      data-testid="sim-cx-accept"
                    >
                      bank accepts (18:15 check)
                    </button>
                    ·
                    <button onClick={() => cancellationDecided(c.id, false)} className="underline" data-testid="sim-cx-reject">
                      bank rejects
                    </button>
                  </>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {c.createRequest && (
        <div className="mb-5">
          <Link
            href={`/direct-debit/${c.id}/submitted`}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-blue hover:underline"
          >
            <FileJson size={14} /> View submission details (payloads &amp; customer notifications)
          </Link>
        </div>
      )}

      {c.status === "Not Submitted" && (
        <div className="mb-5 rounded-lg border border-status-declined/60 bg-status-declined/5 px-4 py-2.5 text-sm text-text-primary" data-testid="not-submitted-banner">
          <b>Not submitted to DDS.</b>{" "}
          {c.notSubmittedKind === "unknown"
            ? `DDS didn't answer in time, so the outcome is unknown. Contact Geidea support quoting ${c.merchantRef} — the Backend checks with DDS before any resubmission.`
            : `DDS refused the contract${c.notSubmittedReason ? `: ${c.notSubmittedReason.replace(/\.$/, "")}` : ""}. Correct the details and resubmit with the same merchant reference, or discard it.`}
        </div>
      )}
      {c.mandateReason && (c.status === "Rejected" || c.status === "Error" || c.status === "Request Expired") && (
        <div className="mb-5 rounded-lg border border-status-declined/60 bg-status-declined/5 px-4 py-2.5 text-sm text-text-primary">
          <b>{contractStatusLabel(c)}:</b> {c.mandateReason}
        </div>
      )}

      {c.awaitingInstrumentNote && c.status === "Awaiting Customer Details" && (
        <div className="mb-5 rounded-lg border border-status-pending bg-status-pending/10 px-4 py-2.5 text-sm text-text-primary">
          {c.awaitingInstrumentNote}
        </div>
      )}

      {c.pausedNote && subscriptionStatus === "Paused" && (
        <div className="mb-5 rounded-lg border border-status-pending bg-status-pending/10 px-4 py-2.5 text-sm text-text-primary">
          {c.pausedNote}
        </div>
      )}

      <div className="mb-2 flex gap-3">
        <StatCard label="Customer" value={c.customerName} sub={c.customerIdNumber} />
        <StatCard
          label="Successful Collections"
          value={formatMoneyAED(summary.collected)}
          sub={`${summary.paid.length} of ${occurrences.length} installments`}
        />
        <StatCard
          label="Failed Collections"
          value={formatMoneyAED(summary.failed.reduce((sum, o) => sum + o.amount, 0))}
          sub={`${summary.failed.length} of ${occurrences.length} installments (final)`}
        />
        <StatCard
          label="Outstanding"
          value={formatMoneyAED(summary.outstanding)}
          sub={c.status === "Active" ? (summary.failed.length > 0 ? `incl. ${summary.failed.length} failed` : "Scheduled + failed, excl. rolled over") : "Planned — collections start once DD Active"}
        />
        <StatCard
          label="Next collection"
          value={summary.next ? `${summary.next.dueDate}${c.status === "Active" ? "" : " (planned)"}` : "—"}
          sub={summary.next ? `${formatMoneyAED(summary.next.amount)} · ${(c.collectionFrequency ?? c.frequency).toLowerCase()}` : "No further collections scheduled"}
        />
      </div>

      <Section title="Mandate details">
        <div className="grid grid-cols-2 gap-x-16">
          <div>
            <Field label="Customer name" value={c.customerName} hint="view.customerName" />
            <Field label={c.customerIdType} value={c.customerIdNumber} hint="view.emiratesId" />
            <Field label="Email / mobile" value={`${email} · ${mobile}`} hint="create.customerEmail" />
            {/* v2.6: the merchant reference is the DDS reference; the Central Bank reference appears once DD Active. */}
            <Field label="Merchant reference" value={c.merchantRef} hint="view.merchantRef" />
            <Field
              label="Central Bank reference"
              value={centralBankRef(c) ?? <span className="text-text-muted">Issued once the contract is DD Active</span>}
            />
            <Field label="Contract description" value={c.contractDescription || <span className="text-text-muted">—</span>} />
            <Field label="Store" value={c.storeName ? `${c.storeName} (${c.storeId})` : "—"} />
            <Field label="Status" value={<StatusDot status={contractStatusLabel(c)} />} hint="view.status" />
            <Field label="Created on" value={c.createdOn} hint="view.createdOn" />
            <Field label="Validity" value={`${c.commencesOn} – ${c.expiresOn}`} hint="view.validity" />
            <Field label="Payment frequency" value={c.frequency} hint="view.frequency" />
          </div>
          <div>
            <Field label="Next collection" value={summary.next ? `${summary.next.dueDate} · ${formatMoneyAED(summary.next.amount)}` : "—"} />
            <Field label="Last collection" value={summary.last ? `${summary.last.dueDate} (${summary.last.status})` : "—"} />
            <Field label="Amount type" value={c.amountType} hint="view.amountType" />
            <Field
              label={c.amountType === "Fixed" ? "Amount per installment" : "Min / Max amount"}
              value={c.amountType === "Fixed" ? formatMoneyAED(c.minAmount) : `${formatMoneyAED(c.minAmount)} – ${formatMoneyAED(c.maxAmount)}`}
              hint="view.minMax"
            />
            <Field
              label="Payment method"
              hint="view.instrument"
              value={
                c.maskedInstrumentRef ? (
                  <span className="inline-flex items-center gap-1.5">
                    {c.instrumentType === "Bank Account" ? <Landmark size={14} strokeWidth={1.8} /> : <CreditCard size={14} strokeWidth={1.8} />}
                    {c.instrumentType} {formatInstrumentRef(c.maskedInstrumentRef)}
                    {c.bankName ? `, ${c.bankName}` : ""}
                  </span>
                ) : (
                  <span className="text-text-muted">To be provided by customer</span>
                )
              }
            />
            <Field label="Subscription" value={subscriptionStatus} hint="view.subscriptionStatus" />
            <Field label="Schedule version" value={`v${scheduleVersion}`} hint="view.scheduleVersion" />
            {isPendingSign && (
              <Field
                label="Signing link"
                value={
                  `Sent ${resendCount}× (max ${MAX_RESENDS} resends) ${c.reviewLinkExpiresAt ? `· valid until ${c.reviewLinkExpiresAt}` : ""}`
                }
                hint="act.resend"
              />
            )}
          </div>
        </div>
        <div className="mt-1 border-t border-border-color pt-2.5">
          <Field
            label="Rollover"
            hint="view.rollover"
            value={
              c.rolloverEnabled ? (
                <span className="inline-flex items-center gap-1.5">
                  <RotateCw size={13} strokeWidth={2} />
                  Automatic — up to {c.rolloversAllowed} consecutive, {liveRolloverRemaining} left in the current run (resets after any collection is paid)
                </span>
              ) : (
                "Disabled"
              )
            }
          />
          <Field
            label="Notes (merchant only)"
            hint="view.notes"
            value={
              <span className="inline-flex items-center gap-2">
                {c.notes || <span className="text-text-muted">—</span>}
                {can("create") && (
                  <button
                    onClick={() => {
                      setNotesDraft(c.notes ?? "");
                      setNotesOpen(true);
                    }}
                    className="text-brand-blue"
                    aria-label="Edit notes"
                    data-testid="edit-notes"
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </span>
            }
          />
        </div>
      </Section>

      <Section title="Collection status">
        {occurrences.length > 0 ? (
          <div className="mt-2">
            <CollectionTable
              contract={c}
              occurrences={occurrences}
              subscriptionStatus={subscriptionStatus}
              onRetry={(seq) => setOccurrences((prev) => applyRetrySubmitted(prev, seq))}
              onAmend={c.status === "Active" && !cxSigned ? () => { setAmendNotice(null); setAmendOpen(true); } : undefined}
              onSimulate={(seq, r) => setOccurrences((prev) => applyRetryResult(c, prev, seq, r))}
            />
          </div>
        ) : (
          <div className="py-1 text-sm text-text-muted">{c.emptyNote}</div>
        )}
        {c.cancelledNote && <div className="mt-2 text-xs text-text-muted">{c.cancelledNote}</div>}
      </Section>

      <Section title="Activity history" right={<History size={16} className="text-text-muted" />}>
        {c.activity && c.activity.length > 0 ? (
          <ul className="mt-1 divide-y divide-border-color text-sm" data-testid="activity">
            {c.activity.map((e, i) => (
              <li key={i} className="flex gap-4 py-2">
                <span className="w-44 shrink-0 text-text-muted">{e.at}</span>
                <span className="w-32 shrink-0 text-text-secondary">{e.actor}</span>
                <span className="text-text-primary">{e.text}</span>
              </li>
            ))}
            <li className="flex gap-4 py-2">
              <span className="w-44 shrink-0 text-text-muted">{c.createdOn}</span>
              <span className="w-32 shrink-0 text-text-secondary">Merchant user</span>
              <span className="text-text-primary">Contract created</span>
            </li>
          </ul>
        ) : (
          <div className="py-1 text-sm text-text-muted">{c.createdOn} · Merchant user · Contract created</div>
        )}
      </Section>

      {amendOpen && (
        <AmendScheduleModal
          contract={c}
          occurrences={occurrences}
          subscriptionStatus={subscriptionStatus}
          scheduleVersion={scheduleVersion}
          onClose={() => setAmendOpen(false)}
          onSaved={(result, changed, reason) => {
            setOccurrences(result);
            setScheduleVersion((v) => v + 1);
            setAmendOpen(false);
            logActivity(c.id, "Merchant user", `Schedule amended (#${changed.join(", #")})${reason ? ` — ${reason}` : ""}`);
            setAmendNotice(
              `Schedule amended — ${changed.length} collection${changed.length === 1 ? "" : "s"} (#${changed.join(", #")}) updated, schedule version v${scheduleVersion + 1}${reason ? `. Reason: ${reason}` : ""}. Retry deadlines recalculated.` +
                result
                  .filter((o) => changed.includes(o.seq) && o.paymentSeq && occurrences.find((x) => x.seq === o.seq)?.status === "Error")
                  .map((o) => ` #${o.seq} was in Error: it is Scheduled again and will be sent with the new payment reference ${paymentRef(c.merchantRef, o.paymentSeq!)}.`)
                  .join("")
            );
          }}
        />
      )}

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)}>
        <div className="p-8" data-testid="cancel-dialog">
          <h2 className="mb-2 text-xl font-bold text-text-primary">Cancel contract {c.merchantRef}?</h2>
          <p className="mb-4 text-sm text-text-secondary">
            Geidea sends {c.customerName} a link to sign the cancellation with UAE PASS. Once their bank accepts it (up to 1
            working day after signing), the contract is DD Cancelled and no further payments are collected. History and
            documents are kept.
          </p>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text-primary">Reason *</label>
          <select
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="mb-3 w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
            data-testid="cancel-reason"
          >
            <option value="">Select a reason</option>
            {DD_CANCEL_REASONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text-primary">Comments{cancelReason === "P99" ? " *" : " (optional)"}</label>
          <textarea
            value={cancelComments}
            maxLength={1000}
            rows={2}
            onChange={(e) => setCancelComments(e.target.value)}
            className="mb-4 w-full rounded-lg border border-border-color px-3 py-2 text-sm outline-none"
            data-testid="cancel-comments"
          />
          <div className="mb-3 rounded-lg border border-status-pending bg-status-pending/10 px-3.5 py-2.5 text-[13px] text-text-primary" data-testid="cancel-note">
            <b>Note:</b> Until the customer accepts the cancellation, payment collection will continue. If you want collections to stop now, pause the subscription.
          </div>
          {subscriptionStatus === "Active" && can("pauseResume") && (
            <label className="mb-3 flex items-center gap-2 text-sm text-text-primary">
              <input type="checkbox" checked={cancelPause} onChange={(e) => setCancelPause(e.target.checked)} data-testid="cancel-pause" />
              Also pause collections now
            </label>
          )}
          {subscriptionStatus === "Paused" && (
            <div className="mb-3 text-[13px] text-text-secondary">Collections are already paused and stay paused.</div>
          )}
          <div className="mb-6 flex items-start gap-2 text-[13px] text-status-declined">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            A cancellation request can&apos;t be withdrawn. The customer must sign it with UAE PASS before the bank cancels the direct debit.
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setCancelOpen(false)} className="rounded-lg border border-border-color px-5 py-2.5 text-sm font-medium">
              Keep contract
            </button>
            <button
              disabled={!cancelValid}
              onClick={() => {
                const pause = cancelPause && subscriptionStatus === "Active";
                setCancelNotice(requestCancellation(c.id, cancelReason, cancelComments.trim(), pause, config.contractReviewExpiryDays));
                if (pause) setSubscriptionStatus("Paused");
                setCancelOpen(false);
              }}
              className="rounded-lg bg-status-declined px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="cancel-confirm"
            >
              Send cancellation request
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={pauseModalOpen} onClose={() => setPauseModalOpen(false)}>
        <div className="p-8">
          <h2 className="mb-2 text-xl font-bold text-text-primary">Pause collections?</h2>
          <p className="mb-4 text-sm text-text-secondary">
            The contract stays DD Active — only collections stop. Collections due while paused are Skipped and not
            collected (they are not rolled over). A collection already sent to DDS carries on. You can resume at any time.
          </p>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text-primary">Reason (optional)</label>
          <input
            value={pauseReason}
            maxLength={200}
            onChange={(e) => setPauseReason(e.target.value)}
            className="mb-6 w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
            data-testid="pause-reason"
          />
          <div className="flex items-center justify-end gap-4">
            <button onClick={() => setPauseModalOpen(false)} className="text-sm font-medium text-text-secondary">
              Cancel
            </button>
            <button
              onClick={() => {
                setSubscriptionStatus("Paused");
                setSubscriptionPaused(c.id, true, `Collections paused${pauseReason.trim() ? ` — ${pauseReason.trim()}` : ""}`);
                setPauseReason("");
                setPauseModalOpen(false);
              }}
              className={clsx("rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover")}
            >
              Pause collections
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={discardOpen} onClose={() => setDiscardOpen(false)}>
        <div className="p-8">
          <h2 className="mb-2 text-xl font-bold text-text-primary">Discard contract {c.merchantRef}?</h2>
          <p className="mb-6 text-sm text-text-secondary">
            The customer hasn&apos;t signed yet. Discarding stops the contract for good: the review link will show
            &ldquo;no longer available&rdquo;, no collection will be made, and the merchant reference can&apos;t be reused.
            {(c.status === "Pending Customer Sign" || c.status === "Request Expired") && " Geidea will also discard the mandate at DDS."}
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDiscardOpen(false)} className="rounded-lg border border-border-color px-5 py-2.5 text-sm font-medium">
              Keep contract
            </button>
            <button
              onClick={() => {
                setResendNotice(discardContract(c.id));
                setOccurrences(c.occurrences);
                setDiscardOpen(false);
              }}
              className="rounded-lg bg-status-declined px-5 py-2.5 text-sm font-semibold text-white"
              data-testid="discard-confirm"
            >
              Discard
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={notesOpen} onClose={() => setNotesOpen(false)}>
        <div className="p-8">
          <h2 className="mb-2 text-xl font-bold text-text-primary">Edit notes</h2>
          <p className="mb-3 text-sm text-text-secondary">Merchant-only — never shown to the customer. Up to 1,000 characters.</p>
          <textarea
            value={notesDraft}
            maxLength={1000}
            rows={5}
            onChange={(e) => setNotesDraft(e.target.value)}
            className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
            data-testid="notes-input"
          />
          <div className="mb-5 text-right text-xs text-text-muted">{notesDraft.length} / 1,000</div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setNotesOpen(false)} className="text-sm font-medium text-text-secondary">Cancel</button>
            <button
              onClick={() => {
                editNotes(c.id, notesDraft.trim());
                setNotesOpen(false);
              }}
              className="rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
              data-testid="notes-save"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
