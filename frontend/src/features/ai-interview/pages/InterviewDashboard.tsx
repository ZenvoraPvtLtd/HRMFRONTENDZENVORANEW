import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { interviewApi } from "../services/interviewApi";
import type { Interview } from "../types/interview";
import AnalyticsCard from "../components/AnalyticsCard";

export default function InterviewDashboard() {
  const [items, setItems] = useState<Interview[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    interviewApi.list().then(setItems).catch(() => {});
    interviewApi.history().then(setHistory).catch(() => {});
  }, []);

  const completed = history.length;
  const avg = completed ? Math.round(history.reduce((a, b) => a + (b.score || 0), 0) / completed) : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">AI Interview</h1>
          <p className="text-slate-500 text-sm">Manage AI-powered candidate interviews</p>
        </div>
        <div className="flex gap-2">
          <Link to="/recruitment/ai-interview/history" className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">History</Link>
          <Link to="/recruitment/ai-interview/create" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">+ Create Interview</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <AnalyticsCard label="Total Interviews" value={items.length} />
        <AnalyticsCard label="Active" value={items.filter(i => i.status === "active").length} color="green" />
        <AnalyticsCard label="Completed" value={completed} color="blue" />
        <AnalyticsCard label="Average Score" value={`${avg}%`} color="amber" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="font-semibold text-slate-700">Recent Interviews</h2>
        </div>
        <div className="divide-y">
          {items.length === 0 && <p className="p-6 text-slate-500 text-sm">No interviews yet. Create your first one.</p>}
          {items.slice(0, 8).map((i) => (
            <div key={i.id} className="px-6 py-4 flex justify-between items-center hover:bg-slate-50">
              <div>
                <p className="font-medium text-slate-800">{i.title}</p>
                <p className="text-xs text-slate-500">{i.department} · {i.experience_level} · {i.question_count} questions</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 text-xs rounded-full bg-green-50 text-green-700">{i.status}</span>
                <Link to={`/recruitment/ai-interview/link/${i.id}`} className="text-indigo-600 text-sm font-medium hover:underline">Get Link</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
