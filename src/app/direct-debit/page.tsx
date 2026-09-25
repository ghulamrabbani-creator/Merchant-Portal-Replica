"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, UploadCloud, Landmark, CreditCard, HelpCircle, MoreVertical } from "lucide-react";
import clsx from "clsx";
import PageHeader from "@/components/ui/PageHeader";
import SearchBar from "@/components/ui/SearchBar";
import ExportButton from "@/components/ui/ExportButton";
import StatCard from "@/components/ui/StatCard";
import StatusDot from "@/components/ui/StatusDot";
import Modal from "@/components/ui/Modal";
import DirectDebitFiltersButton from "@/components/directdebit/DirectDebitFiltersButton";
import CreateDirectDebitContractModal from "@/components/directdebit/CreateDirectDebitContractModal";
import CollectionTable from "@/components/directdebit/CollectionTable";
import FieldHint from "@/components/directdebit/FieldHint";
import { useDDConfig } from "@/lib/dd-config-context";
import { useAllContracts, useHydrated } from "@/lib/dd-contract-store";
import { HintKey } from "@/lib/dd-field-map";
import { applyRetryResult, applyRetrySubmitted, contractStatusLabel, formatMoneyAED } from "@/lib/direct-debit";
import { DirectDebitContract, DirectDebitOccurrence } from "@/lib/types";

function collectionSummary(occurrences: DirectDebitOccurrence[]) {
  const successful = occurrences.filter((o) => o.status === "Paid");
  // Rejected (still retryable) and Failed (final) both count as unsuccessful collections here.
  const failed = occurrences.filter((o) => o.status === "Failed" || o.status === "Rejected");
  return {
    successCount: successful.length,
    successAmount: successful.reduce((sum, o) => sum + o.amount, 0),
    failCount: failed.length,
    failAmount: failed.reduce((sum, o) => sum + o.amount, 0),
  };
}

function Th({ children, k, className }: { children?: React.ReactNode; k?: HintKey; className?: string }) {
  return (
    <th className={clsx("px-4 py-3 font-medium", className)}>
      <span className="inline-flex items-center gap-1">
        {children}
        {k && <FieldHint k={k} />}
      </span>
    </th>
  );
}

export default function DirectDebitPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const { config } = useDDConfig();
  // Demo contracts plus any created in this browser (dd-contract-store, added 25-Sep-2026).
  const contracts = useAllContracts();
  // Some demo contracts use dates relative to today (retry-deadline demos) and this route is
  // statically prerendered at build time — so rows render only once hydrated, to keep build-time
  // dates out of the HTML.
  const hydrated = useHydrated();

  // Local, in-memory copy of each contract's occurrences, keyed by contract id, so Retry on the
  // List screen's expand-row can update the view without mutating the shared mock-data module —
  // same pattern as the Contract Detail screen. Manual rollover (and its handlers) was removed
  // 25-Sep-2026 — out of MVP scope per Backend Stories S7.
  const [occurrencesByContract, setOccurrencesByContract] = useState<Record<string, DirectDebitOccurrence[]>>({});

  function occurrencesOf(c: DirectDebitContract) {
    return occurrencesByContract[c.id] ?? c.occurrences;
  }

  function handleRetry(c: DirectDebitContract, seq: number) {
    setOccurrencesByContract((prev) => ({ ...prev, [c.id]: applyRetrySubmitted(prev[c.id] ?? c.occurrences, seq) }));
  }

  function handleSimulate(c: DirectDebitContract, seq: number, result: "ACCP" | "RJCT") {
    setOccurrencesByContract((prev) => ({
      ...prev,
      [c.id]: applyRetryResult(c, prev[c.id] ?? c.occurrences, seq, result),
    }));
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
            onClick={() => config.actions.allowCreateContract && setCreateOpen(true)}
            disabled={!config.actions.allowCreateContract}
            title={
              config.actions.allowCreateContract
                ? undefined
                : "Contract creation is switched off for this merchant (allow_create_contract = false)."
            }
            className="flex items-center gap-2 rounded-lg bg-brand-blue px-[18px] py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="add-contract"
          >
            <Plus size={16} />
            Add Contract
          </button>
          <FieldHint k="cfg.action.create" value={String(config.actions.allowCreateContract)} />
          {config.enableBulkUpload && config.actions.allowBulkUpload && (
            <button
              onClick={() => setBulkUploadOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-brand-blue px-[18px] py-2.5 text-sm font-semibold text-brand-blue hover:bg-brand-blue/5"
            >
              <UploadCloud size={16} />
              Bulk Upload
            </button>
          )}
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
              <Th k="view.merchantRef">Merchant Reference</Th>
              <Th k="view.customerName">Customer Name</Th>
              <Th k="view.instrument" className="px-3">Instrument</Th>
              <Th k="view.validity">Validity</Th>
              <Th k="view.frequency">Frequency</Th>
              <Th>Previous Deduction</Th>
              <Th>Next Due</Th>
              <Th>Successful Collections</Th>
              <Th>Failed Collections</Th>
              <Th k="view.status">Status</Th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {!hydrated && (
              <tr>
                <td colSpan={12} className="px-4 py-6 text-center text-sm text-text-muted">
                  Loading contracts…
                </td>
              </tr>
            )}
            {hydrated && contracts.map((c) => {
              const isOpen = expanded === c.id;
              const occurrences = occurrencesOf(c);
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
                        {c.merchantRef}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-primary">{c.customerName}</td>
                    <td className="px-3 py-3 text-text-secondary">
                      {c.instrumentType === "Bank Account" ? (
                        <Landmark size={17} strokeWidth={1.7} />
                      ) : c.instrumentType === "Credit Card" ? (
                        <CreditCard size={17} strokeWidth={1.7} />
                      ) : (
                        // TBFC, customer hasn't chosen an instrument yet — see types.ts
                        <HelpCircle size={17} strokeWidth={1.7} className="text-text-muted/60" />
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
                      <StatusDot status={contractStatusLabel(c)} />
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
                            <CollectionTable
                              contract={c}
                              occurrences={occurrences}
                              subscriptionStatus={c.subscriptionStatus}
                              onRetry={(seq) => handleRetry(c, seq)}
                              onSimulate={(seq, r) => handleSimulate(c, seq, r)}
                              headerBg="bg-card-bg"
                            />
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
          Show {contracts.length} of 142 contracts
        </div>
      </div>

      {/* Mounted only while open (25-Sep-2026) so its date defaults and the lead-time rule are
          seeded from the hydrated, persisted DD config — same fix as the config modals. */}
      {createOpen && <CreateDirectDebitContractModal open={createOpen} onClose={() => setCreateOpen(false)} />}

      <Modal open={bulkUploadOpen} onClose={() => setBulkUploadOpen(false)}>
        <div className="p-8">
          <h2 className="mb-2 text-xl font-bold text-text-primary">Bulk Contract Upload — not yet available</h2>
          <p className="mb-6 text-sm text-text-secondary">
            Bulk Contract Creation is still being designed — this button is wired up per the
            Enable Bulk Contract Upload toggle in PGW Config in MA, but the upload flow itself
            (file format, maker/checker review, TBFC interaction) isn&apos;t built yet. Placeholder
            for that flow, same pattern as Cancel mandate on Contract Detail.
          </p>
          <div className="flex justify-end">
            <button
              onClick={() => setBulkUploadOpen(false)}
              className="rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
