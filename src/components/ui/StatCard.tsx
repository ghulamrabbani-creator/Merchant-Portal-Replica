export default function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex-1 rounded-xl border border-border-color bg-card-bg px-5 py-4">
      <div className="text-sm text-text-secondary">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-text-primary">
        {value}
      </div>
      <div className="mt-1 text-xs text-text-muted">{sub}</div>
    </div>
  );
}
