"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, MoreVertical, Plus, Store } from "lucide-react";
import DateField from "@/components/ui/DateField";
import SearchBar from "@/components/ui/SearchBar";
import PaymentLinkFiltersButton from "@/components/paybylink/PaymentLinkFiltersButton";
import ExportButton from "@/components/ui/ExportButton";
import StatCard from "@/components/ui/StatCard";
import StatusDot from "@/components/ui/StatusDot";
import CreatePaymentLinkModal from "@/components/paybylink/CreatePaymentLinkModal";
import { paymentLinks } from "@/lib/mock-data";
import { formatMoney, formatDateTime } from "@/lib/format";

export default function PaymentLinksPage() {
  const [range, setRange] = useState("Creation Date");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Payment Links</h1>
        <button className="flex items-center gap-2 rounded-lg border border-border-color bg-brand-orange-light px-4 py-2 text-sm font-medium text-text-primary">
          <Store size={16} />
          All stores
          <ChevronDown size={14} />
        </button>
      </div>

      <div className="mb-5 flex items-center justify-between">
        <DateField value={range} onChange={setRange} />
      </div>

      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-border-color px-4 py-2.5 text-sm font-medium text-text-primary">
            All
            <ChevronDown size={14} />
          </button>
          <SearchBar scopes={["Payment link number", "Customer name", "Reference"]} />
        </div>
        <div className="flex items-center gap-3">
          <PaymentLinkFiltersButton />
          <ExportButton />
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
          >
            <Plus size={16} />
            Create paylink
          </button>
        </div>
      </div>

      <div className="mb-6 flex gap-4">
        <StatCard label="Payment Links" value="AED 152,482.36" sub="Number of links: 1434" />
        <StatCard label="Total Paid" value="AED 2,670.10" sub="Number of links: 443" />
        <StatCard label="Total Incomplete" value="AED 24.00" sub="Number of links: 5" />
        <StatCard label="Total Expired" value="AED 149,046.08" sub="Number of links: 922" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border-color bg-card-bg">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b border-border-color text-left text-text-secondary">
              <th className="px-4 py-3 font-medium">Payment Link Number</th>
              <th className="px-4 py-3 font-medium">Customer Name</th>
              <th className="px-4 py-3 font-medium">Store</th>
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Creation Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {paymentLinks.map((l) => {
              const { date, time } = formatDateTime(l.creationDate);
              return (
                <tr
                  key={l.id}
                  className="border-b border-border-color last:border-0 hover:bg-page-bg/60"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/pay-by-link/payment-links/${l.id}`}
                      className="font-medium text-brand-blue hover:underline"
                    >
                      {l.linkNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text-primary">{l.customerName}</td>
                  <td className="px-4 py-3 text-text-primary">{l.store}</td>
                  <td className="px-4 py-3 text-text-primary">{l.reference ?? "-"}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {formatMoney(l.amount, l.currency)}
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {date} - {time}
                  </td>
                  <td className="px-4 py-3">
                    <StatusDot status={l.status} />
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    <MoreVertical size={16} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <CreatePaymentLinkModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
