export interface MetricCardProps {
  label: string;
  value: string;
  change: string;
  positive: boolean;
}

export default function MetricCard({
  label,
  value,
  change,
  positive,
}: MetricCardProps) {
  return (
    <div
      className="rounded-2xl p-4 sm:p-6 relative"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        className="text-xs sm:text-sm mb-1 pr-10"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </div>
      <div
        className="text-2xl sm:text-3xl font-bold"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </div>
      <div
        className="absolute right-4 top-4 text-xs sm:text-sm font-semibold"
        style={{ color: positive ? "#10b981" : "#f87171" }}
      >
        {change}
      </div>
    </div>
  );
}
