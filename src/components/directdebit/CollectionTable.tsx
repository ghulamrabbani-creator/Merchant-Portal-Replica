"use client";

// Collection status table, shared by the Contract List's expand-row and Contract Detail (added
// 25-Sep-2026 — both screens used to carry their own copy of this table and its Retry / manual
// Rollover logic).
//
// What changed with it (Backend Stories S5–S7):
//  - Manual rollover (Rollover button, destination picker, Undo rollover) is removed — out of MVP
//    scope (S7). The Rolled Over column now only reports what AUTOMATIC rollover did (S6 §3).
//  - Retry follows S6 §1.1: only a Rejected collection, not a terminal reason code, fewer than 3
//    retries, and on or before its retry deadline. The button says why when it's disabled.
//  - New Retry deadline column (S6 §1.2): next collection's due date − DDS min gap − 1 working day.
//  - Status shows the DDS reason label (S5 §3.3), the skip reason, and "Representment Pending"
//    while a retry is with DDS.
// 15-Oct-2026 (MP Backlog v2.2 US-18/US-19/US-22/US-26; DDS: representment is for RJCT only): an
// Error collection shows "Payment validation error" — no Retry, no bounce memo — and is re-set with
// Amend schedule (new payment reference). Reasons show on Rejected / Failed; a bounce memo appears on
// any collection rejected at least once; Retry is gated by the role's Retry permission.

import clsx from "clsx";
import { AlertTriangle, FileDown, RotateCw } from "lucide-react";
import StatusDot from "@/components/ui/StatusDot";
import FieldHint from "@/components/directdebit/FieldHint";
import { useDDConfig } from "@/lib/dd-config-context";
import { HintKey } from "@/lib/dd-field-map";
import {
  RETRY_BLOCKED_TEXT,
  RETRY_CAP,
  ddToday,
  diffDays,
  formatDateNice,
  formatMoneyAED,
  hasBounceMemo,
  paymentRef,
  sentPaymentRef,
  isTerminalReasonCode,
  parseNiceDate,
  reasonLabel,
  retryDeadline,
  retryEligibility,
} from "@/lib/direct-debit";
import { DDSubscriptionStatus, DirectDebitContract, DirectDebitOccurrence } from "@/lib/types";

const SKIP_REASON_TEXT: Record<string, string> = {
  paused: "Subscription paused — not sent for collection.",
  cancellation_signed: "Customer signed the cancellation — not sent while the bank decides.",
  min_gap: "Too close to the previous debit (DDS minimum gap) — amount rolled automatically.",
  not_active_in_time: "Mandate wasn't Active in time for this collection.",
  missed_submission: "Missed the payment file submission.",
};

function H({ label, k }: { label: string; k: HintKey }) {
  return (
    <th className="px-3.5 py-2 font-medium">
      <span className="inline-flex items-center gap-1">
        {label}
        <FieldHint k={k} />
      </span>
    </th>
  );
}

function rolledOverText(c: DirectDebitContract, o: DirectDebitOccurrence, all: DirectDebitOccurrence[]) {
  if (o.rolledOver === "rolled_over") {
    const dest = all.find((x) => (x.rolledOverFrom ?? []).includes(o.seq));
    return dest ? `Yes → #${dest.seq}` : "Yes";
  }
  if (o.rolledOver === "blocked_by_ceiling") return "Blocked (max amount)";
  if (o.rolledOver === "exhausted") return "Exhausted";
  if (o.rolledOver === "no_destination") return "No later collection";
  if (!c.rolloverEnabled) return "Not available";
  return "—";
}

export default function CollectionTable({
  contract,
  occurrences,
  subscriptionStatus,
  onRetry,
  onSimulate,
  onAmend,
  headerBg = "bg-page-bg",
}: {
  contract: DirectDebitContract;
  occurrences: DirectDebitOccurrence[];
  subscriptionStatus: DDSubscriptionStatus;
  onRetry: (seq: number) => void;
  onSimulate?: (seq: number, result: "ACCP" | "RJCT") => void;
  /** Opens Amend schedule (Contract Detail only) — the action for a collection in Error. */
  onAmend?: () => void;
  headerBg?: string;
}) {
  const { can, devHints } = useDDConfig();
  const today = ddToday();

  function statusCell(o: DirectDebitOccurrence) {
    const inRetry = o.paymentStatus === "RPND";
    return (
      <>
        <StatusDot status={inRetry ? "Representment Pending" : o.status === "Error" ? "Payment validation error" : o.status} />
        {(o.status === "Rejected" || o.status === "Failed") && o.reasonCode && o.reasonCode !== "0" && (
          <div
            className={clsx(
              "mt-0.5 max-w-[260px] text-[11px]",
              isTerminalReasonCode(o.reasonCode) ? "font-semibold text-status-expired" : "text-text-muted"
            )}
          >
            {o.reasonCode} · {reasonLabel(o.reasonCode)}
            {isTerminalReasonCode(o.reasonCode) && " (terminal)"}
          </div>
        )}
        {o.status === "Skipped" && o.skipReason && (
          <div className="mt-0.5 max-w-[260px] text-[11px] text-text-muted">{SKIP_REASON_TEXT[o.skipReason]}</div>
        )}
        {o.note && <div className="mt-0.5 max-w-[260px] text-[11px] text-text-muted">{o.note}</div>}
        {sentPaymentRef(contract.merchantRef, o) && (
          <div className="mt-0.5 font-mono text-[10.5px] text-text-muted" data-testid={`payref-${o.seq}`}>{sentPaymentRef(contract.merchantRef, o)}</div>
        )}
        {o.status === "Scheduled" && o.paymentSeq && (
          <div className="mt-0.5 text-[10.5px] text-text-muted" data-testid={`newref-${o.seq}`}>
            Re-set after an error · new reference <span className="font-mono">{paymentRef(contract.merchantRef, o.paymentSeq)}</span>
          </div>
        )}
        {(o.errorHistory ?? []).map((h, i) => (
          <div key={i} className="mt-0.5 text-[10.5px] text-text-muted">
            Earlier attempt <span className="font-mono">{paymentRef(contract.merchantRef, Number(h.paymentRef))}</span> ({h.dueDate}): {h.message}
          </div>
        ))}
      </>
    );
  }

  function deadlineCell(o: DirectDebitOccurrence) {
    if (o.status === "Cancelled" || o.status === "Skipped") return <span className="text-text-muted">—</span>;
    if (o.status === "Paid") return <span className="text-text-muted">—</span>;
    if (o.status === "Failed") {
      return <span className="text-text-muted">{isTerminalReasonCode(o.reasonCode) ? "No retry (terminal)" : "Closed"}</span>;
    }
    const d = retryDeadline(contract, occurrences, o.seq);
    if (!d) return <span className="text-text-muted">—</span>;
    const due = parseNiceDate(o.dueDate);
    const left = diffDays(today, d);
    const noWindow = diffDays(due, d) <= 0;
    if (o.status === "Error") return <span className="text-text-muted">No retry — re-set with Amend</span>;
    if (o.status === "Rejected" || o.paymentStatus === "RPND") {
      return (
        <div>
          <div className={clsx("font-medium", left < 0 ? "text-status-expired" : "text-text-primary")}>{formatDateNice(d)}</div>
          <div className={clsx("text-[11px]", left < 0 ? "text-status-expired" : left <= 1 ? "text-status-pending" : "text-text-muted")}>
            {left < 0 ? "Window closed" : left === 0 ? "Last day to retry" : `${left} day${left === 1 ? "" : "s"} left`}
          </div>
        </div>
      );
    }
    // Scheduled / Submitted: show the deadline it WILL have if it's rejected (S7 §2.3 returns it).
    return (
      <div className="text-text-muted">
        {formatDateNice(d)}
        {noWindow && (
          <div className="flex items-center gap-1 text-[11px] text-status-pending" title="The retry deadline falls on or before this collection's own due date — if it's rejected there is no time to retry.">
            <AlertTriangle size={11} /> No retry window
          </div>
        )}
      </div>
    );
  }

  function actionsCell(o: DirectDebitOccurrence) {
    if (o.paymentStatus === "RPND") {
      if (!onSimulate || !devHints) return <span className="text-[11px] text-text-muted">Retry in progress</span>;
      return (
        <div className="flex flex-col gap-1 text-[11px]">
          <span className="text-text-muted">Retry in progress</span>
          <span className="text-fuchsia-700">
            Simulate DDS:{" "}
            <button className="underline" onClick={() => onSimulate(o.seq, "ACCP")}>
              ACCP
            </button>{" "}
            ·{" "}
            <button className="underline" onClick={() => onSimulate(o.seq, "RJCT")}>
              RJCT
            </button>
          </span>
        </div>
      );
    }
    const memo = hasBounceMemo(o) ? (
      <a
        href={`data:text/plain;charset=utf-8,${encodeURIComponent(`BOUNCE MEMO (prototype)\nContract: ${contract.merchantRef}\nCollection #${o.seq} due ${o.dueDate}\nReason: ${o.reasonCode ?? "—"} ${reasonLabel(o.reasonCode)}`)}`}
        download={`${contract.merchantRef}-${o.seq}-bounce-memo.txt`}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-blue hover:underline"
        data-testid={`bounce-memo-${o.seq}`}
      >
        <FileDown size={12} /> Bounce memo
      </a>
    ) : null;
    if (o.status === "Error") {
      if (!onAmend) return <span className="text-[11px] text-text-muted">Re-set from Contract Detail</span>;
      return (
        <button
          onClick={onAmend}
          disabled={!can("amend")}
          title={can("amend") ? "Give this collection a new date (and amount) — it is sent again with a new payment reference" : "Your role doesn't include the Amend Collection permission."}
          className="rounded-md border border-brand-blue px-2.5 py-1 text-xs font-medium text-brand-blue hover:bg-brand-blue/5 disabled:cursor-not-allowed disabled:border-border-color disabled:text-text-muted"
          data-testid={`reset-${o.seq}`}
        >
          Re-set (Amend)
        </button>
      );
    }
    if (o.status !== "Rejected") return memo;
    const e = retryEligibility(contract, subscriptionStatus, occurrences, o, can("retry"), today);
    const count = o.retryCount ?? 0;
    return (
      <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-1">
        <button
          onClick={() => e.allowed && onRetry(o.seq)}
          disabled={!e.allowed}
          title={e.reason ? `${e.reason}: ${RETRY_BLOCKED_TEXT[e.reason]}` : `Send retry ${count + 1} of ${RETRY_CAP} to DDS`}
          className={clsx(
            "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
            e.allowed
              ? "border-brand-blue text-brand-blue hover:bg-brand-blue/5"
              : "cursor-not-allowed border-border-color text-text-muted"
          )}
          data-testid={`retry-${o.seq}`}
        >
          <RotateCw size={12} />
          Retry ({count} of {RETRY_CAP})
        </button>
        <FieldHint k="act.retry" value={e.allowed ? "allowed" : e.reason} />
      </div>
      {memo}
      </div>
    );
  }

  const th = "px-3.5 py-2 font-medium";

  return (
    <div className="overflow-x-auto rounded-lg border border-border-color">
      <table className="w-full text-sm">
        <thead>
          <tr className={clsx("border-b border-border-color text-left text-text-secondary", headerBg)}>
            <H label="#" k="col.seq" />
            <H label="Due Date" k="col.dueDate" />
            <H label="Amount" k="col.amount" />
            <H label="Status" k="col.status" />
            <H label="Rolled Over" k="col.rolledOver" />
            <H label="Retry Deadline" k="col.retryDeadline" />
            <H label="Payout Status" k="col.payoutStatus" />
            <H label="Collected On" k="col.collectedOn" />
            <th className={th}>Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {occurrences.map((o) => (
            <tr key={o.seq} className="border-t border-border-color align-top" data-testid={`occ-row-${o.seq}`}>
              <td className="px-3.5 py-2 text-text-muted">{o.seq}</td>
              <td className="px-3.5 py-2 text-text-primary">{o.dueDate}</td>
              <td className="px-3.5 py-2 font-semibold text-text-primary">
                {formatMoneyAED(o.amount)}
                {o.rolledOverFrom && o.rolledOverFrom.length > 0 && (
                  <div className="text-[11px] font-normal text-text-muted">
                    incl. rollover from {o.rolledOverFrom.map((s) => `#${s}`).join(", ")}
                  </div>
                )}
                {o.amountSource === "merchant_edited" && (
                  <div className="text-[11px] font-normal text-text-muted">
                    amended{o.originalAmount != null && o.originalAmount !== o.amount ? ` · was ${formatMoneyAED(o.originalAmount)}` : ""}
                  </div>
                )}
              </td>
              <td className="px-3.5 py-2">{statusCell(o)}</td>
              <td className="px-3.5 py-2 text-text-muted">{rolledOverText(contract, o, occurrences)}</td>
              <td className="px-3.5 py-2 text-[13px]">{deadlineCell(o)}</td>
              <td className="px-3.5 py-2 text-text-muted">{o.payoutStatus || "—"}</td>
              <td className="px-3.5 py-2 text-text-muted">{o.collectedOn || "—"}</td>
              <td className="px-3.5 py-2">{actionsCell(o)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
