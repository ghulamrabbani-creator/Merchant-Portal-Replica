"use client";

import { useState } from "react";
import { ChevronDown, Plus, Store } from "lucide-react";
import DateField from "@/components/ui/DateField";
import SearchBar from "@/components/ui/SearchBar";
import FiltersButton from "@/components/ui/FiltersButton";
import StatusDot from "@/components/ui/StatusDot";
import CreatePaymentLinkModal from "@/components/paybylink/CreatePaymentLinkModal";
import { staticLinks } from "@/lib/mock-data";
import { formatMoney } from "@/lib/format";

export default function StaticLinksPage() {
  const [range, setRange] = useState("Creation Date");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Static Links</h1>
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
          <SearchBar scopes={["Payment link number", "Title"]} />
          <FiltersButton />
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
          >
            <Plus size={16} />
            Create paylink
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border-color bg-card-bg">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border-color text-left text-text-secondary">
              <th className="px-4 py-3 font-medium">Payment Link Number</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Store</th>
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Creation Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {staticLinks.map((l) => (
              <tr
                key={l.id}
                className="border-b border-border-color last:border-0 hover:bg-page-bg/60"
              >
                <td className="px-4 py-3 font-medium text-brand-blue">
                  {l.linkNumber}
                </td>
                <td className="px-4 py-3 text-text-primary">{l.title}</td>
                <td className="px-4 py-3 text-text-primary">{l.store}</td>
                <td className="px-4 py-3 text-text-primary">
                  {l.reference ?? "-"}
                </td>
                <td className="px-4 py-3 font-medium text-text-primary">
                  {formatMoney(l.amount, l.currency)}
                </td>
                <td className="px-4 py-3 text-text-primary">
                  {l.creationDate.slice(0, 10)}
                </td>
                <td className="px-4 py-3">
                  <StatusDot status={l.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreatePaymentLinkModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
