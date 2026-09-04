"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, Landmark, CreditCard, MoreVertical, RotateCw, Undo2 } from "lucide-react";
import clsx from "clsx";
import PageHeader from "@/components/ui/PageHeader";
import SearchBar from "@/components/ui/SearchBar";
import ExportButton from "@/components/ui/ExportButton";
import StatCard from "@/components/ui/StatCard";
import StatusDot from "@/components/ui/StatusDot";
import DirectDebitFiltersButton from "@/components/directdebit/DirectDebitFiltersButton";
import CreateDirectDebitContractModal from "@/components/directdebit/CreateDirectDebitContractModal";
import { directDebitContracts } from "@/lib/mock-data";
import {
  formatMoneyAED,
  RETRY_CAP,
  canRolloverOccurrence,
  canUndoRollover,
  rolloverDestinationOptions,
} from "@/lib/direct-debit";
import { DirectDebitContract, DirectDebitOccurrence } from "@/lib/types";

function collectionSummary(occurrences: DirectDebitOccurrence[]) {
  const successful = occurrences.filter((o) => o.status === "Paid");
  const failed = occurrences.filter((o) => o.status === "Failed");
  return {
    successCount: successful.length,
    successAmount: successful.reduce((sum, o) => sum + o.amount, 0),
    failCount: failed.length,
    failAmount: failed.reduce((sum, o) => sum + o.amount, 0),
  };
}

export default function DirectDebitPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Local, in-memory copy of each contract's occurrences, keyed by contract id, so Retry /
  // Rollover / Undo rollover on the List screen's expand-row can update the view without
  // mutating the shared mock-data module — same pattern as the Contract Detail screen
  // (direct-debit/[id]/page.tsx). Mirrors the Skipped/Actions treatment from that screen onto
  // this one (Notes/Projects/Direct Debit.md backlog item, Sep 2026).
  const [occurrencesByContract, setOccurrencesByContract] = useState<
    Record<string, DirectDebitOccurrence[]>
  >(() => Object.fromEntries(directDebitContracts.map((c) => [c.id, c.occurrences])));

  // Which destination occurrence is selected in each Skipped row's rollover dropdown, keyed by
  // contract id then by the SOURCE occurrence's seq — see Contract Detail screen for the
  // single-contract version of this same pattern.
  const [rolloverSelections, setRolloverSelections] = useState<
    Record<string, Record<number, number>>
  >({});

  function handleRetry(contractId: string, seq: number) {
    setOccurrencesByContract((prev) => ({
      ...prev,
      [contractId]: (prev[contractId] ?? []).map((o) => {
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
      }),
    }));
  }

  // See Contract Detail screen (direct-debit/[id]/page.tsx) for the full write-up of why this
  // appends to rolledOverFrom instead of overwriting it (DD-2026-00085 bug fix, Sep 2026).
  function handleRollover(c: DirectDebitContract, seq: number, destSeq: number) {
    setOccurrencesByContract((prev) => {
      const occurrences = prev[c.id] ?? [];
      const eligibility = canRolloverOccurrence(c, c.subscriptionStatus, occurrences, seq, destSeq);
      if (!eligibility.allowed) return prev;
      const idx = occurrences.findIndex((o) => o.seq === seq);
      const destIdx = occurrences.findIndex((o) => o.seq === destSeq);
      if (idx === -1 || destIdx === -1) return prev;
      const source = occurrences[idx];
      const dest = occurrences[destIdx];
      const next = [...occurrences];
      next[idx] = { ...source, rolledOver: "rolled_over" };
      next[destIdx] = {
        ...dest,
        amount: dest.amount + source.amount,
        rolledOverFrom: [...(dest.rolledOverFrom ?? []), source.seq],
      };
      return { ...prev, [c.id]: next };
    });
    setRolloverSelections((prev) => {
      const forContract = { ...(prev[c.id] ?? {}) };
      delete forContract[seq];
      return { ...prev, [c.id]: forContract };
    });
  }

  function handleUndoRollover(contractId: string, seq: number) {
    setOccurrencesByContract((prev) => {
      const occurrences = prev[contractId] ?? [];
      if (!canUndoRollover(occurrences, seq)) return prev;
      const idx = occurrences.findIndex((o) => o.seq === seq);
      if (idx === -1) return prev;
      const source = occurrences[idx];
      const destIdx = occurrences.findIndex((o) => (o.rolledOverFrom ?? []).includes(source.seq));
      if (destIdx === -1) return prev;
      const dest = occurrences[destIdx];
      const remaining = (dest.rolledOverFrom ?? []).filter((s) => s !== source.seq);
      const next = [...occurrences];
      next[idx] = { ...source, rolledOver: "none" };
      next[destIdx] = {
        ...dest,
        amount: dest.amount - source.amount,
        rolledOverFrom: remaining.length > 0 ? remaining : undefined,
      };
      return { ...prev, [contractId]: next };
    });
  }

  function renderRolledOver(c: DirectDebitContract, o: DirectDebitOccurrence) {
    if (o.rolledOver === "rolled_over") return "Yes";
    if (o.rolledOver === "blocked_by_ceiling") return "Blocked";
    if (o.rolledOver === "exhausted") return "Exhausted";
    if (!c.rolloverEnabled) return "Not Available";
    return "—";
  }

  // Actions column: dynamic per occurrence — Retry for a Failed row, Rollover / Undo rollover
  // for a Skipped row, nothing for anything else. Identical logic to the Contract Detail
  // screen's renderActions, parameterized here by contract since this table lists many
  // contracts at once rather than just one.
  function renderActions(c: DirectDebitContract, occurrences: DirectDebitOccurrence[], o: DirectDebitOccurrence) {
    if (o.status === "Failed") {
      const retryCount = o.retryCount ?? 0;
      const canRetry = retryCount < RETRY_CAP;
      return (
        <button
          onClick={() => canRetry && handleRetry(c.id, o.seq)}
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
            onClick={() => canUndo && handleUndoRollover(c.id, o.seq)}
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

      const gate = canRolloverOccurrence(c, c.subscriptionStatus, occurrences, o.seq);
      const options = rolloverDestinationOptions(c, occurrences, o.seq);
      const defaultDest = options.find((opt) => !opt.wouldBreachCeiling)?.seq ?? options[0]?.seq;
      const selectedDest = (rolloverSelections[c.id] ?? {})[o.seq] ?? defaultDest;
      const confirmEligibility =
        gate.allowed && selectedDest != null
          ? canRolloverOccurrence(c, c.subscriptionStatus, occurrences, o.seq, selectedDest)
          : gate;

      const gateTitle =
        gate.reason === "subscription_paused"
          ? "Rollover is disabled while the subscription is paused — Resume it first from the Contract Detail screen."
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
                setRolloverSelections((prev) => ({
                  ...prev,
                  [c.id]: { ...(prev[c.id] ?? {}), [o.seq]: Number(e.target.value) },
                }))
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
            onClick={() => confirmEligibility.allowed && selectedDest != null && handleRollover(c, o.seq, selectedDest)}
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
      <PageHeader title="Direct Debit Contracts" />

      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-border-color bg-white px-4 py-2.5 text-sm font-medium text-text-primary">
            All statuses
            <ChevronDown size={14} />
          </button>
          <SearchBar
            scopes={["Contract Ref", "Customer Name", "Merchant Ref", "Emirates ID"]}
            placeholder="Search collections, mandates"
          />
        </div>
        <div className="flex items-center gap-3">
          <DirectDebitFiltersButton />
          <ExportButton />
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-blue px-[18px] py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
          >
            <Plus size={16} />
            Add Contract
          </button>
        </div>
      </div>

      <div className="mb-5 flex gap-3">
        <StatCard label="Active Contracts" value="142" sub="Total value: AED 1,842,600.00" />
        <StatCard label="Pending Customer Sign" value="11" sub="Awaiting UAE PASS signature" />
        <StatCard label="Pending Bank Approval" value="7" sub="Submitted to Central Bank" />
        <StatCard label="Total Collections" value="3,204" sub="AED 12,860,400.00 total value" />
        <StatCard label="Failed Collections" value="AED 86,400.00" sub="27 occurrences, 9 exhausted retries" />
        <StatCard label="Declined Contracts" value="6" sub="Rejected or Denied" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border-color bg-card-bg">
        <table className="w-full min-w-[1200px] text-sm">
          <thead>
            <tr className="border-b border-border-color text-left text-text-secondary">
              <th className="w-10 px-4 py-3" />
              <th className="px-4 py-3 font-medium">Contract Ref</th>
              <th className="px-4 py-3 font-medium">Customer Name</th>
              <th className="px-3 py-3 font-medium">Instrument</th>
              <th className="px-4 py-3 font-medium">Validity</th>
              <th className="px-4 py-3 font-medium">Frequency</th>
              <th className="px-4 py-3 font-medium">Previous Deduction</th>
              <th className="px-4 py-3 font-medium">Next Due</th>
              <th className="px-4 py-3 font-medium">Successful Collections</th>
              <th className="px-4 py-3 font-medium">Failed Collections</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {directDebitContracts.map((c) => {
              const isOpen = expanded === c.id;
              const occurrences = occurrencesByContract[c.id] ?? c.occurrences;
              const summary = collectionSummary(occurrences);
              return (
                <Fragment key={c.id}>
                  <tr
                    className={clsx(
                      "border-b border-border-color last:border-0 hover:bg-page-bg/60",
                      isOpen && "bg-page-bg/60"
                    )}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpanded(isOpen ? null : c.id)}
                        className="text-text-muted"
                      >
                        <ChevronDown
                          size={16}
                          className={clsx("transition-transform", isOpen && "rotate-180")}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/direct-debit/${c.id}`}
                        className="font-medium text-brand-blue hover:underline"
                      >
                        {c.ref}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-primary">{c.customerName}</td>
                    <td className="px-3 py-3 text-text-secondary">
                      {c.instrumentType === "Bank Account" ? (
                        <Landmark size={17} strokeWidth={1.7} />
                      ) : (
                        <CreditCard size={17} strokeWidth={1.7} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {c.commencesOn} – {c.expiresOn}
                    </td>
                    <td className="px-4 py-3 text-text-primary">{c.frequency}</td>
                    <td className="px-4 py-3">
                      {c.prevDeduction ? (
                        <>
                          <span
                            className={clsx(
                              "font-semibold",
                              c.prevDeduction.ok ? "text-status-completed" : "text-status-declined"
                            )}
                          >
                            {formatMoneyAED(c.prevDeduction.amount)}
                          </span>
                          <div className="text-xs text-text-muted">
                            {c.prevDeduction.date}
                            {!c.prevDeduction.ok && " · Failed"}
                          </div>
                        </>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {c.nextDue ? (
                        <>
                          {formatMoneyAED(c.nextDue.amount)}
                          <div className="text-xs text-text-muted">{c.nextDue.date}</div>
                        </>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {summary.successCount > 0 ? (
                        <>
                          <span className="font-semibold text-status-completed">{summary.successCount}</span>
                          <div className="text-xs text-text-muted">{formatMoneyAED(summary.successAmount)}</div>
                        </>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {summary.failCount > 0 ? (
                        <>
                          <span className="font-semibold text-status-declined">{summary.failCount}</span>
                          <div className="text-xs text-text-muted">{formatMoneyAED(summary.failAmount)}</div>
                        </>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusDot status={c.status} />
                      {c.subscriptionStatus === "Paused" && (
                        <div className="mt-0.5 text-xs text-text-muted">Subscription paused</div>
                      )}
                      {c.statusNote && (
                        <div className="mt-0.5 text-xs text-text-muted">{c.statusNote}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      <MoreVertical size={16} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-border-color bg-page-bg/40">
                      <td colSpan={12} className="px-4 py-4 pl-14">
                        {occurrences.length > 0 ? (
                          <>
                            <div className="overflow-hidden rounded-lg border border-border-color">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-border-color bg-card-bg text-left text-text-secondary">
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
                                        {o.status === "Skipped" && c.subscriptionStatus === "Paused" && (
                                          <div className="mt-0.5 max-w-[260px] text-[11px] text-text-muted">
                                            Subscription paused — not submitted for collection.
                                          </div>
                                        )}
                                        {o.note && (
                                          <div className="mt-0.5 max-w-[260px] text-[11px] text-text-muted">
                                            {o.note}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-3.5 py-2 text-text-muted">{renderRolledOver(c, o)}</td>
                                      <td className="px-3.5 py-2 text-text-muted">{o.payoutStatus || "—"}</td>
                                      <td className="px-3.5 py-2 text-text-muted">
                                        {o.collectedOn || "—"}
                                      </td>
                                      <td className="px-3.5 py-2">{renderActions(c, occurrences, o)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {c.cancelledNote && (
                              <div className="mt-2 text-xs text-text-muted">{c.cancelledNote}</div>
                            )}
                          </>
                        ) : (
                          <div className="py-1 text-sm text-text-muted">{c.emptyNote}</div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-border-color px-4 py-3 text-sm text-text-secondary">
          Show {directDebitContracts.length} of 142 contracts
        </div>
      </div>

      <CreateDirectDebitContractModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
