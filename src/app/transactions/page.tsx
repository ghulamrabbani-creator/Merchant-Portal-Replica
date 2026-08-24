"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, MoreVertical, Store } from "lucide-react";
import DateField from "@/components/ui/DateField";
import SearchBar from "@/components/ui/SearchBar";
import FiltersButton from "@/components/ui/FiltersButton";
import ExportButton from "@/components/ui/ExportButton";
import SchemeBadge from "@/components/ui/SchemeBadge";
import RefundModal from "@/components/ui/RefundModal";
import { transactions } from "@/lib/mock-data";
import { formatMoney, formatDateTime } from "@/lib/format";
import clsx from "clsx";

export default function TransactionsPage() {
  const [range, setRange] = useState("25 Jul 2026 - 23 Aug 2026");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [refundTxnId, setRefundTxnId] = useState<string | null>(null);
  const refundTxn = transactions.find((t) => t.id === refundTxnId) ?? null;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Transactions</h1>
        <button className="flex items-center gap-2 rounded-lg border border-border-color bg-brand-orange-light px-4 py-2 text-sm font-medium text-text-primary">
          <Store size={16} />
          All stores
          <ChevronDown size={14} />
        </button>
      </div>

      <div className="mb-5 flex items-center justify-between">
        <DateField value={range} onChange={setRange} />
        <div className="flex items-center gap-3">
          <SearchBar
            scopes={[
              "Reference ID",
              "Terminal ID",
              "Payout ID",
              "Order ID",
              "Pay By Link Number",
            ]}
          />
          <FiltersButton />
          <ExportButton />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border-color bg-card-bg">
        <table className="w-full min-w-[1200px] text-sm">
          <thead>
            <tr className="border-b border-border-color text-left text-text-secondary">
              <th className="w-10 px-4 py-3" />
              <th className="px-4 py-3 font-medium">Reference / Order ID</th>
              <th className="px-4 py-3 font-medium">Date and time</th>
              <th className="px-4 py-3 font-medium">Store</th>
              <th className="px-4 py-3 font-medium">Terminal ID</th>
              <th className="px-4 py-3 font-medium">Scheme</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Tags</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Card Class</th>
              <th className="px-4 py-3 font-medium">Card Segment</th>
              <th className="px-4 py-3 font-medium">Card Origin</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const { date, time } = formatDateTime(t.date);
              const isOpen = expanded === t.id;
              return (
                <>
                  <tr
                    key={t.id}
                    className="border-b border-border-color last:border-0 hover:bg-page-bg/60"
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpanded(isOpen ? null : t.id)}
                        className="text-text-muted"
                      >
                        <ChevronDown
                          size={16}
                          className={clsx(
                            "transition-transform",
                            isOpen && "rotate-180"
                          )}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/transactions/${t.id}`}
                        className="font-medium text-brand-blue hover:underline"
                      >
                        #{t.reference.slice(0, 6)}...{t.reference.slice(-6)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {date}
                      <div className="text-xs text-text-muted">{time}</div>
                    </td>
                    <td className="px-4 py-3 text-text-primary">{t.store}</td>
                    <td className="px-4 py-3">
                      <div className="text-brand-blue">{t.paymentMethod}</div>
                      <div className="text-text-primary">{t.terminalId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <SchemeBadge scheme={t.scheme} />
                    </td>
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {formatMoney(t.amount, t.currency)}
                    </td>
                    <td className="px-4 py-3">
                      {t.tags?.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-page-bg px-2 py-1 text-xs font-medium text-text-secondary"
                        >
                          {tag}
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-text-primary">{t.type}</td>
                    <td className="px-4 py-3 text-text-primary">
                      {t.cardClass}
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {t.cardSegment}
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {t.cardOrigin}
                    </td>
                    <td className="relative px-4 py-3">
                      <button
                        onClick={() =>
                          setMenuFor(menuFor === t.id ? null : t.id)
                        }
                        className="text-text-muted"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {menuFor === t.id && (
                        <div className="absolute right-4 top-10 z-10 w-32 rounded-xl border border-border-color bg-white p-1 shadow-lg">
                          <button
                            onClick={() => {
                              setRefundTxnId(t.id);
                              setMenuFor(null);
                            }}
                            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-text-primary hover:bg-page-bg"
                          >
                            Refund
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-border-color bg-page-bg/40">
                      <td colSpan={13} className="px-8 py-5">
                        <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm md:grid-cols-2">
                          <Row label="Status" value={t.status} />
                          <Row label="Net amount" value={formatMoney(t.netAmount, t.currency)} />
                          <Row label="Payout ID" value="4534980" />
                          <Row label="Exchange rate" value={t.exchangeRate?.toString() ?? "-"} />
                          <Row label="Store" value={t.store} />
                          <Row label="Original amount" value={formatMoney(t.amount, t.currency)} />
                          <Row label="Commission" value={formatMoney(t.commission, t.currency)} />
                          <Row label="VAT amount" value={formatMoney(t.vat, t.currency)} />
                          <Row label="Order ID" value={t.reference} />
                          <Row label="Card Class" value={t.cardClass} />
                          <Row label="Card Segment" value={t.cardSegment} />
                          <Row label="Card Origin" value={t.cardOrigin} />
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {refundTxn && (
        <RefundModal
          open={!!refundTxn}
          onClose={() => setRefundTxnId(null)}
          amount={refundTxn.amount}
          currency={refundTxn.currency}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}
