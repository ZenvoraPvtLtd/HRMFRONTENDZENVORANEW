import { Calendar, Clock } from "lucide-react";

export interface InterviewItem {
   name: string;
    role: string;
    date: string;
   time: string;
}

export interface UpcomingInterviewsProps {
  interviews: InterviewItem[];
  onViewAll?: () => void;
   title?: string;
}

export default function UpcomingInterviews({
  interviews,
  onViewAll,
  title = "Upcoming Interviews",
}: UpcomingInterviewsProps) {
  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <div
          className="text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </div>
        <span
          className="text-xs font-medium cursor-pointer"
          style={{ color: "var(--accent)" }}
          onClick={onViewAll}
        >
          View all
        </span>
      </div>

      {/* Interview list */}
      <div className="flex flex-col gap-4">
        {interviews.map((interview) => (
          <div
            key={interview.name}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                minWidth: 0,
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                style={{
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                }}
              >
                {interview.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <div
                  className="text-sm font-semibold truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {interview.name}
                </div>
                <div
                  className="text-xs truncate"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {interview.role}
                </div>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div
                className="text-xs flex items-center gap-1 justify-end"
                style={{ color: "var(--accent)" }}
              >
                <Calendar size={12} /> {interview.date.split(",")[0]}
              </div>
              <div
                className="text-xs flex items-center gap-1 justify-end mt-0.5"
                style={{ color: "var(--text-secondary)" }}
              >
                <Clock size={12} /> {interview.time}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
