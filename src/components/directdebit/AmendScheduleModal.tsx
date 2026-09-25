"use client";

// Amend schedule (added 25-Sep-2026) — Backend Stories S7 §2, modelled on the per-row "Amend
// Payment" action on DDS's own portal. Replaces manual rollover (out of MVP scope) as the
// merchant's way to recover a skipped/failed amount or move a collection.
//
// One subscription-level call — PATCH /direct-debit/v1/subscriptions/{subscriptionId}/collections
// — carrying only the collections being changed. The Backend applies every change to a COPY of
// the schedule and validates the RESULTING schedule (rules A0–A13), so changes that are only valid
// together (move Oct later AND Nov later) pass together. All-or-nothing; every failure comes back
// tagged with its collection. validateAmend() in lib/direct-debit.ts runs the same rules here.

import { useMemo, useState } from "react";
import clsx from "clsx";
import { AlertCircle, Lock } from "lucide-react";
import Modal from "@/components/ui/Modal";
import FieldHint from "@/components/directdebit/FieldHint";
import { useDDConfig } from "@/lib/dd-config-context";
import {
  AmendChange,
  AmendError,
  formatMoneyAED,
  isAmendable,
  isCollectionLocked,
  minGapDays,
  parseNiceDate,
  toDateInputValue,
  validateAmend,
} from "@/lib/direct-debit";
import { DDSubscriptionStatus, DirectDebitContract, DirectDebitOccurrence } from "@/lib/types";

function collectionId(c: DirectDebitContract, seq: number) {
  return `${c.id}-c${String(seq).padStart(2, "0")}`;
}

export default function AmendScheduleModal({
  contract,
  occurrences,
  subscriptionStatus,
  scheduleVersion,
  onClose,
  onSaved,
}: {
  contract: DirectDebitContract;
  occurrences: DirectDebitOccurrence[];
  subscriptionStatus: DDSubscriptionStatus;
  scheduleVersion: number;
  onClose: () => void;
  onSaved: (result: DirectDebitOccurrence[], changedSeqs: number[], reason: string) => void;
}) {
  const { config, devHints } = useDDConfig();
  const fixed = contract.amountType === "Fixed";
  const gap = minGapDays(contract.frequency);

  const [drafts, setDrafts] = useState<Record<number, { date: string; amount: string }>>(() =>
    Object.fromEntries(
      occurrences
        .filter((o) => isAmendable(o))
        .map((o) => [o.seq, { date: toDateInputValue(parseNiceDate(o.dueDate)), amount: String(o.amount) }])
    )
  );
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<AmendError[] | null>(null);

  const changes: AmendChange[] = useMemo(() => {
    const out: AmendChange[] = [];
    for (const o of occurrences) {
      const d = drafts[o.seq];
      if (!d) continue;
      const origDate = toDateInputValue(parseNiceDate(o.dueDate));
      const amt = Number(d.amount);
      const ch: AmendChange = { seq: o.seq };
      if (d.date && d.date !== origDate) ch.newDueDate = d.date;
      if (!fixed && !Number.isNaN(amt) && amt !== o.amount) ch.newAmount = amt;
      if (ch.newDueDate || ch.newAmount != null) out.push(ch);
    }
    return out;
  }, [drafts, occurrences, fixed]);

  const payload = {
    scheduleVersion,
    ...(reason.trim() ? { reason: reason.trim() } : {}),
    changes: changes.map((c) => ({
      collectionId: collectionId(contract, c.seq),
      ...(c.newDueDate ? { newDueDate: c.newDueDate } : {}),
      ...(c.newAmount != null ? { newAmount: c.newAmount } : {}),
    })),
  };

  function save() {
    if (changes.length === 0) {
      setErrors([{ seq: null, code: "NOTHING_TO_CHANGE", message: "Change at least one date or amount first." }]);
      return;
    }
    const { errors: errs, result } = validateAmend(
      contract,
      subscriptionStatus,
      occurrences,
      changes,
      config.actions.allowEditCollection
    );
    setErrors(errs);
    if (errs.length === 0) {
      const changed = new Set(changes.map((c) => c.seq));
      const withMeta = result.map((o) => {
        if (!changed.has(o.seq)) return o;
        const orig = occurrences.find((x) => x.seq === o.seq)!;
        const amountChanged = o.amount !== orig.amount;
        return {
          ...o,
          originalAmount: orig.originalAmount ?? orig.amount,
          amountSource: amountChanged ? ("merchant_edited" as const) : o.amountSource,
          amendReason: reason.trim() || undefined,
        };
      });
      onSaved(withMeta, [...changed], reason.trim());
    }
  }

  const rowErrors = (seq: number) => (errors ?? []).filter((e) => e.seq === seq);
  const requestErrors = (errors ?? []).filter((e) => e.seq === null);

  return (
    <Modal open onClose={onClose} widthClass="max-w-4xl">
      <div className="p-8">
        <h2 className="mb-1 flex items-center gap-1.5 text-xl font-bold text-text-primary">
          Amend schedule <FieldHint k="act.amend" />
        </h2>
        <p className="mb-4 text-[13px] text-text-muted">
          Change the due date{fixed ? "" : " and/or amount"} of any upcoming collection that hasn&apos;t been sent to
          DDS yet. All changes are checked together against the resulting schedule and saved all-or-nothing.
          {fixed && " This is a Fixed-amount contract, so only dates can change."} DDS needs at least{" "}
          <strong>{gap} days</strong> between two debits on a {contract.frequency} mandate — if moving one date
          brings it too close to the next collection, move that one as well in the same save.
        </p>

        <div className="mb-4 max-h-[46vh] overflow-y-auto rounded-lg border border-border-color">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-page-bg">
              <tr className="text-left text-text-secondary">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Current due date</th>
                <th className="px-3 py-2 font-medium">Current amount</th>
                <th className="px-3 py-2 font-medium">New due date</th>
                <th className="px-3 py-2 font-medium">New amount</th>
              </tr>
            </thead>
            <tbody>
              {occurrences.map((o) => {
                const d = drafts[o.seq];
                const errs = rowErrors(o.seq);
                const locked = o.status === "Scheduled" && isCollectionLocked(parseNiceDate(o.dueDate));
                return (
                  <tr
                    key={o.seq}
                    className={clsx("border-t border-border-color align-top", errs.length && "bg-status-expired/5")}
                    data-testid={`amend-row-${o.seq}`}
                  >
                    <td className="px-3 py-2 text-text-muted">{o.seq}</td>
                    <td className="px-3 py-2">{o.dueDate}</td>
                    <td className="px-3 py-2 font-semibold">{formatMoneyAED(o.amount)}</td>
                    {d ? (
                      <>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={d.date}
                            onChange={(e) => setDrafts((p) => ({ ...p, [o.seq]: { ...p[o.seq], date: e.target.value } }))}
                            className="rounded-md border border-border-color px-2 py-1 text-sm outline-none focus:border-brand-blue"
                            data-testid={`amend-date-${o.seq}`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={d.amount}
                            disabled={fixed}
                            onChange={(e) => setDrafts((p) => ({ ...p, [o.seq]: { ...p[o.seq], amount: e.target.value } }))}
                            className="w-[120px] rounded-md border border-border-color px-2 py-1 text-sm outline-none focus:border-brand-blue disabled:bg-page-bg disabled:text-text-muted"
                            data-testid={`amend-amount-${o.seq}`}
                          />
                          {errs.map((e, i) => (
                            <div key={i} className="mt-1 max-w-[340px] text-[11.5px] text-status-expired">
                              <span className="font-mono font-semibold">{e.code}</span> — {e.message}
                            </div>
                          ))}
                        </td>
                      </>
                    ) : (
                      <td colSpan={2} className="px-3 py-2 text-[12px] text-text-muted">
                        {locked ? (
                          <span className="inline-flex items-center gap-1">
                            <Lock size={11} /> Locked — past 18:45 the day before it&apos;s due
                          </span>
                        ) : (
                          `${o.status} — can't be amended`
                        )}
                        {errs.map((e, i) => (
                          <div key={i} className="mt-1 text-[11.5px] text-status-expired">
                            <span className="font-mono font-semibold">{e.code}</span> — {e.message}
                          </div>
                        ))}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <label className="mb-1 block text-[12.5px] font-semibold text-text-primary">Reason (optional)</label>
        <input
          value={reason}
          maxLength={250}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Recover skipped September amount"
          className="mb-3 w-full rounded-lg border border-border-color px-3 py-2 text-sm outline-none focus:border-brand-blue"
        />

        {requestErrors.length > 0 && (
          <div className="mb-3 rounded-lg border border-status-expired/40 bg-status-expired/5 px-3.5 py-2.5">
            {requestErrors.map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-[12.5px] text-status-expired">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>
                  <span className="font-mono font-semibold">{e.code}</span> — {e.message}
                </span>
              </div>
            ))}
          </div>
        )}
        {errors && errors.length > 0 && (
          <div className="mb-3 text-[12px] text-status-expired" data-testid="amend-refused">
            Nothing was saved — {errors.length} rule{errors.length === 1 ? "" : "s"} failed.
          </div>
        )}

        {devHints && (
          <div className="mb-4 rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-slate-200">
            <div className="mb-1 text-slate-400">
              PATCH /direct-debit/v1/subscriptions/sub_{contract.id}/collections
            </div>
            <pre className="whitespace-pre-wrap">{JSON.stringify(payload, null, 2)}</pre>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">
            Schedule version {scheduleVersion} · {changes.length} collection{changes.length === 1 ? "" : "s"} changed
          </span>
          <div className="flex gap-3">
            <button onClick={onClose} className="text-sm font-medium text-text-secondary">
              Cancel
            </button>
            <button
              onClick={save}
              className="rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
              data-testid="amend-save"
            >
              Validate &amp; save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
