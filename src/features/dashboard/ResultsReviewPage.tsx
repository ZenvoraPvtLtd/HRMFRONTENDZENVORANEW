import { useEffect, useState } from "react";
import {
  XCircle,
  Clock,
  UserCheck,
  MessageSquare,
  Briefcase,
  Award,
} from "lucide-react";
import Button from "../../components/button/Button";
import { SEARCH_EVENT } from "../../components/layout/TopHeader";

const initialReviews = [
  {
    id: 1,
    name: "Eleanor Pena",
    role: "Senior Product Designer",
    avatar: "https://i.pravatar.cc/150?u=24",
    interviewDate: "May 13, 2026",
    evaluator: "Jane Doe (Head of Design)",
    scores: {
      technical: 92,
      communication: 88,
      problemSolving: 95,
      cultureFit: 90,
    },
    overallScore: 91,
    recommendation: "Hire",
    notes:
      "Outstanding portfolio. Showed great empathy in the design exercise. Strong fit for our team. Demonstrated excellent understanding of our core user demographic.",
  },
  {
    id: 2,
    name: "Ralph Edwards",
    role: "Frontend Developer",
    avatar: "https://i.pravatar.cc/150?u=36",
    interviewDate: "May 12, 2026",
    evaluator: "Mike Smith (Engineering Manager)",
    scores: {
      technical: 65,
      communication: 75,
      problemSolving: 70,
      cultureFit: 85,
    },
    overallScore: 73,
    recommendation: "Hold",
    notes:
      "Good team fit but struggled slightly with the advanced React rendering optimization questions. Maybe suitable for a mid-level role, but need to compare with other candidates.",
  },
  {
    id: 3,
    name: "Courtney Henry",
    role: "UI Ux Designer",
    avatar: "https://i.pravatar.cc/150?u=50",
    interviewDate: "May 11, 2026",
    evaluator: "Jane Doe (Head of Design)",
    scores: {
      technical: 40,
      communication: 60,
      problemSolving: 50,
      cultureFit: 55,
    },
    overallScore: 51,
    recommendation: "Reject",
    notes:
      "Basic understanding of design systems but lacks the deep experience required for this specific fast-paced role. Did not perform well in the whiteboard session.",
  },
];

function ResultsReviewPage() {
  const [reviews] = useState(initialReviews);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("All");

  useEffect(() => {
    const handleHeaderSearch = (event: Event) => {
      setSearchQuery((event as CustomEvent<string>).detail || "");
    };

    window.addEventListener(SEARCH_EVENT, handleHeaderSearch);
    return () => window.removeEventListener(SEARCH_EVENT, handleHeaderSearch);
  }, []);

  const getRecStyle = (rec: string) => {
    switch (rec) {
      case "Hire":
        return {
          bg: "rgba(16,185,129,0.1)",
          color: "#10b981",
          icon: <UserCheck size={14} />,
        };
      case "Hold":
        return {
          bg: "rgba(245,158,11,0.1)",
          color: "#f59e0b",
          icon: <Clock size={14} />,
        };
      case "Reject":
        return {
          bg: "rgba(239,68,68,0.1)",
          color: "#ef4444",
          icon: <XCircle size={14} />,
        };
      default:
        return {
          bg: "var(--icon-accent-bg)",
          color: "var(--text-primary)",
          icon: null,
        };
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "#10b981";
    if (score >= 65) return "#f59e0b";
    return "#ef4444";
  };

  const filteredReviews = reviews.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filterType === "All" || r.recommendation === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="animate-fade-in px-2 sm:px-4">
      

      {/* Filters */}
      <div className="mb-6 flex flex-wrap justify-end gap-2">
        {["All", "Hire", "Hold", "Reject"].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className="px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer"
            style={{
              background:
                filterType === type ? "var(--accent)" : "transparent",
              color:
                filterType === type
                  ? "var(--accent-text)"
                  : "var(--text-secondary)",
              border: `1px solid ${filterType === type ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {filteredReviews.map((review) => {
          const recStyle = getRecStyle(review.recommendation);
          return (
            <div
              key={review.id}
              className="rounded-2xl flex flex-col"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                padding: "1.25rem",
              }}
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-4 gap-3">
                <div className="flex gap-3 items-center min-w-0">
                  <img
                    src={review.avatar}
                    alt={review.name}
                    className="w-12 h-12 rounded-full object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <h3
                      className="font-semibold text-base truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {review.name}
                    </h3>
                    <div
                      className="flex items-center gap-1.5 text-xs mt-0.5"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <Briefcase size={12} className="shrink-0" />
                      <span className="truncate">{review.role}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className="text-2xl font-bold leading-none"
                    style={{ color: getScoreColor(review.overallScore) }}
                  >
                    {review.overallScore}
                  </div>
                  <div
                    className="text-xs mt-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Overall
                  </div>
                </div>
              </div>

              {/* Status Ribbon */}
              <div
                className="rounded-xl p-3 mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border)",
                }}
              >
                <div>
                  <div
                    className="text-xs mb-0.5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Evaluated By
                  </div>
                  <div
                    className="text-sm font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {review.evaluator}
                  </div>
                </div>
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold self-start sm:self-auto"
                  style={{ background: recStyle.bg, color: recStyle.color }}
                >
                  {recStyle.icon} {review.recommendation}
                </div>
              </div>

              {/* Score Breakdowns */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {Object.entries(review.scores).map(([skill, score]) => (
                  <div key={skill}>
                    <div className="flex justify-between mb-1.5 text-xs">
                      <span
                        className="capitalize"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {skill.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                      <span
                        className="font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {score}%
                      </span>
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: "var(--bg-hover)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${score}%`,
                          background: getScoreColor(score),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Evaluator Notes */}
              <div
                className="rounded-xl p-3 mt-auto"
                style={{
                  background: "var(--bg-hover)",
                  borderLeft: "3px solid var(--accent)",
                }}
              >
                <div
                  className="flex items-center gap-1.5 text-xs font-semibold mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <MessageSquare size={13} /> Evaluator Notes
                </div>
                <p
                  className="text-sm leading-relaxed m-0"
                  style={{ color: "var(--text-primary)" }}
                >
                  "{review.notes}"
                </p>
              </div>

              {/* Actions */}
              <div
                className="flex gap-2 mt-4 pt-4"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                {review.recommendation === "Hire" && (
                  <Button
                    style={{
                      flex: 1,
                      padding: "0.625rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <Award size={14} /> Send Offer Letter
                  </Button>
                )}
                {review.recommendation === "Hold" && (
                  <button
                    className="flex-1 rounded-xl py-2.5 text-sm font-semibold cursor-pointer transition-colors"
                    style={{
                      background: "transparent",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    Move to Talent Pool
                  </button>
                )}
                {review.recommendation === "Reject" && (
                  <button
                    className="flex-1 rounded-xl py-2.5 text-sm font-semibold cursor-pointer"
                    style={{
                      background: "transparent",
                      color: "#ef4444",
                      border: "1px solid rgba(239,68,68,0.3)",
                    }}
                  >
                    Send Rejection Email
                  </button>
                )}
                <button
                  className="rounded-xl px-3 py-2.5 text-sm cursor-pointer transition-colors"
                  style={{
                    background: "transparent",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  Full Report
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ResultsReviewPage;
