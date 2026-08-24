"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Briefcase,
  FileText,
  Link2,
  User,
  ChevronDown,
  ChevronLeft,
} from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { label: "Payouts", href: "/payouts", icon: Briefcase },
];

const reportsItems = [{ label: "Statements", href: "/reports/statements" }];

const payByLinkItems = [
  { label: "Payment Links", href: "/pay-by-link/payment-links" },
  { label: "Static Links", href: "/pay-by-link/static-links" },
  { label: "Recurring Payments", href: "/pay-by-link/recurring-payments" },
  { label: "Bulk Uploads", href: "/pay-by-link/bulk-uploads" },
];

const userMgmtItems = [
  { label: "Users", href: "/user-management/users" },
  { label: "Roles", href: "/user-management/roles" },
];

function ExpandableSection({
  label,
  icon: Icon,
  items,
  pathname,
  defaultOpen,
}: {
  label: string;
  icon: React.ElementType;
  items: { label: string; href: string }[];
  pathname: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isActive = items.some((i) => pathname.startsWith(i.href));

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
          isActive
            ? "bg-sidebar-active-bg text-white"
            : "text-sidebar-text hover:bg-sidebar-active-bg/60 hover:text-white"
        )}
      >
        <Icon size={18} strokeWidth={1.8} />
        <span className="flex-1 text-left font-medium">{label}</span>
        <ChevronDown
          size={16}
          className={clsx("transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="mt-1 ml-4 flex flex-col gap-0.5 border-l border-white/10 pl-4">
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "text-white" : "text-sidebar-text hover:text-white"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <aside className="flex h-screen w-[76px] shrink-0 flex-col justify-between bg-sidebar-bg px-3 py-6">
        <div>
          <div className="mb-8 flex justify-center">
            <div className="h-8 w-8 rounded bg-brand-orange" />
          </div>
          <nav className="flex flex-col items-center gap-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    active
                      ? "bg-sidebar-active-bg text-white"
                      : "text-sidebar-text hover:bg-sidebar-active-bg/60 hover:text-white"
                  )}
                >
                  <Icon size={18} strokeWidth={1.8} />
                </Link>
              );
            })}
          </nav>
        </div>
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center justify-center rounded-lg py-2 text-sidebar-text hover:text-white"
        >
          <ChevronLeft size={18} className="rotate-180" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex h-screen w-[260px] shrink-0 flex-col justify-between bg-sidebar-bg px-4 py-6">
      <div>
        <div className="mb-8 flex items-center gap-2 px-2">
          <span className="text-2xl font-extrabold tracking-tight text-brand-orange">
            geidea
          </span>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-active-bg text-white"
                    : "text-sidebar-text hover:bg-sidebar-active-bg/60 hover:text-white"
                )}
              >
                <Icon size={18} strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}

          <ExpandableSection
            label="Reports"
            icon={FileText}
            items={reportsItems}
            pathname={pathname}
            defaultOpen={false}
          />
          <ExpandableSection
            label="Pay-By-Link"
            icon={Link2}
            items={payByLinkItems}
            pathname={pathname}
            defaultOpen={pathname.startsWith("/pay-by-link")}
          />
          <ExpandableSection
            label="User Management"
            icon={User}
            items={userMgmtItems}
            pathname={pathname}
            defaultOpen={false}
          />
        </nav>
      </div>

      <button
        onClick={() => setCollapsed(true)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-text hover:text-white"
      >
        <ChevronLeft size={16} />
        Collapse
      </button>
    </aside>
  );
}
