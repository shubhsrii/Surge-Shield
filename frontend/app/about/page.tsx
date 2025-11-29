"use client";

import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import { Card } from "../components/ui/Card";

export default function AboutPage() {
  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 p-4 md:p-6 space-y-4">
          <h1 className="text-xl md:text-2xl font-semibold">About Surge Shield</h1>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Problem">
              <p className="text-xs text-slate-300">
                Hospitals face unpredictable surges during festivals, pollution
                spikes, and epidemics. Today, most systems are reactive:
                overcrowded emergency rooms, staff burnout, stockouts, and
                preventable adverse events.
              </p>
            </Card>
            <Card title="Solution">
              <p className="text-xs text-slate-300">
                Surge Shield is an AI-powered hospital surge management system
                that forecasts demand 7–30 days ahead and autonomously
                recommends staffing, supply, bed, and patient advisory actions.
                It behaves like a digital operations manager.
              </p>
            </Card>
          </div>

          <Card title="High-Level Architecture">
            <ol className="list-decimal list-inside text-xs text-slate-300 space-y-1">
              <li>
                <span className="font-semibold">Data Layer:</span> Hospital
                admissions, bed occupancy, staff rosters, inventory snapshots,
                AQI and event calendars.
              </li>
              <li>
                <span className="font-semibold">ML Layer:</span> Time-series
                forecaster (LSTM-style) models baseline inflow. Gradient
                boosting (XGBoost-style) models event-driven surge %.
              </li>
              <li>
                <span className="font-semibold">Agentic AI Layer:</span> An AI
                agent orchestrates tools to fetch data, run models, and generate
                structured action plans.
              </li>
              <li>
                <span className="font-semibold">Application Layer:</span>{" "}
                Next.js dashboard surfaces surge risk, predictions, AI
                recommendations, and post-event insights.
              </li>
            </ol>
          </Card>

          <Card title="Team & Implementation Notes">
            <p className="text-xs text-slate-300">
              Built in a hackathon-style setting on:
            </p>
            <ul className="list-disc list-inside text-xs text-slate-300 mt-2">
              <li>Frontend: Next.js (App Router), TypeScript, Tailwind CSS.</li>
              <li>Backend: FastAPI with Python.</li>
              <li>ML: NumPy, pandas, scikit-learn / XGBoost stubs.</li>
              <li>
                Agentic AI: LLM-in-the-loop design (templates here, ready for
                tool-calling integration).
              </li>
            </ul>
          </Card>
        </main>
      </div>
    </div>
  );
}
