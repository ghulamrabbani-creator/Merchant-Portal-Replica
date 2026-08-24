import clsx from "clsx";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function MetricCard({
  label,
  value,
  suffix,
  changePct,
  active,
  onClick,
}: {
  label: string;
  value: string;
  suffix?: string;
  changePct?: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const positive = (changePct ?? 0) >= 0;
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex-1 rounded-xl border bg-card-bg px-5 py-4 text-left transition-colors",
        active
          ? "border-brand-blue ring-1 ring-brand-blue"
          : "border-border-color hover:border-text-muted"
      )}
    >
      <div className="text-sm text-text-secondary">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-text-primary">
        {value}{" "}
        {suffix && (
          <span className="text-sm font-normal text-text-secondary">
            {suffix}
          </span>
        )}
      </div>
      {changePct !== undefined && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          <span
            className={clsx(
              "flex items-center justify-center rounded-full p-0.5",
              positive
                ? "bg-status-completed/15 text-status-completed"
                : "bg-status-declined/15 text-status-expired"
            )}
          >
            {positive ? (
              <ArrowUpRight size={12} />
            ) : (
              <ArrowDownRight size={12} />
            )}
          </span>
          <span
            className={
              positive ? "text-status-completed" : "text-status-expired"
            }
          >
            {Math.abs(changePct).toFixed(2)}%
          </span>
          <span className="text-text-muted">Last period</span>
        </div>
      )}
    </button>
  );
}
