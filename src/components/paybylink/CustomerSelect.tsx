"use client";

import { useState } from "react";
import { Search, MoreVertical, X } from "lucide-react";
import clsx from "clsx";
import { DummyCustomer } from "@/lib/mock-data";

export default function CustomerSelect({
  customers,
  selected,
  onSelect,
  onCreate,
}: {
  customers: DummyCustomer[];
  selected: DummyCustomer | null;
  onSelect: (c: DummyCustomer | null) => void;
  onCreate: (c: DummyCustomer) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const results = customers.filter((c) =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(query.toLowerCase())
  );

  if (selected) {
    return (
      <div className="relative rounded-lg border border-border-color px-4 py-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-semibold text-text-primary">
              {selected.firstName} {selected.lastName}
            </div>
            <div className="text-sm text-text-secondary">
              {selected.email ?? selected.phone}
            </div>
          </div>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-text-muted hover:text-text-primary"
          >
            <MoreVertical size={16} />
          </button>
        </div>
        {menuOpen && (
          <div className="absolute right-2 top-10 z-20 w-32 rounded-xl border border-border-color bg-white p-1 shadow-lg">
            <button
              onClick={() => {
                onSelect(null);
                setMenuOpen(false);
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-text-primary hover:bg-page-bg"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Find or add a customer"
          className="w-full rounded-lg border border-border-color bg-page-bg px-3 py-2.5 text-sm outline-none"
        />
        <Search
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-border-color bg-white p-1 shadow-lg">
          <button
            onClick={() => {
              setCreateOpen(true);
              setOpen(false);
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-brand-blue hover:bg-page-bg"
          >
            + Add New Customer
          </button>
          {results.length > 0 && (
            <div className="mt-1 border-t border-border-color pt-1">
              {results.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onSelect(c);
                    setOpen(false);
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-page-bg"
                >
                  <div className="font-medium text-text-primary">
                    {c.firstName} {c.lastName}
                  </div>
                  <div className="text-xs text-text-muted">
                    {c.email ?? c.phone}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <CreateCustomerModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(c) => {
          onCreate(c);
          setCreateOpen(false);
        }}
      />
    </div>
  );
}

function CreateCustomerModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (c: DummyCustomer) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contactMethod, setContactMethod] = useState<"email" | "phone">(
    "email"
  );
  const [contactValue, setContactValue] = useState("");
  const [addressTypes, setAddressTypes] = useState<Set<string>>(new Set());

  if (!open) return null;

  const toggleAddress = (key: string) => {
    setAddressTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const canCreate = firstName.trim().length > 0 && contactValue.trim().length > 0;

  const handleCreate = () => {
    if (!canCreate) return;
    const id = `cu-${Date.now()}`;
    onCreate({
      id,
      firstName,
      lastName,
      email: contactMethod === "email" ? contactValue : undefined,
      phone: contactMethod === "phone" ? contactValue : undefined,
    });
    setFirstName("");
    setLastName("");
    setContactValue("");
    setAddressTypes(new Set());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-start justify-between">
          <h3 className="text-xl font-bold text-text-primary">
            Create Customer
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <div className="mb-5">
          <div className="mb-2 text-sm font-semibold text-text-primary">
            Customer details
          </div>
          <div className="flex gap-3">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First Name"
              className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last Name"
              className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
            />
          </div>
        </div>

        <div className="mb-5">
          <div className="mb-2 text-sm font-semibold text-text-primary">
            Contact method
          </div>
          <div className="mb-3 flex gap-2">
            {(["email", "phone"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setContactMethod(m);
                  setContactValue("");
                }}
                className={clsx(
                  "rounded-full border px-4 py-2 text-sm font-medium",
                  contactMethod === m
                    ? "border-brand-blue bg-brand-blue/5 text-brand-blue"
                    : "border-border-color text-text-primary"
                )}
              >
                {m === "email" ? "Email address" : "Phone number"}
              </button>
            ))}
          </div>
          <input
            value={contactValue}
            onChange={(e) => setContactValue(e.target.value)}
            placeholder={contactMethod === "email" ? "Email" : "Phone"}
            className="w-full rounded-lg border border-border-color px-3 py-2.5 text-sm outline-none"
          />
        </div>

        <div className="mb-8">
          <div className="mb-2 text-sm font-semibold text-text-primary">
            Customer address (Optional)
          </div>
          <div className="flex gap-2">
            {["Shipping address", "Billing address"].map((label) => (
              <button
                key={label}
                onClick={() => toggleAddress(label)}
                className={clsx(
                  "rounded-full border px-4 py-2 text-sm font-medium",
                  addressTypes.has(label)
                    ? "border-brand-blue bg-brand-blue/5 text-brand-blue"
                    : "border-border-color text-text-primary"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            className="text-sm font-medium text-text-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
