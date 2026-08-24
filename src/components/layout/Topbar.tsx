"use client";

import { MessageCircle, ChevronDown } from "lucide-react";

export default function Topbar() {
  return (
    <header className="flex h-16 items-center justify-end gap-6 border-b border-border-color bg-white px-8">
      <button className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary">
        <MessageCircle size={18} strokeWidth={1.8} />
        Need support ?
      </button>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-orange-light text-sm font-semibold text-brand-orange">
          T
        </div>
        <ChevronDown size={16} className="text-text-secondary" />
      </div>
      <button className="text-sm font-medium text-text-secondary hover:text-text-primary">
        العربية
      </button>
    </header>
  );
}
