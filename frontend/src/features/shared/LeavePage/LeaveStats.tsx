import { Calendar, TrendingDown, CheckCircle2 } from "lucide-react";
import type { LeaveRequest } from "../../../types/leave";

const ANNUAL_TOTAL = 18;

interface LeaveStatsProps {
  requests: LeaveRequest[];
}

export default function LeaveStats({ requests }: LeaveStatsProps) {
  // Full Day = 1, Half Day = 0.5
  const used = requests
    .filter((r) => r.status === "Approved")
    .reduce((sum, r) => sum + (r.duration_type === "Half Day" ? 0.5 : 1), 0);

  const remaining = parseFloat((ANNUAL_TOTAL - used).toFixed(1));

  const cards = [
    {
      key: "total",
      label: "Total",
      value: ANNUAL_TOTAL,
      icon: <Calendar size={22} />,
      color: "var(--text-primary)",
      iconBg: "var(--bg-hover)",
    },
    {
      key: "used",
      label: "Used",
      value: used,
      icon: <TrendingDown size={22} />,
      color: "var(--text-primary)",
      iconBg: "var(--bg-hover)",
    },
    {
      key: "remaining",
      label: "Remaining",
      value: remaining,
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
          </div>
        </div>
      ))}
    </div>
  );
}
