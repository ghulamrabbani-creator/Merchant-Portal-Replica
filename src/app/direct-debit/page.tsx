"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, UploadCloud, Landmark, CreditCard, HelpCircle, MoreVertical, Store } from "lucide-react";
import clsx from "clsx";
import PageHeader from "@/components/ui/PageHeader";
import SearchBar from "@/components/ui/SearchBar";
import ExportButton from "@/components/ui/ExportButton";
import StatCard from "@/components/ui/StatCard";
import StatusDot from "@/components/ui/StatusDot";
import Modal from "@/components/ui/Modal";
import DirectDebitFiltersButton, { DDListFilters, EMPTY_FILTERS } from "@/components/directdebit/DirectDebitFiltersButton";
import CreateDirectDebitContractModal from "@/components/directdebit/CreateDirectDebitContractModal";
import CollectionTable from "@/components/directdebit/CollectionTable";
import FieldHint from "@/components/directdebit/FieldHint";
import { useDDConfig } from "@/lib/dd-config-context";
import { useAllContracts, useHydrated } from "@/lib/dd-contract-store";
import { HintKey } from "@/lib/dd-field-map";
import { applyRetryResult, applyRetrySubmitted, contractStatusLabel, formatMoneyAED, isCancellationPending, statusFilterKey } from "@/lib/direct-debit";
import { DD_STORES } from "@/lib/mock-data";
import { discardBlockedReason, discardContract, resendBlockedReason, resendSigningLink, useContractsVersion } from "@/lib/dd-actions";
import { DirectDebitContract, DirectDebitOccurrence } from "@/lib/types";

function collectionSummary(occurrences: DirectDebitOccurrence[]) {
  const successful = occurrences.filter((o) => o.status === "Paid");
  // US-04 (14-Oct-2026): only Failed (final) collections count here. Rejected/Error can still be
  // retried and are shown on the collection rows, not as failed.
  const failed = occurrences.filter((o) => o.status === "Failed");
  return {
    successCount: successful.length,
    successAmount: successful.reduce((sum, o) => sum + o.amount, 0),
    failCount: failed.length,
    failAmount: failed.reduce((sum, o) => sum + o.amount, 0),
  };
}

const sumAmt = (xs: { amount: number }[]) => xs.reduce((t, o) => t + o.amount, 0);

/** US-03 (14-Oct-2026): every card is computed from all contracts in the selected stores. Total Collections = Paid only (TB-1); Failed = Failed only; Declined =
 *  DD Rejected + DD Error (no DD Denied — banks do not support DENY, DDS 15-Oct-2026). */
function computeKpis(list: DirectDebitContract[]) {
  const active = list.filter((c) => c.status === "Active");
  const pendingSign = list.filter((c) => c.status === "Awaiting Customer Details" || c.status === "Pending Customer Sign");
  const pendingBank = list.filter((c) => c.status === "Pending System Submission" || c.status === "Pending Bank Approval");
  const paid = list.flatMap((c) => c.occurrences.filter((o) => o.status === "Paid"));
  const failedByContract = list.map((c) => c.occurrences.filter((o) => o.status === "Failed")).filter((x) => x.length > 0);
  const failed = failedByContract.flat();
  const declined = list.filter((c) => c.status === "Rejected" || c.status === "Error");
  return {
    active: { n: active.length, value: sumAmt(active.map((c) => ({ amount: c.maxAmount }))), cancelling: active.filter((c) => isCancellationPending(c)).length },
    pendingSign: { n: pendingSign.length, awaiting: pendingSign.filter((c) => c.status === "Awaiting Customer Details").length },
    pendingBank: { n: pendingBank.length },
    paid: { n: paid.length, amount: sumAmt(paid) },
    failed: { n: failed.length, amount: sumAmt(failed), contracts: failedByContract.length },
    declined: { n: declined.length },
  };
}

function matchesSearch(c: DirectDebitContract, scope: string, text: string): boolean {
  const q = text.trim().toLowerCase();
  if (!q) return true;
  if (scope === "Customer Name") return c.customerName.toLowerCase().includes(q);
  if (scope === "Emirates ID") return c.customerIdNumber.replace(/-/g, "").includes(q.replace(/-/g, ""));
  if (scope === "Mobile") return (c.customerMobile ?? "").includes(q);
  return c.merchantRef.toLowerCase().includes(q);
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
  const { can } = useDDConfig();
  useContractsVersion(); // re-render after Discard / Resend
  const [search, setSearch] = useState<{ scope: string; text: string }>({ scope: "Merchant Ref", text: "" });
  const [filters, setFilters] = useState<DDListFilters>(EMPTY_FILTERS);
  const [stores, setStores] = useState<string[]>(DD_STORES.map((s) => s.id));
  const [storeOpen, setStoreOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [discardFor, setDiscardFor] = useState<DirectDebitContract | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const inView = useMemo(
    () =>
      contracts.filter(
        (c) =>
          (!c.storeId || stores.includes(c.storeId)) &&
          (filters.statuses.length === 0 || filters.statuses.includes(c.status) || filters.statuses.includes(statusFilterKey(c))) &&
          (filters.frequencies.length === 0 || filters.frequencies.includes(c.frequency)) &&
          (filters.instruments.length === 0 || (c.instrumentType && filters.instruments.includes(c.instrumentType)))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contracts, contracts.length, stores, filters, hydrated]
  );
  const searching = search.text.trim().length > 0;
  const rows = inView.filter((c) => matchesSearch(c, search.scope, search.text));
  // v2.6 / Backlog v2.1 decision 9: the cards always cover every contract in the selected stores —
  // not the filters, search or any date range.
  const kpi = computeKpis(contracts.filter((c) => !c.storeId || stores.includes(c.storeId)));
  const multiStore = stores.length > 1;

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
      <PageHeader
        title="Direct Debit Contracts"
        storeSelector={
          <div className="relative">
            <button
              onClick={() => setStoreOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg border border-border-color bg-brand-orange-light px-4 py-2 text-sm font-medium text-text-primary"
              data-testid="store-selector"
            >
              <Store size={15} />
              {stores.length === DD_STORES.length ? "All stores" : `${stores.length} store${stores.length === 1 ? "" : "s"}`}
              <ChevronDown size={14} />
            </button>
            {storeOpen && (
              <div className="absolute right-0 z-20 mt-1 w-72 rounded-xl border border-border-color bg-white p-2 shadow-lg">
                {DD_STORES.map((st) => (
                  <label key={st.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-page-bg">
                    <input
                      type="checkbox"
                      checked={stores.includes(st.id)}
                      onChange={() =>
                        setStores((cur) => (cur.includes(st.id) ? (cur.length > 1 ? cur.filter((x) => x !== st.id) : cur) : [...cur, st.id]))
                      }
                    />
                    <span className="text-text-primary">{st.name}</span>
                    <span className="ml-auto text-xs text-text-muted">{st.id}</span>
                  </label>
                ))}
                <div className="px-2 pt-1 text-xs text-text-muted">Only DD-enabled stores are listed. At least one must stay selected.</div>
              </div>
            )}
          </div>
        }
      />

      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <SearchBar
            scopes={["Merchant Ref", "Customer Name", "Emirates ID", "Mobile"]}
            placeholder="Search contracts"
            onChange={(scope, text) => setSearch({ scope, text })}
          />
        </div>
        <div className="flex items-center gap-3">
          <DirectDebitFiltersButton value={filters} onApply={setFilters} />
          {can("export") && <ExportButton />}
          <button
            onClick={() => can("create") && setCreateOpen(true)}
            disabled={!can("create")}
            title={can("create") ? undefined : "Your role doesn't include the Create Contract permission."}
            className="flex items-center gap-2 rounded-lg bg-brand-blue px-[18px] py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="add-contract"
          >
            <Plus size={16} />
            Add Contract
          </button>
          {config.enableBulkUpload && (can("bulkMaker") || can("bulkChecker")) && (
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

      {toast && (
        <div className="mb-4 flex items-start justify-between gap-4 rounded-lg border border-status-approved/40 bg-status-approved/5 px-4 py-3 text-sm text-text-primary">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-text-muted">Dismiss</button>
        </div>
      )}

      {/* US-03: hidden while a search is active; computed from every contract in the selected stores (not filters). Dev hints show each card's criteria. */}
      {hydrated && !searching && (
        <div className="mb-5 flex gap-3" data-testid="dd-kpis">
          <StatCard label="DD Active" hint={<FieldHint k="kpi.active" />} value={String(kpi.active.n)} sub={`Max contract value: ${formatMoneyAED(kpi.active.value)}${kpi.active.cancelling ? ` · incl. ${kpi.active.cancelling} cancellation pending` : ""}`} />
          <StatCard label="Pending Customer Sign" hint={<FieldHint k="kpi.pendingSign" />} value={String(kpi.pendingSign.n)} sub={`${kpi.pendingSign.awaiting} awaiting customer details`} />
          <StatCard label="Pending Bank Approval" hint={<FieldHint k="kpi.pendingBank" />} value={String(kpi.pendingBank.n)} sub="Submitted or approved by the paying bank" />
          <StatCard label="Total Collections" hint={<FieldHint k="kpi.totalCollections" />} value={String(kpi.paid.n)} sub={`${formatMoneyAED(kpi.paid.amount)} collected (Paid only)`} />
          <StatCard label="Failed Collections" hint={<FieldHint k="kpi.failedCollections" />} value={formatMoneyAED(kpi.failed.amount)} sub={`${kpi.failed.n} collections · ${kpi.failed.contracts} contracts`} />
          <StatCard label="Declined Contracts" hint={<FieldHint k="kpi.declined" />} value={String(kpi.declined.n)} sub="DD Rejected or DD Error" />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border-color bg-card-bg">
        <table className="w-full min-w-[1200px] text-sm">
          <thead>
            <tr className="border-b border-border-color text-left text-text-secondary">
              <th className="w-10 px-4 py-3" />
              <Th k="view.merchantRef">Merchant Reference</Th>
              <Th k="view.customerName">Customer Name</Th>
              {multiStore && <Th>Store</Th>}
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
                <td colSpan={multiStore ? 13 : 12} className="px-4 py-6 text-center text-sm text-text-muted">
                  Loading contracts…
                </td>
              </tr>
            )}
            {hydrated && rows.length === 0 && (
              <tr>
                <td colSpan={multiStore ? 13 : 12} className="px-4 py-6 text-center text-sm text-text-muted">
                  No contracts match{searching ? " this search" : " the selected stores and filters"}.
                </td>
              </tr>
            )}
            {hydrated && rows.map((c) => {
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
                    {multiStore && <td className="px-4 py-3 text-xs text-text-secondary">{c.storeName ?? "—"}</td>}
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
                    <td className="relative px-4 py-3 text-text-muted">
                      <button onClick={() => setMenuFor(menuFor === c.id ? null : c.id)} data-testid={`row-menu-${c.id}`} aria-label="Contract actions">
                        <MoreVertical size={16} />
                      </button>
                      {menuFor === c.id && (() => {
                        const resendWhy = resendBlockedReason(c, can("manageUnsigned"));
                        const discardWhy = discardBlockedReason(c, can("manageUnsigned"));
                        const item = "block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-page-bg disabled:cursor-not-allowed disabled:text-text-muted disabled:hover:bg-transparent";
                        return (
                          <div className="absolute right-4 z-20 mt-1 w-56 rounded-xl border border-border-color bg-white p-1 shadow-lg">
                            <Link href={`/direct-debit/${c.id}`} className={clsx(item, "text-text-primary")}>View details</Link>
                            <button
                              className={clsx(item, "text-text-primary")}
                              disabled={!!resendWhy}
                              title={resendWhy ?? undefined}
                              onClick={() => {
                                setMenuFor(null);
                                setToast(resendSigningLink(c.id, config.contractReviewExpiryDays));
                              }}
                            >
                              Resend signing link
                            </button>
                            <button
                              className={clsx(item, "text-status-declined")}
                              disabled={!!discardWhy}
                              title={discardWhy ?? undefined}
                              onClick={() => {
                                setMenuFor(null);
                                setDiscardFor(c);
                              }}
                            >
                              Discard contract
                            </button>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-border-color bg-page-bg/40">
                      <td colSpan={multiStore ? 13 : 12} className="px-4 py-4 pl-14">
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
          Showing {rows.length} of {inView.length} contracts{multiStore ? ` across ${stores.length} stores` : ""}
        </div>
      </div>

      {/* Mounted only while open (25-Sep-2026) so its date defaults and the lead-time rule are
          seeded from the hydrated, persisted DD config — same fix as the config modals. */}
      {createOpen && <CreateDirectDebitContractModal open={createOpen} onClose={() => setCreateOpen(false)} />}

      <Modal open={!!discardFor} onClose={() => setDiscardFor(null)}>
        {discardFor && (
          <div className="p-8">
            <h2 className="mb-2 text-xl font-bold text-text-primary">Discard contract {discardFor.merchantRef}?</h2>
            <p className="mb-6 text-sm text-text-secondary">
              The customer hasn&apos;t signed yet. Discarding stops the contract for good: the review link will show
              &ldquo;no longer available&rdquo;, no collection will be made, and the merchant reference can&apos;t be reused.
              {(discardFor.status === "Pending Customer Sign" || discardFor.status === "Request Expired") &&
                " Geidea will also discard the mandate at DDS."}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDiscardFor(null)} className="rounded-lg border border-border-color px-5 py-2.5 text-sm font-medium">Keep contract</button>
              <button
                onClick={() => {
                  setToast(discardContract(discardFor.id));
                  setDiscardFor(null);
                }}
                className="rounded-lg bg-status-declined px-5 py-2.5 text-sm font-semibold text-white"
                data-testid="discard-confirm"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={bulkUploadOpen} onClose={() => setBulkUploadOpen(false)}>
        <div className="p-8">
          <h2 className="mb-2 text-xl font-bold text-text-primary">Bulk Contract Upload — not yet available</h2>
          <p className="mb-6 text-sm text-text-secondary">
            Bulk Contract Creation is still being designed — this button is wired up per the
            Enable Bulk Contract Upload toggle in PGW Config in MA, but the upload flow itself
            (file format, maker/checker review, TBFC interaction) isn&apos;t built yet. Placeholder
            for that flow (US-37, TBFC bulk, is Phase 1 in backlog v2).
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
