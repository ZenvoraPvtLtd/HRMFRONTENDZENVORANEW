import type { Resume } from "../types/resume";

export default function ResumePreview({ resume }: { resume: Resume }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-indigo-500 grid place-items-center text-white text-xl font-bold">
          {(resume.candidate_name || "C")[0]}
        </div>
        <div>
          <h3 className="text-lg font-semibold">{resume.candidate_name}</h3>
          <p className="text-sm text-slate-500">{resume.email}</p>
        </div>
      </div>
      <div className="mt-6 grid sm:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="font-medium text-slate-700 mb-2">Skills</p>
          <div className="flex flex-wrap gap-1.5">
            {resume.skills.map((s) => <span key={s} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs">{s}</span>)}
          </div>
        </div>
        <div>
          <p className="font-medium text-slate-700 mb-2">Experience</p>
          <p className="text-slate-600">{resume.experience}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="font-medium text-slate-700 mb-2">Projects</p>
          <ul className="list-disc list-inside text-slate-600 space-y-1">
            {resume.projects.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
        <div className="sm:col-span-2">
          <p className="font-medium text-slate-700 mb-2">Education</p>
          <ul className="list-disc list-inside text-slate-600 space-y-1">
            {resume.education.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
