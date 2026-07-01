import { useParams } from "react-router-dom";
import { useState } from "react";

export default function InterviewLink() {
  const { id } = useParams();
  const url = `${window.location.origin}/candidate/interview/${id}`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800">Interview Created</h1>
      <p className="text-slate-500 text-sm mt-1 mb-6">Share this unique link with the candidate</p>
      <div className="bg-white border rounded-xl p-6">
        <p className="text-sm text-slate-600 mb-2">Candidate Interview Link</p>
        <div className="flex gap-2">
          <input readOnly value={url} className="flex-1 border rounded-lg px-3 py-2 bg-slate-50 text-sm" />
          <button onClick={copy} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">{copied ? "Copied!" : "Copy"}</button>
        </div>
        <div className="mt-4 flex gap-3">
          <a href={`mailto:?subject=AI Interview Invitation&body=Please complete your interview: ${url}`}
             className="px-4 py-2 border rounded-lg text-sm">Send via Email</a>
          <a href={url} target="_blank" rel="noreferrer" className="px-4 py-2 border rounded-lg text-sm">Open Candidate View</a>
        </div>
      </div>
    </div>
  );
}
