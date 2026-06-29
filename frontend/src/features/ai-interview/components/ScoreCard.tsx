export default function ScoreCard({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? "green" : score >= 60 ? "yellow" : "red";
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex justify-between items-baseline">
        <p className="text-slate-600 font-medium">{label}</p>
        <p className={`text-2xl font-bold text-${color}-600`}>{score}</p>
      </div>
      <div className="mt-3 w-full bg-slate-100 rounded-full h-2">
        <div className={`h-2 rounded-full bg-${color}-500`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
