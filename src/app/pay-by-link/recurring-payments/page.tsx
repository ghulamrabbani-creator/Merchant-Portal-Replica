"use client";

import { useState } from "react";
import { ChevronDown, MoreVertical, Plus, Store } from "lucide-react";
import DateField from "@/components/ui/DateField";
import SearchBar from "@/components/ui/SearchBar";
import FiltersButton from "@/components/ui/FiltersButton";
import ExportButton from "@/components/ui/ExportButton";
import StatCard from "@/components/ui/StatCard";
import StatusDot from "@/components/ui/StatusDot";
import { recurringPayments } from "@/lib/mock-data";

export default function RecurringPaymentsPage() {
  const [range, setRange] = useState("Creation Date");

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <h1 className="text-2xl font-bold text-text-primary">
          Recurring Payments
        </h1>
        <button className="flex items-center gap-2 rounded-lg border border-border-color bg-brand-orange-light px-4 py-2 text-sm font-medium text-text-primary">
          <Store size={16} />
          All stores
          <ChevronDown size={14} />
        </button>
      </div>

      <div className="mb-5 flex items-center justify-between">
        <DateField value={range} onChange={setRange} />
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-border-color px-4 py-2.5 text-sm font-medium text-text-primary">
            All
            <ChevronDown size={14} />
          </button>
          <SearchBar scopes={["Recurring ID", "Customer name", "Reference"]} />
          <FiltersButton />
          <ExportButton />
          <button className="flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover">
            <Plus size={16} />
            Create link
          </button>
        </div>
      </div>

      <div className="mb-6 flex gap-4">
        <StatCard label="Active Recurring Payments" value="AED 0.00" sub="Active Payments: 0" />
        <StatCard
          label="Successful Auto-Debits Payments"
          value="AED 3.00"
          sub="Successful Auto-Debits: 3"
        />
        <StatCard label="Overdue Payments" value="AED 0.00" sub="Overdue Payments: 0" />
        <StatCard
          label="Expired Recurring Payments"
          value="AED 0.00"
          sub="Failed Payments: 0"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border-color bg-card-bg">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-border-color text-left text-text-secondary">
              <th className="px-4 py-3 font-medium">Recurring ID</th>
              <th className="px-4 py-3 font-medium">Customer Name</th>
              <th className="px-4 py-3 font-medium">Store</th>
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium">Payment Method</th>
              <th className="px-4 py-3 font-medium">Creation Date</th>
              <th className="px-4 py-3 font-medium">Next payment</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {recurringPayments.map((r) => (
              <tr
                key={r.id}
                className="border-b border-border-color last:border-0 hover:bg-page-bg/60"
              >
                <td className="px-4 py-3 font-medium text-brand-blue">
                  {r.recurringId}
                </td>
                <td className="px-4 py-3 text-text-primary">{r.customerName}</td>
                <td className="px-4 py-3 text-text-primary">{r.store}</td>
                <td className="px-4 py-3 text-text-primary">{r.reference}</td>
                <td className="px-4 py-3 text-text-primary">{r.paymentMethod}</td>
                <td className="px-4 py-3 text-text-primary">
                  {r.creationDate.slice(0, 10)}
                </td>
                <td className="px-4 py-3 text-text-primary">
                  {r.nextPayment.slice(0, 10)}
                </td>
                <td className="px-4 py-3">
                  <StatusDot status={r.status} />
                </td>
                <td className="px-4 py-3 text-text-muted">
                  <MoreVertical size={16} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
