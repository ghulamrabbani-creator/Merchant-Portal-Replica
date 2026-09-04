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
  Undo2,
} from "lucide-react";
import clsx from "clsx";
import { directDebitContracts } from "@/lib/mock-data";
import {
  formatMoneyAED,
  RETRY_CAP,
  canRolloverOccurrence,
  canUndoRollover,
  rolloverStreakUsed,
  rolloverDestinationOptions,
} from "@/lib/direct-debit";
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

export default function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const found = directDebitContracts.find((x) => x.id === id);

  // Local, in-memory copy so Pause/Resume/Retry/Rollover/Undo rollover can update the view
  // without mutating the shared mock-data module. Not persisted — see README note in the
  // wireframe package this screen was built from (Notes/Projects/Direct Debit.md, Contract
  // Detail screen section). Hooks must run unconditionally, ahead of the not-found check below,
  // so they fall back to safe defaults when `found` is undefined.
  const [subscriptionStatus, setSubscriptionStatus] = useState(found?.subscriptionStatus ?? "Active");
  const [occurrences, setOccurrences] = useState<DirectDebitOccurrence[]>(found?.occurrences ?? []);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  // Which destination occurrence is currently selected in each Skipped row's rollover dropdown,
  // keyed by the SOURCE occurrence's seq. Only populated once the merchant changes the dropdown
  // away from its default (nearest non-ceiling-breaching option) — see renderActions.
  const [rolloverSelections, setRolloverSelections] = useState<Record<number, number>>({});

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

  // Live, derived remaining-in-the-current-run figure — reflects the consecutive/reset rule
  // (see canRolloverOccurrence), not the static `rolloverRemaining` snapshot in mock data, so it
  // updates immediately if a Rollover/Undo rollover click above changes what's currently stacked.
  const liveRolloverRemaining = useMemo(() => {
    if (!found) return 0;
    const used = rolloverStreakUsed(occurrences);
    return Math.max(0, found.rolloversAllowed - used);
  }, [occurrences, found]);

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

  // Manual rollover for a Skipped occurrence (see Notes/Projects/Direct Debit.md — "Skipped
  // occurrences & manual rollover"). Unlike the automatic Failed-occurrence rollover, this is a
  // merchant choice: pressing the button sets THIS occurrence's `rolledOver` flag to
  // "rolled_over" (its own `status` stays "Skipped" — status and rolledOver are independent
  // fields, see the DDRolloverState comment in lib/types.ts) and folds its amount onto whichever
  // upcoming occurrence the merchant picked from the dropdown (`destSeq`) — no longer assumed to
  // be `seq + 1`, so a merchant with several consecutive Skipped occurrences can spread them
  // across different future occurrences instead of laddering through each other. The button then
  // flips to "Undo rollover" on this same row.
  function handleRollover(seq: number, destSeq: number) {
    setOccurrences((prev) => {
      const eligibility = canRolloverOccurrence(c, subscriptionStatus, prev, seq, destSeq);
      if (!eligibility.allowed) return prev;
      const idx = prev.findIndex((o) => o.seq === seq);
      const destIdx = prev.findIndex((o) => o.seq === destSeq);
      if (idx === -1 || destIdx === -1) return prev;
      const source = prev[idx];
      const dest = prev[destIdx];
      const next = [...prev];
      next[idx] = { ...source, rolledOver: "rolled_over" };
      // APPEND to rolledOverFrom rather than overwrite — a destination can now receive more than
      // one source (bug found by Rabbani testing DD-2026-00085: overwriting a single scalar field
      // silently dropped the earlier source's reference and broke Undo for it). The "incl.
      // rollover from #X, #Y" line is derived at render time from this array (see renderActions'
      // caller / the amount cell below), not stored as a static note, so it always lists every
      // contributing source correctly regardless of order.
      next[destIdx] = {
        ...dest,
        amount: dest.amount + source.amount,
        rolledOverFrom: [...(dest.rolledOverFrom ?? []), source.seq],
      };
      return next;
    });
    setRolloverSelections((prev) => {
      const next = { ...prev };
      delete next[seq];
      return next;
    });
  }

  // Reverses handleRollover — for the "I didn't mean to press that" case. Only enabled while
  // the destination occurrence hasn't itself been submitted (see canUndoRollover). Removes ONLY
  // this source's contribution — a destination that received more than one rollover keeps the
  // others intact (this is exactly the case that used to break: undoing one source used to wipe
  // the destination's single rolledOverFrom field entirely, disabling Undo for every OTHER source
  // still rolled onto it too).
  function handleUndoRollover(seq: number) {
    setOccurrences((prev) => {
      if (!canUndoRollover(prev, seq)) return prev;
      const idx = prev.findIndex((o) => o.seq === seq);
      if (idx === -1) return prev;
      const source = prev[idx];
      const destIdx = prev.findIndex((o) => (o.rolledOverFrom ?? []).includes(source.seq));
      if (destIdx === -1) return prev;
      const dest = prev[destIdx];
      const remaining = (dest.rolledOverFrom ?? []).filter((s) => s !== source.seq);
      const next = [...prev];
      next[idx] = { ...source, rolledOver: "none" };
      next[destIdx] = {
        ...dest,
        amount: dest.amount - source.amount,
        rolledOverFrom: remaining.length > 0 ? remaining : undefined,
      };
      return next;
    });
  }

  function renderRolledOver(o: DirectDebitOccurrence) {
    if (o.rolledOver === "rolled_over") return "Yes";
    if (o.rolledOver === "blocked_by_ceiling") return "Blocked";
    if (o.rolledOver === "exhausted") return "Exhausted";
    if (!c.rolloverEnabled) return "Not Available";
    return "—";
  }

  // Actions column: dynamic per occurrence — Retry for a Failed row, Rollover / Undo rollover
  // for a Skipped row, nothing for anything else. Renamed from "Retry" so both actions can share
  // the one column rather than fighting over it.
  function renderActions(o: DirectDebitOccurrence) {
    if (o.status === "Failed") {
      const retryCount = o.retryCount ?? 0;
      const canRetry = retryCount < RETRY_CAP;
      return (
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
          Retry {`(${retryCount} of ${RETRY_CAP})`}
        </button>
      );
    }

    if (o.status === "Skipped") {
      if (o.rolledOver === "rolled_over") {
        const canUndo = canUndoRollover(occurrences, o.seq);
        return (
          <button
            onClick={() => canUndo && handleUndoRollover(o.seq)}
            disabled={!canUndo}
            title={canUndo ? undefined : "Locked — the occurrence it rolled onto has already been processed."}
            className={clsx(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
              canUndo
                ? "border-status-declined text-status-declined hover:bg-status-declined/5"
                : "border-border-color text-text-muted cursor-not-allowed"
            )}
          >
            <Undo2 size={12} />
            Undo rollover
          </button>
        );
      }

      // Destination is merchant-chosen (see Direct Debit.md, "Skipped occurrences & manual
      // rollover") — only upcoming Scheduled occurrences qualify, so a Skipped or Failed
      // occurrence can never be picked as where the amount lands. `canRolloverOccurrence` without
      // a destSeq answers "is Rollover available at all" (contract toggle, pause state, streak
      // cap, at least one non-breaching destination); once a destination is selected the same
      // function re-checks THAT specific choice before committing.
      const gate = canRolloverOccurrence(c, subscriptionStatus, occurrences, o.seq);
      const options = rolloverDestinationOptions(c, occurrences, o.seq);
      const defaultDest = options.find((opt) => !opt.wouldBreachCeiling)?.seq ?? options[0]?.seq;
      const selectedDest = rolloverSelections[o.seq] ?? defaultDest;
      const confirmEligibility =
        gate.allowed && selectedDest != null
          ? canRolloverOccurrence(c, subscriptionStatus, occurrences, o.seq, selectedDest)
          : gate;

      const gateTitle =
        gate.reason === "subscription_paused"
          ? "Rollover is disabled while the subscription is paused — Resume it first."
          : gate.reason === "rollover_disabled"
            ? "Rollover isn't enabled on this contract."
            : gate.reason === "exhausted"
              ? `No rollover left — ${c.rolloversAllowed} of ${c.rolloversAllowed} already used in this consecutive run.`
              : gate.reason === "no_future_occurrence"
                ? "No upcoming Scheduled occurrence to roll this onto."
                : undefined;
      const confirmTitle =
        confirmEligibility.reason === "blocked_by_ceiling"
          ? "Rolling onto the selected occurrence would exceed the contract's max amount ceiling — pick a different one."
          : gateTitle;

      return (
        <div className="flex flex-col gap-1">
          {gate.allowed && options.length > 0 && (
            <select
              value={selectedDest ?? ""}
              onChange={(e) =>
                setRolloverSelections((prev) => ({ ...prev, [o.seq]: Number(e.target.value) }))
              }
              className="rounded-md border border-border-color bg-white px-1.5 py-1 text-[11px] text-text-primary"
            >
              {options.map((opt) => (
                <option key={opt.seq} value={opt.seq} disabled={opt.wouldBreachCeiling}>
                  #{opt.seq} · {opt.dueDate} → {formatMoneyAED(opt.resultingAmount)}
                  {opt.wouldBreachCeiling ? " (exceeds ceiling)" : ""}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => confirmEligibility.allowed && selectedDest != null && handleRollover(o.seq, selectedDest)}
            disabled={!confirmEligibility.allowed}
            title={confirmTitle}
            className={clsx(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
              confirmEligibility.allowed
                ? "border-brand-blue text-brand-blue hover:bg-brand-blue/5"
                : "border-border-color text-text-muted cursor-not-allowed"
            )}
          >
            <RotateCw size={12} />
            Rollover
          </button>
          {gate.reason === "subscription_paused" && (
            <div className="max-w-[220px] text-[11px] text-text-muted">Disabled while paused.</div>
          )}
        </div>
      );
    }

    return null;
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
          label="Successful Collections"
          value={formatMoneyAED(summary.collected)}
          sub={`${summary.paid.length} of ${occurrences.length} installments`}
        />
        <StatCard
          label="Failed Collections"
          value={formatMoneyAED(summary.failed.reduce((sum, o) => sum + o.amount, 0))}
          sub={`${summary.failed.length} of ${occurrences.length} installments`}
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
                  Enabled — up to {c.rolloversAllowed} consecutive, {liveRolloverRemaining} left in the current run (resets to {c.rolloversAllowed} after any occurrence is collected in full)
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
                  <th className="px-3.5 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {occurrences.map((o) => (
                  <tr key={o.seq} className="border-t border-border-color align-top">
                    <td className="px-3.5 py-2 text-text-muted">{o.seq}</td>
                    <td className="px-3.5 py-2 text-text-primary">{o.dueDate}</td>
                    <td className="px-3.5 py-2 font-semibold text-text-primary">
                      {formatMoneyAED(o.amount)}
                      {o.rolledOverFrom && o.rolledOverFrom.length > 0 && (
                        <div className="text-[11px] font-normal text-text-muted">
                          incl. rollover from {o.rolledOverFrom.map((s) => `#${s}`).join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="px-3.5 py-2">
                      <StatusDot status={o.status} />
                      {o.status === "Skipped" && subscriptionStatus === "Paused" && (
                        <div className="mt-0.5 max-w-[260px] text-[11px] text-text-muted">
                          Subscription paused — not submitted for collection.
                        </div>
                      )}
                      {o.note && (
                        <div className="mt-0.5 max-w-[260px] text-[11px] text-text-muted">{o.note}</div>
                      )}
                    </td>
                    <td className="px-3.5 py-2 text-text-muted">{renderRolledOver(o)}</td>
                    <td className="px-3.5 py-2 text-text-muted">{o.payoutStatus || "—"}</td>
                    <td className="px-3.5 py-2 text-text-muted">{o.collectedOn || "—"}</td>
                    <td className="px-3.5 py-2">{renderActions(o)}</td>
                  </tr>
                ))}
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
