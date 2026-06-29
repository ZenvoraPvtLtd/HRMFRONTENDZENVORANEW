import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useInterviewStore } from "../services/store";
import { resumeApi } from "../services/resumeApi";
import ResumePreview from "../components/ResumePreview";

type MatchResp = {
  match_score: number;
  role_key: string;
  matched_skills: string[];
  missing_skills: string[];
  breakdown: Record<string, number>;
  explanation: string;
};

export default function ResumeAnalysis() {
  const { id } = useParams();
  const nav = useNavigate();
  const candidate = useInterviewStore(s => s.candidate);
  const [m, setM] = useState<MatchResp | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!candidate) return;
    resumeApi.match(candidate.id, "", id ? Number(id) : undefined)
      .then(setM)
      .catch((e) => setErr(e?.message || "Could not compute match"));
  }, [candidate, id]);

  if (!candidate) {
    return (
      <div className="p-8 text-center">
        No resume found.{" "}
        <button className="text-indigo-600" onClick={() => nav(`/candidate/interview/${id}`)}>
          Upload again
        </button>
      </div>
    );
  }

  const score = m?.match_score ?? 0;
  const scoreColor =
    score >= 80 ? "text-emerald-600 bg-emerald-50 border-emerald-200" :
    score >= 60 ? "text-indigo-600 bg-indigo-50 border-indigo-200" :
    score >= 40 ? "text-amber-600 bg-amber-50 border-amber-200" :
    "text-rose-600 bg-rose-50 border-rose-200";
  const verdict =
    score >= 80 ? "Strong match" :
    score >= 60 ? "Good fit" :
    score >= 40 ? "Partial fit" : "Weak match";

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Resume Analysis</h1>
            <p className="text-sm text-slate-500 mt-1">
              {m?.explanation || "Analyzing your resume against the job role…"}
            </p>
          </div>
          <div className={`px-4 py-2 rounded-xl border ${scoreColor} text-right min-w-[140px]`}>
            <p className="text-[10px] uppercase tracking-wider font-medium opacity-70">Job Match</p>
            <p className="text-3xl font-bold leading-tight">{score}%</p>
            <p className="text-xs font-medium">{verdict}</p>
          </div>
        </div>

        {err && <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-4 py-2 text-sm">{err}</div>}

        {m && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white border rounded-xl p-5">
              <p className="font-semibold text-emerald-700 mb-3 text-sm">✓ Matched Skills ({m.matched_skills.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {m.matched_skills.length ? m.matched_skills.map(s => (
                  <span key={s} className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">{s}</span>
                )) : <span className="text-xs text-slate-400">No direct skill match.</span>}
              </div>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <p className="font-semibold text-rose-700 mb-3 text-sm">✗ Missing Skills ({m.missing_skills.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {m.missing_skills.length ? m.missing_skills.map(s => (
                  <span key={s} className="px-2 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-medium">{s}</span>
                )) : <span className="text-xs text-slate-400">Covers all required skills.</span>}
              </div>
            </div>
          </div>
        )}

        {m && (
          <div className="bg-white border rounded-xl p-5">
            <p className="text-sm font-semibold text-slate-700 mb-3">Score Breakdown</p>
            <div className="space-y-2">
              {Object.entries(m.breakdown).map(([k, v]) => {
                const max = { skills: 40, experience: 25, projects: 20, education: 10, keywords: 5 }[k] || 100;
                const pct = Math.round((v / max) * 100);
                return (
                  <div key={k}>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span className="capitalize">{k} <span className="text-slate-400">/ {max}</span></span>
                      <span className="font-medium">{v}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <ResumePreview resume={candidate} />

        <button
          onClick={() => nav(`/candidate/interview/${id}/check`)}
          className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
        >
          Start AI Interview →
        </button>
      </div>
    </div>
  );
}
