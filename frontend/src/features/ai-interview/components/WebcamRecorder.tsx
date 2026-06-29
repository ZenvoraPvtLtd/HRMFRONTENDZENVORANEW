import { useEffect, useRef, useState } from "react";

export default function WebcamRecorder() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((s) => { stream = s; if (videoRef.current) videoRef.current.srcObject = s; setActive(true); })
      .catch((e) => setErr(e.message || "Camera unavailable"));
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  return (
    <div className="bg-slate-900 rounded-xl overflow-hidden aspect-video relative">
      <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
      <div className="absolute top-3 left-3 flex gap-2">
        <span className={`px-2 py-1 rounded-full text-xs ${active ? "bg-green-500" : "bg-slate-500"} text-white`}>
          {active ? "● Live" : "Connecting…"}
        </span>
      </div>
      {err && <div className="absolute inset-0 grid place-items-center text-white text-sm bg-slate-900/80 p-4 text-center">{err}</div>}
    </div>
  );
}
