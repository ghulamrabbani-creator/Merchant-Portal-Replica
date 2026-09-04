"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { Landmark, CreditCard, ShieldCheck, CheckCircle2, Loader2, FileText } from "lucide-react";
import { directDebitContracts, STORE_NAME } from "@/lib/mock-data";
import { formatMoneyAED } from "@/lib/direct-debit";

type SignStep = "review" | "fetching" | "unsigned" | "signing" | "signed";

export default function ContractSignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const found = directDebitContracts.find((c) => c.id === id);
  const [step, setStep] = useState<SignStep>("review");

  useEffect(() => {
    if (!found) return;
    if (step === "fetching") {
      const t = setTimeout(() => setStep("unsigned"), 1100);
      return () => clearTimeout(t);
    }
    if (step === "signing") {
      const t = setTimeout(() => {
        setStep("signed");
        found.status = "Pending Bank Approval";
      }, 1600);
      return () => clearTimeout(t);
    }
  }, [step, found]);

  if (!found) return notFound();
  const c = found;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-page-bg">
      <div className="mx-auto max-w-[720px] px-6 py-10">
        {/* header */}
        <div className="mb-6 flex items-center gap-2">
          <span className="text-lg font-extrabold text-brand-orange">g</span>
          <span className="text-text-muted">|</span>
          <span className="text-sm font-medium text-text-secondary">Direct Debit Contract Signing</span>
        </div>

        <h1 className="mb-1.5 text-xl font-bold text-text-primary">Direct Debit Contract – Review & Sign</h1>
        <p className="mb-5 text-[13px] text-text-secondary">
          <strong className="text-text-primary">{STORE_NAME}</strong> has sent you this mandate to review and
          sign. Read the terms and schedule below, then continue to sign digitally via UAE PASS.
        </p>

        {c.contractDescription && (
          <div className="mb-4 flex items-start gap-2.5 rounded-[10px] bg-[#F3F4F6] px-4 py-3.5">
            <FileText size={15} className="mt-0.5 shrink-0 text-text-muted" />
            <div>
              <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Contract Description
              </div>
              <div className="text-[13px] leading-relaxed text-text-secondary">{c.contractDescription}</div>
            </div>
          </div>
        )}

        {/* Parties */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border-color bg-white p-5">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Requested by
            </div>
            <div className="text-sm font-semibold text-text-primary">{STORE_NAME}</div>
            <div className="mt-0.5 text-xs text-text-muted">Merchant reference: {c.merchantRef}</div>
          </div>
          <div className="rounded-xl border border-border-color bg-white p-5">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Customer</div>
            <div className="text-sm font-semibold text-text-primary">{c.customerName}</div>
            <div className="mt-0.5 text-xs text-text-muted">
              {c.customerIdType}: {c.customerIdNumber}
            </div>
          </div>
        </div>

        {/* Contract terms */}
        <div className="mb-4 rounded-xl border border-border-color bg-white p-5">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Contract terms
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
            <Row label="Contract reference" value={c.ref} />
            <Row label="Contract duration" value={`${c.commencesOn} – ${c.expiresOn}`} />
            <Row label="Collection frequency" value={c.frequency} />
            <Row
              label={c.amountType === "Fixed" ? "Amount per collection" : "Amount range"}
              value={
                c.amountType === "Fixed"
                  ? formatMoneyAED(c.minAmount)
                  : `${formatMoneyAED(c.minAmount)} – ${formatMoneyAED(c.maxAmount)}`
              }
            />
            <Row
              label="Payment instrument"
              value={
                <span className="inline-flex items-center gap-1.5">
                  {c.instrumentType === "Bank Account" ? <Landmark size={13} /> : <CreditCard size={13} />}
                  {c.instrumentType} {c.maskedInstrumentRef}
                  {c.bankName ? `, ${c.bankName}` : ""}
                </span>
              }
            />
            <Row
              label="Rollover"
              value={c.rolloverEnabled ? `Enabled — up to ${c.rolloversAllowed} consecutive` : "Disabled"}
            />
          </div>
        </div>

        {/* Occurrences */}
        <div className="mb-6 overflow-hidden rounded-xl border border-border-color bg-white">
          <div className="border-b border-border-color px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Collection schedule — {c.occurrences.length} occurrence{c.occurrences.length !== 1 ? "s" : ""}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-color bg-page-bg text-left text-text-secondary">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Due date</th>
                <th className="px-4 py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {c.occurrences.slice(0, 12).map((o) => (
                <tr key={o.seq} className="border-t border-border-color">
                  <td className="px-4 py-2 text-text-muted">{o.seq}</td>
                  <td className="px-4 py-2 text-text-primary">{o.dueDate}</td>
                  <td className="px-4 py-2 font-semibold text-text-primary">{formatMoneyAED(o.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {c.occurrences.length > 12 && (
            <div className="border-t border-border-color px-5 py-2.5 text-[11.5px] text-text-muted">
              Showing the first 12 of {c.occurrences.length} occurrences.
            </div>
          )}
        </div>

        {/* Action / state machine */}
        <div className="rounded-xl border border-border-color bg-white p-6 text-center">
          {step === "review" && (
            <>
              <p className="mb-4 text-sm text-text-secondary">
                Review the details above, then continue to view the full contract and sign it digitally.
              </p>
              <button
                onClick={() => setStep("fetching")}
                className="rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
              >
                View & Sign Contract
              </button>
            </>
          )}
          {step === "fetching" && (
            <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
              <Loader2 size={16} className="animate-spin" />
              Fetching your unsigned contract…
            </div>
          )}
          {step === "unsigned" && (
            <>
              <p className="mb-1 text-sm font-medium text-text-primary">Your contract is ready to sign.</p>
              <p className="mb-4 text-[12.5px] text-text-muted">
                You&apos;ll be redirected to UAE PASS to complete your digital signature.
              </p>
              <button
                onClick={() => setStep("signing")}
                className="inline-flex items-center gap-2 rounded-lg bg-black px-6 py-2.5 text-sm font-semibold text-white hover:bg-black/85"
              >
                <ShieldCheck size={16} />
                Sign with UAE PASS
              </button>
            </>
          )}
          {step === "signing" && (
            <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
              <Loader2 size={16} className="animate-spin" />
              Redirecting to UAE PASS…
            </div>
          )}
          {step === "signed" && (
            <div className="flex flex-col items-center gap-2 text-status-completed">
              <CheckCircle2 size={28} />
              <div className="text-sm font-semibold text-text-primary">Contract signed successfully</div>
              <div className="text-[12.5px] text-text-muted">Submitted for Central Bank and payer bank approval.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border-color/60 py-1.5 last:border-0">
      <span className="text-text-secondary">{label}</span>
      <span className="text-right font-medium text-text-primary">{value}</span>
    </div>
  );
}
