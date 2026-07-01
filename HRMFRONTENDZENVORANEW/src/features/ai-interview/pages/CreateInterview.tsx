import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { interviewApi } from "../services/interviewApi";

export default function CreateInterview() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "", department: "Engineering", experience_level: "mid",
    skills: "", difficulty: "medium", duration: 30, question_count: 5,
    interview_type: "technical",
  });

  const update = (k: string, v: any) => setForm({ ...form, [k]: v });

  const submit = async () => {
    setLoading(true);
    try {
      const iv = await interviewApi.create({
        ...form,
        skills: form.skills.split(",").map(s => s.trim()).filter(Boolean),
      });
      nav(`/recruitment/ai-interview/link/${iv.id}`);
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Create Interview</h1>
      <p className="text-slate-500 text-sm mb-6">Configure the AI interview for a job role</p>

      <div className="bg-white rounded-xl border p-6 space-y-5">
        <Field label="Job Title"><input className={inp} value={form.title} onChange={e => update("title", e.target.value)} placeholder="Frontend Engineer" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Department"><input className={inp} value={form.department} onChange={e => update("department", e.target.value)} /></Field>
          <Field label="Experience Level">
            <select className={inp} value={form.experience_level} onChange={e => update("experience_level", e.target.value)}>
              <option value="entry">Entry</option><option value="mid">Mid</option><option value="senior">Senior</option>
            </select>
          </Field>
        </div>
        <Field label="Required Skills (comma separated)">
          <input className={inp} value={form.skills} onChange={e => update("skills", e.target.value)} placeholder="React, TypeScript, Node" />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Difficulty">
            <select className={inp} value={form.difficulty} onChange={e => update("difficulty", e.target.value)}>
              <option>easy</option><option>medium</option><option>hard</option>
            </select>
          </Field>
          <Field label="Duration (min)"><input type="number" className={inp} value={form.duration} onChange={e => update("duration", +e.target.value)} /></Field>
          <Field label="Questions"><input type="number" className={inp} value={form.question_count} onChange={e => update("question_count", +e.target.value)} /></Field>
        </div>
        <Field label="Interview Type">
          <select className={inp} value={form.interview_type} onChange={e => update("interview_type", e.target.value)}>
            <option value="technical">Technical</option><option value="behavioral">Behavioral</option><option value="general">General</option>
          </select>
        </Field>
        <div className="flex gap-3 pt-4 border-t">
          <button onClick={submit} disabled={loading || !form.title} className="px-5 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">
            {loading ? "Generating…" : "Generate Interview"}
          </button>
          <button className="px-5 py-2 border rounded-lg" onClick={() => alert("Draft saved (local)")}>Save Draft</button>
        </div>
      </div>
    </div>
  );
}
const inp = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-sm font-medium text-slate-700 mb-1 block">{label}</span>{children}</label>;
}
