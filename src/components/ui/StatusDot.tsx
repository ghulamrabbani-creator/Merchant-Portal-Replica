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
  Suspended: "bg-status-declined",
  Rejected: "bg-status-declined",
  "Pending Customer Sign": "bg-status-pending",
  "Pending Bank Approval": "bg-status-pending",
  Processed: "bg-status-completed",
  Processing: "bg-status-pending",
  Failed: "bg-status-declined",
  Success: "bg-status-completed",
  "Max Order Reached": "bg-status-completed",
  // Added Sep 2026 for Direct Debit occurrences skipped during a subscription pause. This is a
  // settled, terminal state (not an active wait like the orange Pending/Processing dots), so I
  // mapped it to the same neutral tone as Submitted/Created rather than a new "bg-status-skipped"
  // token — that token doesn't exist in tailwind.config here, and an undefined utility class
  // would silently render with no color at all. If you'd rather Skipped read visually distinct
  // from Submitted/Created, that needs a new color added to the Tailwind config first — happy to
  // wire it up once that token exists.
  Skipped: "bg-status-submitted",
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
