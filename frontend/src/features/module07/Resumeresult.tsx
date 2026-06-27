import { CheckCircle, FileText } from "lucide-react";
import { useState } from "react";

type Status = "Shortlisted" | "Review" | "Rejected";
type Filter = "All" | Status;

interface Candidate {
  candidate_name: string;
  file_name: string;
  match_score: number;
  status: Status;
  matched_skills: string[];
}

const candidates: Candidate[] = [
  {
    candidate_name: "Rahul Sharma",
    file_name: "Rahul_Sharma_Resume.pdf",
    match_score: 87,
    status: "Shortlisted",
    matched_skills: ["React", "TypeScript", "Redux", "Tailwind"],
  },
  {
    candidate_name: "Priya Verma",
    file_name: "Priya_Verma_Resume.pdf",
    match_score: 72,
    status: "Review",
    matched_skills: ["React", "JavaScript"],
  },
  {
    candidate_name: "Aman Singh",
    file_name: "Aman_Singh_Resume.pdf",
    match_score: 45,
    status: "Rejected",
    matched_skills: ["HTML"],
  },
];

const filters: Filter[] = [
  "All",
  "Shortlisted",
  "Review",
  "Rejected",
];





export default function ResumeResultsPage() {

    const [candidateList, setCandidateList] = useState(candidates);

   const [activeFilter, setActiveFilter] = useState<Filter>("All");

    const filteredCandidates: Candidate[] =
    activeFilter === "All"
        ? candidateList
        : candidateList.filter((candidate) => candidate.status === activeFilter);

    const handleStatusChange = (
        fileName: string,
        newStatus: Status
    ) => {
    setCandidateList((prev) =>
        prev.map((candidate) =>
        candidate.file_name === fileName
            ? { ...candidate, status: newStatus }
            : candidate
        )
    );
    };

    const stats = [
    {
        label: "TOTAL SCREENED",
        value: candidateList.length,
    },
    {
        label: "SHORTLISTED",
        value: candidates.filter(
        (candidate) => candidate.status === "Shortlisted"
        ).length,
    },
    {
        label: "NEEDS REVIEW",
        value: candidates.filter(
        (candidate) => candidate.status === "Review"
        ).length,
    },
    {
        label: "REJECTED",
        value: candidates.filter(
        (candidate) => candidate.status === "Rejected"
        ).length,
    },
    ];

  

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {stats.map((item) => (
          <div
            key={item.label}
            className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5"
          >
            <p className="text-zinc-400 text-sm font-semibold">
              {item.label}
            </p>
            <h2 className="text-5xl font-bold mt-3">{item.value}</h2>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="text-zinc-400 font-medium">Filter:</span>

        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-5 py-3 rounded-full border transition-all ${
              activeFilter === filter
                ? "bg-zinc-900 border-zinc-700 text-white"
                : "border-zinc-800 text-zinc-300 hover:bg-zinc-900"
            }`}
          >
            {filter}
          </button>
        ))}

        <span className="ml-auto text-zinc-400 font-semibold">
          {filteredCandidates.length} result
          {filteredCandidates.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Candidate Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        
        {filteredCandidates.map((candidate) => (

            <div
            key={candidate.file_name}
            className="border border-zinc-800 p-5"
            >


            {/* cards */}
           <div
            key={candidate.file_name}
            className="w-full rounded-3xl border border-zinc-800 bg-zinc-950 p-5"
            >
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                <h3 className="text-xl font-bold">
                    {candidate.candidate_name}
                </h3>

                <div className="flex items-center gap-2 mt-2 text-zinc-400 text-sm">
                    <FileText size={16} />
                    <span>{candidate.file_name}</span>
                </div>
                </div>

                {/* ATS Score */}
                {/* ATS Score */}
                <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${
                  candidate.status === "Shortlisted"
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : candidate.status === "Review"
                    ? "border-yellow-500/40 bg-yellow-500/10"
                    : "border-red-500/40 bg-red-500/10"
                }`}>
                  <div className={`h-2 w-2 rounded-full ${
                    candidate.status === "Shortlisted"
                      ? "bg-emerald-400"
                      : candidate.status === "Review"
                      ? "bg-yellow-400"
                      : "bg-red-400"
                  }`} />
                  <span className={`font-semibold ${
                    candidate.status === "Shortlisted"
                      ? "text-emerald-400"
                      : candidate.status === "Review"
                      ? "text-yellow-400"
                      : "text-red-400"
                  }`}>
                    {candidate.match_score}
                  </span>
                </div>  {/* ✅ closes score badge */}
              </div>    {/* ✅ closes flex justify-between (card header) */}

                </div>

            

        {/* Skills */}
        <div className="mt-6 flex flex-wrap gap-2">
            {candidate.matched_skills.map((skill) => (
            <span
            key={skill}
            className="rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-300"
            >
                {skill}
            </span>
        ))}
        </div>

    {/* Footer */}
        <div className="flex justify-between items-center mt-6">
        <div
        className={`flex items-center gap-2 px-4 py-2 rounded-full ${
            candidate.status === "Shortlisted"
            ? "bg-emerald-950 text-emerald-400"
            : candidate.status === "Review"
            ? "bg-yellow-950 text-yellow-400"
            : "bg-red-950 text-red-400"
        }`}
        >
        <CheckCircle size={16} />
        <span>{candidate.status}</span>
                </div>

                <span className="text-zinc-400 text-sm">
                {candidate.matched_skills.length} skills matched
                </span>
        </div>

        {/* Action Buttons for Review Candidates */}
        {candidate.status === "Review" && (
        <div className="flex gap-3 mt-4">
            <button
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 font-medium hover:bg-emerald-700 transition"
            onClick={() => handleStatusChange(candidate.file_name, "Shortlisted")}
            >
            Shortlist
            </button>

            <button
            className="flex-1 rounded-xl bg-red-600 px-4 py-2 font-medium hover:bg-red-700 transition"
            onClick={() => handleStatusChange(candidate.file_name, "Rejected")}
            >
            Reject
            </button>
        </div>
        )}

        </div>
        ))}

      </div>
      </div>
  );
}