import { useEffect, useRef, useState } from "react";

interface TimerProps {
  seconds: number;
  /** Called exactly once when the countdown reaches 0 */
  onExpire?: () => void;
}

export default function Timer({ seconds, onExpire }: TimerProps) {
  const [t, setT] = useState(seconds);
  const firedRef = useRef(false);

  useEffect(() => {
    if (t <= 0) {
      if (!firedRef.current) {
        firedRef.current = true;
        onExpire?.();
      }
      return;
    }
    const id = setInterval(() => setT((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [t, onExpire]);

  const m = Math.floor(t / 60);
  const s = t % 60;
  const urgent = t <= 60 && t > 0;

  return (
    <div
      className={`px-3 py-1 rounded-full text-sm font-mono ${
        t <= 0
          ? "bg-rose-100 text-rose-700"
          : urgent
          ? "bg-amber-100 text-amber-700 animate-pulse"
          : "bg-slate-100 text-slate-700"
      }`}
    >
      {m}:{String(s).padStart(2, "0")}
    </div>
  );
}
