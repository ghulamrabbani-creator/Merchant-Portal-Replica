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
} from "lucide-react";
import clsx from "clsx";
import { directDebitContracts } from "@/lib/mock-data";
import { formatMoneyAED } from "@/lib/direct-debit";
import StatCard from "@/components/ui/StatCard";
import StatusDot from "@/components/ui/StatusDot";
import Modal from "@/components/ui/Modal";
import { DirectDebitOccurrence } from "@/lib/types";

function Field({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border-color py-2.5 last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-right text-sm font-medium text-text-primary">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 rounded-xl border border-border-color bg-card-bg p-6">
      <div className="mb-2 text-base font-bold text-text-primary">{title}</div>
      {children}
    </div>
  );
}

const RETRY_CAP = 3;

export default function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const found = directDebitContracts.find((x) => x.id === id);

  // Local, in-memory copy so Pause/Resume/Retry can update the view without mutating the
  // shared mock-data module. Not persisted — see README note in the wireframe package this
  // screen was built from (Notes/Projects/Direct Debit.md, Contract Detail screen section).
  // Hooks must run unconditionally, ahead of the not-found check below, so they fall back to
  // safe defaults when `found` is undefined.
  const [subscriptionStatus, setSubscriptionStatus] = useState(found?.subscriptionStatus ?? "Active");
  const [occurrences, setOccurrences] = useState<DirectDebitOccurrence[]>(found?.occurrences ?? []);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const summary = useMemo(() => {
    const paid = occurrences.filter((o) => o.status === "Paid");
    const failed = occurrences.filter((o) => o.status === "Failed");
    const scheduled = occurrences.filter((o) => o.status === "Scheduled");
    const collected = paid.reduce((sum, o) => sum + o.amount, 0);
    const outstanding =
      scheduled.reduce((sum, o) => sum + o.amount, 0) +
      failed.reduce((sum, o) => sum + o.amount, 0);
    const next = scheduled[0];
    const last = [...paid, ...failed].sort((a, b) => a.seq - b.seq).pop();
    return { paid, failed, scheduled, collected, outstanding, next, last };
  }, [occurrences]);

  if (!found) return notFound();
  const c = found;

  function handleRetry(seq: number) {
    setOccurrences((prev) =>
      prev.map((o) => {
        if (o.seq !== seq) return o;
        const nextCount = (o.retryCount ?? 0) + 1;
        return {
          ...o,
          retryCount: nextCount,
          note:
            nextCount >= RETRY_CAP
              ? `${nextCount} of ${RETRY_CAP} retries exhausted`
              : `Retry submitted — ${nextCount} of ${RETRY_CAP} retries used`,
        };
      })
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-text-muted">
        <Link href="/direct-debit" className="hover:text-text-primary hover:underline">
          Direct Debit
        </Link>
        <span>/</span>
        <span>{c.ref}</span>
      </div>

      <div className="mb-5 flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link
            href="/direct-debit"
            className="mt-1.5 text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={22} />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-text-primary">{c.ref}</h1>
              <StatusDot status={c.status} />
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
        <div className="flex items-center gap-2.5">
          {subscriptionStatus === "Active" ? (
            <button
              onClick={() => setPauseModalOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-border-color bg-white px-4 py-2.5 text-sm font-medium text-text-primary hover:border-text-muted"
            >
              <PauseCircle size={16} />
              Pause
            </button>
          ) : (
            <button
              onClick={() => setSubscriptionStatus("Active")}
              className="flex items-center gap-2 rounded-lg border border-brand-blue px-4 py-2.5 text-sm font-medium text-brand-blue"
            >
              <PlayCircle size={16} />
              Resume
            </button>
          )}
          <button
            onClick={() => setCancelModalOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-status-declined px-4 py-2.5 text-sm font-medium text-status-declined"
          >
            <Ban size={16} />
            Cancel mandate
          </button>
        </div>
      </div>

      {c.pausedNote && subscriptionStatus === "Paused" && (
        <div className="mb-5 rounded-lg border border-status-pending bg-status-pending/10 px-4 py-2.5 text-sm text-text-primary">
          {c.pausedNote}
        </div>
      )}

      <div className="mb-2 flex gap-3">
        <StatCard label="Customer" value={c.customerName} sub={c.customerIdNumber} />
        <StatCard
          label="Collected"
          value={formatMoneyAED(summary.collected)}
          sub={`${summary.paid.length} of ${occurrences.length} installments`}
        />
        <StatCard
          label="Outstanding"
          value={formatMoneyAED(summary.outstanding)}
          sub={summary.failed.length > 0 ? `incl. ${summary.failed.length} failed payment${summary.failed.length > 1 ? "s" : ""}` : "—"}
        />
        <StatCard
          label="Next collection"
          value={summary.next ? summary.next.dueDate : "—"}
          sub={summary.next ? `${formatMoneyAED(summary.next.amount)} · ${c.frequency.toLowerCase()}` : "No further occurrences scheduled"}
        />
      </div>

      <Section title="Mandate details">
        <div className="grid grid-cols-2 gap-x-16">
          <div>
            <Field label="Customer name" value={c.customerName} />
            <Field label={c.customerIdType} value={c.customerIdNumber} />
            <Field label="Mandate reference" value={c.ref} />
            <Field label="Merchant reference" value={c.merchantRef} />
            <Field label="Status" value={<StatusDot status={c.status} />} />
            <Field label="Created on" value={c.createdOn} />
            <Field label="Validity" value={`${c.commencesOn} – ${c.expiresOn}`} />
            <Field label="Frequency" value={c.frequency} />
          </div>
          <div>
            <Field label="Next collection" value={summary.next ? `${summary.next.dueDate} · ${formatMoneyAED(summary.next.amount)}` : "—"} />
            <Field label="Last collection" value={summary.last ? `${summary.last.dueDate} (${summary.last.status})` : "—"} />
            <Field label="Amount type" value={c.amountType} />
            <Field
              label={c.amountType === "Fixed" ? "Amount per installment" : "Min / Max amount"}
              value={c.amountType === "Fixed" ? formatMoneyAED(c.minAmount) : `${formatMoneyAED(c.minAmount)} – ${formatMoneyAED(c.maxAmount)}`}
            />
            <Field label="Successful collections" value={summary.paid.length} />
            <Field label="Failed collections" value={summary.failed.length} />
            <Field
              label="Payment method"
              value={
                <span className="inline-flex items-center gap-1.5">
                  {c.instrumentType === "Bank Account" ? (
                    <Landmark size={14} strokeWidth={1.8} />
                  ) : (
                    <CreditCard size={14} strokeWidth={1.8} />
                  )}
                  {c.instrumentType} {c.maskedInstrumentRef}
                  {c.bankName ? `, ${c.bankName}` : ""}
                </span>
              }
            />
          </div>
        </div>
        <div className="mt-1 border-t border-border-color pt-2.5">
          <Field
            label="Rollover"
            value={
              c.rolloverEnabled ? (
                <span className="inline-flex items-center gap-1.5">
                  <RotateCw size={13} strokeWidth={2} />
                  Enabled — {c.rolloversAllowed} allowed, {c.rolloverRemaining} remaining
                </span>
              ) : (
                "Disabled"
              )
            }
          />
          <Field label="Notes" value={c.notes || <span className="text-text-muted">—</span>} />
        </div>
      </Section>

      <Section title="Collection status">
        {occurrences.length > 0 ? (
          <div className="mt-2 overflow-hidden rounded-lg border border-border-color">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-color bg-page-bg text-left text-text-secondary">
                  <th className="px-3.5 py-2 font-medium">#</th>
                  <th className="px-3.5 py-2 font-medium">Due Date</th>
                  <th className="px-3.5 py-2 font-medium">Amount</th>
                  <th className="px-3.5 py-2 font-medium">Status</th>
                  <th className="px-3.5 py-2 font-medium">Rolled Over</th>
                  <th className="px-3.5 py-2 font-medium">Payout Status</th>
                  <th className="px-3.5 py-2 font-medium">Collected On</th>
                  <th className="px-3.5 py-2 font-medium">Retry</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {occurrences.map((o) => {
                  const retryCount = o.retryCount ?? 0;
                  const canRetry = o.status === "Failed" && retryCount < RETRY_CAP;
                  return (
                    <tr key={o.seq} className="border-t border-border-color align-top">
                      <td className="px-3.5 py-2 text-text-muted">{o.seq}</td>
                      <td className="px-3.5 py-2 text-text-primary">{o.dueDate}</td>
                      <td className="px-3.5 py-2 font-semibold text-text-primary">
                        {formatMoneyAED(o.amount)}
                        {o.rolledOverFrom && (
                          <div className="text-[11px] font-normal text-text-muted">
                            incl. rollover from #{o.rolledOverFrom}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-2">
                        <StatusDot status={o.status} />
                        {o.note && (
                          <div className="mt-0.5 max-w-[260px] text-[11px] text-text-muted">{o.note}</div>
                        )}
                      </td>
                      <td className="px-3.5 py-2 text-text-muted">
                        {o.rolledOver === "rolled_over"
                          ? "Yes"
                          : o.rolledOver === "blocked_by_ceiling"
                            ? "Blocked"
                            : "—"}
                      </td>
                      <td className="px-3.5 py-2 text-text-muted">{o.payoutStatus || "—"}</td>
                      <td className="px-3.5 py-2 text-text-muted">{o.collectedOn || "—"}</td>
                      <td className="px-3.5 py-2">
                        <button
                          onClick={() => canRetry && handleRetry(o.seq)}
                          disabled={!canRetry}
                          className={clsx(
                            "rounded-md border px-2.5 py-1 text-xs font-medium",
                            canRetry
                              ? "border-brand-blue text-brand-blue hover:bg-brand-blue/5"
                              : "border-border-color text-text-muted cursor-not-allowed"
                          )}
                        >
                          Retry {o.status === "Failed" ? `(${retryCount} of ${RETRY_CAP})` : ""}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-1 text-sm text-text-muted">{c.emptyNote}</div>
        )}
        {c.cancelledNote && <div className="mt-2 text-xs text-text-muted">{c.cancelledNote}</div>}
      </Section>

      <Modal open={pauseModalOpen} onClose={() => setPauseModalOpen(false)}>
        <div className="p-8">
          <h2 className="mb-2 text-xl font-bold text-text-primary">Pause this contract?</h2>
          <p className="mb-6 text-sm text-text-secondary">
            This suspends the <strong>subscription</strong> only — the mandate itself stays Active.
            Occurrences due after the pause take effect will not be included in future payment
            file submissions. Anything already due, submitted, or settled is unaffected. You can
            resume at any time.
          </p>
          <div className="flex items-center justify-end gap-4">
            <button
              onClick={() => setPauseModalOpen(false)}
              className="text-sm font-medium text-text-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setSubscriptionStatus("Paused");
                setPauseModalOpen(false);
              }}
              className="rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
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
            The cancel-mandate flow is still being designed (deferred until the Contract Detail
            screen was finalized — see Notes/Projects/Direct Debit.md). This button is a
            placeholder for that flow.
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
