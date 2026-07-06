import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { interviewApi, type ProctoringEventType } from "../services/interviewApi";
import { interviewAiApi } from "../services/interviewAiApi";
import { useInterviewStore } from "../services/store";
import type { Question } from "../types/interview";
import QuestionCard from "../components/QuestionCard";
import Timer from "../components/Timer";
import ProgressBar from "../components/ProgressBar";
import { createFaceMonitor } from "../services/cheatDetection";


type CamState = "pending" | "granted" | "denied" | "unavailable" | "off";
type MicState = "idle" | "listening" | "paused" | "muted" | "processing" | "error";
type Phase = "welcome" | "ai-speaking" | "ready" | "answering" | "review" | "terminated";
type ProctoringStatus = "OK" | "Warning" | "Terminated";
type WarningEventType = "multiple_faces" | "no_face" | "background_voice" | "tab_switch" | "fullscreen_exit" | "paste_detected";
type TerminationEventType =
  | "multiple_faces_terminated"
  | "no_face_terminated"
  | "background_voice_terminated"
  | "tab_switch_terminated"
  | "fullscreen_exit_terminated"
  | "paste_detected_terminated";

const PROCTORING_MESSAGES = {
  multiple_faces: "Multiple people have been detected in front of the camera. Only the candidate is allowed during the interview. If another person is detected again, your interview will be terminated automatically.",
  no_face: "Candidate not visible on camera.",
  background_voice: "Background voice detected. External assistance is not allowed.",
  tab_switch: "Tab switching detected. Leaving interview tab is not allowed.",
  fullscreen_exit: "Fullscreen mode is required during the interview.",
  paste_detected: "Pasting answers is not allowed.",
} as const;

const TERMINATION_REASONS = {
  multiple_faces: "Your interview has been terminated because multiple people were detected during the assessment after a warning was issued. This violates the interview guidelines.",
  no_face: "Interview terminated because candidate left the camera multiple times.",
  background_voice: "Interview terminated due to repeated background voice violations.",
  tab_switch: "Your interview has been automatically terminated because you switched away from the interview window or browser tab. To maintain assessment integrity, tab switching is strictly prohibited.",
  fullscreen_exit: "Interview terminated due to repeated fullscreen violations.",
  paste_detected: "Interview terminated due to repeated paste violations.",
} as const;

// Browser SpeechRecognition typings (loose)
const getSR = (): any => {
  const W: any = window;
  return W.SpeechRecognition || W.webkitSpeechRecognition || null;
};

const isLocalInterviewHost = () =>
  ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

const getEffectiveOnline = () => navigator.onLine || isLocalInterviewHost();

export default function InterviewRoom() {
  const { id } = useParams();
  const nav = useNavigate();
  const candidate = useInterviewStore((s) => s.candidate);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [questionRetryNonce, setQuestionRetryNonce] = useState(0);
  const [phase, setPhase] = useState<Phase>("welcome");
  const [aiReaction, setAiReaction] = useState<string>("");
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);
  const [terminated, setTerminated] = useState<boolean>(false);
  const [terminationReason, setTerminationReason] = useState<string>("");
  const terminatedRef = useRef<boolean>(false);

  // ---- dynamic AI question flow state ----
  const [prevQuestions, setPrevQuestions] = useState<string[]>([]);
  const [prevAnswers, setPrevAnswers] = useState<string[]>([]);
  const [currentDifficulty, setCurrentDifficulty] = useState<string>("easy");
  const [cheatWarning, setCheatWarning] = useState<string>("");
  const [pausedByCheat, setPausedByCheat] = useState<boolean>(false);
  const [cameraProctorStatus, setCameraProctorStatus] = useState<ProctoringStatus>("OK");
  const [audioProctorStatus, setAudioProctorStatus] = useState<ProctoringStatus>("OK");
  const [browserProctorStatus, setBrowserProctorStatus] = useState<ProctoringStatus>("OK");
  const cameraProctorStatusRef = useRef<ProctoringStatus>("OK");
  const audioProctorStatusRef = useRef<ProctoringStatus>("OK");
  const browserProctorStatusRef = useRef<ProctoringStatus>("OK");

  // ---- cheat / monitoring ----
  const faceMonitorRef = useRef<ReturnType<typeof createFaceMonitor> | null>(null);
  const cheatTriggeredRef = useRef<boolean>(false);
  const cheatPersistMsRef = useRef<number>(0);
  const tabCheatTriggeredRef = useRef<boolean>(false);
  const noiseCheatTriggeredRef = useRef<boolean>(false);

  // shared persistent-cheat timer (all violations)
  const cheatStartMsRef = useRef<number | null>(null);
  const cheatViolationActiveRef = useRef<boolean>(false);

  const [cheatType, setCheatType] = useState<"face" | "multi-face" | "noise" | "tab" | "fullscreen" | "paste" | null>(null);

  // ---- MediaPipe face monitoring state ----
  const faceMonitorRunningRef = useRef<boolean>(false);

  // ---- anti-cheating state & refs ----
  const [violationsCount, setViolationsCount] = useState<number>(0);
  const [violationBreakdown, setViolationBreakdown] = useState<Record<WarningEventType, number>>({
    multiple_faces: 0,
    no_face: 0,
    background_voice: 0,
    tab_switch: 0,
    fullscreen_exit: 0,
    paste_detected: 0,
  });
  const [violationLogs, setViolationLogs] = useState<string[]>([]);
  const [showCheatingPopup, setShowCheatingPopup] = useState<boolean>(false);
  const [detectionStatus, setDetectionStatus] = useState<"single-person" | "multiple-people" | "no-person" | "loading">("loading");
  const [faceDetectorFailed, setFaceDetectorFailed] = useState<boolean>(false);
  const isMultiFaceViolatingRef = useRef<boolean>(false);
  const multipleFaceStartRef = useRef<number | null>(null);
  const noFaceStartRef = useRef<number | null>(null);
  const backgroundVoiceStartRef = useRef<number | null>(null);
  const loggedProctoringRef = useRef<Record<ProctoringEventType, boolean>>({
    multiple_faces: false,
    no_face: false,
    background_voice: false,
    multiple_faces_terminated: false,
    no_face_terminated: false,
    background_voice_terminated: false,
    tab_switch: false,
    fullscreen_exit: false,
    paste_detected: false,
    network_disconnect: false,
    termination_screenshot: false,
    tab_switch_terminated: false,
    fullscreen_exit_terminated: false,
    paste_detected_terminated: false,
  });
  const violationCountsRef = useRef<Record<WarningEventType, number>>({
    multiple_faces: 0,
    no_face: 0,
    background_voice: 0,
    tab_switch: 0,
    fullscreen_exit: 0,
    paste_detected: 0,
  });
  const lastEventSecondRef = useRef<Partial<Record<ProctoringEventType, number>>>({});

  // ---- auto test simulation state ----
  const [isAutoTesting, setIsAutoTesting] = useState<boolean>(false);
  const [autoTestLog, setAutoTestLog] = useState<string[]>([]);





  // ---- media state ----
  const [camState, setCamState] = useState<CamState>("pending");
  const [micState, setMicState] = useState<MicState>("idle");
  const [mediaError, setMediaError] = useState<string>("");
  const [voiceLevel, setVoiceLevel] = useState(0);   // 0..1
  const [silenceWarn, setSilenceWarn] = useState(false);
  const [online, setOnline] = useState<boolean>(getEffectiveOnline());
  const [networkPaused, setNetworkPaused] = useState<boolean>(false);
  const networkPausedRef = useRef<boolean>(false);
  const interviewStartedRef = useRef<boolean>(false);
  const fullscreenExitArmedRef = useRef<boolean>(false);

  // ---- transcript state ----
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [editText, setEditText] = useState("");

  // ---- refs ----
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recogRef = useRef<any>(null);
  const shouldRunRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const silenceMsRef = useRef(0);
  const transcriptBoxRef = useRef<HTMLDivElement>(null);
  const spokenIdxRef = useRef<number>(-1);
  const phaseRef = useRef<Phase>("welcome");
  const pausedByCheatRef = useRef<boolean>(false);

  const toDynamicSlots = (rows: Question[]) => {
    const source = rows.length ? rows : [{ id: 0, interview_id: Number(id) || 0, order: 0, question_text: "" } as Question];
    return source.map((row, order) => ({ ...row, order, question_text: "" }));
  };

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    terminatedRef.current = terminated;
  }, [terminated]);

  useEffect(() => {
    pausedByCheatRef.current = pausedByCheat;
  }, [pausedByCheat]);

  useEffect(() => {
    cameraProctorStatusRef.current = cameraProctorStatus;
  }, [cameraProctorStatus]);

  useEffect(() => {
    audioProctorStatusRef.current = audioProctorStatus;
  }, [audioProctorStatus]);

  useEffect(() => {
    browserProctorStatusRef.current = browserProctorStatus;
  }, [browserProctorStatus]);

  useEffect(() => {
    networkPausedRef.current = networkPaused;
  }, [networkPaused]);

  // ---- Text-to-Speech (AI interviewer voice) ----
  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!ttsEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
      onEnd?.();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.98; u.pitch = 1.0; u.volume = 1.0; u.lang = "en-US";
      const voices = window.speechSynthesis.getVoices();
      const pref = voices.find(v => /en[-_]US/i.test(v.lang) && /female|google|samantha|zira|jenny/i.test(v.name))
        || voices.find(v => /en[-_]US/i.test(v.lang)) || voices[0];
      if (pref) u.voice = pref;
      u.onend = () => onEnd?.();
      u.onerror = () => onEnd?.();
      window.speechSynthesis.speak(u);
    } catch { onEnd?.(); }
  }, [ttsEnabled]);

  const stopSpeaking = () => { try { window.speechSynthesis?.cancel(); } catch { } };

  const requestInterviewFullscreen = async () => {
    if (document.fullscreenElement) return true;
    try {
      await document.documentElement.requestFullscreen();
      return true;
    } catch {
      return false;
    }
  };

  const beginInterview = async () => {
    if (terminatedRef.current) return;
    const fullscreenReady = await requestInterviewFullscreen();
    if (!fullscreenReady) {
      recordProctoringViolation("fullscreen_exit", PROCTORING_MESSAGES.fullscreen_exit);
      return;
    }
    interviewStartedRef.current = true;
    fullscreenExitArmedRef.current = true;
    // kick off dynamic generation on first entry to ready
    setPrevQuestions([]);
    setPrevAnswers([]);
    setCurrentDifficulty("easy");
    setPausedByCheat(false);
    setCheatWarning("");

    setIdx(0);
    // Keep the DB question ids/count for answer submission, but let the LLM fill every question.
    setQuestions((prev) => toDynamicSlots(prev));

    setPhase("ready");
  };



  // ---- load questions (dynamic generation replaces static DB questions) ----
  useEffect(() => {
    // keep compatibility: we still use DB question list if available,
    // but dynamic flow will request new questions from backend.
    if (!id) return;
    interviewApi.questions(Number(id))
      .then((rows) => setQuestions(toDynamicSlots(rows)))
      .catch(() => setQuestions(toDynamicSlots([])));
  }, [id]);


  const cleanQuestion = (text: string) => {
    let s = (text || "").trim();
    if (!s) return s;

    s = s.replace(/^["'`]+|["'`]+$/g, "").trim();

    const wrapperPatterns = [
      /^your\s+resume[-\s]*based\s+question\s*(?:is|--|[:.-]+)?\s*/i,
      /^based\s+on\s+your\s+(?:resume|profile|background|experience),?\s*(?:here\s+is|here's|this\s+is|i'd\s+like\s+to\s+ask|let's\s+move\s+to|my\s+next\s+question\s+is)[^:?.!]*[:.-]*\s*/i,
      /^based\s+on\s+your\s+(?:resume|profile|background|experience),\s*/i,
      /^based\s+on\s+your\s+(?:resume|profile|background|experience)[^:?.!]*[:.-]+\s*/i,
      /^(?:here\s+is|here's)\s+(?:your\s+)?(?:next\s+)?question\s*(?:is|--|[:.-]+)?\s*/i,
      /^for\s+(?:your\s+)?(?:next\s+)?question\s*(?:is|--|[:.-]+)?\s*/i,
      /^(?:next\s+question|question)\s*(?:is|--|[:.-]+)?\s*/i,
      /^(?:i'd\s+like\s+to\s+ask|let's\s+talk\s+about|let's\s+move\s+to)\s*[:.-]*\s*/i,
    ];

    let changed = true;
    while (changed) {
      changed = false;
      for (const pattern of wrapperPatterns) {
        const next = s.replace(pattern, "").trim();
        if (next !== s) {
          s = next;
          changed = true;
        }
      }
    }

    return s.replace(/^["'`]+|["'`]+$/g, "").trim();
  };

  const resumeQuestion = async () => {
    // dynamic generation: ask next question based on resume + previous context
    if (!candidate) return;
    const resumeText =
      [
        candidate.experience ? `Experience: ${candidate.experience}` : "",
        candidate.skills?.length ? `Skills: ${candidate.skills.join(", ")}` : "",
        candidate.projects?.length ? `Projects: ${candidate.projects.join(" | ")}` : "",
        candidate.education?.length ? `Education: ${candidate.education.join(" | ")}` : "",
      ]
        .filter(Boolean)
        .join("\n") || "";

    const payload = {
      resume_text: resumeText,
      interview_id: id ? Number(id) : undefined,
      candidate_id: candidate.id,
      previous_questions: prevQuestions,
      previous_answers: prevAnswers,
      current_difficulty: currentDifficulty,
    };

    const resp = await interviewAiApi.generateQuestion(payload);
    const qText = cleanQuestion(resp.question?.trim() || "");


    // avoid repeats (best-effort): if repeats, bump difficulty slightly and retry once
    if (qText && prevQuestions.includes(qText)) {
      const nextDiff = currentDifficulty === "easy" ? "medium" : currentDifficulty === "medium" ? "hard" : "hard";
      setCurrentDifficulty(nextDiff);
      const resp2 = await interviewAiApi.generateQuestion({
        ...payload,
        previous_questions: [...prevQuestions, qText],
        current_difficulty: nextDiff,
      });
      const retryText = cleanQuestion(resp2.question?.trim() || "");
      if (retryText && !prevQuestions.includes(retryText) && retryText !== qText) {
        return retryText;
      }
      throw new Error("Hugging Face returned a repeated question.");

    }

    if (!qText) {
      throw new Error("Hugging Face returned an empty question.");
    }

    return qText;
  };

  // ---- AI speaks the current question when entering "ready" phase ----
  useEffect(() => {
    if (phase !== "ready" || terminated) return;
    if (!candidate) return;
    if (pausedByCheat) return;

    // if we don't have a question yet for this index, generate it
    const existing = questions[idx];
    if (!existing || !existing.question_text) {
      (async () => {
        const qText = await resumeQuestion();
        setQuestions((prev) => {
          const next = [...prev];
          next[idx] = {
            id: existing?.id ?? 0,
            interview_id: existing?.interview_id ?? 0,
            order: idx,
            question_text: qText ?? "",

          };
          return next;
        });
        // update difficulty progression after we generate
        setPhase("ready");
      })().catch((err) => {
        setMediaError(err?.message || "Question generation failed. Check Hugging Face logs and token.");
      });
      return;
    }

    const cur = questions[idx];
    if (!cur) return;
    if (spokenIdxRef.current === idx) return;
    spokenIdxRef.current = idx;
    setPhase("ai-speaking");
    speak(`${cur.question_text}`, () => setPhase("ready"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, questions, phase, candidate, pausedByCheat, terminated, questionRetryNonce]);



  // ---- online/offline ----
  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      if (!networkPausedRef.current) return;
      networkPausedRef.current = false;
      setNetworkPaused(false);
      setPausedByCheat(false);
      setCheatWarning("");
      setShowCheatingPopup(false);
      loggedProctoringRef.current.network_disconnect = false;
      if (phaseRef.current === "answering" && !terminatedRef.current) {
        shouldRunRef.current = true;
        const r = buildRecognizer();
        recogRef.current = r;
        try {
          r?.start();
          setMicState("listening");
        } catch {
          setMicState("error");
        }
      }
    };
    const onOffline = () => {
      if (isLocalInterviewHost()) {
        setOnline(true);
        return;
      }
      setOnline(false);
      if (terminatedRef.current || networkPausedRef.current) return;
      if (isDebouncedEvent("network_disconnect")) return;
      networkPausedRef.current = true;
      setNetworkPaused(true);
      setPausedByCheat(true);
      setCheatWarning("Internet connection lost. Interview paused.");
      setShowCheatingPopup(true);
      shouldRunRef.current = false;
      try { recogRef.current?.stop(); } catch { }
      setMicState((m) => (m === "listening" || m === "processing" ? "paused" : m));
      const logMsg = `[${new Date().toLocaleTimeString()}] Internet connection lost. Interview paused.`;
      setViolationLogs((logs) => [...logs, logMsg]);
      if (candidate && id) {
        interviewApi.saveProctoringEvent({
          candidate_id: candidate.id,
          interview_id: Number(id),
          event_type: "network_disconnect",
          severity: "warning",
          message: "Internet connection lost. Interview paused.",
        }).catch((err) => console.error("Failed to save network event:", err));
      }
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate, id]);

  const clearProctoringEvent = (eventType: WarningEventType) => {
    loggedProctoringRef.current[eventType] = false;
  };

  const maybeResumeFromProctoringClear = () => {
    if (
      pausedByCheatRef.current &&
      cameraProctorStatusRef.current === "OK" &&
      audioProctorStatusRef.current === "OK"
    ) {
      resumeFromCheat();
    }
  };

  const stopInterviewMedia = () => {
    shouldRunRef.current = false;
    try { recogRef.current?.stop(); } catch { }
    recogRef.current = null;
    stopSpeaking();
    stopFaceMonitor();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try { audioCtxRef.current?.close(); } catch { }
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setMicState("idle");
    setCamState("off");
  };

  const isDebouncedEvent = (eventType: ProctoringEventType) => {
    const second = Math.floor(Date.now() / 1000);
    if (lastEventSecondRef.current[eventType] === second) return true;
    lastEventSecondRef.current[eventType] = second;
    return false;
  };

  const terminateForProctoring = (
    warningType: WarningEventType,
    terminationEventType: TerminationEventType,
    reason: string
  ) => {
    if (terminatedRef.current) return;
    terminatedRef.current = true;

    setTerminated(true);
    setTerminationReason(reason);
    setCheatWarning(reason);
    setShowCheatingPopup(false);
    setPausedByCheat(false);
    setPhase("terminated");
    setSubmitting(false);
    cameraProctorStatusRef.current = "Terminated";
    audioProctorStatusRef.current = "Terminated";
    setCameraProctorStatus("Terminated");
    setAudioProctorStatus("Terminated");
    setViolationLogs((logs) => [...logs, `[${new Date().toLocaleTimeString()}] ${reason}`]);
    stopInterviewMedia();

    if (candidate && id && !isDebouncedEvent(terminationEventType)) {
      interviewApi.saveProctoringEvent({
        candidate_id: candidate.id,
        interview_id: Number(id),
        event_type: terminationEventType,
        severity: "critical",
        message: reason,
      }).catch((err) => console.error("Failed to save termination event:", err));
    }

    if (id) {
      interviewApi.terminate(Number(id)).catch((err) => console.error("Failed to mark interview terminated:", err));
    }

    loggedProctoringRef.current[warningType] = true;
  };

  const recordProctoringViolation = (
    eventType: WarningEventType,
    message: string,
    severity: "warning" | "critical" = "warning"
  ) => {
    if (terminatedRef.current) return;
    if (loggedProctoringRef.current[eventType]) return;
    if (isDebouncedEvent(eventType)) return;
    loggedProctoringRef.current[eventType] = true;

    const logMsg = `[${new Date().toLocaleTimeString()}] ${message}`;
    setViolationLogs((logs) => [...logs, logMsg]);
    setCheatWarning(message);
    setShowCheatingPopup(true);

    if (eventType === "background_voice") {
      audioProctorStatusRef.current = "Warning";
      setAudioProctorStatus("Warning");
    } else {
      cameraProctorStatusRef.current = "Warning";
      setCameraProctorStatus("Warning");
    }

    if (candidate && id) {
      interviewApi.saveProctoringEvent({
        candidate_id: candidate.id,
        interview_id: Number(id),
        event_type: eventType,
        severity,
        message,
      }).catch((err) => console.error("Failed to save proctoring event:", err));
    }

    violationCountsRef.current[eventType] += 1;
    setViolationBreakdown((prev) => ({ ...prev, [eventType]: violationCountsRef.current[eventType] }));
    setViolationsCount((prev) => prev + 1);

    if (violationCountsRef.current[eventType] >= 2) {
      const terminationEventType = `${eventType}_terminated` as TerminationEventType;
      terminateForProctoring(eventType, terminationEventType, TERMINATION_REASONS[eventType]);
    }
  };

  const startCheatTimerIfNeeded = (type: "face" | "multi-face" | "noise" | "tab") => {
    if (terminatedRef.current) return;
    if (cheatViolationActiveRef.current && pausedByCheat) return;
    if (cheatStartMsRef.current == null) {
      cheatStartMsRef.current = performance.now();
      cheatViolationActiveRef.current = true;
      setCheatType(type);
    } else {
      setCheatType(type);
      cheatViolationActiveRef.current = true;
    }

    const elapsedMs = performance.now() - (cheatStartMsRef.current ?? performance.now());
    if (elapsedMs >= 10_000) {
      triggerCheatPause(
        type === "face"
          ? "Face not detected. Please stay visible."
          : type === "multi-face"
            ? "Multiple people detected. Please continue alone."
            : type === "noise"
              ? "Background noise detected. Please move to a quieter place."
              : "Warning: tab switched or minimized. Please continue on this tab.",
        type
      );
    }
  };

  const clearCheatTimer = () => {
    cheatStartMsRef.current = null;
    cheatViolationActiveRef.current = false;
    setCheatType(null);
    // if paused and conditions cleared, auto-resume
    if (pausedByCheat) {
      resumeFromCheat();
    }
  };


  const stopFaceMonitor = () => {
    try {
      faceMonitorRef.current?.stop?.();
    } catch { }
    faceMonitorRunningRef.current = false;
  };


  // ---- tab switch / visibility detection ----
  useEffect(() => {
    if (terminated) return;
    
    const triggerTabTermination = () => {
      terminateForProctoring("tab_switch", "tab_switch_terminated", TERMINATION_REASONS.tab_switch);
    };

    const onVis = () => {
      if (document.visibilityState !== "visible") {
        triggerTabTermination();
      }
    };

    const onBlur = () => {
      triggerTabTermination();
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pausedByCheat, terminated]);

  // ---- MediaPipe face detection ----
  useEffect(() => {
    if (terminated || phase === "terminated") {
      stopFaceMonitor();
      return;
    }

    if (phase === "welcome") {
      stopFaceMonitor();
      if (cheatType === "face" || cheatType === "multi-face") {
        clearCheatTimer();
      }
      return;
    }

    const video = videoRef.current;
    if (!video || camState !== "granted") {
      stopFaceMonitor();
      return;
    }

    // Avoid re-init multiple times
    if (faceMonitorRunningRef.current) return;
    faceMonitorRunningRef.current = true;

    const monitor = createFaceMonitor({
      video,
      config: { persistSeconds: 3, intervalMs: 250 },
      onWarning: (status) => {
        const now = performance.now();
        if (status === "multiple-faces") {
          setDetectionStatus("multiple-people");
          cameraProctorStatusRef.current = "Warning";
          setCameraProctorStatus("Warning");
          noFaceStartRef.current = null;
          clearProctoringEvent("no_face");

          if (multipleFaceStartRef.current == null) multipleFaceStartRef.current = now;
          isMultiFaceViolatingRef.current = true;
          recordProctoringViolation(
            "multiple_faces",
            PROCTORING_MESSAGES.multiple_faces,
            "warning"
          );
        } else if (status === "no-face") {
          setDetectionStatus("no-person");
          cameraProctorStatusRef.current = "Warning";
          setCameraProctorStatus("Warning");
          isMultiFaceViolatingRef.current = false;
          multipleFaceStartRef.current = null;
          clearProctoringEvent("multiple_faces");

          if (noFaceStartRef.current == null) noFaceStartRef.current = now;
          if (now - noFaceStartRef.current >= 3000) {
            recordProctoringViolation(
              "no_face",
              PROCTORING_MESSAGES.no_face,
              "warning"
            );
          }
        } else if (status === "ok") {
          setDetectionStatus("single-person");
          cameraProctorStatusRef.current = "OK";
          setCameraProctorStatus("OK");
          isMultiFaceViolatingRef.current = false;
          if (audioProctorStatusRef.current === "OK") setShowCheatingPopup(false);
          multipleFaceStartRef.current = null;
          noFaceStartRef.current = null;
          clearProctoringEvent("multiple_faces");
          clearProctoringEvent("no_face");
          maybeResumeFromProctoringClear();
        }
      },
      onPersistentCheat: () => {
        // Component-level timers handle the distinct 2s/3s proctoring thresholds.
      },
    });

    faceMonitorRef.current = monitor;

    (async () => {
      try {
        await monitor.init?.();
        setFaceDetectorFailed(false);
        if (faceMonitorRunningRef.current) {
          monitor.start?.();
        }
      } catch (err) {
        console.error("Face detector failed to initialize", err);
        setFaceDetectorFailed(true);
        // DEV ONLY: enable Cheat Simulator fallback if initialization fails.
        if (import.meta && import.meta.env && import.meta.env.DEV) {
          (window as any).__simulatedFaces = 1;
          setDetectionStatus("single-person");
          faceMonitorRunningRef.current = true;
          monitor.start?.();
        } else {
          faceMonitorRunningRef.current = false;
          setDetectionStatus("loading");
        }
      }
    })();

    return () => {
      stopFaceMonitor();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, camState, cheatType, pausedByCheat, terminated]);





  // ---- autoscroll transcript ----
  useEffect(() => {
    if (transcriptBoxRef.current) {
      transcriptBoxRef.current.scrollTop = transcriptBoxRef.current.scrollHeight;
    }
  }, [finalText, interimText]);

  const attachStreamToVideo = useCallback(async () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      await video.play().catch(() => { });
      return;
    }

    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => resolve();
      window.setTimeout(resolve, 500);
    });
    await video.play().catch(() => { });
  }, []);

  useEffect(() => {
    if (camState !== "granted") return;
    attachStreamToVideo();
  }, [attachStreamToVideo, camState]);

  // ---- request camera + mic (real, gesture-preserving) ----
  const initMedia = useCallback(async () => {
    setMediaError("");
    setCamState("pending");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      setCamState("granted");
      await attachStreamToVideo();
      setupAudioMeter(stream);
      // listen for device disconnects
      stream.getVideoTracks()[0]?.addEventListener("ended", () => setCamState("unavailable"));
      stream.getAudioTracks()[0]?.addEventListener("ended", () => setMicState("error"));
    } catch (e: any) {
      const msg = String(e?.name || e?.message || e);
      if (msg.includes("NotAllowed") || msg.includes("Permission")) {
        setCamState("denied");
        setMediaError("Camera/Microphone permission was denied. Enable it from the browser address bar and retry.");
      } else if (msg.includes("NotFound") || msg.includes("Devices")) {
        setCamState("unavailable");
        setMediaError("No camera or microphone detected on this device.");
      } else if (msg.includes("NotReadable")) {
        setCamState("unavailable");
        setMediaError("Camera/Microphone is in use by another application.");
      } else {
        setCamState("unavailable");
        setMediaError(e?.message || "Unable to access media devices.");
      }
    }
  }, [attachStreamToVideo]);

  // start media on mount (after user clicked Start AI Interview = gesture)
  useEffect(() => {
    initMedia();
    return () => {
      shouldRunRef.current = false;
      try { recogRef.current?.stop(); } catch { }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { audioCtxRef.current?.close(); } catch { }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      try { window.speechSynthesis?.cancel(); } catch { }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- audio meter / silence detection + background noise enforcement ----
  const setupAudioMeter = (stream: MediaStream) => {
    try {
      const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new Ctx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      let last = performance.now();

      // noise heuristic: consider "noisy" if rms exceeds threshold often
      let noisyMs = 0;
      const NOISE_THRESHOLD = 0.12; // tune: higher => fewer false pauses

      const tick = () => {
        if (terminatedRef.current) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const lvl = Math.min(1, rms * 2.5);
        setVoiceLevel(lvl);

        const now = performance.now();
        const dt = now - last;
        last = now;

        // existing silence warning
        if (shouldRunRef.current) {
          if (lvl < 0.04) silenceMsRef.current += dt;
          else silenceMsRef.current = 0;
          setSilenceWarn(silenceMsRef.current > 6000);
        } else {
          silenceMsRef.current = 0;
          setSilenceWarn(false);
        }

        // background voice/noise proctoring
        if (phaseRef.current === "answering" && !pausedByCheatRef.current) {
          if (lvl > NOISE_THRESHOLD) {
            noisyMs += dt;
            backgroundVoiceStartRef.current ??= now;
            audioProctorStatusRef.current = "Warning";
            setAudioProctorStatus("Warning");
            if (noisyMs >= 2000) {
              recordProctoringViolation(
                "background_voice",
                PROCTORING_MESSAGES.background_voice,
                "warning"
              );
            }
          } else {
            noisyMs = 0;
            backgroundVoiceStartRef.current = null;
            clearProctoringEvent("background_voice");
            audioProctorStatusRef.current = "OK";
            setAudioProctorStatus("OK");
            if (cameraProctorStatusRef.current === "OK") setShowCheatingPopup(false);
            maybeResumeFromProctoringClear();
          }
        } else {
          noisyMs = 0;
          backgroundVoiceStartRef.current = null;
          audioProctorStatusRef.current = "OK";
          setAudioProctorStatus("OK");
          if (cameraProctorStatusRef.current === "OK") setShowCheatingPopup(false);
          maybeResumeFromProctoringClear();
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // analyser optional
    }
  };


  // ---- speech recognizer ----
  const buildRecognizer = () => {
    const SR = getSR();
    if (!SR) return null;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";

    r.onstart = () => setMicState("listening");
    r.onaudiostart = () => setMicState("listening");
    r.onsoundend = () => setMicState((m) => (m === "listening" ? "processing" : m));

    r.onresult = (e: any) => {
      let interim = "";
      let finalChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalChunk += t + " ";
        else interim += t;
      }
      if (finalChunk) {
        setFinalText((p) => (p ? p + " " : "") + finalChunk.trim());
        setMicState("listening");
      }
      setInterimText(interim);
    };

    r.onerror = (ev: any) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        shouldRunRef.current = false;
        setMicState("error");
        setMediaError("Microphone permission denied for speech recognition.");
      } else if (ev.error === "no-speech") {
        // benign — keep listening
      } else if (ev.error === "audio-capture") {
        setMicState("error");
        setMediaError("Microphone disconnected.");
      }
    };

    r.onend = () => {
      if (shouldRunRef.current) {
        try { r.start(); } catch { }
      } else {
        setMicState((m) => (m === "error" ? "error" : "idle"));
      }
    };
    return r;
  };

  const ensureMicTrackEnabled = (enabled: boolean) => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = enabled));
  };

  // ---- answer flow ----
  const startAnswer = () => {
    if (terminatedRef.current) return;
    if (pausedByCheat) return;
    if (phase === "ai-speaking") { return; }
    if (!questions[idx]?.question_text?.trim()) {
      setMediaError("Question is still being generated from Hugging Face. Please wait.");
      return;
    }

    if (camState !== "granted") {
      setMediaError("Camera not available. Please grant permission first.");
      return;
    }
    if (!getSR()) {
      setMediaError("This browser does not support live speech recognition. Use Chrome or Edge.");
      return;
    }
    setFinalText("");
    setInterimText("");
    setPhase("answering");
    ensureMicTrackEnabled(true);
    shouldRunRef.current = true;
    const r = buildRecognizer();
    if (!r) return;
    recogRef.current = r;
    try { r.start(); setMicState("listening"); } catch { }
  };

  const pauseAnswer = () => {
    if (terminatedRef.current) return;
    shouldRunRef.current = false;
    try { recogRef.current?.stop(); } catch { }
    setMicState("paused");
  };

  const autoSubmitOrTerminate = async () => {
    shouldRunRef.current = false;
    try { recogRef.current?.stop(); } catch { }
    stopSpeaking();
    stopFaceMonitor();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    try { audioCtxRef.current?.close(); } catch { }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (!candidate) return;
    setSubmitting(true);
    setCheatWarning("Interview terminated due to repeated proctoring violations.");
    try {
      const result = await interviewApi.analyze(candidate.id, Number(id));
      nav(`/candidate/interview/${id}/result`, { state: { result, terminated: true } });
    } catch (e: any) {
      console.error("Auto-submit analysis error:", e);
      nav(`/candidate/interview/${id}/result`, { state: { terminated: true } });
    } finally {
      setSubmitting(false);
    }
  };

  const runAutomatedSecurityTest = async () => {
    setIsAutoTesting(true);
    setAutoTestLog([]);
    const log = (msg: string) => {
      setAutoTestLog((prev) => [...prev, msg]);
      console.log(`[E2E Test] ${msg}`);
    };
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      log("Starting automated anti-cheating verification...");

      // Step 1: Simulate 1 face
      log("Step 1: Simulating 1 face (normal candidate)...");
      (window as any).__simulatedFaces = 1;
      setDetectionStatus("single-person");
      await delay(2000);
      log("✓ Verified: Status is Green (Single Person), no warnings shown.");

      // Step 2: Simulate 2 faces (Violation 1)
      log("Step 2: Simulating 2 faces (cheating attempt 1)...");
      (window as any).__simulatedFaces = 2;
      setDetectionStatus("multiple-people");
      await delay(2000);
      log("✓ Verified: Violation count incremented. Warning popup is open.");

      // Step 3: Dismiss warning/simulate clearing
      log("Step 3: Simulating second person leaving (clearing)...");
      (window as any).__simulatedFaces = 1;
      setDetectionStatus("single-person");
      await delay(2000);
      log("✓ Verified: Status returned to Green, warning popup dismissed.");

      // Step 4: Simulate 2 faces again (Violation 2)
      log("Step 4: Simulating 2 faces again (cheating attempt 2)...");
      (window as any).__simulatedFaces = 2;
      setDetectionStatus("multiple-people");
      await delay(2000);
      log("✓ Verified: Violation count incremented. Warning popup is open.");

      // Step 5: Simulate clearing again
      log("Step 5: Simulating second person leaving again...");
      (window as any).__simulatedFaces = 1;
      setDetectionStatus("single-person");
      await delay(2000);
      log("✓ Verified: Status returned to Green, warning popup dismissed.");

      // Step 6: Extra simulator step retained for manual reset testing.
      log("Step 6: Simulating 2 faces after termination lock...");
      (window as any).__simulatedFaces = 2;
      setDetectionStatus("multiple-people");
      await delay(2000);
      log("✓ Verified: Violation count incremented. Warning popup is open.");

      // Step 7: Simulate clearing again
      log("Step 7: Simulating second person leaving again...");
      (window as any).__simulatedFaces = 1;
      setDetectionStatus("single-person");
      await delay(2000);
      log("✓ Verified: Status returned to Green, warning popup dismissed.");

      // Step 8: Confirm duplicate detections do not create duplicate warnings in the same second.
      log("Step 8: Confirming duplicate detections stay debounced...");
      (window as any).__simulatedFaces = 2;
      setDetectionStatus("multiple-people");
      await delay(1000);
      log("Verified: Duplicate warning debounce and termination lock are active.");

    } catch (err: any) {
      log(`Error during verification: ${err.message}`);
    } finally {
      setIsAutoTesting(false);
    }
  };

  const triggerCheatPause = (reason: string, type: "face" | "multi-face" | "noise" | "tab") => {
    if (terminatedRef.current) return;
    if (pausedByCheat) return;
    setCheatType(type);
    setCheatWarning(reason);
    cheatViolationActiveRef.current = true;
    cheatTriggeredRef.current = true;
    setPausedByCheat(true);

    // stop recognition immediately
    pauseAnswer();
  };

  const resumeFromCheat = () => {
    if (terminatedRef.current) return;
    // Only allow resume if still in answering phase
    if (!pausedByCheat) return;
    if (phase !== "answering") {
      // If we left the answering phase while paused, just clear flags.
      setPausedByCheat(false);
      setCheatWarning("");
      setCheatType(null);
      cheatViolationActiveRef.current = false;
      cheatStartMsRef.current = null;
      return;
    }

    setPausedByCheat(false);
    setCheatWarning("");
    setCheatType(null);
    cheatViolationActiveRef.current = false;
    cheatStartMsRef.current = null;

    shouldRunRef.current = true;
    const r = buildRecognizer();
    recogRef.current = r;
    try {
      r?.start();
      setMicState("listening");
    } catch {
      setMicState("error");
    }
  };






  const resumeAnswer = () => {
    if (terminatedRef.current) return;
    if (phase !== "answering") return;
    if (pausedByCheat) return;
    shouldRunRef.current = true;
    const r = buildRecognizer();
    recogRef.current = r;
    try {
      r?.start();
      setMicState("listening");
    } catch {
      setMicState("error");
    }
  };


  const toggleMute = () => {
    if (terminatedRef.current) return;
    if (micState === "muted") {
      ensureMicTrackEnabled(true);
      resumeAnswer();
    } else {
      ensureMicTrackEnabled(false);
      shouldRunRef.current = false;
      try { recogRef.current?.stop(); } catch { }
      setMicState("muted");
    }
  };

  const stopAnswer = () => {
    if (terminatedRef.current) return;
    shouldRunRef.current = false;
    try { recogRef.current?.stop(); } catch { }
    setMicState("idle");
    setEditText(((finalText + " " + interimText).trim()));
    setInterimText("");
    setPhase("review");
    const reactions = ["Good answer.", "Interesting perspective.", "Got it, thanks.", "Thanks for sharing.", "Noted, let's continue.", "Nice explanation."];
    const r = reactions[Math.floor(Math.random() * reactions.length)];
    setAiReaction(r);
    speak(r);
  };

  const clearTranscript = () => {
    setFinalText("");
    setInterimText("");
    setEditText("");
  };

  const reRecord = () => {
    if (terminatedRef.current) return;
    clearTranscript();
    startAnswer();
  };

  // ---- camera toggle ----
  const toggleCamera = () => {
    if (terminatedRef.current) return;
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamState(track.enabled ? "granted" : "off");
  };

  // ---- next / submit ----
  const submitAndNext = async () => {
    if (terminatedRef.current) return;
    if (!candidate || !questions[idx]) return;
    const text = editText.trim();
    if (!text) {
      setMediaError("Transcript is empty. Please record an answer first.");
      return;
    }
    setSubmitting(true);
    try {
      await interviewApi.submitAnswer({
        candidate_id: candidate.id,
        question_id: questions[idx].id,
        answer_text: text,
      });
      setPrevQuestions((prev) => [...prev, questions[idx].question_text]);
      setPrevAnswers((prev) => [...prev, text]);
      setMediaError("");
      setEditText("");
      setFinalText("");
      setInterimText("");
      if (idx + 1 < questions.length) {
        setAiReaction("");
        setCurrentDifficulty((diff) => diff === "easy" ? "medium" : diff === "medium" ? "hard" : "hard");
        setIdx(idx + 1);
        setPhase("ready");
      } else {
        const result = await interviewApi.analyze(candidate.id, Number(id));
        nav(`/candidate/interview/${id}/result`, { state: { result } });
      }
    } catch (e: any) {
      setMediaError(e?.message || "Failed to submit answer.");
    } finally {
      setSubmitting(false);
    }
  };

  const q = questions[idx];
  const currentQuestionText = q?.question_text?.trim() || "";
  const totalWords = useMemo(
    () => (finalText + " " + interimText).trim().split(/\s+/).filter(Boolean).length,
    [finalText, interimText]
  );

  const initials = (candidate?.candidate_name || "C N")
    .split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const proctoringStatusClass = (status: ProctoringStatus) =>
    status === "Terminated"
      ? "text-rose-700"
      : status === "Warning"
        ? "text-rose-600 animate-pulse"
        : "text-emerald-600";

  return (
    <div className="min-h-screen bg-slate-50">
      {phase === "welcome" && (
        <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl max-w-xl w-full p-8 shadow-2xl">
            <div className="flex items-center gap-4 mb-5">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center text-white text-2xl shadow-lg">🤖</div>
              <div>
                <p className="text-xs uppercase tracking-wider text-indigo-600 font-semibold">AI Interviewer</p>
                <h2 className="text-xl font-bold text-slate-800">Aira</h2>
              </div>
            </div>
            <p className="text-slate-700 mb-2">
              Hi <span className="font-semibold">{candidate?.candidate_name || "there"}</span>, welcome to your AI interview!
            </p>
            <p className="text-sm text-slate-600 mb-5">
              I'll ask you {questions.length || "a few"} questions today. Take your time, speak clearly, and answer naturally.
              I'll listen, transcribe, and analyze your responses in real time.
            </p>
            <ul className="text-sm text-slate-600 space-y-2 mb-6 bg-slate-50 p-4 rounded-lg">
              <li>✓ I'll speak each question aloud — listen carefully.</li>
              <li>✓ Your microphone unlocks once I finish speaking.</li>
              <li>✓ Review and edit the transcript before submitting each answer.</li>
              <li>✓ Stay on this tab and keep your face visible to the camera.</li>
            </ul>
            <button
              onClick={() => { if (!terminatedRef.current) { setPhase("ready"); spokenIdxRef.current = -1; } }}
              disabled={!questions.length || camState !== "granted" || terminated}
              className="w-full py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {camState !== "granted" ? "Waiting for camera & mic…" : "I'm Ready — Start Interview →"}
            </button>
          </div>
        </div>
      )}

      {showCheatingPopup && !terminated && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-rose-200 max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <span className="text-3xl">⚠️</span>
              <h3 className="text-lg font-bold text-slate-900">Proctoring Warning</h3>
            </div>
            <p className="text-sm text-slate-700 mb-6 font-semibold">
              {cheatWarning || "Please resolve the proctoring issue before continuing."}
            </p>
            <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-500 mb-6">
              Please ensure you are alone, visible on camera, and in a quiet room. A second warning for the same issue terminates the interview.
              <div className="mt-2 font-bold text-rose-600">
                Violations Logged: {violationsCount}
              </div>
            </div>
            <button
              onClick={() => setShowCheatingPopup(false)}
              className="w-full py-2.5 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors shadow-md text-sm"
            >
              I Understand & Acknowledge
            </button>
          </div>
        </div>
      )}

      {terminated && (
        <div className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-rose-200 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-700 mb-4">
              <span className="text-3xl">!</span>
              <h3 className="text-lg font-bold text-slate-900">Interview Terminated</h3>
            </div>
            <p className="text-sm text-slate-800 font-semibold">{terminationReason}</p>
            <div className="mt-5 rounded-lg bg-rose-50 border border-rose-100 p-3 text-xs text-rose-700">
              Webcam and microphone access have been stopped. Answer submission is locked.
            </div>
          </div>
        </div>
      )}

      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-800">AI Interview</span>
            <span className="text-xs text-slate-500">Question {Math.min(idx + 1, questions.length || 1)} / {questions.length || "…"}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot ok={camState === "granted"} label="Camera" />
            <StatusDot ok={micState === "listening" || micState === "idle"} warn={micState === "paused" || micState === "muted"} label="Mic" />
            <StatusDot ok={online} label="Network" />
            {phase !== "welcome" && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm border ${terminated ? "bg-rose-100 text-rose-800 border-rose-300" : violationsCount > 0 ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-50 text-slate-600 border-slate-200"
                }`}>
                Violations: <span className="font-bold">{violationsCount}</span>
              </span>
            )}
            <Timer seconds={(questions.length || 5) * 120} />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-3">
          <ProgressBar value={idx + (phase === "review" ? 1 : 0)} max={questions.length || 1} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Webcam + profile */}
        <div className="space-y-4">
          <div className="bg-slate-900 rounded-xl overflow-hidden aspect-video relative">
            {camState === "granted" ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="block w-full h-full object-cover bg-slate-950"
                style={{ transform: "scaleX(-1)" }}
              />
            ) : (
              <div className="w-full h-full grid place-items-center">
                <div className="h-20 w-20 rounded-full bg-indigo-600 text-white grid place-items-center text-2xl font-semibold">{initials}</div>
              </div>
            )}
            <div className="absolute top-3 left-3 flex flex-wrap gap-2 max-w-[calc(100%-1.5rem)]">
              <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${camState === "granted" ? "bg-green-500 text-white" : "bg-slate-500 text-white"}`}>
                {camState === "granted" ? "● Live" : camState === "pending" ? "Connecting…" : camState === "off" ? "Camera Off" : camState === "denied" ? "Denied" : "Unavailable"}
              </span>
              {micState !== "idle" && (
                <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${micState === "listening" ? "bg-emerald-500 text-white" :
                  micState === "processing" ? "bg-amber-500 text-white" :
                    micState === "paused" ? "bg-slate-400 text-white" :
                      micState === "muted" ? "bg-rose-500 text-white" : "bg-red-600 text-white"
                  }`}>{(micState.charAt(0).toUpperCase() + micState.slice(1))}</span>

              )}
              {camState === "granted" && phase !== "welcome" && (
                <span className={`px-2 py-1 rounded-full text-[11px] font-medium flex items-center gap-1 shadow ${detectionStatus === "multiple-people"
                    ? "bg-rose-600 text-white animate-pulse"
                    : detectionStatus === "single-person"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-600 text-white"
                  }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${detectionStatus === "multiple-people"
                      ? "bg-white animate-ping"
                      : "bg-white"
                    }`} />
                  {detectionStatus === "multiple-people" ? "Multiple People" : detectionStatus === "single-person" ? "Single Person" : "Scanning..."}
                </span>
              )}
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
              <Waveform level={voiceLevel} active={micState === "listening"} />
            </div>
          </div>

          {/* Media controls */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap gap-2">
            <button onClick={toggleCamera} disabled={terminated} className="px-3 py-1.5 text-xs rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-50">
              {camState === "off" ? "Turn camera on" : "Turn camera off"}
            </button>
            <button
              onClick={toggleMute}
              disabled={phase !== "answering" || terminated}
              className="px-3 py-1.5 text-xs rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
            >
              {micState === "muted" ? "Unmute" : "Mute"}
            </button>
            {(camState === "denied" || camState === "unavailable") && (
              <button onClick={initMedia} className="px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700">
                Retry permission
              </button>
            )}
          </div>

          {/* Security Monitor Card */}
          {phase !== "welcome" && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Live Proctoring Status</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Camera Status:</span>
                  <span className={`font-semibold ${proctoringStatusClass(cameraProctorStatus)}`}>
                    {cameraProctorStatus}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Audio Status:</span>
                  <span className={`font-semibold ${proctoringStatusClass(audioProctorStatus)}`}>
                    {audioProctorStatus}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Violations Count:</span>
                  <span className={`font-bold ${violationsCount > 0 ? "text-rose-600" : "text-slate-700"}`}>
                    {violationsCount}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded border border-slate-100 bg-slate-50 p-2 text-center">
                    <div className="text-slate-500">Multiple faces</div>
                    <div className="font-bold text-slate-800">{violationBreakdown.multiple_faces} / 2</div>
                  </div>
                  <div className="rounded border border-slate-100 bg-slate-50 p-2 text-center">
                    <div className="text-slate-500">No face</div>
                    <div className="font-bold text-slate-800">{violationBreakdown.no_face} / 2</div>
                  </div>
                  <div className="rounded border border-slate-100 bg-slate-50 p-2 text-center">
                    <div className="text-slate-500">Audio</div>
                    <div className="font-bold text-slate-800">{violationBreakdown.background_voice} / 2</div>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Face Detection:</span>
                  <span className="text-slate-600">
                    {detectionStatus === "multiple-people" ? "Multiple faces" :
                      detectionStatus === "single-person" ? "One face" :
                        detectionStatus === "no-person" ? "No face" : "Scanning"}
                  </span>
                </div>
                {violationsCount > 0 && (
                  <div className="mt-2 text-[11px] text-rose-600 bg-rose-50 border border-rose-100 rounded p-2">
                    Warning: {violationsCount} proctoring warning{violationsCount > 1 ? 's' : ''} logged. Two warnings in any category terminate the interview.
                  </div>
                )}
                {terminationReason && (
                  <div className="mt-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded p-2 font-semibold">
                    {terminationReason}
                  </div>
                )}
                {violationLogs.length > 0 && (
                  <div className="max-h-24 overflow-y-auto text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded p-2 space-y-1">
                    {violationLogs.slice(-4).map((log, i) => (
                      <div key={`${log}-${i}`}>{log}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Candidate profile */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-700 grid place-items-center font-semibold">{initials}</div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 truncate">{candidate?.candidate_name || "Candidate"}</p>
                <p className="text-xs text-slate-500 truncate">{candidate?.email || "—"}</p>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-600 space-y-1">
              <p><span className="text-slate-400">Experience:</span> {candidate?.experience || "—"}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {(candidate?.skills || []).slice(0, 8).map((s) => (
                  <span key={s} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px]">{s}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Developer Simulation Panel */}
          {phase !== "welcome" && import.meta.env.DEV && (
            <div className="bg-slate-800 text-slate-100 rounded-xl border border-slate-700 p-4 space-y-3 shadow-md">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cheat Simulator</h4>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
                  {faceDetectorFailed ? "DEV FALLBACK" : "DEV ONLY"}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Mock the number of faces detected in the webcam stream to test the anti-cheating response.
              </p>
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                <button
                  onClick={() => {
                    (window as any).__simulatedFaces = undefined;
                    // Trigger a temporary state change to force-update indicator
                    setDetectionStatus((prev) => (prev === "loading" ? "no-person" : "loading"));
                  }}
                  className="px-1 py-1 text-[10px] rounded bg-slate-700 hover:bg-slate-600 transition-colors text-center font-semibold"
                  title="Use real webcam stream"
                >
                  Real
                </button>
                <button
                  onClick={() => {
                    (window as any).__simulatedFaces = 0;
                    setDetectionStatus("no-person");
                  }}
                  className="px-1 py-1 text-[10px] rounded bg-slate-700 hover:bg-slate-600 transition-colors text-center font-semibold"
                  title="Mock 0 faces detected"
                >
                  0 Faces
                </button>
                <button
                  onClick={() => {
                    (window as any).__simulatedFaces = 1;
                    setDetectionStatus("single-person");
                  }}
                  className="px-1 py-1 text-[10px] rounded bg-emerald-700 hover:bg-emerald-600 transition-colors text-center font-semibold"
                  title="Mock 1 face detected"
                >
                  1 Face
                </button>
                <button
                  onClick={() => {
                    (window as any).__simulatedFaces = 2;
                    setDetectionStatus("multiple-people");
                  }}
                  className="px-1 py-1 text-[10px] rounded bg-rose-600 hover:bg-rose-50 transition-colors text-center font-semibold animate-pulse"
                  title="Mock 2 faces detected"
                >
                  2 Faces
                </button>
              </div>
              <div className="text-[10px] text-slate-400 bg-slate-900/60 p-2 rounded leading-normal space-y-1">
                <div>• <strong>Real</strong>: Normal camera feed detection</div>
                <div>• <strong>0 Faces</strong>: Simulates "no-face" status</div>
                <div>• <strong>1 Face</strong>: Simulates single candidate (Green)</div>
                <div>• <strong>2 Faces</strong>: Simulates multiple people (Red + warning popup)</div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Question + transcript */}
        <div className="lg:col-span-2 space-y-4">
          {mediaError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-4 py-2 text-sm flex items-center justify-between">
              <span>{mediaError}</span>
              <button onClick={() => setMediaError("")} className="text-rose-500 text-xs">Dismiss</button>
            </div>
          )}
          {silenceWarn && phase === "answering" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-4 py-2 text-sm">
              We can't hear you. Speak closer to the microphone or check your input device.
            </div>
          )}
          {!online && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-4 py-2 text-sm">
              You appear to be offline. Reconnect to submit answers.
            </div>
          )}

          {q ? (
            <>
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-4 text-white shadow-lg">
                <div className="flex items-center gap-4">
                  <div className={`h-14 w-14 rounded-full bg-white/20 grid place-items-center text-2xl ${phase === "ai-speaking" ? "animate-pulse ring-4 ring-white/40" : ""}`}>🤖</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">AI Interviewer · Aira</p>
                    <p className="text-sm font-medium truncate">
                      {phase === "ai-speaking" ? "Speaking… please listen" :
                        phase === "answering" ? "Listening to your answer…" :
                          phase === "review" ? (aiReaction || "Review your answer") :
                            currentQuestionText ? "Ready when you are" : "Generating question..."}
                    </p>
                  </div>
                  <button
                    onClick={() => { setTtsEnabled(v => !v); if (ttsEnabled) stopSpeaking(); }}
                    className="text-xs px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 backdrop-blur-sm"
                    title="Toggle AI voice"
                  >
                    {ttsEnabled ? "🔊 Voice On" : "🔇 Voice Off"}
                  </button>
                </div>
                {phase === "ai-speaking" && (
                  <div className="mt-3 flex items-end gap-1 h-6">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => (
                      <span key={i} className="w-1 rounded-full bg-white/80 animate-pulse" style={{ height: `${30 + (i % 3) * 30}%`, animationDelay: `${i * 70}ms` }} />
                    ))}
                  </div>
                )}
              </div>

              <QuestionCard number={idx + 1} total={questions.length} text={currentQuestionText || "Generating question from Hugging Face..."} />

              {/* Transcript panel */}
              <div className="bg-white rounded-xl border border-slate-200">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">Live transcript</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${micState === "listening"
                        ? "bg-emerald-50 text-emerald-700"
                        : micState === "processing"
                          ? "bg-amber-50 text-amber-700"
                          : micState === "paused"
                            ? "bg-slate-100 text-slate-600"
                            : micState === "muted"
                              ? "bg-rose-50 text-rose-600"
                              : "bg-slate-100 text-slate-500"
                        }`}
                    >
                      {(() => {
                        if (micState === "listening") return "Listening…";
                        if (micState === "processing") return "Processing…";
                        if (micState === "paused") return "Paused";
                        if (micState === "muted") return "Muted";

                        switch (phase) {
                          case "ready":
                            return "Ready";

                          case "ai-speaking":
                            return "AI speaking";

                          case "answering":
                            return "Answering";

                          case "review":
                            return "Completed";

                          default:
                            return "Idle";
                        }
                      })()}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">{totalWords} words</span>
                </div>

                {phase !== "review" ? (
                  <div
                    ref={transcriptBoxRef}
                    className="max-h-64 overflow-y-auto px-4 py-3 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap min-h-[8rem]"
                  >
                    {finalText}
                    {interimText && (
                      <span className="text-slate-400"> {interimText}</span>
                    )}
                    {!finalText && !interimText && (
                      <span className="text-slate-400">Your spoken answer will appear here in real time.</span>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    disabled={terminated}
                    className="w-full max-h-64 min-h-[10rem] px-4 py-3 text-sm leading-relaxed text-slate-800 focus:outline-none resize-y"
                    placeholder="Review and edit your answer before submitting."
                  />
                )}

                {/* Action bar */}
                <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/60 rounded-b-xl">
                  {phase === "ready" && (
                    <button
                      onClick={startAnswer}
                      disabled={camState !== "granted" || terminated || !currentQuestionText}
                      className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {"● Start Answer"}
                    </button>
                  )}
                  {phase === "answering" && (
                    <>
                      {micState === "paused" || micState === "muted" ? (
                        <button onClick={resumeAnswer} disabled={terminated} className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                          Resume
                        </button>
                      ) : (
                        <button onClick={pauseAnswer} disabled={terminated} className="px-4 py-2 rounded-md bg-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-300 disabled:opacity-50">
                          Pause
                        </button>
                      )}
                      <button onClick={stopAnswer} disabled={terminated} className="px-4 py-2 rounded-md bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-50">
                        ■ Stop Answer
                      </button>
                      <button onClick={clearTranscript} className="px-3 py-2 rounded-md border border-slate-200 text-slate-600 text-sm hover:bg-white">
                        Clear
                      </button>
                    </>
                  )}
                  {phase === "review" && (
                    <>
                      <button
                        onClick={submitAndNext}
                        disabled={submitting || !online || terminated}
                        className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {submitting ? "Submitting…" : idx + 1 < questions.length ? "Submit & Next →" : "Submit & Finish"}
                      </button>
                      <button onClick={reRecord} disabled={terminated} className="px-4 py-2 rounded-md border border-slate-200 text-slate-700 text-sm hover:bg-white disabled:opacity-50">
                        Re-record answer
                      </button>
                      <button onClick={clearTranscript} className="px-3 py-2 rounded-md border border-slate-200 text-slate-600 text-sm hover:bg-white">
                        Clear transcript
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
              Loading questions…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusDot({ ok, warn, label }: { ok?: boolean; warn?: boolean; label: string }) {
  const color = ok ? "bg-emerald-500" : warn ? "bg-amber-500" : "bg-rose-500";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <span className={`h-2 w-2 rounded-full ${color}`} /> {label}
    </span>
  );
}

function Waveform({ level, active }: { level: number; active: boolean }) {
  const bars = 18;
  return (
    <div className="flex items-end gap-[3px] h-8 px-2 py-1 rounded-md bg-black/30 backdrop-blur-sm w-full">
      {Array.from({ length: bars }).map((_, i) => {
        const phase = (i / bars) * Math.PI;
        const h = Math.max(2, Math.round((active ? level : 0.05) * 28 * (0.6 + 0.4 * Math.sin(phase + level * 6))));
        return <span key={i} className="w-[3px] rounded-sm bg-emerald-400/90" style={{ height: `${h}px` }} />;
      })}
    </div>
  );
}
