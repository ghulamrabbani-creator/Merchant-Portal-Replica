"use client";

import { useState } from "react";
import { X, ChevronDown } from "lucide-react";

export interface LineItem {
  id: string;
  name: string;
  price: number;
  sku: string;
  vatPercent: number;
  vatAmount: number;
  discountValue: number;
  discountType: "Percentage" | "Flat";
}

export default function AddItemModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (item: LineItem) => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [sku, setSku] = useState("");
  const [vatPercent, setVatPercent] = useState(5);
  const [discountValue, setDiscountValue] = useState("");
  const [discountType, setDiscountType] = useState<"Percentage" | "Flat">(
    "Percentage"
  );

  if (!open) return null;

  const priceNum = parseFloat(price) || 0;
  const vatAmount = (priceNum * vatPercent) / 100;
  const canSave = name.trim().length > 0 && priceNum > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: `item-${Date.now()}`,
      name,
      price: priceNum,
      sku,
      vatPercent,
      vatAmount,
      discountValue: parseFloat(discountValue) || 0,
      discountType,
    });
    setName("");
    setPrice("");
    setSku("");
    setDiscountValue("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-start justify-between">
          <h3 className="text-xl font-bold text-text-primary">Add Item</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <div className="mb-5">
          <div className="mb-2 text-sm font-semibold text-text-primary">
            Item Details
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Item Name"
            className="mb-3 w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
          />
          <div className="flex gap-3">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              placeholder="Item Price"
              className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
            />
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="SKU"
              className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
            />
          </div>
        </div>

        <div className="mb-5">
          <div className="mb-2 text-sm font-semibold text-text-primary">
            Item VAT
          </div>
          <div className="flex gap-3">
            <div className="relative w-full">
              <select
                value={vatPercent}
                onChange={(e) => setVatPercent(parseFloat(e.target.value))}
                className="w-full appearance-none rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
              >
                <option value={5}>Standard VAT - 5% VAT</option>
                <option value={0}>Zero rated - 0% VAT</option>
                <option value={15}>Custom - 15% VAT</option>
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
            </div>
            <input
              readOnly
              value={vatAmount ? vatAmount.toFixed(2) : ""}
              placeholder="VAT Amount"
              className="w-full rounded-lg border border-border-color bg-page-bg px-3 py-2.5 text-sm outline-none"
            />
          </div>
        </div>

        <div className="mb-8">
          <div className="mb-2 text-sm font-semibold text-text-primary">
            Item Discount
          </div>
          <input
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            type="number"
            placeholder="Value"
            className="mb-3 w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
          />
          <div className="relative">
            <select
              value={discountType}
              onChange={(e) =>
                setDiscountType(e.target.value as "Percentage" | "Flat")
              }
              className="w-full appearance-none rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
            >
              <option value="Percentage">Percentage</option>
              <option value="Flat">Flat</option>
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button onClick={onClose} className="text-sm font-medium text-text-secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
