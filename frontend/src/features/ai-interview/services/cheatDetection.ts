// MediaPipe Face Detection integration (minimal) + utilities
// Uses @mediapipe/tasks-vision WebAssembly runtime.

export type FaceStatus = "ok" | "no-face" | "multiple-faces" | "error";

export type FaceMonitorConfig = {
  /** consecutive seconds to trigger pause */
  persistSeconds: number; // >= 1
  /** fps-ish sample cadence */
  intervalMs: number;
};

const publicUrl = (path: string) => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/${path.replace(/^\//, "")}`;
};

const FACE_DETECTOR_MODEL_URL = publicUrl("models/face_detection_short_range.tflite");
const VISION_WASM_URL = publicUrl("mediapipe/tasks-vision/wasm");

const absoluteUrl = (path: string) => new URL(path, window.location.origin).toString();

export async function loadFaceDetector() {
  // Dynamic import to avoid SSR issues.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const vision = await import("@mediapipe/tasks-vision");
  return vision;
}

export function createFaceMonitor(params: {
  video: HTMLVideoElement;
  config: FaceMonitorConfig;
  onWarning: (status: FaceStatus) => void;
  onPersistentCheat: () => void;
}) {
  const { video, config, onWarning, onPersistentCheat } = params;

  let detector: any = null;
  let rafId: number | null = null;
  let intervalId: number | null = null;
  let stopped = false;

  // Tracks consecutive "bad" time
  let badMs = 0;
  let lastTs = performance.now();

  const getSimulatedFaces = () => {
    if (typeof window === "undefined") return undefined;
    return (window as any).__simulatedFaces;
  };

  async function init() {
    const vision = await loadFaceDetector();
    const { FaceDetector, FilesetResolver } = vision as any;

    const fileset = await FilesetResolver.forVisionTasks(absoluteUrl(VISION_WASM_URL), false);
    const modelResponse = await fetch(absoluteUrl(FACE_DETECTOR_MODEL_URL));
    if (!modelResponse.ok) {
      throw new Error(`Face detector model failed to load (${modelResponse.status})`);
    }
    const modelAssetBuffer = new Uint8Array(await modelResponse.arrayBuffer());

    detector = await FaceDetector.createFromOptions(fileset as any, {
      baseOptions: {
        modelAssetBuffer,
      },
      runningMode: "VIDEO",
      // Higher threshold => fewer false positives.
      minDetectionConfidence: 0.4,
    } as any);
  }

  function stop() {
    stopped = true;
    if (rafId != null) cancelAnimationFrame(rafId);
    if (intervalId != null) window.clearInterval(intervalId);
    try {
      detector?.close?.();
    } catch {}
  }

  function start() {
    stopped = false;
    // We use rAF only to pull frames from video; the processing cadence is on interval.
    intervalId = window.setInterval(() => {
      if (stopped) return;
      const simCount = getSimulatedFaces();
      if (!detector && simCount === undefined) return;
      try {
        // MediaPipe tasks expects timestamp in ms.
        const now = performance.now();
        const dt = now - lastTs;
        lastTs = now;

        let faces: any[] = [];
        if (simCount !== undefined) {
          faces = Array.from({ length: simCount });
        } else {
          const result = detector.detectForVideo(video, now);
          faces = (result?.detections || []) as any[];
        }

        let status: FaceStatus = "ok";
        if (!faces.length) status = "no-face";
        else if (faces.length > 1) status = "multiple-faces";

        if (status === "ok") {
          badMs = 0;
        } else {
          badMs += dt;
        }

        onWarning(status);
        if (badMs >= config.persistSeconds * 1000) {
          badMs = 0; // avoid repeated triggers
          onPersistentCheat();
        }
      } catch {
        onWarning("error");
      }
    }, config.intervalMs);
  }

  return {
    init,
    start,
    stop,
  };
}

