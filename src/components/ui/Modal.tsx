"use client";

import { X } from "lucide-react";
import { ReactNode, useEffect } from "react";

export default function Modal({
  open,
  onClose,
  children,
  widthClass = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  widthClass?: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={`relative w-full ${widthClass} max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-xl`}
      >
        <button
          onClick={onClose}
          className="absolute right-5 top-5 text-text-muted hover:text-text-primary"
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}
