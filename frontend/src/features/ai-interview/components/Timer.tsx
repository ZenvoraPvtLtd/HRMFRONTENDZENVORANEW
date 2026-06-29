import { useEffect, useState } from "react";
export default function Timer({ seconds }: { seconds: number }) {
  const [t, setT] = useState(seconds);
  useEffect(() => {
    if (t <= 0) return;
    const id = setInterval(() => setT((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [t]);
  const m = Math.floor(t / 60), s = t % 60;
  return <div className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-mono">{m}:{String(s).padStart(2, "0")}</div>;
}
