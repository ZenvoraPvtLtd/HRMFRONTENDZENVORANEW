import { useMemo, useState } from "react";
import {
  Search,
  ExternalLink,
  MoreVertical,
} from "lucide-react";

type Status =
  | "Pending Interview"
  | "Hired"
  | "Rejected";

type Filter = "All" | Status;

interface Candidate {
  id: number;
  name: string;
  status: Status;
  interviewDate: string;
  interviewTime: string;
  meetLink: string;
}

const candidates: Candidate[] = [
  {
    id: 1,
    name: "Rahul Sharma",
    status: "Pending Interview",
    interviewDate: "25 Jun 2026",
    interviewTime: "10:00 AM",
    meetLink: "https://meet.google.com/demo-1",
  },
  {
    id: 2,
    name: "Priya Verma",
    status: "Hired",
    interviewDate: "25 Jun 2026",
    interviewTime: "11:00 AM",
    meetLink: "https://meet.google.com/demo-2",
  },
  {
    id: 3,
    name: "Aman Singh",
    status: "Rejected",
    interviewDate: "26 Jun 2026",
    interviewTime: "03:00 PM",
    meetLink: "https://meet.google.com/demo-3",
  },
];

const filters: Filter[] = [
  "All",
  "Pending Interview",
  "Hired",
  "Rejected",
];

export default function InterviewDashboard() {
  const [filter, setFilter] =
    useState<Filter>("All");

  const [search, setSearch] = useState("");

  const filteredCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      const matchesFilter =
        filter === "All"
          ? true
          : candidate.status === filter;

      const matchesSearch =
        candidate.name
          .toLowerCase()
          .includes(search.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [filter, search]);

  const stats = {
    total: candidates.length,
    hired: candidates.filter(
      (c) => c.status === "Hired"
    ).length,
    pending: candidates.filter(
      (c) => c.status === "Pending Interview"
    ).length,
    rejected: candidates.filter(
      (c) => c.status === "Rejected"
    ).length,
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">

      {/* Stats */}

      <div className="grid grid-cols-4 gap-5 mb-10">

        <StatCard
          title="TOTAL"
          value={stats.total}
        />

        <StatCard
          title="HIRED"
          value={stats.hired}
        />

        <StatCard
          title="PENDING INTERVIEW"
          value={stats.pending}
        />

        <StatCard
          title="REJECTED"
          value={stats.rejected}
        />

      </div>

      {/* Filters */}

      <div className="flex items-center gap-3 mb-6">

        <span className="text-zinc-400">
          Filter:
        </span>

        {filters.map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`px-5 py-2 rounded-full border transition ${
              filter === item
                ? "bg-zinc-800 border-zinc-700"
                : "border-zinc-800"
            }`}
          >
            {item}
          </button>
        ))}

        

      </div>

      {/* Table */}

      <div className="rounded-2xl border border-zinc-800 overflow-hidden bg-zinc-950">

        <table className="w-full">

          <thead>

            <tr className="border-b border-zinc-800 text-zinc-400">

              <th className="text-left p-4">
                Candidate
              </th>

              <th className="text-left p-4">
                Status
              </th>

              <th className="text-left p-4">
                Interview Date
              </th>

              <th className="text-left p-4">
                Time
              </th>

              <th className="text-left p-4">
                Meet Link
              </th>

              <th className="text-left p-4">
                Actions
              </th>

            </tr>

          </thead>

          <tbody>

            {filteredCandidates.map(
              (candidate) => (
                <tr
                  key={candidate.id}
                  className="border-b border-zinc-800 hover:bg-zinc-900"
                >
                  <td className="p-4 font-medium">
                    {candidate.name}
                  </td>

                  <td className="p-4">
                    <StatusBadge
                      status={candidate.status}
                    />
                  </td>

                  <td className="p-4">
                    {candidate.interviewDate}
                  </td>

                  <td className="p-4">
                    {candidate.interviewTime}
                  </td>

                  <td className="p-4">
                    <a
                      href={candidate.meetLink}
                      target="_blank"
                      className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
                    >
                      Join Meet
                      <ExternalLink size={14} />
                    </a>
                  </td>

                  <td className="p-4">

                    <button className="p-2 rounded-lg hover:bg-zinc-800">

                      <MoreVertical
                        size={18}
                      />

                    </button>

                  </td>
                </tr>
              )
            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="text-zinc-400 text-sm font-semibold">
        {title}
      </div>

      <div className="text-4xl font-bold mt-3">
        {value}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: Status;
}) {
  const styles = {
    Hired:
      "bg-green-500/10 text-green-400",
    Rejected:
      "bg-red-500/10 text-red-400",
    "Pending Interview":
      "bg-yellow-500/10 text-yellow-400",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}