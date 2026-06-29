import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { interviewApi } from "../services/interviewApi";
import { useInterviewStore } from "../services/store";
import type { Result } from "../types/interview";

export default function InterviewResult() {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const candidate = useInterviewStore(s => s.candidate);
  const [r, setR] = useState<Result | null>(null);

  const terminated = location.state?.terminated === true;

  useEffect(() => {
    if (!candidate) return;
    interviewApi.results(candidate.id).then(setR).catch(() => {});
  }, [candidate, id]);

  if (!r) {
    return (
      <div className="min-h-screen bg-slate-950 grid place-items-center text-slate-300">
        <div className="text-center">
          <div className="h-12 w-12 mx-auto rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mb-4" />
          Generating your AI report…
        </div>
      </div>
    );
  }

  const hire = (r.recommendation || "").toLowerCase().includes("hire") && !r.recommendation.toLowerCase().includes("no");
  const bandColor = r.final_score >= 85 ? "from-emerald-500 to-teal-500"
    : r.final_score >= 70 ? "from-indigo-500 to-blue-500"
    : r.final_score >= 55 ? "from-amber-500 to-orange-500"
    : "from-rose-500 to-red-500";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {terminated && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 px-6 py-4 flex items-start gap-4 shadow-lg animate-pulse">
            <span className="text-2xl mt-0.5">⚠️</span>
            <div>
              <h3 className="font-bold text-rose-400 text-lg">Interview Session Terminated</h3>
              <p className="text-sm mt-1 text-rose-300">
                This interview was terminated automatically after repeated proctoring violations.
              </p>
            </div>
          </div>
        )}

        {/* Hero */}
        <div className={`rounded-2xl bg-gradient-to-br ${bandColor} p-8 shadow-xl`}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-widest opacity-80">Interview complete</p>
              <h1 className="text-3xl font-bold mt-1">{candidate?.candidate_name || "Candidate"}</h1>
              <p className="text-sm opacity-90 mt-1">{candidate?.email || "—"}</p>
            </div>
            <div className="text-center">
              <p className="text-xs uppercase opacity-80">Overall Score</p>
              <p className="text-6xl font-bold leading-none">{r.final_score}</p>
              <span className={`mt-3 inline-block px-4 py-1.5 rounded-full font-semibold text-sm ${
                hire ? "bg-white text-emerald-700" : "bg-white/20 text-white border border-white/40"
              }`}>
                {hire ? "✓ " : "✗ "}{r.recommendation}
              </span>
            </div>
          </div>
        </div>

        {/* Score grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Metric label="Technical" value={r.technical_score} accent="indigo" />
          <Metric label="Communication" value={r.communication_score} accent="emerald" />
          <Metric label="Confidence" value={r.confidence_score} accent="amber" />
          <Metric label="Problem Solving" value={r.problem_solving_score} accent="purple" />
        </div>

        {/* Analysis */}
        <div className="grid md:grid-cols-3 gap-4">
          <Panel title="Strengths" items={r.strengths} icon="✓" tone="emerald" />
          <Panel title="Areas to Improve" items={r.weaknesses} icon="!" tone="rose" />
          <Panel title="Suggestions" items={r.suggestions} icon="→" tone="indigo" />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={() => nav("/recruitment/ai-interview")}
            className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium border border-slate-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: number; accent: string }) {
  const colors: Record<string, string> = {
    indigo: "from-indigo-500 to-indigo-400",
    emerald: "from-emerald-500 to-emerald-400",
    amber: "from-amber-500 to-amber-400",
    purple: "from-purple-500 to-fuchsia-400",
  };
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      <div className="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${colors[accent]}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function Panel({ title, items, icon, tone }: { title: string; items: string[]; icon: string; tone: string }) {
  const toneClasses: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  };
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <p className="font-semibold mb-3 flex items-center gap-2">
        <span className={`h-6 w-6 grid place-items-center rounded-md border text-xs ${toneClasses[tone]}`}>{icon}</span>
        {title}
      </p>
      <ul className="space-y-2 text-sm text-slate-300">
        {items.length ? items.map((s, i) => (
          <li key={i} className="flex gap-2"><span className="text-slate-500">·</span>{s}</li>
        )) : <li className="text-slate-500">—</li>}
      </ul>
    </div>
  );
}
