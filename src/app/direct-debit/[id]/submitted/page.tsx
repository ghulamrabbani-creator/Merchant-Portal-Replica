"use client";

// Contract submitted (added 25-Sep-2026, Rabbani) — inserted between "Create & Send Contract" and
// the customer's review page. Two sections:
//   1. Payloads, side by side: what the portal sent to the Geidea DD Backend
//      (POST /direct-debit/v1/contracts, Backend Stories S2 §3a) and what the Backend sends on to
//      DDS (Create DDA, S2 §4c) — with both 201 responses. Hover a field to see where it goes.
//   2. The SMS and email Geidea sends the customer (S2 §7, S3 §1 — templates carry the merchant
//      display name, contract description, review link and link expiry). The link opens the
//      customer's review & signing page in a new tab. Hidden entirely when the merchant has
//      "Suppress Geidea customer notifications" on — Geidea sends nothing in that case.

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  MessageSquare,
  BellOff,
  Server,
  Monitor,
  Landmark,
} from "lucide-react";
import { useContract } from "@/lib/dd-contract-store";
import { STORE_NAME } from "@/lib/mock-data";
import { beRequestBody, beResponseBody, ddsCreateDdaBody, ddsResponseBody } from "@/lib/dd-payloads";
import { contractStatusLabel } from "@/lib/direct-debit";
import StatusDot from "@/components/ui/StatusDot";
import JsonPanel from "@/components/directdebit/JsonPanel";
import FieldHint from "@/components/directdebit/FieldHint";
import { DirectDebitContract } from "@/lib/types";

// Backend request field → DDS Create DDA field(s) — S2 §4c. Fields with no entry never go to DDS.
const BE_TO_DDS: Record<string, string[]> = {
  merchantReference: ["ddaReferenceNumber"],
  customerName: ["customerFullName"],
  customerEmail: ["customerEmail"],
  customerMobile: ["customerMobileNumber"],
  emiratesId: ["customerIdNumber", "custNid"],
  paymentMethodType: ["userPreferPaymentMethod"],
  bankName: ["customerAccountBankName"],
  accountHolderTitle: ["customerBankAccountTitle"],
  bankAccountType: ["customerBankAccountType"],
  iban: ["customerBankAccountNumber"],
  cardNumber: ["customerCreditCardNumber"],
  cardHolderName: ["creditCardHolderName"],
  startDate: ["commencesOn"],
  endDate: ["expiresOn"],
  amountType: ["amountType"],
  minAmount: ["minAmount"],
  maxAmount: ["maxAmount"],
  frequencyCeiling: ["paymentFrequency"],
};
const DDS_TO_BE: Record<string, string[]> = Object.entries(BE_TO_DDS).reduce(
  (acc, [be, ddsKeys]) => {
    for (const d of ddsKeys) acc[d] = [...(acc[d] ?? []), be];
    return acc;
  },
  {} as Record<string, string[]>
);
// DDS fields set by the Backend itself, not from a request field.
const DDS_CONSTANTS: Record<string, string> = {
  customerType: "Always \"Individual\" in Phase 1 (Mandate.customer_type)",
  customerIdType: "Always \"UAE Emirates Identity Card\" (Mandate.customer_id_type)",
};

export default function ContractSubmittedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { contract, ready } = useContract(id);
  if (!contract) {
    if (!ready)
      return (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      );
    return notFound();
  }
  return <Submitted c={contract} />;
}

function Submitted({ c }: { c: DirectDebitContract }) {
  const [hover, setHover] = useState<{ side: "be" | "dds"; key: string } | null>(null);
  const req = c.createRequest;
  // Snapshot of the merchant's Suppress Geidea customer notifications setting AT CREATION — the
  // create flow records 0 sends when it was on (a later config change doesn't rewrite history).
  const suppressed = (c.signingNotificationCount ?? 0) === 0;
  const tbfc = c.instrumentProvidedBy === "customer";

  // Review URL (S2 §6.1): https://<portal-host>/contracts/review/{mandateId}. Only rendered after
  // hydration (this component mounts once useContract is ready), so window is available.
  const reviewPath = `/contracts/review/${c.id}`;
  const reviewUrl = typeof window !== "undefined" ? `${window.location.origin}${reviewPath}` : reviewPath;
  const expiry = c.reviewLinkExpiresAt ?? "—";

  const beReq = useMemo(() => (req ? beRequestBody(req) : null), [req]);
  const ddsReq = useMemo(() => (req ? ddsCreateDdaBody(req) : null), [req]);
  const beRes = useMemo(
    () => (req ? beResponseBody(c, req, suppressed, reviewUrl, expiry) : null),
    [c, req, suppressed, reviewUrl, expiry]
  );
  const ddsRes = useMemo(() => (req ? ddsResponseBody(req) : null), [req]);

  const beActive = hover ? (hover.side === "be" ? [hover.key] : DDS_TO_BE[hover.key] ?? []) : [];
  const ddsActive = hover ? (hover.side === "dds" ? [hover.key] : BE_TO_DDS[hover.key] ?? []) : [];
  const hoverExplain = hover
    ? hover.side === "be"
      ? BE_TO_DDS[hover.key]
        ? `${hover.key} → DDS ${BE_TO_DDS[hover.key].join(" + ")}`
        : `${hover.key} stays in Geidea — never sent to DDS`
      : DDS_TO_BE[hover.key]
        ? `DDS ${hover.key} ← ${DDS_TO_BE[hover.key].join(" + ")}`
        : DDS_CONSTANTS[hover.key]
          ? `DDS ${hover.key}: ${DDS_CONSTANTS[hover.key]}`
          : hover.key
    : null;

  const firstName = c.customerName.split(" ")[0];

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={30} className="mt-0.5 text-status-completed" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Contract submitted</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
              <span>
                Merchant reference <strong className="text-text-primary">{c.merchantRef}</strong>
              </span>
              <span className="text-text-muted">·</span>
              <StatusDot status={contractStatusLabel(c)} />
            </div>
            <p className="mt-1.5 max-w-3xl text-[13px] text-text-muted">
              {tbfc
                ? "Held locally by the DD Backend — DDS isn't called until the customer enters their payment instrument on the review page."
                : "Registered with DDS. The customer now verifies, reviews and signs via UAE PASS."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Link
            href="/direct-debit"
            className="rounded-lg border border-border-color bg-white px-4 py-2.5 text-sm font-medium text-text-primary hover:border-text-muted"
          >
            Back to contracts
          </Link>
          <Link
            href={`/direct-debit/${c.id}`}
            className="rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
            data-testid="view-contract"
          >
            View contract
          </Link>
        </div>
      </div>

      {!req ? (
        <div className="rounded-xl border border-border-color bg-card-bg p-6 text-sm text-text-muted">
          Submission details are only available for contracts created in this browser — this is a demo record.
        </div>
      ) : (
        <>
          {/* ---------------- Section A: payloads ---------------- */}
          <div className="rounded-xl border border-border-color bg-card-bg p-6">
            <div className="mb-1 flex items-center justify-between gap-4">
              <h2 className="text-base font-bold text-text-primary">What was sent</h2>
              <div className="flex items-center gap-2 text-[12px] font-medium text-text-secondary">
                <span className="inline-flex items-center gap-1 rounded-full bg-page-bg px-2.5 py-1">
                  <Monitor size={12} /> Merchant Portal
                </span>
                <ArrowRight size={13} className="text-text-muted" />
                <span className="inline-flex items-center gap-1 rounded-full bg-page-bg px-2.5 py-1">
                  <Server size={12} /> Geidea DD Backend
                </span>
                <ArrowRight size={13} className="text-text-muted" />
                <span className="inline-flex items-center gap-1 rounded-full bg-page-bg px-2.5 py-1">
                  <Landmark size={12} /> DDS
                </span>
              </div>
            </div>
            <p className="mb-4 text-[12.5px] text-text-muted">
              Field names exactly as in the Backend Stories (S2 §3a request, §4c DDS mapping, §8 response). Hover a
              field to see where it goes next.{" "}
              <span className="font-mono text-[11.5px] text-fuchsia-700">{hoverExplain ?? ""}</span>
            </p>

            <div className="grid grid-cols-2 gap-5">
              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold text-text-primary">1 · Portal → DD Backend</div>
                    <div className="font-mono text-[11.5px] text-text-muted">POST /direct-debit/v1/contracts</div>
                  </div>
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">request</span>
                </div>
                <JsonPanel
                  data={beReq!}
                  activeKeys={beActive}
                  onHoverKey={(k) => setHover(k ? { side: "be", key: k } : null)}
                  testId="be-request"
                />
                <p className="mt-2 text-[11.5px] text-text-muted">
                  MID is not in the body — the Backend takes it from the authenticated session. Full IBAN/card number is
                  used in memory for the DDS call and never stored.
                </p>
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold text-text-primary">2 · DD Backend → DDS (Create DDA)</div>
                    <div className="font-mono text-[11.5px] text-text-muted">
                      POST /v1/merchant/direct-debit-authorities
                    </div>
                  </div>
                  <span className="rounded bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">request</span>
                </div>
                {ddsReq ? (
                  <>
                    <JsonPanel
                      data={ddsReq}
                      activeKeys={ddsActive}
                      onHoverKey={(k) => setHover(k ? { side: "dds", key: k } : null)}
                      testId="dds-request"
                    />
                    <p className="mt-2 text-[11.5px] text-text-muted">
                      Basic auth with the DDS credentials of the merchant&apos;s OIC (569000143 — Geidea). Dates dd/MM/yyyy.
                      Never sent: notes, contractDescription, OIC, and anything about the schedule or rollover.
                    </p>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-border-color bg-page-bg p-5 text-[13px] text-text-secondary" data-testid="dds-not-called">
                    <div className="mb-1 font-semibold text-text-primary">Not called yet — To Be Filled By Customer</div>
                    DDS doesn&apos;t accept a mandate without instrument details, so the Backend holds this contract locally
                    (mandate_creation_stage = awaiting_customer_instrument). Create DDA is called with the full payload
                    when the customer submits their bank account or card on the review page —{" "}
                    <span className="font-mono text-[12px]">POST /direct-debit/v1/sign/{"{mandateId}"}/instrument</span>{" "}
                    (S3 §5).
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[13px] font-semibold text-text-primary">4 · DD Backend → Portal</div>
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">201 response</span>
                </div>
                <JsonPanel data={beRes!} testId="be-response" />
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[13px] font-semibold text-text-primary">3 · DDS → DD Backend</div>
                  <span className="rounded bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">201 response</span>
                </div>
                {ddsRes ? (
                  <>
                    <JsonPanel data={ddsRes} />
                    <p className="mt-2 text-[11.5px] text-text-muted">
                      Saved as Mandate.dda_id / ddar_id; status_code = PNDG (DDS returns no status — PNDG is the documented
                      initial state). ddarId builds the UAE PASS signing URL, released to the customer only after the OTP check.
                    </p>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-border-color bg-page-bg p-5 text-[13px] text-text-muted">
                    No DDS call — see step 2.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ---------------- Section B: customer notifications ---------------- */}
          <div className="mt-5 rounded-xl border border-border-color bg-card-bg p-6">
            <div className="mb-1 flex items-center gap-1.5">
              <h2 className="text-base font-bold text-text-primary">What the customer receives</h2>
              <FieldHint k="notif.template" />
            </div>

            {suppressed ? (
              <div
                className="mt-3 flex items-start gap-3 rounded-lg border border-status-pending/50 bg-status-pending/10 p-5 text-sm text-text-secondary"
                data-testid="notifications-suppressed"
              >
                <BellOff size={20} className="mt-0.5 shrink-0 text-status-pending" />
                <div>
                  <div className="font-semibold text-text-primary">No notification sent by Geidea</div>
                  Suppress Geidea customer notifications is on for this merchant, so Geidea sends no SMS, email or
                  WhatsApp — the partner notifies the customer from its own channels and its own web page.
                  {!tbfc && " The UAE PASS signingUrl is returned to the partner in the Create Contract response (step 4)."}
                  {tbfc && " Under TBFC the partner collects the instrument on its own page and submits it via POST /direct-debit/v1/contracts/{mandateId}/instrument."}
                </div>
              </div>
            ) : (
              <>
                <p className="mb-5 text-[12.5px] text-text-muted">
                  Sent by Geidea right after creation, by SMS, email and WhatsApp (WhatsApp uses the SMS text). Arabic
                  versions go alongside — English shown here. The link opens the customer&apos;s page in a new tab.
                </p>
                <div className="grid grid-cols-[340px_1fr] gap-6">
                  {/* SMS */}
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
                      <MessageSquare size={14} /> SMS
                    </div>
                    <div className="rounded-[28px] border-[6px] border-slate-800 bg-slate-50 p-3 shadow-sm">
                      <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-orange text-[12px] font-extrabold text-white">
                          g
                        </div>
                        <div className="text-[13px] font-semibold text-slate-800">GEIDEA</div>
                      </div>
                      <div className="mb-1 text-center text-[10.5px] text-slate-400">Today</div>
                      <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-[12.5px] leading-relaxed text-slate-800 shadow-sm" data-testid="sms-preview">
                        Dear {firstName}, <strong>{STORE_NAME}</strong> has sent you a Direct Debit contract
                        {c.contractDescription ? ` for: ${c.contractDescription}` : ""}. Please review and sign it before{" "}
                        {expiry}:{" "}
                        <a
                          href={reviewPath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-blue-600 underline"
                          data-testid="sms-link"
                        >
                          {reviewUrl}
                        </a>
                      </div>
                      <div className="mt-3 text-center text-[10px] text-slate-400">Sender can&apos;t accept replies</div>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
                      <Mail size={14} /> Email
                    </div>
                    <div className="overflow-hidden rounded-xl border border-border-color shadow-sm" data-testid="email-preview">
                      <div className="border-b border-border-color bg-page-bg px-5 py-3 text-[12.5px]">
                        <div className="text-[15px] font-semibold text-text-primary">
                          Action required: review and sign your Direct Debit contract with {STORE_NAME}
                        </div>
                        <div className="mt-1 text-text-muted">
                          From <strong className="text-text-secondary">Geidea Direct Debit</strong> &lt;no-reply@geidea.net&gt; · to{" "}
                          {c.customerEmail}
                        </div>
                      </div>
                      <div className="bg-white px-6 py-5 text-[13px] leading-relaxed text-slate-700">
                        <div className="mb-4 flex items-center gap-1.5">
                          <span className="text-xl font-extrabold text-brand-orange">geidea</span>
                        </div>
                        <p className="mb-3">Dear {c.customerName},</p>
                        <p className="mb-3">
                          <strong>{STORE_NAME}</strong> has sent you a Direct Debit contract for your approval.
                        </p>
                        {c.contractDescription && (
                          <div className="mb-3 rounded-lg bg-page-bg px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">What it&apos;s for</div>
                            <div>{c.contractDescription}</div>
                          </div>
                        )}
                        <p className="mb-4">
                          Please review and sign it by <strong>{expiry}</strong>. You&apos;ll confirm it&apos;s you with a one-time
                          code, review the terms and collection schedule, then sign securely with UAE PASS.
                        </p>
                        <a
                          href={reviewPath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-brand-blue-hover"
                          data-testid="email-link"
                        >
                          Review &amp; sign contract <ExternalLink size={13} />
                        </a>
                        <p className="mt-3 break-all text-[11.5px] text-text-muted">
                          Or open this link: {reviewUrl}
                        </p>
                        <p className="mt-4 text-[11.5px] text-text-muted">
                          This link expires on {expiry}. If you weren&apos;t expecting this, contact {STORE_NAME}. Direct Debit
                          collections are processed through the UAE Direct Debit System (DDS) under Geidea Payment LLC.
                          <br />
                          *This is a system-generated email. Please do not reply.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
