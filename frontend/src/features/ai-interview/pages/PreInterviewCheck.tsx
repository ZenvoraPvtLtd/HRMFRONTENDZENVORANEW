import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useInterviewStore } from "../services/store";

type Check = "pending" | "ok" | "fail";

const isLocalInterviewHost = () =>
  ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

const getEffectiveOnline = () => navigator.onLine || isLocalInterviewHost();

export default function PreInterviewCheck() {
  const { id } = useParams();
  const nav = useNavigate();
  const candidate = useInterviewStore((s) => s.candidate);

  const [cam, setCam] = useState<Check>("pending");
  const [mic, setMic] = useState<Check>("pending");
  const [net, setNet] = useState<Check>(getEffectiveOnline() ? "ok" : "fail");
  const [resume] = useState<Check>(candidate ? "ok" : "fail");
  const [err, setErr] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const run = useCallback(async () => {
    setErr("");
    setCam("pending"); setMic("pending");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCam(stream.getVideoTracks().length ? "ok" : "fail");
      setMic(stream.getAudioTracks().length ? "ok" : "fail");
    } catch (e: any) {
      setCam("fail"); setMic("fail");
      setErr(e?.message || "Permission denied");
    }
  }, []);

  useEffect(() => {
    run();
    const u = () => setNet(getEffectiveOnline() ? "ok" : "fail");
    window.addEventListener("online", u);
    window.addEventListener("offline", u);
    return () => {
      window.removeEventListener("online", u);
      window.removeEventListener("offline", u);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [run]);

  const allOk = cam === "ok" && mic === "ok" && net === "ok" && resume === "ok";

  const proceed = () => {
    // release before room mounts so it can re-acquire fresh in a gesture
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    nav(`/candidate/interview/${id}/start`);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 rounded-xl overflow-hidden aspect-video">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h1 className="text-xl font-semibold text-slate-800">Pre-interview check</h1>
          <p className="text-sm text-slate-500 mt-1">We'll verify your device before the interview begins.</p>

          <ul className="mt-5 space-y-3">
            <Row label="Camera" state={cam} hint="Live preview should be visible" />
            <Row label="Microphone" state={mic} hint="Browser mic access" />
            <Row label="Internet connection" state={net} hint={net === "ok" ? "Online" : "Offline"} />
            <Row label="Resume uploaded" state={resume} hint={candidate?.candidate_name ? candidate.candidate_name : "Upload your resume first"} />
          </ul>

          {err && <p className="mt-4 text-sm text-rose-600">{err}</p>}

          <div className="mt-6 flex gap-2">
            <button onClick={run} className="px-3 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50">Retry</button>
            <button
              onClick={proceed}
              disabled={!allOk}
              className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              Start Interview →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, state, hint }: { label: string; state: Check; hint: string }) {
  const color = state === "ok" ? "bg-emerald-500" : state === "pending" ? "bg-amber-500" : "bg-rose-500";
  const text = state === "ok" ? "Ready" : state === "pending" ? "Checking…" : "Failed";
  return (
    <li className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2">
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <span className="inline-flex items-center gap-2 text-xs text-slate-600">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        {text}
      </span>
    </li>
  );
}
