import { useEffect, useState } from "react";
import { interviewApi } from "../services/interviewApi";

export default function InterviewHistory() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { interviewApi.history().then(setRows).catch(() => {}); }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Interview History</h1>
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="p-3">Candidate</th><th className="p-3">Role</th><th className="p-3">Date</th>
              <th className="p-3">Score</th><th className="p-3">Status</th><th className="p-3">Report</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No interviews completed yet.</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="p-3 font-medium">{r.candidate_name}</td>
                <td className="p-3">{r.role}</td>
                <td className="p-3">{new Date(r.date).toLocaleDateString()}</td>
                <td className="p-3 font-semibold text-indigo-600">{r.score}</td>
                <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs">{r.status}</span></td>
                <td className="p-3"><button className="text-indigo-600 hover:underline">View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
