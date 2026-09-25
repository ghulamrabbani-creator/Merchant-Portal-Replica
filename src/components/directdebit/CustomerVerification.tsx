"use client";

// Customer verification screen (added 25-Sep-2026, Rabbani) — the first thing a customer sees
// when they open the review & signing link from the SMS / email. This page is fully Geidea's real
// estate, so it is where the customer learns which MERCHANT the contract is from — DDS's own
// screens and messages always say Geidea, because every mandate runs under Geidea's OIC.
//
// Shows: Geidea + DDS marks, the merchant display name, the merchant's contract description, the
// customer's name, and masked Emirates ID / email / mobile. The customer picks where to receive a
// one-time code, presses Send code, and the button turns into an OTP box + Submit. The prototype
// accepts 123456. On success → the existing Contract Review & Sign page.
//
// Backend basis: S3 §2 (GET /sign/{mandateId}/access → pageState) and §3 (OTP). DIFFERENCES from
// S3 as written, to be agreed and fed back into the story:
//  - S3 §3a asks the customer to type their full mobile number first and sends the OTP by SMS only.
//    This screen instead lets them choose SMS or email (proposed POST /sign/{mandateId}/send-otp
//    with { channel }).
//  - S3 §2 returns only pageState, merchant display name and masked mobile before the OTP. This
//    screen also needs contract description, customer name, masked Emirates ID and masked email.
// Logos: text placeholders — swap in the official Geidea and DDS logo files when available.

import { useEffect, useState } from "react";
import clsx from "clsx";
import { ShieldCheck, Mail, Smartphone, FileText, Lock, AlertCircle } from "lucide-react";
import FieldHint from "@/components/directdebit/FieldHint";
import { maskEmail, maskEmiratesId, maskMobile } from "@/lib/direct-debit";
import { DirectDebitContract } from "@/lib/types";

const PROTOTYPE_OTP = "123456";
const MAX_ATTEMPTS = 5;
const RESEND_AFTER_SECONDS = 60;

/** Geidea × DDS header used on every customer-facing page. Text placeholders, not the real logos. */
export function CustomerPageHeader() {
  return (
    <div className="mb-6 flex items-center justify-between border-b border-border-color pb-4">
      <div className="flex items-center gap-3">
        <span className="text-[22px] font-extrabold tracking-tight text-brand-orange" aria-label="Geidea">
          geidea
        </span>
        <span className="h-6 w-px bg-border-color" />
        <span className="inline-flex items-center gap-2" aria-label="UAE Direct Debit System">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2bb39a] text-[10px] font-extrabold text-white">
            DD
          </span>
          <span className="text-[12.5px] font-semibold leading-tight text-slate-700">
            UAE Direct Debit
            <br />
            <span className="font-normal text-text-muted">System (DDS)</span>
          </span>
        </span>
      </div>
      <span className="inline-flex items-center gap-1.5 text-[12px] text-text-muted">
        <Lock size={12} /> Secure page
      </span>
    </div>
  );
}

export default function CustomerVerification({
  contract,
  merchantName,
  onVerified,
}: {
  contract: DirectDebitContract;
  merchantName: string;
  onVerified: () => void;
}) {
  const mobile = contract.customerMobile ?? "0501234567";
  const email = contract.customerEmail ?? "customer@example.com";
  const [channel, setChannel] = useState<"SMS" | "EMAIL">("SMS");
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [otp, setOtp] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  // Ticks once a second while a code is out, for the resend countdown.
  useEffect(() => {
    if (sentAt == null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sentAt]);

  const locked = attempts >= MAX_ATTEMPTS;
  const resendIn = sentAt == null ? 0 : Math.max(0, RESEND_AFTER_SECONDS - Math.floor((now - sentAt) / 1000));
  const destination = channel === "SMS" ? maskMobile(mobile) : maskEmail(email);

  function sendCode() {
    setSentAt(Date.now());
    setNow(Date.now());
    setOtp("");
    setError("");
  }

  function submit() {
    if (locked) return;
    if (otp === PROTOTYPE_OTP) {
      onVerified();
      return;
    }
    const n = attempts + 1;
    setAttempts(n);
    setError(
      n >= MAX_ATTEMPTS
        ? "OTP_LOCKED — too many wrong codes. Try again in 30 minutes."
        : `That code isn't right. ${MAX_ATTEMPTS - n} attempt${MAX_ATTEMPTS - n === 1 ? "" : "s"} left.`
    );
  }

  return (
    <div>
      <CustomerPageHeader />

      <div className="mb-5">
        <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
          Direct Debit contract from <FieldHint k="cust.merchantName" value={JSON.stringify(merchantName)} />
        </div>
        <h1 className="text-2xl font-bold text-text-primary" data-testid="verify-merchant">
          {merchantName}
        </h1>
        <p className="mt-1.5 text-[13px] text-text-secondary">
          {merchantName} has asked you to set up a Direct Debit. Confirm it&apos;s you to see the contract and sign it.
          Your bank and DDS will show this contract under <strong>Geidea Payment LLC</strong>, which collects it on{" "}
          {merchantName}&apos;s behalf.
        </p>
      </div>

      {contract.contractDescription && (
        <div className="mb-4 flex items-start gap-2.5 rounded-[10px] bg-[#F3F4F6] px-4 py-3.5">
          <FileText size={15} className="mt-0.5 shrink-0 text-text-muted" />
          <div>
            <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              What this contract is for <FieldHint k="cust.description" />
            </div>
            <div className="text-[13px] leading-relaxed text-text-secondary" data-testid="verify-description">
              {contract.contractDescription}
            </div>
          </div>
        </div>
      )}

      <div className="mb-5 rounded-xl border border-border-color bg-white p-5">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Your details</div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Detail label="Name" value={contract.customerName} hint={<FieldHint k="cust.name" />} />
          <Detail label="Emirates ID" value={maskEmiratesId(contract.customerIdNumber)} hint={<FieldHint k="cust.maskedEid" />} />
          <Detail label="Email" value={maskEmail(email)} hint={<FieldHint k="cust.maskedEmail" />} />
          <Detail label="Mobile" value={maskMobile(mobile)} hint={<FieldHint k="cust.maskedMobile" />} />
        </div>
        <div className="mt-3 text-[11.5px] text-text-muted">
          Not you, or details look wrong? Don&apos;t continue — contact {merchantName}.
        </div>
      </div>

      <div className="rounded-xl border border-border-color bg-white p-5">
        <div className="mb-1 flex items-center gap-1.5 text-[14px] font-semibold text-text-primary">
          <ShieldCheck size={16} className="text-brand-blue" /> Verify it&apos;s you
        </div>
        <p className="mb-4 text-[12.5px] text-text-muted">We&apos;ll send you a 6-digit code. It&apos;s valid for 5 minutes.</p>

        <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-text-primary">
          Send my code by <FieldHint k="cust.otpChannel" value={JSON.stringify(channel)} />
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <ChannelOption
            active={channel === "SMS"}
            disabled={sentAt != null}
            onClick={() => setChannel("SMS")}
            icon={<Smartphone size={16} />}
            title="SMS"
            sub={maskMobile(mobile)}
            testId="channel-sms"
          />
          <ChannelOption
            active={channel === "EMAIL"}
            disabled={sentAt != null}
            onClick={() => setChannel("EMAIL")}
            icon={<Mail size={16} />}
            title="Email"
            sub={maskEmail(email)}
            testId="channel-email"
          />
        </div>

        {sentAt == null ? (
          <button
            onClick={sendCode}
            className="w-full rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
            data-testid="send-otp"
          >
            Send code
          </button>
        ) : (
          <div>
            <div className="mb-2 text-[12.5px] text-text-secondary">
              Code sent by {channel === "SMS" ? "SMS" : "email"} to <strong>{destination}</strong>.
            </div>
            <div className="flex items-center gap-2">
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && otp.length === 6 && submit()}
                inputMode="numeric"
                autoFocus
                disabled={locked}
                placeholder="••••••"
                className="w-full rounded-lg border border-border-color px-3 py-2.5 text-center font-mono text-lg tracking-[0.5em] outline-none focus:border-brand-blue disabled:bg-page-bg"
                data-testid="otp-input"
              />
              <FieldHint k="cust.otp" />
              <button
                onClick={submit}
                disabled={otp.length !== 6 || locked}
                className="shrink-0 rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="otp-submit"
              >
                Submit
              </button>
            </div>
            {error && (
              <div className="mt-2 flex items-center gap-1.5 text-[12.5px] text-status-expired" data-testid="otp-error">
                <AlertCircle size={13} /> {error}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between text-[12px] text-text-muted">
              <span>
                {resendIn > 0 ? (
                  `Didn't get it? You can resend in ${resendIn}s`
                ) : (
                  <button onClick={sendCode} className="font-semibold text-brand-blue">
                    Resend code
                  </button>
                )}
                {" · "}
                <button
                  onClick={() => {
                    setSentAt(null);
                    setOtp("");
                    setError("");
                  }}
                  className="font-semibold text-brand-blue"
                >
                  Use a different option
                </button>
              </span>
              <span className="rounded bg-page-bg px-2 py-0.5 text-[11px]">Prototype: use 123456</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 text-center text-[11px] text-text-muted">
        Direct Debit collections are processed through the UAE Direct Debit System (DDS) under Geidea Payment LLC.
      </div>
    </div>
  );
}

function Detail({ label, value, hint }: { label: string; value: string; hint?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[11.5px] text-text-muted">
        {label} {hint}
      </div>
      <div className="font-medium text-text-primary">{value}</div>
    </div>
  );
}

function ChannelOption({
  active,
  disabled,
  onClick,
  icon,
  title,
  sub,
  testId,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors",
        active ? "border-brand-blue bg-brand-blue/5" : "border-border-color bg-white",
        disabled && !active && "opacity-50"
      )}
      data-testid={testId}
    >
      <span
        className={clsx(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px]",
          active ? "border-brand-blue" : "border-border-color"
        )}
      >
        {active && <span className="h-[9px] w-[9px] rounded-full bg-brand-blue" />}
      </span>
      <span className={active ? "text-brand-blue" : "text-text-muted"}>{icon}</span>
      <span>
        <span className="block text-[13px] font-semibold text-text-primary">{title}</span>
        <span className="block font-mono text-[12px] text-text-muted">{sub}</span>
      </span>
    </button>
  );
}
