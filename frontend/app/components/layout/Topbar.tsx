"use client";

import { useRouter } from "next/navigation";

export default function Topbar() {
  const router = useRouter();

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="font-medium text-sm text-slate-300">
        <span className="text-xs uppercase tracking-wide text-slate-500">
          Hospital:
        </span>{" "}
        MetroCare General Hospital
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard")}
          className="hidden sm:inline-flex items-center text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          Go to Dashboard
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-xs font-semibold">
          SS
        </div>
      </div>
    </header>
  );
}
