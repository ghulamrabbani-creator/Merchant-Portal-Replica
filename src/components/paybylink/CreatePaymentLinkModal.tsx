"use client";

import { useState } from "react";
import { X, Calendar, ChevronDown, Trash2 } from "lucide-react";
import clsx from "clsx";
import StoreSelect from "./StoreSelect";
import CustomerSelect from "./CustomerSelect";
import AddItemModal, { LineItem } from "./AddItemModal";
import FeeAdjustments, { FeeAdjustment } from "./FeeAdjustments";
import { DummyCustomer, dummyCustomers as initialCustomers } from "@/lib/mock-data";

export default function CreatePaymentLinkModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"quick" | "standard">("quick");
  const [storeId, setStoreId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<DummyCustomer[]>(initialCustomers);
  const [customer, setCustomer] = useState<DummyCustomer | null>(null);
  const [amount, setAmount] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [feesEnabled, setFeesEnabled] = useState(false);
  const [fee, setFee] = useState<FeeAdjustment>({
    label: "",
    type: "Percentage",
    value: "",
  });
  const [confirmingClose, setConfirmingClose] = useState(false);

  if (!open) return null;

  const itemsSubtotal = items.reduce((sum, i) => sum + i.price, 0);
  const itemsVat = items.reduce((sum, i) => sum + i.vatAmount, 0);
  const itemsDiscount = items.reduce((sum, i) => {
    if (i.discountType === "Percentage") return sum + (i.price * i.discountValue) / 100;
    return sum + i.discountValue;
  }, 0);
  const feeValue = feesEnabled ? parseFloat(fee.value) || 0 : 0;
  const feeAmount =
    fee.type === "Percentage" ? (itemsSubtotal * feeValue) / 100 : feeValue;

  const total =
    mode === "quick"
      ? amount
        ? parseFloat(amount) || 0
        : 0
      : itemsSubtotal + itemsVat - itemsDiscount + feeAmount;

  const hasUnsavedData =
    mode === "quick" ? !!amount : items.length > 0 || !!customer;

  const attemptClose = () => {
    if (hasUnsavedData) setConfirmingClose(true);
    else onClose();
  };

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-border-color px-8 py-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-extrabold text-brand-orange">g</span>
          <span className="text-text-muted">|</span>
          <span className="font-semibold text-text-primary">
            Unique Payment Link
          </span>
        </div>
        <button onClick={attemptClose} className="text-text-muted hover:text-text-primary">
          <X size={22} />
        </button>
      </div>

      <div className="grid flex-1 grid-cols-2 overflow-hidden">
        <div className="overflow-y-auto border-r border-border-color px-10 py-8">
          <h2 className="mb-5 text-2xl font-bold text-text-primary">
            Create Payment Link
          </h2>

          <div className="mb-6 flex rounded-xl bg-page-bg p-1">
            <button
              onClick={() => setMode("quick")}
              className={clsx(
                "flex-1 rounded-lg py-2.5 text-sm font-semibold",
                mode === "quick"
                  ? "bg-brand-orange text-white"
                  : "text-text-secondary"
              )}
            >
              Quick link
            </button>
            <button
              onClick={() => setMode("standard")}
              className={clsx(
                "flex-1 rounded-lg py-2.5 text-sm font-semibold",
                mode === "standard"
                  ? "bg-brand-orange text-white"
                  : "text-text-secondary"
              )}
            >
              Standard link
            </button>
          </div>
          <p className="mb-6 text-sm text-text-muted">
            {mode === "quick"
              ? "A transaction created from a single account with no items."
              : "A transaction created with itemized line items and totals."}
          </p>

          <Label>Select store</Label>
          <div className="mb-5">
            <StoreSelect value={storeId} onChange={setStoreId} />
          </div>

          <Label>Customer details</Label>
          <div className="mb-5">
            <CustomerSelect
              customers={customers}
              selected={customer}
              onSelect={setCustomer}
              onCreate={(c) => {
                setCustomers((prev) => [...prev, c]);
                setCustomer(c);
              }}
            />
          </div>

          {mode === "standard" && (
            <>
              <Label>Item details</Label>
              <button
                onClick={() => setAddItemOpen(true)}
                className="mb-3 w-full rounded-lg border border-border-color px-3 py-2.5 text-left text-sm text-text-muted"
              >
                Add new item
              </button>
              {items.length > 0 && (
                <div className="mb-5 flex flex-col gap-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border-color p-3"
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-sm font-medium text-brand-blue">
                          {item.name}
                        </span>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-text-muted hover:text-status-declined"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-text-secondary">
                        <span>VAT {item.vatPercent}%</span>
                        <span>AED {item.vatAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mb-5 flex items-center justify-between">
                <Label noMargin>Fees Adjustments</Label>
                <Toggle checked={feesEnabled} onChange={setFeesEnabled} />
              </div>
              {feesEnabled && <FeeAdjustments fee={fee} onChange={setFee} />}
            </>
          )}

          <Label>
            {mode === "standard" ? "Payment link details" : "Transaction details"}
          </Label>
          {mode === "quick" && (
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              type="number"
              className="mb-3 w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
            />
          )}
          <div className="relative mb-3">
            <input
              readOnly
              value="23 Aug 2026 - 22 Sep 2026"
              className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
            />
            <Calendar
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
          </div>
          <Select placeholder="English" className="mb-3" />
          {mode === "quick" && <Select placeholder="AED" />}
        </div>

        <div className="flex flex-col overflow-y-auto bg-page-bg px-10 py-8">
          <h3 className="mb-4 text-xl font-bold text-text-primary">Preview</h3>
          <div className="rounded-2xl bg-[#eef0fb] p-6">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-text-secondary">
                Payment from Geidea
              </div>
              <div className="mt-1 text-3xl font-bold text-brand-orange">
                AED {total.toFixed(2)}
              </div>
              <div className="mt-4 flex flex-col gap-2 border-t border-border-color pt-4 text-sm">
                <div className="flex justify-between text-text-secondary">
                  <span>Payment link activation date</span>
                  <span className="text-text-primary">23/08/2026</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Payment link expiry date</span>
                  <span className="text-text-primary">22/09/2026</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Creation Date</span>
                  <span className="text-text-primary">23/08/2026</span>
                </div>
                {mode === "standard" && items.length > 0 && (
                  <>
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between border-t border-border-color pt-2 font-semibold text-text-primary"
                      >
                        <span>{item.name}</span>
                        <span>AED {item.price.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-text-secondary">
                      <span>Total Discount</span>
                      <span>- AED {itemsDiscount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-text-secondary">
                      <span>Total VAT</span>
                      <span>AED {itemsVat.toFixed(2)}</span>
                    </div>
                    {feesEnabled && feeAmount > 0 && (
                      <div className="flex justify-between text-text-secondary">
                        <span>{fee.label || "Extra charge"}</span>
                        <span>AED {feeAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between border-t border-border-color pt-2 text-text-secondary">
                  <span>Subtotal</span>
                  <span className="text-text-primary">
                    AED {total.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-text-primary">
                  <span>Total</span>
                  <span>AED {total.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 text-center text-sm text-text-muted">
              Powered by{" "}
              <span className="font-bold text-brand-orange">geidea</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border-color px-8 py-4">
        <button
          onClick={onClose}
          className="rounded-lg border border-brand-blue px-6 py-2.5 text-sm font-semibold text-brand-blue"
        >
          Create link
        </button>
        <button
          onClick={onClose}
          className="rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-hover"
        >
          Create and send
        </button>
      </div>

      <AddItemModal
        open={addItemOpen}
        onClose={() => setAddItemOpen(false)}
        onSave={(item) => {
          setItems((prev) => [...prev, item]);
          setAddItemOpen(false);
        }}
      />

      {confirmingClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-8">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-lg font-bold text-text-primary">
                You&apos;re about to leave this payment link.
              </h3>
              <button onClick={() => setConfirmingClose(false)}>
                <X size={20} className="text-text-muted" />
              </button>
            </div>
            <p className="mb-6 text-sm text-text-secondary">
              The data you entered won&apos;t be saved.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setConfirmingClose(false)}
                className="text-sm font-medium text-text-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmingClose(false);
                  onClose();
                }}
                className="rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Label({
  children,
  noMargin,
}: {
  children: React.ReactNode;
  noMargin?: boolean;
}) {
  return (
    <div
      className={clsx(
        "text-sm font-semibold text-text-primary",
        !noMargin && "mb-2"
      )}
    >
      {children}
    </div>
  );
}

function Select({
  placeholder,
  className,
}: {
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={clsx("relative", className)}>
      <button className="flex w-full items-center justify-between rounded-lg border border-border-color px-3 py-2.5 text-left text-sm text-text-muted">
        {placeholder}
        <ChevronDown size={16} />
      </button>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={clsx(
        "flex h-6 w-11 items-center rounded-full px-0.5 transition-colors",
        checked ? "bg-brand-blue justify-end" : "bg-border-color justify-start"
      )}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow" />
    </button>
  );
}
