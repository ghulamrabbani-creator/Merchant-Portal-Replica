"use client";

// Customer cancellation link — https://<portal-host>/contracts/cancel/{cancellationId}
// (15-Oct-2026, Confluence S8 §3; MP Backlog US-41). Same verification and one-time password as
// the contract review page; the customer signs DDS's cancellation form with UAE PASS
// (ddarId = ddcarId). Geidea confirms the result with DDS — never the redirect alone.
// Prototype: the route takes the contract id; the real link carries the cancellation id.

import { use, useEffect, useState } from "react";
import { Loader2, Ban, CheckCircle2, Clock, ShieldCheck, FileText } from "lucide-react";
import { useContract } from "@/lib/dd-contract-store";
import { STORE_NAME } from "@/lib/mock-data";
import { cancelReasonLabel, ddToday, diffDays, parseNiceDate } from "@/lib/direct-debit";
import { cancellationSigned } from "@/lib/dd-actions";
import { DirectDebitContract } from "@/lib/types";
import CustomerVerification, { CustomerPageHeader } from "@/components/directdebit/CustomerVerification";
import { DevHintsFloatingToggle } from "@/components/directdebit/FieldHint";

type PageState = "NOT_AVAILABLE" | "ALREADY_SIGNED" | "EXPIRED" | "OTP_REQUIRED" | "READY";
type Outcome = "finished" | "failed" | "ddsError" | "canceled";
type Step = "review" | "signing" | "signed" | "failed" | "left";

function initialPageState(c: DirectDebitContract | undefined): PageState {
  const cx = c?.cancellation;
  if (!c || !cx || c.status !== "Active" || cx.stage === "accepted" || cx.stage === "rejected") return "NOT_AVAILABLE";
  if (cx.stage === "with_bank") return "ALREADY_SIGNED";
  if (diffDays(ddToday(), parseNiceDate(cx.linkExpiresAt)) < 0) return "EXPIRED";
  return "OTP_REQUIRED";
}

export default function CustomerCancellationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { contract, ready } = useContract(id);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-page-bg">
      <div className="mx-auto max-w-[720px] px-6 py-10">
        {!ready ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-text-muted">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : (
          <CancelFlow key={id} contract={contract} />
        )}
      </div>
      <DevHintsFloatingToggle />
    </div>
  );
}

function CancelFlow({ contract }: { contract: DirectDebitContract | undefined }) {
  const [state, setState] = useState<PageState>(() => initialPageState(contract));
  if (state === "READY" && contract) return <CancelReviewSign contract={contract} />;
  if (state === "OTP_REQUIRED" && contract)
    return <CustomerVerification contract={contract} merchantName={STORE_NAME} onVerified={() => setState("READY")} />;

  const view =
    state === "ALREADY_SIGNED"
      ? { icon: <CheckCircle2 size={30} className="text-status-completed" />, title: "You have already signed this cancellation.", body: "Your bank processes it within 1 working day. There's nothing else you need to do." }
      : state === "EXPIRED"
        ? { icon: <Clock size={30} className="text-status-pending" />, title: "This link has expired.", body: `Ask ${STORE_NAME} to send you a new one.` }
        : { icon: <Ban size={30} className="text-status-declined" />, title: "This cancellation is no longer available.", body: `Contact ${STORE_NAME}.` };
  return (
    <div>
      <CustomerPageHeader />
      <div className="rounded-xl border border-border-color bg-white p-10 text-center" data-testid={`cx-state-${state}`}>
        <div className="mb-3 flex justify-center">{view.icon}</div>
        <div className="text-lg font-semibold text-text-primary">{view.title}</div>
        <div className="mt-1 text-sm text-text-muted">{view.body}</div>
      </div>
    </div>
  );
}

function CancelReviewSign({ contract: c }: { contract: DirectDebitContract }) {
  const cx = c.cancellation!;
  const [step, setStep] = useState<Step>("review");
  const [outcome, setOutcome] = useState<Outcome>("finished");

  useEffect(() => {
    if (step !== "signing") return;
    const t = setTimeout(() => {
      if (outcome === "finished") {
        cancellationSigned(c.id);
        setStep("signed");
      } else setStep(outcome === "canceled" ? "left" : "failed");
    }, 1600);
    return () => clearTimeout(t);
  }, [step, outcome, c.id]);

  const form = (signed: boolean) =>
    `data:text/plain;charset=utf-8,${encodeURIComponent(`${signed ? "SIGNED" : "UNSIGNED"} CANCELLATION FORM (prototype)\nMerchant: ${STORE_NAME}\nMerchant reference: ${c.merchantRef}\nReason: ${cancelReasonLabel(cx.reasonCode)}`)}`;

  return (
    <div>
      <CustomerPageHeader />
      <div className="rounded-xl border border-border-color bg-white p-8">
        <h1 className="mb-1 text-xl font-bold text-text-primary">Cancel your direct debit</h1>
        <p className="mb-5 text-sm text-text-secondary">
          {STORE_NAME} has asked to cancel your direct debit. Please review and sign the cancellation.
        </p>
        <div className="mb-5 rounded-lg border border-border-color px-4 py-2 text-sm">
          <Row label="Merchant" value={STORE_NAME} />
          <Row label="Contract" value={c.contractDescription || "—"} />
          <Row label="Merchant reference" value={c.merchantRef} />
          <Row label="Reason" value={cancelReasonLabel(cx.reasonCode)} />
        </div>
        <p className="mb-5 text-sm text-text-primary">Once your bank accepts the cancellation, no further payments will be collected.</p>

        <div className="text-center">
          {step === "review" && (
            <>
              <p className="mx-auto mb-4 max-w-md rounded-lg bg-page-bg px-3 py-2 text-[12.5px] text-text-secondary">
                Forgot your UAE PASS signing password? Reset it in UAE PASS › Profile › Reset signing password.
              </p>
              <a href={form(false)} download={`${c.merchantRef}-cancellation-unsigned.txt`} className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-blue hover:underline">
                <FileText size={14} /> Download unsigned cancellation form
              </a>
              <div className="mx-auto mb-4 flex max-w-md items-center gap-2 rounded-lg border border-dashed border-fuchsia-400 px-3 py-2 text-[12px] text-fuchsia-700">
                Prototype — simulate UAE PASS result:
                <select value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome)} className="rounded border border-fuchsia-300 bg-white px-1 py-0.5" data-testid="cx-outcome">
                  <option value="finished">finished — signed</option>
                  <option value="failed">failed</option>
                  <option value="ddsError">ddsError</option>
                  <option value="canceled">canceled — customer left</option>
                </select>
              </div>
              <button onClick={() => setStep("signing")} className="inline-flex items-center gap-2 rounded-lg bg-black px-6 py-2.5 text-sm font-semibold text-white hover:bg-black/85" data-testid="cx-sign">
                <ShieldCheck size={16} />
                Sign cancellation with UAE PASS
              </button>
            </>
          )}
          {step === "signing" && (
            <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
              <Loader2 size={16} className="animate-spin" /> Redirecting to UAE PASS…
            </div>
          )}
          {step === "signed" && (
            <div className="flex flex-col items-center gap-2" data-testid="cx-signed">
              <CheckCircle2 size={28} className="text-status-completed" />
              <div className="text-sm font-semibold text-text-primary">Cancellation signed.</div>
              <div className="text-[12.5px] text-text-muted">Your bank will process it within 1 working day. You can close this page.</div>
              <a href={form(true)} download={`${c.merchantRef}-cancellation-signed.txt`} className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-blue hover:underline">
                <FileText size={14} /> Download signed cancellation form
              </a>
            </div>
          )}
          {(step === "failed" || step === "left") && (
            <div className="flex flex-col items-center gap-2" data-testid={`cx-${step}`}>
              <div className="text-sm font-semibold text-text-primary">{step === "failed" ? "Signing didn't go through." : "Signing wasn't completed."}</div>
              <div className="max-w-md text-[12.5px] text-text-muted">
                {step === "left"
                  ? "You left before signing. You can sign whenever you're ready while the link is valid."
                  : outcome === "ddsError"
                    ? "Something went wrong on our side. Nothing has been signed — please try again."
                    : "Something went wrong with UAE PASS. Nothing has been signed — please try again."}
              </div>
              <button onClick={() => setStep("review")} className="mt-1 rounded-lg bg-brand-blue px-5 py-2 text-sm font-semibold text-white hover:bg-brand-blue-hover">
                Try again
              </button>
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
