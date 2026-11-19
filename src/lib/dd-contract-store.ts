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
  if (missing.length === 0) {
    applyCancellationOverlays();
    return;
  }
  // newest first, matching unshift() on create
  missing.sort((a, b) => b.id.localeCompare(a.id));
  directDebitContracts.unshift(...missing);
  applyCancellationOverlays();
}


// ---- Cancellation overlay (15-Oct-2026, S8 / US-40 / US-41) ----
// The customer's cancellation page opens in a NEW TAB, which starts with fresh memory — so the
// cancellation (and what it changes on the contract) is written to this browser for EVERY
// contract, demo records included, and applied on lookup. Newer writes win (`v`).
const CX_KEY = "mpr:dd-cancellations:v1";
type CxOverlay = Pick<DirectDebitContract, "cancellation" | "status" | "subscriptionStatus" | "statusNote" | "occurrences" | "activity"> & { v: number };
const appliedV: Record<string, number> = {};

function readCx(): Record<string, CxOverlay> {
  try {
    const raw = window.localStorage.getItem(CX_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CxOverlay>) : {};
  } catch {
    return {};
  }
}

/** Save the contract's cancellation state (any contract). */
export function saveCancellationOverlay(c: DirectDebitContract) {
  try {
    const all = readCx();
    const v = Date.now();
    all[c.id] = { cancellation: c.cancellation, status: c.status, subscriptionStatus: c.subscriptionStatus, statusNote: c.statusNote, occurrences: c.occurrences, activity: c.activity, v };
    appliedV[c.id] = v;
    window.localStorage.setItem(CX_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable — this tab still works */
  }
}

export function applyCancellationOverlays() {
  const all = readCx();
  for (const [id, o] of Object.entries(all)) {
    if ((appliedV[id] ?? 0) >= o.v) continue;
    const c = directDebitContracts.find((x) => x.id === id);
    if (!c) continue;
    Object.assign(c, { cancellation: o.cancellation, status: o.status, subscriptionStatus: o.subscriptionStatus, statusNote: o.statusNote, occurrences: o.occurrences, activity: o.activity });
    appliedV[id] = o.v;
  }
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

// ---- Reset test data (19-Nov-2026) ----
// Everything the prototype keeps in this browser lives under "mpr:dd-" keys. Test data = the
// contracts created here and the cancellation state saved for any contract (demo ones too).
// Settings = PGW Config in MA, DD BE Config, the prototype role and the Dev hints switch.
// Actions on demo contracts (pause, retry, amend, discard…) only live in memory, so the reload
// that follows the reset brings every demo contract back exactly as defined in mock-data.ts,
// re-dated against today.
const TEST_DATA_KEYS = [KEY, CX_KEY];
const DD_KEY_PREFIX = "mpr:dd-";

/** What a reset would clear in this browser — shown in the confirmation dialog. */
export function testDataSummary(): { created: number; cancellations: number; settings: number } {
  try {
    const settings = Object.keys(window.localStorage).filter(
      (k) => k.startsWith(DD_KEY_PREFIX) && !TEST_DATA_KEYS.includes(k)
    ).length;
    return { created: Object.keys(readAll()).length, cancellations: Object.keys(readCx()).length, settings };
  } catch {
    return { created: 0, cancellations: 0, settings: 0 };
  }
}

/** Clears this browser's Direct Debit test data (and, if asked, its settings), then reloads the
 *  Contract List so the demo contracts start fresh. */
export function resetTestData(includeSettings: boolean) {
  try {
    const keys = includeSettings
      ? Object.keys(window.localStorage).filter((k) => k.startsWith(DD_KEY_PREFIX))
      : TEST_DATA_KEYS;
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* storage unavailable — nothing was saved, the reload still resets memory */
  }
  // Full page load (not router.push): only a fresh load rebuilds the demo contracts from mock-data.ts.
  window.location.assign(new URL("/direct-debit", window.location.origin).href);
}
