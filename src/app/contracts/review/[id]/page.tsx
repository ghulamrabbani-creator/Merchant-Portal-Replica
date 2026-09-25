"use client";

// Customer review & signing link — https://<portal-host>/contracts/review/{mandateId}
// (Backend Stories S2 §6.1). Added 25-Sep-2026; replaces /direct-debit/{id}/sign (now a redirect).
//
// Page state per S3 §2 (GET /direct-debit/v1/sign/{mandateId}/access → pageState):
//   NOT_AVAILABLE  — cancelled / rejected / discarded
//   ALREADY_SIGNED — status SUBP / APRP / ACCP (shown here as Pending Bank Approval / Active)
//   EXPIRED        — review_link_expires_at has passed
//   OTP_REQUIRED   — no review session yet → CustomerVerification (OTP)
//   READY          — ContractReviewSign (the existing review & sign flow)
// The review session lives only in this page's memory — reloading asks for the OTP again.

import { use, useState } from "react";
import { Loader2, Ban, CheckCircle2, Clock } from "lucide-react";
import { useContract } from "@/lib/dd-contract-store";
import { STORE_NAME } from "@/lib/mock-data";
import { ddToday, diffDays, parseNiceDate } from "@/lib/direct-debit";
import { DirectDebitContract } from "@/lib/types";
import CustomerVerification, { CustomerPageHeader } from "@/components/directdebit/CustomerVerification";
import ContractReviewSign from "@/components/directdebit/ContractReviewSign";
import FieldHint, { DevHintsFloatingToggle } from "@/components/directdebit/FieldHint";

type PageState = "NOT_AVAILABLE" | "ALREADY_SIGNED" | "EXPIRED" | "OTP_REQUIRED" | "READY";

function initialPageState(c: DirectDebitContract | undefined): PageState {
  if (!c || c.status === "Cancelled" || c.status === "Rejected") return "NOT_AVAILABLE";
  if (c.status === "Pending Bank Approval" || c.status === "Active" || c.status === "Suspended") return "ALREADY_SIGNED";
  if (c.reviewLinkExpiresAt && diffDays(ddToday(), parseNiceDate(c.reviewLinkExpiresAt)) < 0) return "EXPIRED";
  return "OTP_REQUIRED";
}

export default function CustomerReviewPage({ params }: { params: Promise<{ id: string }> }) {
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
          <ReviewFlow key={id} contract={contract} />
        )}
      </div>
      <DevHintsFloatingToggle />
    </div>
  );
}

function ReviewFlow({ contract }: { contract: DirectDebitContract | undefined }) {
  const [state, setState] = useState<PageState>(() => initialPageState(contract));

  if (state === "READY" && contract) return <ContractReviewSign contract={contract} />;
  if (state === "OTP_REQUIRED" && contract)
    return <CustomerVerification contract={contract} merchantName={STORE_NAME} onVerified={() => setState("READY")} />;

  const merchant = STORE_NAME;
  const view =
    state === "ALREADY_SIGNED"
      ? { icon: <CheckCircle2 size={30} className="text-status-completed" />, title: "You have already signed this contract.", body: "Your bank reviews it within up to 3 working days. There's nothing else you need to do." }
      : state === "EXPIRED"
        ? { icon: <Clock size={30} className="text-status-pending" />, title: "This link has expired.", body: `Contact ${merchant} for a new one.` }
        : { icon: <Ban size={30} className="text-status-declined" />, title: "This contract is no longer available.", body: `Contact ${merchant}.` };

  return (
    <div>
      <CustomerPageHeader />
      <div className="rounded-xl border border-border-color bg-white p-10 text-center" data-testid={`page-state-${state}`}>
        <div className="mb-3 flex justify-center">{view.icon}</div>
        <div className="flex items-center justify-center gap-1.5 text-lg font-semibold text-text-primary">
          {view.title} <FieldHint k="cust.access" value={state} />
        </div>
        <div className="mt-1 text-sm text-text-muted">{view.body}</div>
      </div>
    </div>
  );
}
