export default function StatCard({
  label,
  value,
  sub,
  hint,
}: {
  label: string;
  value: string;
  sub: string;
  /** Optional element shown after the label, e.g. a Dev hints ⓘ icon. */
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex-1 rounded-xl border border-border-color bg-card-bg px-5 py-4">
      <div className="flex items-center gap-1 text-sm text-text-secondary">
        {label}
        {hint}
      </div>
      <div className="mt-1 text-2xl font-semibold text-text-primary">
        {value}
      </div>
      <div className="mt-1 text-xs text-text-muted">{sub}</div>
    </div>
  );
}
