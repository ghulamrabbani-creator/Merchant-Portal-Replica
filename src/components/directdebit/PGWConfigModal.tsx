"use client";

// "PGW Config in MA" — Direct Debit settings shown inside a replica of the real Backoffice screen
// (Merchants → Impersonate merchant → Payment Gateway → Configuration). Rebuilt 26-Nov-2026
// (Rabbani) on the saved PGW Configuration template + design guide
// (System_Refs/Geidea-Merchant-Portal-Backoffice/pgw-config-template.html and
// pgw-config-ui-design-guide.md): same shell, tokens and components; Direct Debit is a NEW tab
// after "Visa installment Settings" and before "NOTIFICATION Settings".
//
// Behaviour copied from the live screen: edits stay in a draft until "Save changes"; Save is
// diff-gated (disabled when nothing changed); "Discard Changes" returns to the saved values; an
// invalid field blocks Save, gets a red outline and a message, and a red banner says
// "Changes not saved. Fix the highlighted fields." The baseline resets to the saved values after
// every save (the live screen's undo-then-save bug is designed around, per the guide).
//
// Saved values go to DDConfigContext (persisted per browser), which the rest of the Direct Debit
// UI reads: Sidebar (Enable), contract creation and Sign page (Credit Card), summary screen (Bulk
// Upload), lead time and review expiry. The black strip at the top is prototype-only (Reset to
// defaults, Close); everything below it follows the Geidea design.
//
// The 13 existing tabs are listed and clickable so the position of the new tab is clear; their
// fields are not repeated here (they are unchanged by Direct Debit — see the template).

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDDConfig, DDMerchantConfig } from "@/lib/dd-config-context";
import { DD_REFERENCE_CODE } from "@/lib/direct-debit";
import FieldHint from "@/components/directdebit/FieldHint";

const EXISTING_TABS = [
  "Merchant\nDetails", "Gateway\nSettings", "Smart Routing\nSettings", "Tabby\nSettings", "Apple Pay\nSettings",
  "Google Pay\nSettings", "AFT\nSettings", "High Risk\nSettings", "Samsung Pay\nSettings", "TAMARA\nSettings",
  "Visa installment\nSettings", "NOTIFICATION\nSettings", "TEST\nPAYMENTS",
];
const DD_TAB = "Direct Debit\nSettings";
const TABS = (() => {
  const t = EXISTING_TABS.slice();
  t.splice(t.indexOf("NOTIFICATION\nSettings"), 0, DD_TAB);
  return t;
})();

type Draft = {
  featureEnabled: boolean;
  disableCreditCard: boolean;
  enableBulkUpload: boolean;
  contractReviewExpiryDays: string;
  minFirstCollectionLeadWorkingDays: string;
  maxContractAmount: string;
};
type NumKey = "contractReviewExpiryDays" | "minFirstCollectionLeadWorkingDays" | "maxContractAmount";
const LIMITS: Record<NumKey, { min: number; max: number }> = {
  contractReviewExpiryDays: { min: 1, max: 30 },
  minFirstCollectionLeadWorkingDays: { min: 0, max: 30 },
  maxContractAmount: { min: 1, max: 100_000_000 },
};

function toDraft(c: DDMerchantConfig): Draft {
  return {
    featureEnabled: c.featureEnabled,
    disableCreditCard: c.disableCreditCard,
    enableBulkUpload: c.enableBulkUpload,
    contractReviewExpiryDays: String(c.contractReviewExpiryDays),
    minFirstCollectionLeadWorkingDays: String(c.minFirstCollectionLeadWorkingDays),
    maxContractAmount: c.maxContractAmount.toLocaleString("en-US"),
  };
}
const num = (s: string) => Number(s.replace(/,/g, "").trim());

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap');
.gx{--blue:#2F8CFF;--ink:#1f2d3d;--sub:#5f6b7a;--muted:#8a94a3;--line:#e6e9ee;--page:#e4e4e4;--pill:#f3f3f3;--red:#e03a3a;--amber:#9a6a00;--amber-bg:#fff6e0;--toggle-off:#c4c4c4;--orange:#f26a21;
  position:fixed;inset:0;z-index:60;background:var(--page);font-family:Montserrat,"Segoe UI",Arial,sans-serif;color:var(--ink);font-size:13px;overflow:auto}
.gx *{box-sizing:border-box}
.gx .proto{position:sticky;top:0;z-index:4;height:30px;background:#000;color:#f87171;display:flex;align-items:center;justify-content:center;gap:10px;font:500 12px system-ui,sans-serif}
.gx .proto button{background:none;border:none;color:inherit;text-decoration:underline;text-underline-offset:2px;cursor:pointer;font:inherit}
.gx .proto button:hover{color:#fca5a5}.gx .proto .sep{color:rgba(248,113,113,.4)}
.gx .top{position:sticky;top:30px;z-index:3;height:64px;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 24px 0 18px;box-shadow:0 1px 0 #ececec}
.gx .logo{width:22px;height:22px;border-radius:6px;background:var(--orange);color:#fff;font-weight:700;display:grid;place-items:center;font-size:14px}
.gx .tright{display:flex;gap:16px;align-items:center}
.gx .chip{background:#f4f4f4;border-radius:22px;padding:7px 14px;display:flex;align-items:center;gap:10px;font-size:12px;max-width:330px}
.gx .chip b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}.gx .chip .imp{color:var(--blue);font-size:11.5px}
.gx .layout{display:flex}
.gx .side{position:sticky;top:94px;align-self:flex-start;height:calc(100vh - 94px);width:64px;flex:none;background:#fff;display:flex;flex-direction:column;align-items:center;gap:22px;padding-top:22px}
.gx .side svg{width:20px;height:20px;stroke:#4b5563;fill:none;stroke-width:1.6}.gx .side .on svg{stroke:var(--blue)}
.gx .main{flex:1;min-width:0;padding:22px 16px 60px}
.gx .wrap{max-width:968px;margin:0 auto}
.gx .inst{display:flex;justify-content:flex-end;padding-right:24px;margin-bottom:12px}
.gx .inst .box{width:230px}.gx .inst label{display:block;font-size:12.5px;color:var(--muted)}
.gx .inst select{border:none;background:transparent;font:inherit;font-size:13px;color:var(--ink);padding:2px 0;width:100%}
.gx .card{background:#fff;border-radius:6px;padding:0 0 22px}
.gx .tabs{display:flex;align-items:stretch;padding:0 4px;border-bottom:1px solid #f0f0f0}
.gx .arr{width:22px;display:grid;place-items:center;color:#333;font-size:15px;cursor:pointer;user-select:none;background:none;border:none}
.gx .tabstrip{display:flex;overflow:hidden;flex:1;scroll-behavior:smooth}
.gx .tab{flex:none;text-align:center;padding:9px 13px 7px;color:var(--muted);font-size:12.5px;line-height:1.2;border:none;border-bottom:2px solid transparent;cursor:pointer;background:none;font-family:inherit;white-space:pre-line}
.gx .tab.on{color:var(--blue);border-bottom-color:var(--blue)}
.gx .tab .nw{display:inline-block;background:var(--blue);color:#fff;border-radius:6px;font-size:9px;padding:0 5px;margin-left:3px;vertical-align:1px}
.gx .body{padding:14px 28px 0}
.gx .h{font-weight:600;font-size:13.5px;margin:18px 0 2px}
.gx .d{color:var(--sub);font-size:11.5px;line-height:1.45;max-width:560px}
.gx .trow{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding:6px 0}
.gx .trow.plain{align-items:center;padding:9px 0}
.gx .tlabel{font-size:13px;display:flex;align-items:center;gap:6px}
.gx .tstate{display:flex;align-items:center;gap:12px;font-size:12px;flex:none}
.gx .tg{width:46px;height:26px;border-radius:13px;background:var(--toggle-off);position:relative;cursor:pointer;flex:none;border:none;padding:0}
.gx .tg::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:.15s}
.gx .tg.on{background:var(--blue)}.gx .tg.on::after{left:23px}
.gx .tg:focus-visible,.gx .btn:focus-visible,.gx .tab:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
.gx .nest{margin-left:22px}
.gx hr.div{border:none;border-top:1px solid #efefef;margin:16px 0 4px}
.gx .fld{background:var(--pill);border-radius:20px;padding:7px 18px 6px;margin:8px 0;display:flex;align-items:flex-end;gap:10px}
.gx .fld .in{flex:1;min-width:0}
.gx .fld label{display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--muted)}
.gx .fld input{border:none;background:transparent;font:inherit;font-size:13px;width:100%;padding:2px 0;color:var(--ink);outline:none}
.gx .fld .ro{font-size:13px;padding:2px 0;color:var(--muted)}
.gx .fld .unit{font-size:12.5px;color:var(--sub);padding-bottom:3px;white-space:nowrap}
.gx .fld.bad{box-shadow:inset 0 0 0 1.5px var(--red)}
.gx .fld.half{max-width:440px}
.gx .frow{display:flex;justify-content:space-between;gap:10px;margin:-4px 18px 6px;font-size:11px;color:var(--muted)}
.gx .fhalf{max-width:440px}
.gx .ferr{color:var(--red);font-size:11px;margin:-4px 0 4px 18px}
.gx .banner{border-radius:8px;padding:9px 14px;font-size:12px;margin-top:12px;line-height:1.45}
.gx .banner.info{background:#eef5ff;color:#244a75}.gx .banner.warn{background:var(--amber-bg);color:var(--amber)}.gx .banner.err{background:#fdecec;color:var(--red)}
.gx .banner.ok{background:#eaf7ef;color:#1e6b3a}
.gx .acts{display:flex;justify-content:flex-end;gap:12px;margin-top:22px}
.gx .btn{border:none;border-radius:10px;padding:10px 22px;font:inherit;font-weight:500;font-size:13px;cursor:pointer}
.gx .btn.sec{background:#f1f1f1;color:var(--blue)}.gx .btn.pri{background:var(--blue);color:#fff}
.gx .btn:disabled{cursor:not-allowed}.gx .btn.pri:disabled{background:#9cc8ff}.gx .btn.sec:disabled{color:#9cc8ff}
.gx .existing{color:var(--sub);font-size:12.5px;padding:26px 0 6px;line-height:1.6}
.gx .existing b{color:var(--ink);font-weight:600}
.gx .mono{font-family:Consolas,Menlo,monospace}
@media (max-width:760px){.gx .side{display:none}.gx .body{padding:14px 16px 0}.gx .chip{max-width:170px}.gx .chip.user{display:none}.gx .trow{flex-wrap:wrap}}
@media (prefers-reduced-motion:reduce){.gx .tg::after{transition:none}.gx .tabstrip{scroll-behavior:auto}}
`;

function Toggle({ on, onClick, label, testId }: { on: boolean; onClick: () => void; label: string; testId?: string }) {
  return (
    <button type="button" className={`tg${on ? " on" : ""}`} onClick={onClick} role="switch" aria-checked={on} aria-label={label} data-testid={testId} />
  );
}

function PlainToggle({ label, on, onClick, hint, hintValue, testId }: {
  label: string; on: boolean; onClick: () => void; hint?: Parameters<typeof FieldHint>[0]["k"]; hintValue?: string; testId?: string;
}) {
  return (
    <div className="trow plain">
      <span className="tlabel">{label}{hint && <FieldHint k={hint} value={hintValue} />}</span>
      <Toggle on={on} onClick={onClick} label={label} testId={testId} />
    </div>
  );
}

function NumField({ label, value, onChange, unit, prefix, hint, hintKey, hintValue, error, testId }: {
  label: string; value: string; onChange: (v: string) => void; unit?: string; prefix?: string; hint: string;
  hintKey: Parameters<typeof FieldHint>[0]["k"]; hintValue: string; error?: string; testId?: string;
}) {
  return (
    <div className="fhalf">
      <div className={`fld${error ? " bad" : ""}`}>
        {prefix && <span className="unit">{prefix}</span>}
        <div className="in">
          <label>{label}<FieldHint k={hintKey} value={hintValue} /></label>
          <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="numeric" aria-invalid={!!error} aria-label={label} data-testid={testId} />
        </div>
        {unit && <span className="unit">{unit}</span>}
      </div>
      {error && <div className="ferr" role="alert">{error}</div>}
      <div className="frow"><span>{hint}</span></div>
    </div>
  );
}

export default function PGWConfigModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Bumped on "Reset to defaults" so the screen remounts and re-seeds its draft from the defaults.
  const [resetKey, setResetKey] = useState(0);
  if (!open || typeof document === "undefined") return null;
  return <ConfigScreen key={resetKey} onClose={onClose} onReset={() => setResetKey((k) => k + 1)} wasReset={resetKey > 0} />;
}

function ConfigScreen({ onClose, onReset, wasReset }: { onClose: () => void; onReset: () => void; wasReset: boolean }) {
  const { config, setConfig, resetMerchantConfig } = useDDConfig();
  const saved = useMemo(() => toDraft(config), [config]);
  // Mounted only while open (see ChangeLogBar), so this seeds from the hydrated, persisted value.
  const [draft, setDraft] = useState<Draft>(saved);
  const [active, setActive] = useState(TABS.indexOf(DD_TAB));
  const [tried, setTried] = useState(false);
  const [notice, setNotice] = useState<"" | "saved" | "reset">(wasReset ? "reset" : "");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const errors = useMemo(() => {
    const e: Partial<Record<NumKey, string>> = {};
    (Object.keys(LIMITS) as NumKey[]).forEach((k) => {
      const n = num(draft[k]); const { min, max } = LIMITS[k];
      if (draft[k].trim() === "" || Number.isNaN(n) || !Number.isInteger(n) || n < min || n > max)
        e[k] = `Enter a whole number between ${min.toLocaleString("en-US")} and ${max.toLocaleString("en-US")}.`;
    });
    return e;
  }, [draft]);
  const dirty = (Object.keys(draft) as (keyof Draft)[]).some((k) =>
    typeof draft[k] === "string" ? num(draft[k] as string) !== num(saved[k] as string) || Number.isNaN(num(draft[k] as string)) : draft[k] !== saved[k]);
  const hasErr = Object.keys(errors).length > 0;
  const showErr = (k: NumKey) => (tried || draft[k] !== saved[k]) && draft.featureEnabled ? errors[k] : undefined;

  function set<K extends keyof Draft>(k: K, v: Draft[K]) { setDraft((d) => ({ ...d, [k]: v })); setNotice(""); }
  function save() {
    setTried(true);
    if (hasErr && draft.featureEnabled) return;
    const patch: Partial<DDMerchantConfig> = {
      featureEnabled: draft.featureEnabled,
      disableCreditCard: draft.disableCreditCard,
      enableBulkUpload: draft.enableBulkUpload,
    };
    if (!hasErr) {
      patch.contractReviewExpiryDays = num(draft.contractReviewExpiryDays);
      patch.minFirstCollectionLeadWorkingDays = num(draft.minFirstCollectionLeadWorkingDays);
      patch.maxContractAmount = num(draft.maxContractAmount);
    }
    setConfig(patch);
    // New baseline = what was just saved (avoids the live screen's undo-then-save bug).
    setDraft((d) => ({ ...d, maxContractAmount: hasErr ? d.maxContractAmount : num(d.maxContractAmount).toLocaleString("en-US") }));
    setTried(false);
    setNotice("saved");
  }
  function discard() { setDraft(saved); setTried(false); setNotice(""); }
  function reset() { resetMerchantConfig(); onReset(); }

  const onDD = TABS[active] === DD_TAB;

  return createPortal(
    <div className="gx" role="dialog" aria-modal="true" aria-label="PGW Configuration (prototype)" data-testid="pgw-config-screen">
      <style>{CSS}</style>
      <div className="proto">
        <span>Prototype · PGW Config in MA (Backoffice → Payment Gateway → Configuration)</span>
        <span className="sep">|</span>
        <button type="button" onClick={reset} data-testid="pgw-config-reset">Reset to defaults</button>
        <span className="sep">|</span>
        <button type="button" onClick={onClose} data-testid="pgw-config-close">Close</button>
      </div>
      <div className="top">
        <div className="logo">g</div>
        <div className="tright">
          <div className="chip">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.6"><path d="M3 9l2-5h14l2 5M4 9v11h16V9M4 9h16" /></svg>
            <div style={{ minWidth: 0 }}><b>B00000000001 - Test Merchant</b><div className="imp">Impersonating</div></div>
          </div>
          <div className="chip user">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.6"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 5-6 8-6s7 2 8 6" /></svg>
            <div><b>test.user@example.com</b><div style={{ fontSize: 11 }}>System Administrator</div></div>
          </div>
        </div>
      </div>
      <div className="layout">
        <nav className="side" aria-hidden="true">
          <div className="on"><svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z" /></svg></div>
          <div><svg viewBox="0 0 24 24"><path d="M3 4h2l2 11h11l2-8H7" /><circle cx="9" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></svg></div>
          <div><svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 11h8" /></svg></div>
          <div><svg viewBox="0 0 24 24"><path d="M3 13l3-8h12l3 8v6H3z" /><path d="M3 13h5l1 2h6l1-2h5" /></svg></div>
          <div><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3" /><path d="M6 18c2-2 4-3 6-3s4 1 6 3" /></svg></div>
          <div><svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6z" /><path d="M10 10h4M12 8v6" /></svg></div>
          <div><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1" /><path d="M3 6l9 7 9-7" /></svg></div>
        </nav>
        <main className="main">
          <div className="wrap">
            <div className="inst"><div className="box"><label htmlFor="gx-inst">gateway_Instance</label>
              <select id="gx-inst" defaultValue="Live instance"><option>Live instance</option><option>Test instance</option></select></div></div>
            <div className="card">
              <div className="tabs">
                <button type="button" className="arr" aria-label="Scroll tabs left" onClick={() => document.getElementById("gx-strip")?.scrollBy({ left: -300 })}>‹</button>
                <div className="tabstrip" id="gx-strip" role="tablist"
                  ref={(el) => { if (el && !el.dataset.init) { el.dataset.init = "1"; const t = el.querySelector<HTMLElement>(".tab.on"); if (t) el.scrollLeft = t.offsetLeft - el.clientWidth + t.offsetWidth + 160; } }}>
                  {TABS.map((t, i) => {
                    const [a, b] = t.split("\n");
                    return (
                      <button type="button" key={t} role="tab" aria-selected={i === active} className={`tab${i === active ? " on" : ""}`} onClick={() => setActive(i)} data-testid={t === DD_TAB ? "tab-dd" : undefined}>
                        {a}{t === DD_TAB && <span className="nw">NEW</span>}{"\n"}{b}
                      </button>
                    );
                  })}
                </div>
                <button type="button" className="arr" aria-label="Scroll tabs right" onClick={() => document.getElementById("gx-strip")?.scrollBy({ left: 300 })}>›</button>
              </div>

              <div className="body">
                {!onDD ? (
                  <div className="existing">
                    <b>{TABS[active].replace("\n", " ")}</b> is an existing tab. Direct Debit does not change it, so its fields are not repeated in this prototype.
                    <br />Open the <b>Direct Debit Settings</b> tab to see the new settings.
                  </div>
                ) : (
                  <>

                    <div className="trow">
                      <div>
                        <div className="h" style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                          Direct Debit<FieldHint k="cfg.enable" value={`enable_direct_debit = ${draft.featureEnabled}`} />
                        </div>
                        <div className="d">Lets this merchant collect recurring bank-account debits under a DDS contract from the Merchant Portal. Shows Direct Debit in the portal menu. Available when the Direct Debit product is assigned to the MID in MA.</div>
                      </div>
                      <div className="tstate" style={{ marginTop: 14 }}>
                        <span>{draft.featureEnabled ? "ENABLED" : "Disabled"}</span>
                        <Toggle on={draft.featureEnabled} onClick={() => set("featureEnabled", !draft.featureEnabled)} label="Direct Debit" testId="cfg-enable" />
                      </div>
                    </div>

                    {draft.featureEnabled && (
                      <div className="nest">
                        <div className="fhalf">
                          <div className="fld"><div className="in">
                            <label>Reference code<FieldHint k="cfg.enable" value={`dd_reference_code = ${DD_REFERENCE_CODE}`} /></label>
                            <div className="ro mono" data-testid="cfg-ref-code">{DD_REFERENCE_CODE}</div>
                          </div></div>
                          <div className="frow"><span>Set by the DD Backend. Put in front of every merchant reference, e.g. {DD_REFERENCE_CODE}-UNIT304.</span></div>
                        </div>
                        <div className="fhalf">
                          <div className="fld"><div className="in">
                            <label>OIC<FieldHint k="cfg.oic" value="oic_id = 569000143 (Geidea)" /></label>
                            <div className="ro" data-testid="oic-readonly">Geidea OIC (569000143)</div>
                          </div></div>
                          <div className="frow"><span>Only option in the MVP. Merchant OIC is Phase 2.</span></div>
                        </div>

                        <hr className="div" />
                        <div className="h">Instrument</div>
                        <PlainToggle label="Disable Credit Card Instrument" on={draft.disableCreditCard} onClick={() => set("disableCreditCard", !draft.disableCreditCard)}
                          hint="cfg.disableCC" hintValue={`disable_credit_card_instrument = ${draft.disableCreditCard}`} testId="cfg-disable-cc" />
                        {draft.disableCreditCard && <div className="banner warn">Credit Card is removed from contract creation and from the customer&apos;s instrument step. Bank Account only.</div>}

                        <hr className="div" />
                        <div className="h">Contract creation</div>
                        <PlainToggle label="Enable Bulk Contract Upload" on={draft.enableBulkUpload} onClick={() => set("enableBulkUpload", !draft.enableBulkUpload)}
                          hint="cfg.bulk" hintValue={`enable_bulk_contract_upload = ${draft.enableBulkUpload}`} testId="cfg-bulk" />
                        <NumField label="Minimum first-collection lead time" unit="Working days" value={draft.minFirstCollectionLeadWorkingDays}
                          onChange={(v) => set("minFirstCollectionLeadWorkingDays", v)} hint="Default 4 · 0–30. Time for bank approval and the 20:00 file cut-off."
                          hintKey="cfg.leadTime" hintValue={`min_first_collection_lead_working_days = ${draft.minFirstCollectionLeadWorkingDays}`}
                          error={showErr("minFirstCollectionLeadWorkingDays")} testId="cfg-lead-time" />
                        <NumField label="Maximum Contract Amount" prefix="AED" value={draft.maxContractAmount}
                          onChange={(v) => set("maxContractAmount", v)} hint="Default 100,000,000 (DDS scheme cap). Set by Risk."
                          hintKey="cfg.maxAmount" hintValue={`max_contract_amount = ${draft.maxContractAmount}`}
                          error={showErr("maxContractAmount")} testId="cfg-max-amount" />

                        <hr className="div" />
                        <div className="h">Customer journey</div>
                        <NumField label="Contract review expiry" unit="Days" value={draft.contractReviewExpiryDays}
                          onChange={(v) => set("contractReviewExpiryDays", v)} hint="Default 7 · 1–30. How long the customer's review and signing link stays valid."
                          hintKey="cfg.reviewExpiry" hintValue={`contract_review_expiry_days = ${draft.contractReviewExpiryDays}`}
                          error={showErr("contractReviewExpiryDays")} testId="cfg-review-expiry" />

                        <div className="banner info">Who may create, resend, discard, pause, amend, retry or bulk-upload is a per-user permission in the Merchant Portal&apos;s roles, not a setting here.</div>
                      </div>
                    )}

                    {notice === "saved" && <div className="banner ok" role="status">Changes saved.</div>}
                    {notice === "reset" && <div className="banner info" role="status">Prototype settings reset to their defaults.</div>}
                    {tried && hasErr && draft.featureEnabled && <div className="banner err" role="alert">Changes not saved. Fix the highlighted fields.</div>}
                    <div className="acts">
                      <button type="button" className="btn sec" onClick={discard} disabled={!dirty} data-testid="cfg-discard">Discard Changes</button>
                      <button type="button" className="btn pri" onClick={save} disabled={!dirty} data-testid="cfg-save">Save changes</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>,
    document.body,
  );
}
