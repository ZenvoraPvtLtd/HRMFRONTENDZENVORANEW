import { Calendar, TrendingDown, CheckCircle2 } from "lucide-react";
import type { LeaveRequest } from "../../../types/leave";

const CASUAL_TOTAL = 12;
const SICK_TOTAL = 6;
const ANNUAL_TOTAL = 18;

interface LeaveStatsProps {
  earned: number;
  used: number;
  remaining: number;
  requests: LeaveRequest[];
}

export default function LeaveStats({ earned, used, remaining, requests }: LeaveStatsProps) {
  // Calculate used by type from approved requests
  const usedCasual = requests
    .filter((r) => r.status === "Approved" && r.leave_type === "Casual Leave")
    .reduce((sum, r) => sum + (r.days ?? 0), 0);
  const usedSick = requests
    .filter((r) => r.status === "Approved" && r.leave_type === "Sick Leave")
    .reduce((sum, r) => sum + (r.days ?? 0), 0);

  const cards = [
    {
      key: "earned",
      label: "Earned Till Now",
      value: earned,
      sub: `of ${ANNUAL_TOTAL} total (1.5/month)`,
      icon: <Calendar size={22} />,
      color: "var(--text-primary)",
      iconBg: "var(--bg-hover)",
    },
    {
      key: "used",
      label: "Used",
      value: used,
      sub: `Casual ${usedCasual} · Sick ${usedSick}`,
      icon: <TrendingDown size={22} />,
      color: "var(--text-primary)",
      iconBg: "var(--bg-hover)",
    },
    {
      key: "remaining",
      label: "Remaining",
      value: remaining,
      sub: `Casual ${Math.max(0, CASUAL_TOTAL - usedCasual)} · Sick ${Math.max(0, SICK_TOTAL - usedSick)}`,
      icon: <CheckCircle2 size={22} />,
      color: "var(--text-primary)",
      iconBg: "var(--bg-hover)",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.key}
          className="rounded-xl border px-5 py-4 flex items-center gap-4"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
        >
          <div
            className="flex items-center justify-center rounded-xl shrink-0"
            style={{
              width: 48,
              height: 48,
              background: card.iconBg,
              color: card.color,
            }}
          >
            {card.icon}
          </div>
          <div>
            <div className="text-3xl font-bold leading-none" style={{ color: "var(--text-primary)" }}>
              {card.value}
            </div>
            <div className="mt-0.5 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              {card.label}
            </div>
            <div className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)", opacity: 0.7 }}>
              {card.sub}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
