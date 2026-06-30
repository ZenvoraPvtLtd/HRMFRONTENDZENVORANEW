interface Props { label: string; value: string | number; hint?: string; color?: string; }
export default function AnalyticsCard({ label, value, hint, color = "indigo" }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-3xl font-bold mt-2 text-${color}-600`}>{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
