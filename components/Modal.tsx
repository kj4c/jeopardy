"use client";

import { useEffect } from "react";

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean | "xl";
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/70 px-4 py-10 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`panel corner-marks animate-fade-up w-full ${wide === "xl" ? "max-w-6xl" : wide ? "max-w-3xl" : "max-w-lg"} p-6 md:p-8`}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            {subtitle && <p className="label mb-2">{subtitle}</p>}
            <h2 className="font-display text-4xl">{title}</h2>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
