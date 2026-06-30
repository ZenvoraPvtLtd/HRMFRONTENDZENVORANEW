interface Props { number: number; total: number; text: string; }
export default function QuestionCard({ number, total, text }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider">Question {number} of {total}</p>
      <h3 className="text-xl font-semibold text-slate-800 mt-3 leading-relaxed">{text}</h3>
    </div>
  );
}
