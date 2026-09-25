"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  PauseCircle,
  PlayCircle,
  Ban,
  Landmark,
  CreditCard,
  RotateCw,
  Send,
  CalendarClock,
  ExternalLink,
  FileJson,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import clsx from "clsx";
import {
  formatMoneyAED,
  rolloverStreakUsed,
  PENDING_INSTRUMENT_REF_LABEL,
  applyRetryResult,
  applyRetrySubmitted,
  contractStatusLabel,
  formatCreatedOn,
  isAmendable,
  maskEmail,
  maskMobile,
} from "@/lib/direct-debit";
import { useContract, persistIfCreated } from "@/lib/dd-contract-store";
import { directDebitContracts } from "@/lib/mock-data";
import { useDDConfig } from "@/lib/dd-config-context";
import { HintKey } from "@/lib/dd-field-map";
import StatCard from "@/components/ui/StatCard";
import StatusDot from "@/components/ui/StatusDot";
import Modal from "@/components/ui/Modal";
import CollectionTable from "@/components/directdebit/CollectionTable";
import AmendScheduleModal from "@/components/directdebit/AmendScheduleModal";
import FieldHint from "@/components/directdebit/FieldHint";
import { DDSubscriptionStatus, DirectDebitContract, DirectDebitOccurrence } from "@/lib/types";

// Max resends per contract (S3 §1.5 — configurable in the Backend).
const MAX_RESENDS = 5;

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
  const { config } = useDDConfig();
  const actions = config.actions;

  // Local, in-memory copy so Pause/Resume/Retry/Amend can update the view without mutating the
  // shared mock-data module. Not persisted for demo records.
  const [subscriptionStatus, setSubscriptionStatus] = useState<DDSubscriptionStatus>(c.subscriptionStatus);
  const [occurrences, setOccurrences] = useState<DirectDebitOccurrence[]>(c.occurrences);
  const [scheduleVersion, setScheduleVersion] = useState(c.scheduleVersion ?? 1);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);
  const [amendNotice, setAmendNotice] = useState<string | null>(null);
  const [resendCount, setResendCount] = useState(c.signingNotificationCount ?? 0);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  const summary = useMemo(() => {
    const paid = occurrences.filter((o) => o.status === "Paid");
    const failed = occurrences.filter((o) => o.status === "Failed" || o.status === "Rejected");
    const scheduled = occurrences.filter((o) => o.status === "Scheduled");
    const collected = paid.reduce((sum, o) => sum + o.amount, 0);
    const outstanding =
      scheduled.reduce((sum, o) => sum + o.amount, 0) + failed.reduce((sum, o) => sum + o.amount, 0);
    const next = scheduled[0];
    const last = [...paid, ...failed].sort((a, b) => a.seq - b.seq).pop();
    return { paid, failed, scheduled, collected, outstanding, next, last };
  }, [occurrences]);

  const liveRolloverRemaining = Math.max(0, c.rolloversAllowed - rolloverStreakUsed(occurrences));

  const isPendingSign = c.status === "Pending Customer Sign" || c.status === "Awaiting Customer Details";
  const isClosed = c.status === "Cancelled" || c.status === "Rejected";
  const canAmendAny = occurrences.some((o) => isAmendable(o));
  const mobile = c.customerMobile ?? "0501234567";
  const email = c.customerEmail ?? "customer@example.com";

  function handleResend() {
    if (!actions.allowResendSigningLink || config.suppressCustomerNotifications || resendCount - 1 >= MAX_RESENDS) return;
    const n = resendCount + 1;
    setResendCount(n);
    // Write through to the shared record (and this browser's store, for created contracts).
    const target = directDebitContracts.find((x) => x.id === c.id);
    if (target) {
      target.signingNotificationCount = n;
      target.signingNotificationSentAt = formatCreatedOn(new Date());
      persistIfCreated(target);
    }
    setResendNotice(
      `Signing link resent by SMS (${maskMobile(mobile)}), email (${maskEmail(email)}) and WhatsApp — resend ${n - 1} of ${MAX_RESENDS}. Link expiry unchanged${c.reviewLinkExpiresAt ? ` (${c.reviewLinkExpiresAt})` : ""} — expiry extension isn't in this prototype yet.`
    );
  }
  const resendBlockedReason = !actions.allowResendSigningLink
    ? "Resending is switched off for this merchant (allow_resend_signing_link = false)."
    : config.suppressCustomerNotifications
      ? "NOTIFICATIONS_SUPPRESSED — Geidea customer notifications are suppressed for this merchant; the partner re-sends from its own channels."
      : resendCount - 1 >= MAX_RESENDS
        ? `Maximum ${MAX_RESENDS} resends reached.`
        : null;

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-text-muted">
        <Link href="/direct-debit" className="hover:text-text-primary hover:underline">
          Direct Debit
        </Link>
        <span>/</span>
        <span>{c.ref || c.merchantRef}</span>
      </div>

      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/direct-debit" className="mt-1.5 text-text-secondary hover:text-text-primary">
            <ArrowLeft size={22} />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-text-primary">{c.ref || c.merchantRef}</h1>
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
          {c.status === "Active" && (
            <span className="inline-flex items-center gap-1">
              <button
                onClick={() => {
                  setAmendNotice(null);
                  setAmendOpen(true);
                }}
                disabled={!actions.allowEditCollection || !canAmendAny}
                title={
                  !actions.allowEditCollection
                    ? "Amending is switched off for this merchant (allow_edit_collection = false)."
                    : !canAmendAny
                      ? "No upcoming Scheduled collection that can still be changed."
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
                  disabled={!actions.allowPauseResume}
                  title={actions.allowPauseResume ? undefined : "Pause/resume is switched off for this merchant (allow_pause_resume = false)."}
                  className="flex items-center gap-2 rounded-lg border border-border-color bg-white px-4 py-2.5 text-sm font-medium text-text-primary hover:border-text-muted disabled:cursor-not-allowed disabled:text-text-muted"
                >
                  <PauseCircle size={16} />
                  Pause
                </button>
              ) : (
                <button
                  onClick={() => setSubscriptionStatus("Active")}
                  disabled={!actions.allowPauseResume}
                  className="flex items-center gap-2 rounded-lg border border-brand-blue px-4 py-2.5 text-sm font-medium text-brand-blue disabled:cursor-not-allowed disabled:border-border-color disabled:text-text-muted"
                >
                  <PlayCircle size={16} />
                  Resume
                </button>
              )}
              <FieldHint k={subscriptionStatus === "Active" ? "act.pause" : "act.resume"} />
            </span>
          )}
          {!isClosed && c.status !== "Awaiting Customer Details" && (
            <span className="inline-flex items-center gap-1">
              <button
                onClick={() => setCancelModalOpen(true)}
                disabled={!actions.allowCancelContract}
                title={actions.allowCancelContract ? undefined : "Cancel is switched off for this merchant (allow_cancel_contract = false)."}
                className="flex items-center gap-2 rounded-lg border border-status-declined px-4 py-2.5 text-sm font-medium text-status-declined disabled:cursor-not-allowed disabled:border-border-color disabled:text-text-muted"
              >
                <Ban size={16} />
                Cancel mandate
              </button>
              <FieldHint k="act.cancel" />
            </span>
          )}
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
          label="Unsuccessful Collections"
          value={formatMoneyAED(summary.failed.reduce((sum, o) => sum + o.amount, 0))}
          sub={`${summary.failed.length} of ${occurrences.length} installments`}
        />
        <StatCard
          label="Outstanding"
          value={formatMoneyAED(summary.outstanding)}
          sub={summary.failed.length > 0 ? `incl. ${summary.failed.length} unsuccessful` : "—"}
        />
        <StatCard
          label="Next collection"
          value={summary.next ? summary.next.dueDate : "—"}
          sub={summary.next ? `${formatMoneyAED(summary.next.amount)} · ${(c.collectionFrequency ?? c.frequency).toLowerCase()}` : "No further occurrences scheduled"}
        />
      </div>

      <Section title="Mandate details">
        <div className="grid grid-cols-2 gap-x-16">
          <div>
            <Field label="Customer name" value={c.customerName} hint="view.customerName" />
            <Field label={c.customerIdType} value={c.customerIdNumber} hint="view.emiratesId" />
            <Field label="Email / mobile" value={`${email} · ${mobile}`} hint="create.customerEmail" />
            <Field
              label="Mandate reference"
              value={c.ref || <span className="text-text-muted">{PENDING_INSTRUMENT_REF_LABEL}</span>}
              hint="view.mandateRef"
            />
            <Field label="Merchant reference" value={c.merchantRef} hint="view.merchantRef" />
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
                    {c.instrumentType} {c.maskedInstrumentRef}
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
                  config.suppressCustomerNotifications
                    ? "Not sent by Geidea (suppressed)"
                    : `Sent ${resendCount}× ${c.reviewLinkExpiresAt ? `· valid until ${c.reviewLinkExpiresAt}` : ""}`
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
          <Field label="Notes" value={c.notes || <span className="text-text-muted">—</span>} hint="view.notes" />
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
              onSimulate={(seq, r) => setOccurrences((prev) => applyRetryResult(c, prev, seq, r))}
            />
          </div>
        ) : (
          <div className="py-1 text-sm text-text-muted">{c.emptyNote}</div>
        )}
        {c.cancelledNote && <div className="mt-2 text-xs text-text-muted">{c.cancelledNote}</div>}
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
            setAmendNotice(
              `Schedule amended — ${changed.length} collection${changed.length === 1 ? "" : "s"} (#${changed.join(", #")}) updated, schedule version v${scheduleVersion + 1}${reason ? `. Reason: ${reason}` : ""}. Retry deadlines recalculated.`
            );
          }}
        />
      )}

      <Modal open={pauseModalOpen} onClose={() => setPauseModalOpen(false)}>
        <div className="p-8">
          <h2 className="mb-2 text-xl font-bold text-text-primary">Pause this contract?</h2>
          <p className="mb-6 text-sm text-text-secondary">
            This suspends the <strong>subscription</strong> only — the mandate itself stays Active.
            Collections due while paused are Skipped and not collected (they are not rolled over). Anything
            already sent to DDS carries on. You can resume at any time.
          </p>
          <div className="flex items-center justify-end gap-4">
            <button onClick={() => setPauseModalOpen(false)} className="text-sm font-medium text-text-secondary">
              Cancel
            </button>
            <button
              onClick={() => {
                setSubscriptionStatus("Paused");
                setPauseModalOpen(false);
              }}
              className={clsx("rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover")}
            >
              Pause subscription
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={cancelModalOpen} onClose={() => setCancelModalOpen(false)}>
        <div className="p-8">
          <h2 className="mb-2 text-xl font-bold text-text-primary">Cancel mandate flow — not yet available</h2>
          <p className="mb-6 text-sm text-text-secondary">
            The cancel-mandate flow (Backend Stories S8 — reason code, customer UAE PASS cancellation signing) is
            parked. This button is a placeholder for that flow.
          </p>
          <div className="flex justify-end">
            <button
              onClick={() => setCancelModalOpen(false)}
              className="rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
            >
              Got it
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
