"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, QrCode, MessageCircle, MoreVertical, ChevronDown } from "lucide-react";
import { notFound } from "next/navigation";
import { paymentLinks } from "@/lib/mock-data";
import { formatMoney } from "@/lib/format";
import StatusDot from "@/components/ui/StatusDot";

const STEPS = ["Created", "Sent", "Paid", "Expired"];

export default function PaymentLinkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const l = paymentLinks.find((x) => x.id === id);
  if (!l) return notFound();

  const activeStepIndex = STEPS.indexOf(
    l.status === "Paid" ? "Paid" : l.status === "Created" ? "Created" : "Sent"
  );

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/pay-by-link/payment-links"
            className="text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={22} />
          </Link>
          <h1 className="text-2xl font-bold text-text-primary">
            Quick link #{l.linkNumber}
          </h1>
          <StatusDot status={l.status} />
        </div>
        <div className="flex items-center gap-3">
          <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-brand-blue text-brand-blue">
            <MoreVertical size={18} />
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white">
            Send via
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-6">
        <div>
          <div className="rounded-xl border border-border-color bg-card-bg p-6">
            <div className="text-sm font-semibold text-text-secondary">
              Payment
            </div>
            <div className="text-2xl font-bold text-brand-orange">
              {formatMoney(l.amount, l.currency)}
            </div>
            <div className="my-4 border-t border-border-color" />
            <div className="mb-2 text-sm font-semibold text-text-primary">
              Payment link
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 truncate rounded-lg border border-border-color bg-page-bg px-3 py-2.5 text-sm text-brand-blue">
                https://payments.geidea.ae/payByLink/demo/{l.linkNumber.slice(0, 8)}
              </div>
              <IconBtn icon={Copy} />
              <IconBtn icon={QrCode} />
              <IconBtn icon={MessageCircle} />
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-border-color bg-card-bg p-6">
            <div className="mb-6 text-base font-bold text-text-primary">
              Timeline
            </div>
            <div className="flex items-center">
              {STEPS.map((step, i) => (
                <div key={step} className="flex flex-1 flex-col items-center">
                  <div className="flex w-full items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                        i <= activeStepIndex
                          ? "bg-status-completed/15 text-status-completed"
                          : "bg-page-bg text-text-muted"
                      }`}
                    >
                      {i <= activeStepIndex ? "✓" : ""}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="mx-1 h-px flex-1 border-t border-dashed border-border-color" />
                    )}
                  </div>
                  <div
                    className={`mt-2 text-sm font-semibold ${
                      i <= activeStepIndex
                        ? "text-brand-blue"
                        : "text-text-muted"
                    }`}
                  >
                    {step}
                  </div>
                  {i <= activeStepIndex && (
                    <div className="text-xs text-text-muted">
                      {l.creationDate.slice(0, 10)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-border-color bg-card-bg">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-color text-left text-text-secondary">
                  <th className="px-5 py-3 font-medium">Order ID</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border-color">
                  <td className="px-5 py-3 text-text-primary">
                    demo-order-a1b2c3
                  </td>
                  <td className="px-5 py-3">
                    <StatusDot status="Success" />
                  </td>
                  <td className="px-5 py-3 text-text-primary">
                    {l.creationDate.slice(0, 10)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-border-color bg-card-bg p-6">
            <div className="mb-3 text-base font-bold text-text-primary">
              Link Details
            </div>
            <DetailRow label="Activation date:" value={l.activationDate} />
            <DetailRow label="Expiry date:" value={l.expiryDate} />
            <DetailRow label="Creation date:" value={l.creationDate.slice(0, 10)} />
            <DetailRow label="Language:" value={l.language} />
            <DetailRow label="Amount:" value={formatMoney(l.amount, l.currency)} />
          </div>
          <div className="rounded-xl border border-border-color bg-card-bg p-6">
            <div className="mb-3 text-base font-bold text-text-primary">
              Customer Details
            </div>
            <DetailRow label="First Name:" value={l.customerName.split(" ")[0]} />
            <DetailRow label="Last Name:" value={l.customerName.split(" ")[1] ?? "-"} />
            <DetailRow label="Phone Number:" value={l.phone ?? "-"} />
            <DetailRow label="Email:" value={l.email ?? "-"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}

function IconBtn({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-color text-text-secondary hover:text-brand-blue">
      <Icon size={18} />
    </button>
  );
}
