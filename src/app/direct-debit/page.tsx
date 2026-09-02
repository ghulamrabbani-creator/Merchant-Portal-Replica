"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, Landmark, CreditCard, MoreVertical } from "lucide-react";
import clsx from "clsx";
import PageHeader from "@/components/ui/PageHeader";
import SearchBar from "@/components/ui/SearchBar";
import ExportButton from "@/components/ui/ExportButton";
import StatCard from "@/components/ui/StatCard";
import StatusDot from "@/components/ui/StatusDot";
import DirectDebitFiltersButton from "@/components/directdebit/DirectDebitFiltersButton";
import CreateDirectDebitContractModal from "@/components/directdebit/CreateDirectDebitContractModal";
import { directDebitContracts } from "@/lib/mock-data";
import { formatMoneyAED } from "@/lib/direct-debit";
import { DirectDebitContract } from "@/lib/types";

function collectionSummary(c: DirectDebitContract) {
  const successful = c.occurrences.filter((o) => o.status === "Paid");
  const failed = c.occurrences.filter((o) => o.status === "Failed");
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
              <th className="px-4 py-3 font-medium">Customer</th>
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
              const summary = collectionSummary(c);
              return (
                <>
                  <tr
                    key={c.id}
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
                        {c.occurrences.length > 0 ? (
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
                                  </tr>
                                </thead>
                                <tbody className="bg-white">
                                  {c.occurrences.map((o) => (
                                    <tr key={o.seq} className="border-t border-border-color align-top">
                                      <td className="px-3.5 py-2 text-text-muted">{o.seq}</td>
                                      <td className="px-3.5 py-2 text-text-primary">{o.dueDate}</td>
                                      <td className="px-3.5 py-2 font-semibold text-text-primary">
                                        {formatMoneyAED(o.amount)}
                                      </td>
                                      <td className="px-3.5 py-2">
                                        <StatusDot status={o.status} />
                                        {o.note && (
                                          <div className="mt-0.5 max-w-[280px] text-[11px] text-text-muted">
                                            {o.note}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-3.5 py-2 text-text-muted">
                                        {o.rolledOver === "rolled_over"
                                          ? "Yes"
                                          : o.rolledOver === "blocked_by_ceiling"
                                            ? "Blocked"
                                            : !c.rolloverEnabled
                                              ? "Not Available"
                                              : "—"}
                                      </td>
                                      <td className="px-3.5 py-2 text-text-muted">
                                        {o.payoutStatus || "—"}
                                      </td>
                                      <td className="px-3.5 py-2 text-text-muted">
                                        {o.collectedOn || "—"}
                                      </td>
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
                </>
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
