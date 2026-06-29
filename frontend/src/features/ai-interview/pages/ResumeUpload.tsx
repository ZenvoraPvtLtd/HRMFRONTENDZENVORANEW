import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { resumeApi } from "../services/resumeApi";
import { useInterviewStore } from "../services/store";

export default function ResumeUpload() {
  const { id } = useParams();
  const nav = useNavigate();
  const setCandidate = useInterviewStore(s => s.setCandidate);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); };

  const upload = async () => {
    if (!file) return;
    setUploading(true); setErr("");
    try {
      const resume = await resumeApi.upload(file, Number(id));
      setCandidate(resume);
      nav(`/candidate/interview/${id}/analysis`);
    } catch (e: any) { setErr(e?.message || "Upload failed"); }
    finally { setUploading(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
      <div className="bg-white border rounded-2xl shadow-sm p-8 max-w-xl w-full">
        <h1 className="text-2xl font-bold text-slate-800">Upload Your Resume</h1>
        <p className="text-slate-500 text-sm mt-1">PDF or DOCX. We'll auto-parse your profile.</p>

        <div onDrop={onDrop} onDragOver={(e) => e.preventDefault()}
             className="mt-6 border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:border-indigo-400 transition">
          <p className="text-slate-600 mb-3">Drag & drop your resume here, or</p>
          <label className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg cursor-pointer">
            Choose File
            <input type="file" hidden accept=".pdf,.docx,.doc" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          {file && <p className="mt-4 text-sm text-slate-700">📄 {file.name} <span className="text-slate-400">({(file.size/1024).toFixed(1)} KB)</span></p>}
        </div>

        {err && <p className="text-red-600 text-sm mt-3">{err}</p>}

        <button disabled={!file || uploading} onClick={upload}
          className="mt-6 w-full py-3 bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-50">
          {uploading ? "Uploading…" : "Upload & Continue"}
        </button>
      </div>
    </div>
  );
}
