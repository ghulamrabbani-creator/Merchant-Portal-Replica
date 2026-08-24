"use client";

import { useState } from "react";
import { X, CheckCircle2 } from "lucide-react";
import clsx from "clsx";

export default function RefundModal({
  open,
  onClose,
  amount,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  amount: number;
  currency: string;
}) {
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [partialAmount, setPartialAmount] = useState("");
  const [step, setStep] = useState<"form" | "confirm" | "success">("form");

  if (!open) return null;

  const reset = () => {
    setMode("full");
    setPartialAmount("");
    setStep("form");
  };

  const close = () => {
    reset();
    onClose();
  };

  const refundAmount =
    mode === "full" ? amount : parseFloat(partialAmount) || 0;
  const canSubmit =
    mode === "full" || (refundAmount > 0 && refundAmount <= amount);

  if (step === "success") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <CheckCircle2 size={40} className="mx-auto mb-4 text-status-completed" />
          <h3 className="mb-2 text-lg font-bold text-text-primary">
            Refund submitted
          </h3>
          <p className="mb-6 text-sm text-text-secondary">
            {currency} {refundAmount.toFixed(2)} has been refunded
            successfully. Your refund will be processed within 24 hours.
          </p>
          <button
            onClick={close}
            className="w-full rounded-lg bg-brand-blue py-2.5 text-sm font-semibold text-white"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
          <div className="mb-4 flex items-start justify-between">
            <h3 className="text-lg font-bold text-text-primary">
              Refund transactions
            </h3>
            <button onClick={() => setStep("form")} className="text-text-muted hover:text-text-primary">
              <X size={20} />
            </button>
          </div>
          <p className="mb-6 text-sm text-text-secondary">
            Are you sure you want to proceed with this refund of{" "}
            <span className="font-semibold text-text-primary">
              {currency} {refundAmount.toFixed(2)}
            </span>
            ?
          </p>
          <div className="flex justify-end gap-4">
            <button
              onClick={() => setStep("form")}
              className="text-sm font-medium text-text-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => setStep("success")}
              className="rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white"
            >
              Proceed
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-start justify-between">
          <h3 className="text-xl font-bold text-text-primary">
            Refund transactions
          </h3>
          <button onClick={close} className="text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <div className="mb-6 flex flex-col gap-4">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="radio"
              checked={mode === "full"}
              onChange={() => setMode("full")}
              className="h-4 w-4 accent-brand-blue"
            />
            <span className="text-sm text-text-primary">
              Full refund{" "}
              <span className="font-semibold">
                {currency} {amount.toFixed(2)}
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="radio"
              checked={mode === "partial"}
              onChange={() => setMode("partial")}
              className="h-4 w-4 accent-brand-blue"
            />
            <span className="text-sm text-text-primary">Partial refund</span>
          </label>

          {mode === "partial" && (
            <div className="ml-7">
              <input
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                type="number"
                placeholder={`Max ${amount.toFixed(2)}`}
                max={amount}
                className={clsx(
                  "w-full max-w-[220px] rounded-lg border px-3 py-2.5 text-sm outline-none",
                  refundAmount > amount
                    ? "border-status-declined"
                    : "border-border-color"
                )}
              />
              {refundAmount > amount && (
                <p className="mt-1 text-xs text-status-declined">
                  Amount cannot exceed {currency} {amount.toFixed(2)}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-4">
          <button onClick={close} className="text-sm font-medium text-text-secondary">
            Cancel
          </button>
          <button
            onClick={() => canSubmit && refundAmount > 0 && setStep("confirm")}
            disabled={!canSubmit || refundAmount <= 0}
            className="rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
