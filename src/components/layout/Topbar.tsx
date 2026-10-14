"use client";

import { MessageCircle, ChevronDown, UserCog } from "lucide-react";
import { DD_ROLES, DDRole, useDDConfig } from "@/lib/dd-config-context";
import { useHydrated } from "@/lib/dd-contract-store";

export default function Topbar() {
  const { role, setRole } = useDDConfig();
  const hydrated = useHydrated();
  return (
    <header className="flex h-16 items-center justify-end gap-6 border-b border-border-color bg-white px-8">
      {/* Prototype only (14-Oct-2026): simulates the Merchant Portal role framework so Direct Debit
          actions can be shown per user permission (MP Backlog v2 US-02). Not part of the real UI. */}
      <label
        className="flex items-center gap-2 rounded-lg border border-dashed border-fuchsia-300 bg-fuchsia-50 px-3 py-1.5 text-xs text-fuchsia-800"
        title="Prototype only: simulate the logged-in user's role to see which Direct Debit actions they get"
      >
        <UserCog size={14} />
        Role (prototype)
        <select
          value={hydrated ? role : "admin"}
          onChange={(e) => setRole(e.target.value as DDRole)}
          className="rounded border border-fuchsia-200 bg-white px-1.5 py-0.5 text-xs text-text-primary"
          data-testid="role-switcher"
        >
          {DD_ROLES.map((r) => (
            <option key={r.role} value={r.role}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <button className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary">
        <MessageCircle size={18} strokeWidth={1.8} />
        Need support ?
      </button>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-orange-light text-sm font-semibold text-brand-orange">
          T
        </div>
        <ChevronDown size={16} className="text-text-secondary" />
      </div>
      <button className="text-sm font-medium text-text-secondary hover:text-text-primary">
        العربية
      </button>
    </header>
  );
}
