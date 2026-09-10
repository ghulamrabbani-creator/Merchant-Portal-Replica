"use client";

// Direct Debit merchant/BE configuration store (added Sep 2026, Rabbani) — backs the "PGW
// Config in MA" and "DD BE Config" screens reachable from the ChangeLogBar. State lives in a
// React Context at the root layout so a change here (Sidebar visibility, Credit Card
// availability, the Bulk Upload button) takes effect immediately across the app without
// prop-drilling.
//
// Persistence (added 10-Sep-2026, Rabbani): unlike the rest of this prototype's in-memory-only
// mutations (directDebitContracts, etc.), this config is mirrored to localStorage so a demo
// survives a browser refresh or a new tab on the same origin — a "Reset to defaults" link in
// each modal clears it on demand, so a demo never gets stuck on a stray config. This is a real
// deployed Next.js app (not an in-conversation artifact), so localStorage is the appropriate
// tool here.
//
// Implementation note: this is built on useSyncExternalStore (below), NOT useState + a
// useEffect that reads localStorage on mount. Two reasons:
//   - SSR safety: Next.js renders this "use client" component's initial HTML on the server,
//     where localStorage doesn't exist. useSyncExternalStore's getServerSnapshot argument
//     handles that automatically (React calls it during SSR and initial hydration, then
//     switches to the real getSnapshot) — no manual "hydrated" flag or mount-effect race to get
//     wrong.
//   - An effect that calls setState to hydrate from an external source is exactly the pattern
//     react-hooks/set-state-in-effect flags as risky (cascading renders); useSyncExternalStore
//     is React's own recommended replacement for "read from an external system" cases like this.
//
// Plaintext storage note: DD BE Config's password and encryption key end up in the browser's
// localStorage in plaintext. Acceptable for a dev-reference tool per this repo's own framing
// (see changelog.ts), but flagged explicitly rather than left implicit.
//
// Scope note: OIC selection (Geidea OIC vs Merchant OIC) is captured here for completeness but
// deliberately NOT wired to any visible behavior — there's no way to represent "which OIC a
// contract settles under" anywhere else in this prototype yet, so it's config-only for now.

import { createContext, useContext, useSyncExternalStore, ReactNode } from "react";

export type DDOICMode = "geidea" | "merchant";

export interface DDMerchantOIC {
  oic: string;
  username: string;
  password: string;
}

export interface DDMerchantConfig {
  // Shows/hides the Direct Debit item in the Sidebar's menu pane.
  featureEnabled: boolean;
  // Which OIC (and whose DDS API credentials) this merchant's contracts authenticate under.
  // "geidea" (default) uses the credentials in DDBackendConfig below; "merchant" uses merchantOIC.
  oicMode: DDOICMode;
  merchantOIC: DDMerchantOIC;
  // Off by default — Credit Card is selectable. On: removed from both the merchant's contract
  // creation instrument picker and the customer's TBFC instrument step.
  disableCreditCard: boolean;
  // Off by default. On: adds a "Bulk Upload" button next to "+ Add Contract" on the Direct
  // Debit summary screen. Bulk Contract Creation itself isn't built yet — the button opens a
  // coming-soon placeholder, same pattern as the Cancel-mandate placeholder on Contract Detail.
  enableBulkUpload: boolean;
  // Ceiling on a single contract's max_amount for this merchant. Merchant-editable, unlike the
  // rest of this config which mostly toggles — kept as its own explicit Save in the UI.
  maxContractAmount: number;
}

export interface DDBackendConfig {
  // API authentication between Geidea and DDS. Tied to OIC — this pair is used when
  // oicMode === "geidea"; a Merchant OIC contract would authenticate with merchantOIC's own
  // username/password instead (captured above, not here).
  username: string;
  password: string;
  // Used to encrypt the card number sent in the DDS contract-creation API. Generic — applies to
  // Credit Card contract creation regardless of which OIC the contract settles under.
  cardEncryptionPublicKey: string;
}

export const DEFAULT_MERCHANT_CONFIG: DDMerchantConfig = {
  featureEnabled: true,
  oicMode: "geidea",
  merchantOIC: { oic: "", username: "", password: "" },
  disableCreditCard: false,
  enableBulkUpload: false,
  maxContractAmount: 100_000_000,
};

export const DEFAULT_BE_CONFIG: DDBackendConfig = {
  username: "geidea_dd_svc",
  password: "Sup3rSecret!DDS",
  cardEncryptionPublicKey:
    "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1c7...(sample)\n-----END PUBLIC KEY-----",
};

// localStorage keys — versioned so a future shape change can be detected/ignored rather than
// crash-parsed, by bumping the suffix.
const STORAGE_KEY = "mpr:dd-merchant-config:v1";
const STORAGE_KEY_BE = "mpr:dd-be-config:v1";

/**
 * A tiny localStorage-backed external store, shaped for useSyncExternalStore. One instance per
 * config object (merchant / backend) — this repo only ever mounts one DDConfigProvider (at the
 * root layout), so module-level singletons are fine here rather than plumbing store instances
 * through context creation.
 */
function createLocalStorageStore<T extends object>(key: string, defaultValue: T) {
  // `cache` is what getSnapshot returns: it must be a stable reference across calls unless the
  // value actually changed, or useSyncExternalStore will think the store is changing every
  // render. Starts as defaultValue (matches getServerSnapshot / the SSR-rendered markup) and is
  // only replaced wholesale by set()/reset() or the one-time client read below.
  let cache: T = defaultValue;
  let hasReadClient = false;
  const listeners = new Set<() => void>();

  function readFromStorage(): T {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return defaultValue;
      const parsed = JSON.parse(raw);
      // Shallow-merge over the default so a field added in a later round (not present in an
      // older saved blob) still gets its default rather than `undefined`.
      return { ...defaultValue, ...parsed };
    } catch {
      return defaultValue;
    }
  }

  function getSnapshot(): T {
    // First client-side read pulls in whatever was persisted, once; after that, cache only
    // changes via set()/reset() below, so this stays a plain field read on every later call.
    if (!hasReadClient) {
      cache = readFromStorage();
      hasReadClient = true;
    }
    return cache;
  }

  function getServerSnapshot(): T {
    return defaultValue;
  }

  function subscribe(callback: () => void) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  function set(next: T) {
    cache = next;
    hasReadClient = true;
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage disabled/full — the in-memory cache above still serves the rest of this
      // session, it just won't survive a refresh. Not worth surfacing as an error in what's a
      // dev-reference tool.
    }
    listeners.forEach((listener) => listener());
  }

  function reset() {
    set(defaultValue);
  }

  return { getSnapshot, getServerSnapshot, subscribe, set, reset };
}

const merchantStore = createLocalStorageStore(STORAGE_KEY, DEFAULT_MERCHANT_CONFIG);
const beStore = createLocalStorageStore(STORAGE_KEY_BE, DEFAULT_BE_CONFIG);

interface DDConfigContextValue {
  config: DDMerchantConfig;
  setConfig: (patch: Partial<DDMerchantConfig>) => void;
  setMerchantOIC: (patch: Partial<DDMerchantOIC>) => void;
  resetMerchantConfig: () => void;
  beConfig: DDBackendConfig;
  setBeConfig: (patch: Partial<DDBackendConfig>) => void;
  resetBeConfig: () => void;
}

const DDConfigContext = createContext<DDConfigContextValue | null>(null);

export function DDConfigProvider({ children }: { children: ReactNode }) {
  const config = useSyncExternalStore(
    merchantStore.subscribe,
    merchantStore.getSnapshot,
    merchantStore.getServerSnapshot,
  );
  const beConfig = useSyncExternalStore(beStore.subscribe, beStore.getSnapshot, beStore.getServerSnapshot);

  function setConfig(patch: Partial<DDMerchantConfig>) {
    merchantStore.set({ ...merchantStore.getSnapshot(), ...patch });
  }

  function setMerchantOIC(patch: Partial<DDMerchantOIC>) {
    const prev = merchantStore.getSnapshot();
    merchantStore.set({ ...prev, merchantOIC: { ...prev.merchantOIC, ...patch } });
  }

  function resetMerchantConfig() {
    merchantStore.reset();
  }

  function setBeConfig(patch: Partial<DDBackendConfig>) {
    beStore.set({ ...beStore.getSnapshot(), ...patch });
  }

  function resetBeConfig() {
    beStore.reset();
  }

  return (
    <DDConfigContext.Provider
      value={{
        config,
        setConfig,
        setMerchantOIC,
        resetMerchantConfig,
        beConfig,
        setBeConfig,
        resetBeConfig,
      }}
    >
      {children}
    </DDConfigContext.Provider>
  );
}

export function useDDConfig() {
  const ctx = useContext(DDConfigContext);
  if (!ctx) {
    throw new Error("useDDConfig must be used within a DDConfigProvider (see src/app/layout.tsx)");
  }
  return ctx;
}
