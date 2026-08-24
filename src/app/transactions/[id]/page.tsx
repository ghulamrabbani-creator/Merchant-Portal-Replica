"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MoreVertical, Upload } from "lucide-react";
import { transactions } from "@/lib/mock-data";
import { formatMoney, formatDateTime } from "@/lib/format";
import StatusDot from "@/components/ui/StatusDot";
import SchemeBadge from "@/components/ui/SchemeBadge";
import RefundModal from "@/components/ui/RefundModal";
import { notFound } from "next/navigation";

function Field({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium text-text-primary">{value}</span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 rounded-xl border border-border-color bg-card-bg p-6">
      <div className="mb-2 text-base font-bold text-text-primary">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-x-16">{children}</div>
    </div>
  );
}

export default function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = transactions.find((x) => x.id === id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  if (!t) return notFound();

  const { date, time } = formatDateTime(t.date);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link
            href="/transactions"
            className="mt-1 text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={22} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Order ID {t.reference}
            </h1>
            <div className="text-sm text-text-muted">
              {date} - {time.toUpperCase()}
            </div>
          </div>
        </div>
        <div className="relative flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-brand-blue text-brand-blue"
          >
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <div className="absolute left-0 top-12 z-10 w-32 rounded-xl border border-border-color bg-white p-1 shadow-lg">
              <button
                onClick={() => {
                  setRefundOpen(true);
                  setMenuOpen(false);
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-text-primary hover:bg-page-bg"
              >
                Refund
              </button>
            </div>
          )}
          <button className="flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white">
            <Upload size={16} />
            Export
          </button>
        </div>
      </div>

      <RefundModal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        amount={t.amount}
        currency={t.currency}
      />

      <div className="rounded-xl border border-border-color bg-card-bg p-6">
        <div className="mb-2 text-base font-bold text-text-primary">
          Transaction Overview
        </div>
        <div className="grid grid-cols-2 gap-x-16">
          <div>
            <Field label="Original Amount" value={formatMoney(t.amount, t.currency)} />
            <Field
              label={
                <span className="flex items-center gap-2">
                  Exchange Rate
                  {t.isDcc && (
                    <span className="rounded bg-page-bg px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary">
                      DCC
                    </span>
                  )}
                </span>
              }
              value={t.exchangeRate ?? "-"}
            />
            <Field label="Gross Amount" value="0" />
            <Field label="Commission" value={t.commission} />
            <Field label="VAT" value={t.vat} />
            <Field label="Net Amount" value={formatMoney(t.netAmount, t.currency)} />
            <Field label="Payment Method" value={t.paymentMethod} />
            <Field label="Masked Card Number" value={t.maskedCard} />
          </div>
          <div>
            <Field label="Type" value={t.type} />
            <Field label="Terminal ID" value={t.terminalId} />
            <Field label="Store" value={t.store} />
            <Field label="Status" value={<StatusDot status={t.status} />} />
            <Field label="Scheme" value={<SchemeBadge scheme={t.scheme} />} />
            <Field label="Tags" value={t.tags?.join(", ") ?? "-"} />
            <Field label="Approval Code" value={t.approvalCode} />
            <Field label="RRN" value={t.rrn} />
            <Field label="Card Class" value={t.cardClass} />
            <Field label="Card Segment" value={t.cardSegment} />
            <Field label="Card Origin" value={t.cardOrigin} />
          </div>
        </div>
      </div>

      <Section title="Online transaction details">
        <Field label="Payment Link Number" value="N/A" />
        <Field label="Subscription Number" value="N/A" />
      </Section>

      <Section title="Terminal details">
        <div>
          <Field label="TID" value={t.terminalId} />
          <Field label="MID" value="20100000101" />
          <Field label="Terminal Name" value="N/A" />
        </div>
        <div>
          <Field label="Terminal Location" value="N/A" />
          <Field label="Batch Number" value="N/A" />
        </div>
      </Section>

      <Section title="Payout Information">
        <Field label="Payout ID" value="4534980" />
        <Field label="Payout Status" value="N/A" />
        <Field label="Settlement Amount" value="N/A" />
        <Field label="Payment Date" value="N/A" />
      </Section>

      <Section title="Installment details">
        <Field label="Installment Bank" value="N/A" />
        <Field label="Installment Type" value="N/A" />
        <Field label="Tenor" value="N/A" />
        <Field label="Installment Discount Rate" value="N/A" />
      </Section>

      <Section title="BNPL details">
        <Field label="BNPL Provider" value="N/A" />
        <Field label="BNPL Order Id" value="N/A" />
      </Section>
    </div>
  );
}
