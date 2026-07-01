import type { ReactNode } from "react";

export interface ActivityItem {
  icon: ReactNode;
   text: string;
  time: string;
  color: string;
}

export interface RecentActivityProps {
  activities: ActivityItem[];
   onViewAll?: () => void;
  title?: string;
}

export default function RecentActivity({
  activities,
  onViewAll,
  title = "Recent Activity",
}: RecentActivityProps) {
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

      {/* Activity list */}
      <div className="flex flex-col gap-4">
        {activities.map((activity, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "0.5rem",
                  background: `${activity.color}20`,
                  color: activity.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {activity.icon}
              </div>
              <span
                className="text-sm truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {activity.text}
              </span>
            </div>
            <span
              className="text-xs shrink-0"
              style={{ color: "var(--text-secondary)" }}
            >
              {activity.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
