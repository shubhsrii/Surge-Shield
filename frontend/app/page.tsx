"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-50">
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="max-w-3xl text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-700 bg-slate-900/60 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            AI Agentic Surge Operations for Hospitals
          </div>

          <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
            Anticipate hospital surges
            <span className="block text-primary-400">
              before they become a crisis.
            </span>
          </h1>

          <p className="text-sm md:text-base text-slate-300 leading-relaxed">
            Surge Shield is an AI-powered hospital surge management system that
            continuously monitors admissions, air quality, and public events to
            predict patient surges days in advance and autonomously generate
            staffing, supply, bed, and patient advisory plans.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-sm font-medium shadow-lg shadow-primary-900/60"
            >
              Launch Operations Dashboard
            </Link>
            <Link
              href="/about"
              className="px-5 py-2.5 rounded-xl border border-slate-700 text-sm text-slate-200 hover:bg-slate-900"
            >
              How Surge Shield works
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mt-6 text-xs md:text-sm">
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
              <p className="font-semibold text-slate-100 mb-1">Predict</p>
              <p className="text-slate-400">
                LSTM + gradient boosting forecasts surges from festivals,
                pollution spikes, and epidemic signals.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
              <p className="font-semibold text-slate-100 mb-1">Plan</p>
              <p className="text-slate-400">
                Agentic AI converts forecasts into staffing, inventory, and bed
                management playbooks.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
              <p className="font-semibold text-slate-100 mb-1">Learn</p>
              <p className="text-slate-400">
                Post-event insights close the loop, improving future readiness
                and reducing chaos.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-slate-500 py-4">
        Designed for hackathon scenario · Surge Shield · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
