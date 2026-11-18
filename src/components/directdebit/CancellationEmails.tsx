"use client";

// Customer emails for a contract cancellation — 18-Nov-2026, Confluence v2.7, S8 §3.7.
// Every customer message about a cancellation is EMAIL ONLY (no SMS). English wording is decided;
// the Arabic version is with Business (S8 open point a). Sent by Geidea on behalf of the merchant.

import { useState } from "react";
import { ChevronDown, ChevronRight, Mail } from "lucide-react";
import { cancelReasonLabel, maskEmail } from "@/lib/direct-debit";
import { DirectDebitContract } from "@/lib/types";

export type CancellationEmailKind = "request" | "accepted" | "rejected";

const KIND_LABEL: Record<CancellationEmailKind, string> = {
  request: "Cancellation request (on start and each resend)",
  accepted: "Cancellation accepted",
  rejected: "Cancellation rejected by the bank",
};

/** The email text with the contract's values filled in. `strong` marks the line shown in bold. */
export function cancellationEmail(
  kind: CancellationEmailKind,
  c: DirectDebitContract,
  merchant: string
): { subject: string; lines: { text: string; strong?: boolean; tight?: boolean }[] } {
  const hello = { text: `Dear ${c.customerName},` };
  const contract = { text: `Contract: ${c.contractDescription || "—"}`, tight: true };
  const ref = { text: `Merchant reference: ${c.merchantRef}`, tight: true };
  const footer = { text: `This is an automated message from Geidea on behalf of ${merchant}.` };
  if (kind === "request") {
    const reason = c.cancellation ? cancelReasonLabel(c.cancellation.reasonCode) : "—";
    return {
      subject: `Action needed: sign to cancel your direct debit with ${merchant}`,
      lines: [
        hello,
        { text: `${merchant} has requested to cancel your direct debit.`, tight: true },
        contract,
        ref,
        { text: `Reason: ${reason}` },
        { text: "This cancellation will not take effect until you sign it.", strong: true, tight: true },
        { text: "Until then, your direct debit stays active and payments can still be collected." },
        { text: "Review and sign: {link}" },
        {
          text: "You will confirm your identity with a one-time password and sign with UAE PASS. Forgot your UAE PASS signing password? Open UAE PASS > Profile > Reset signing password.",
        },
        { text: "Once you sign, your bank will process the cancellation within 1 working day." },
        footer,
      ],
    };
  }
  if (kind === "accepted") {
    return {
      subject: `Your direct debit with ${merchant} is cancelled`,
      lines: [
        hello,
        { text: `Your bank has accepted the cancellation of your direct debit with ${merchant}.`, tight: true },
        contract,
        { ...ref, tight: false },
        {
          text: "No further payments will be collected under this direct debit. A payment already sent to your bank before the cancellation was accepted may still be processed.",
        },
        footer,
      ],
    };
  }
  return {
    subject: `Your request to cancel your direct debit with ${merchant} was not accepted`,
    lines: [
      hello,
      { text: `Your bank has rejected the request to cancel your direct debit with ${merchant}.`, tight: true },
      contract,
      { ...ref, tight: false },
      { text: "Your direct debit remains active. Please contact your bank for more information." },
      { text: `If you still wish to cancel, please contact ${merchant}.` },
      footer,
    ],
  };
}

/** Collapsible preview of the emails sent so far for this cancellation (prototype aid). */
export default function CancellationEmailsPreview({
  contract: c,
  merchant,
  kinds,
}: {
  contract: DirectDebitContract;
  merchant: string;
  kinds: CancellationEmailKind[];
}) {
  const [open, setOpen] = useState(false);
  const to = maskEmail(c.customerEmail ?? "customer@example.com");
  return (
    <div className="mt-2.5" data-testid="cx-emails">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-blue hover:underline"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Mail size={13} /> Customer emails ({kinds.length}) — email only, no SMS
      </button>
      {open && (
        <div className="mt-2 space-y-2.5">
          {kinds.map((k) => {
            const e = cancellationEmail(k, c, merchant);
            return (
              <div key={k} className="rounded-lg border border-border-color bg-white px-4 py-3 text-[12.5px]" data-testid={`cx-email-${k}`}>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{KIND_LABEL[k]} · to {to}</div>
                <div className="mb-2 font-semibold text-text-primary">Subject: {e.subject}</div>
                {e.lines.map((l, i) => (
                  <p key={i} className={`${l.tight ? "mb-0" : "mb-2"} text-text-secondary ${l.strong ? "font-semibold text-text-primary" : ""}`}>
                    {l.text}
                  </p>
                ))}
                <div className="mt-1 text-[11px] text-text-muted">Arabic version: wording with Business (S8 open point a).</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
