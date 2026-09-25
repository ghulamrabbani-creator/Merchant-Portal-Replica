"use client";

// Contracts created in this browser (added 25-Sep-2026).
//
// Why: the customer's review & signing link now opens in a NEW TAB (from the SMS/email preview on
// the Contract submitted page). A new tab starts with fresh JavaScript memory, so a contract that
// only lives in the in-memory `directDebitContracts` array would not exist there (404). Contracts
// created through "Create & Send Contract" are therefore also written to this browser's
// localStorage, and every contract lookup falls back to it. Changes made on the customer pages
// (instrument entered, contract signed) are written back the same way, so the merchant tab sees
// them after a refresh.
//
// Scope: per browser, like the DD config — not shared between devs opening the Vercel link.
// The demo contracts dd1–dd14 still come from mock-data.ts; only created contracts are stored.

import { useSyncExternalStore } from "react";
import { directDebitContracts } from "./mock-data";
import { DirectDebitContract } from "./types";

const KEY = "mpr:dd-created-contracts:v1";

function readAll(): Record<string, DirectDebitContract> {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, DirectDebitContract>) : {};
  } catch {
    return {};
  }
}

/** Persist a created contract (or an update to one) to this browser. */
export function saveCreatedContract(c: DirectDebitContract) {
  try {
    const all = readAll();
    all[c.id] = c;
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage unavailable — the in-memory copy still works in this tab
  }
}

/** Only persists if the contract was created in this browser (demo records stay in memory). */
export function persistIfCreated(c: DirectDebitContract) {
  try {
    if (readAll()[c.id]) saveCreatedContract(c);
  } catch {
    /* ignore */
  }
}

/** Pulls any stored contracts that aren't in the in-memory list yet into it (newest first). */
function hydrateFromStorage() {
  const stored = Object.values(readAll());
  const missing = stored.filter((c) => !directDebitContracts.some((x) => x.id === c.id));
  if (missing.length === 0) return;
  // newest first, matching unshift() on create
  missing.sort((a, b) => b.id.localeCompare(a.id));
  directDebitContracts.unshift(...missing);
}

const noopSubscribe = () => () => {};

/** false during SSR and the first hydration pass, true afterwards — lets pages read
 *  localStorage-backed data without a server/client markup mismatch. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

/** Contract by id — in-memory first, then this browser's stored contracts. `ready` is false until
 *  the client has hydrated (render a loading state, not a 404, until then). */
export function useContract(id: string): { contract: DirectDebitContract | undefined; ready: boolean } {
  const ready = useHydrated();
  if (!ready) return { contract: directDebitContracts.find((c) => c.id === id), ready };
  hydrateFromStorage();
  return { contract: directDebitContracts.find((c) => c.id === id), ready };
}

/** All contracts for the list screen — demo records plus any created in this browser. */
export function useAllContracts(): DirectDebitContract[] {
  const ready = useHydrated();
  if (ready) hydrateFromStorage();
  return directDebitContracts;
}
