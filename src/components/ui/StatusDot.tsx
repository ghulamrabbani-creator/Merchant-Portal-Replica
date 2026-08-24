import clsx from "clsx";

const colorMap: Record<string, string> = {
  Pending: "bg-status-pending",
  Submitted: "bg-status-submitted",
  Declined: "bg-status-declined",
  Approved: "bg-status-approved",
  Completed: "bg-status-completed",
  Paid: "bg-status-completed",
  Preauthorized: "bg-status-submitted",
  Created: "bg-status-submitted",
  Expired: "bg-status-declined",
  Cancelled: "bg-status-declined",
  AutoCancelled: "bg-status-declined",
  Active: "bg-status-approved",
  Processed: "bg-status-completed",
  Processing: "bg-status-pending",
  Failed: "bg-status-declined",
  Success: "bg-status-completed",
  "Max Order Reached": "bg-status-completed",
};

export default function StatusDot({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-text-primary">
      <span
        className={clsx(
          "h-2 w-2 rounded-full",
          colorMap[status] ?? "bg-status-submitted"
        )}
      />
      {status}
    </span>
  );
}
