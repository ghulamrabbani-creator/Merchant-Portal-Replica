import { Store, ChevronDown } from "lucide-react";
import { ReactNode } from "react";

export default function PageHeader({
  title,
  children,
  storeSelector,
}: {
  title: string;
  children?: ReactNode;
  /** Optional working store selector (added 14-Oct-2026 for Direct Debit); replaces the static button. */
  storeSelector?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
      <div className="flex items-center gap-3">
        {children}
        {storeSelector ?? (
          <button className="flex items-center gap-2 rounded-lg border border-border-color bg-brand-orange-light px-4 py-2 text-sm font-medium text-text-primary">
            <Store size={16} />
            All stores
            <ChevronDown size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
