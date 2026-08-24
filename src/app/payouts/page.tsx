"use client";

import { useState } from "react";
import { ChevronDown, Store } from "lucide-react";
import DateField from "@/components/ui/DateField";
import SearchBar from "@/components/ui/SearchBar";
import FiltersButton from "@/components/ui/FiltersButton";
import ExportButton from "@/components/ui/ExportButton";
import { payouts } from "@/lib/mock-data";
import { formatMoney, formatDateTime } from "@/lib/format";
import clsx from "clsx";

export default function PayoutsPage() {
  const [range, setRange] = useState("23 Aug 2026");
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Payouts</h1>
        <button className="flex items-center gap-2 rounded-lg border border-border-color bg-brand-orange-light px-4 py-2 text-sm font-medium text-text-primary">
          <Store size={16} />
          All stores
          <ChevronDown size={14} />
        </button>
      </div>

      <div className="mb-5 flex items-center justify-between">
        <DateField value={range} onChange={setRange} />
        <div className="flex items-center gap-3">
          <SearchBar scopes={["Payout ID", "Store"]} />
          <FiltersButton />
          <ExportButton />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border-color bg-card-bg">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border-color text-left text-text-secondary">
              <th className="w-10 px-4 py-3" />
              <th className="px-4 py-3 font-medium">Payout ID</th>
              <th className="px-4 py-3 font-medium">Date and time</th>
              <th className="px-4 py-3 font-medium">Store</th>
              <th className="px-4 py-3 font-medium">IBAN</th>
              <th className="px-4 py-3 font-medium">Number of transactions</th>
              <th className="px-4 py-3 font-medium">Net payout</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => {
              const { date, time } = formatDateTime(p.date);
              const isOpen = expanded === p.id;
              return (
                <>
                  <tr
                    key={p.id}
                    className="border-b border-border-color last:border-0 hover:bg-page-bg/60"
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpanded(isOpen ? null : p.id)}
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
                    <td className="px-4 py-3 font-medium text-brand-blue">
                      #{p.id === "p1" ? "4534980" : p.id === "p2" ? "4521003" : "4519844"}
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {date}
                      <div className="text-xs text-text-muted">{time}</div>
                    </td>
                    <td className="px-4 py-3 text-text-primary">{p.store}</td>
                    <td className="px-4 py-3 text-text-primary">{p.iban}</td>
                    <td className="px-4 py-3 text-text-primary">
                      {p.numTransactions}
                    </td>
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {formatMoney(p.netPayout, p.currency)}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-border-color bg-page-bg/40">
                      <td colSpan={7} className="px-8 py-5">
                        <div className="grid grid-cols-2 gap-x-16 gap-y-3 text-sm">
                          <Row
                            label="Gross amount"
                            value={formatMoney(p.grossAmount, p.currency)}
                          />
                          <Row
                            label="Fees deducted"
                            value={formatMoney(p.feesDeducted, p.currency)}
                          />
                          <Row
                            label="Net amount"
                            value={formatMoney(p.netPayout, p.currency)}
                          />
                          <Row
                            label="Refund and chargeback"
                            value={formatMoney(p.refundAndChargeback, p.currency)}
                          />
                          <Row label="Store" value={p.store} />
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-border-color px-4 py-3 text-sm text-text-secondary">
          Show {payouts.length} of {payouts.length} payouts
        </div>
      </div>
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
