import { ReactNode } from "react";

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

export function Card({ title, subtitle, children }: CardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm shadow-slate-950/40">
      {(title || subtitle) && (
        <div className="px-4 py-3 border-b border-slate-800 flex flex-col gap-1">
          {title && (
            <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          )}
          {subtitle && (
            <p className="text-xs text-slate-400 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
