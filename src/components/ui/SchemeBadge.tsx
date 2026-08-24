import clsx from "clsx";

const styles: Record<string, string> = {
  Visa: "bg-[#eef1fb] text-[#1a1f71]",
  Mastercard: "bg-[#fdeee6] text-[#eb001b]",
  Jaywan: "bg-[#eef7f0] text-[#0a7a3d]",
  Amex: "bg-[#e8f0fb] text-[#006fcf]",
};

export default function SchemeBadge({ scheme }: { scheme: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold tracking-wide",
        styles[scheme] ?? "bg-page-bg text-text-secondary"
      )}
    >
      {scheme}
    </span>
  );
}
