import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from 'react';
import Button from '../../components/button/Button';
import { useNavigate } from 'react-router-dom';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar 
} from 'recharts';
import { 
  Video, Mic, MicOff, VideoOff, PhoneOff, Activity, MessageSquare, 
  Eye, Smile, ShieldCheck, Download, ChevronLeft, BrainCircuit,
  Camera, Maximize, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

function InterviewWelcome({ onContinue, userName }: { onContinue: () => void; userName?: string }) {
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);

  const guidelines = [
    'Find a quiet, well-lit space with stable internet',
    'Use earphones for better audio quality',
    'Ensure you dress neatly. Sit upright with your face clearly visible',
    'Give detailed responses for better score',
    "Don't exit full-screen mode or switch tabs once the interview starts",
    'Your score from this assessment will be applicable to future applications as well',
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', padding: '2.5rem 1.5rem', fontFamily: 'Inter, sans-serif' }}>
      {/* Logo */}
      <div style={{ marginBottom: '2.5rem' }}>
        <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '0.05em', color: 'var(--accent)' }}>ZENVORA</span>
        <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}> HRM</span>
      </div>

      <div style={{ maxWidth: 700, width: '100%' }}>
        <p style={{ margin: '0 0 0.35rem', fontSize: '1.05rem', color: 'var(--text-secondary)' }}>
          Hi {userName || 'Candidate'}!
        </p>
        <h1 style={{ margin: '0 0 0.75rem', fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          Welcome to your AI Interview
        </h1>
        <p style={{ margin: '0 0 2rem', color: 'var(--text-secondary)', fontSize: '1rem' }}>
          This is just like a standard interview where the interviewer will ask a few simple questions to evaluate your skills.
        </p>

        {/* Info box */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '0.875rem', padding: '1.25rem 1.5rem', marginBottom: '1.75rem' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Evaluating: </span>
            <strong style={{ color: 'var(--text-primary)' }}>Technical Skills</strong>
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Duration: </span>
            <strong style={{ color: 'var(--text-primary)' }}>6-8 minutes</strong>
          </div>
          <div style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontWeight: 600 }}>Guidelines:</div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {guidelines.map((g, i) => (
              <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>{g}</li>
            ))}
          </ul>
        </div>

        {/* Checkbox */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', marginBottom: '1.5rem' }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 2, accentColor: 'var(--text-primary)', flexShrink: 0 }}
          />
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            I understand that cheating (reading answers, using phone, getting help from others, switching tabs, etc.) will result in disqualification.
          </span>
        </label>

        {/* CTA */}
        <button
          onClick={onContinue}
          disabled={!agreed}
          style={{
            padding: '0.75rem 2rem',
            background: agreed ? 'var(--text-primary)' : 'var(--bg-hover)',
            color: agreed ? 'var(--bg-primary)' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '0.975rem',
            fontWeight: 700,
            cursor: agreed ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s',
          }}
        >
          I'm ready to continue
        </button>
        <p style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          By clicking 'I'm ready to continue', you agree for this session to be recorded and shared with recruiters.
        </p>
      </div>
    </div>
  );
}


function InterviewInstructions({ 
  onProceed, 
  userName, 
  onStreamAcquired 
}: { 
  onProceed: () => void; 
  userName?: string; 
  onStreamAcquired?: (stream: MediaStream) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camStatus, setCamStatus] = useState<'checking' | 'ok' | 'denied'>('checking');
  const [micStatus, setMicStatus] = useState<'checking' | 'ok' | 'denied'>('checking');
  const [netStatus] = useState<'ok'>('ok'); // always ok
  const [speakerTested, setSpeakerTested] = useState(false);

  const onStreamAcquiredRef = useRef(onStreamAcquired);
  useEffect(() => {
    onStreamAcquiredRef.current = onStreamAcquired;
  }, [onStreamAcquired]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((s) => {
        stream = s;
        setCamStatus('ok');
        setMicStatus('ok');
        if (videoRef.current) videoRef.current.srcObject = s;
        if (onStreamAcquiredRef.current) onStreamAcquiredRef.current(s);
      })
      .catch(() => {
        setCamStatus('denied');
        setMicStatus('denied');
      });
    return () => {
      // Don't stop tracks if we've acquired it successfully for the parent
    };
  }, []);

  const playTestSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.connect(ctx.destination);
      osc.frequency.value = 440;
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch { /* ignore */ }
  };

  const Tick = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill="#10b981" />
      <path d="M6 10l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const Spin = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" style={{ animation: 'spin 1s linear infinite' }}>
      <circle cx="10" cy="10" r="8" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="30 16" fill="none" />
    </svg>
  );

  const allReady = camStatus === 'ok' && micStatus === 'ok' && speakerTested;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', padding: '2.5rem 2rem' }}>
      {/* Logo */}
      <div style={{ marginBottom: '2.5rem' }}>
        <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--accent)' }}>ZENVORA</span>
        <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)' }}> HRM</span>
      </div>

      {/* Heading */}
      <p style={{ margin: '0 0 0.25rem', color: 'var(--text-secondary)' }}>Hi {userName || 'Candidate'}!</p>
      <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>Welcome to your AI Interview</h1>
      <p style={{ margin: '0 0 2rem', color: 'var(--text-secondary)' }}>
        Before starting, we'll be running a short system check to make sure everything works seamlessly.
      </p>

      {/* 2-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', maxWidth: 900 }}>
        {/* Left — checklist */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '0.875rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

          {/* Internet */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {netStatus === 'ok' ? <Tick /> : <Spin />}
            <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Internet speed</span>
          </div>

          {/* Camera + mic */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {camStatus === 'ok' ? <Tick /> : camStatus === 'checking' ? <Spin /> : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="10" fill="#ef4444" />
                <path d="M7 7l6 6M13 7l-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
            <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Camera and microphone access</span>
          </div>

          {/* Microphone */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {micStatus === 'ok' ? <Tick /> : micStatus === 'checking' ? <Spin /> : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="10" fill="#ef4444" />
                <path d="M7 7l6 6M13 7l-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
            <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Microphone</span>
          </div>

          {/* Speaker audio */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: speakerTested ? 0 : '0.6rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={speakerTested ? '#10b981' : 'var(--text-secondary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
              <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Testing speaker audio</span>
            </div>
            {!speakerTested && (
              <>
                <p style={{ margin: '0 0 0.75rem 2rem', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                  Did you hear the speaker audio?
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', marginLeft: '2rem' }}>
                  <button
                    onClick={() => setSpeakerTested(true)}
                    style={{ padding: '0.4rem 1.25rem', borderRadius: '999px', background: 'var(--text-primary)', color: 'var(--bg-primary)', border: 'none', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => { playTestSound(); }}
                    style={{ padding: '0.4rem 1.25rem', borderRadius: '999px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
                  >
                    Retry
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Proceed button */}
          {speakerTested && camStatus === 'ok' && (
            <button
              onClick={onProceed}
              style={{ marginTop: '0.5rem', padding: '0.7rem 1.5rem', background: 'var(--text-primary)', color: 'var(--bg-primary)', border: 'none', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
            >
              Start Interview →
            </button>
          )}

          {camStatus === 'denied' && (
            <p style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '0.5rem' }}>
              ⚠ Camera/mic blocked. Please allow access in browser settings and refresh.
            </p>
          )}
        </div>

        {/* Right — camera feed */}
        <div style={{ position: 'relative', borderRadius: '0.875rem', overflow: 'hidden', background: '#0f172a', aspectRatio: '4/3' }}>
          {camStatus === 'ok' ? (
            <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: '#6b7280' }}>
              <VideoOff size={40} />
              <span style={{ fontSize: '0.875rem' }}>Camera unavailable</span>
            </div>
          )}
          {/* Name badge */}
          <div style={{ position: 'absolute', bottom: '0.75rem', left: '0.75rem', background: 'rgba(0,0,0,0.65)', color: '#fff', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
            {userName || 'You'}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Thank You Page
// ---------------------------------------------------------------------------
function ThankYouPage({
  score,
  metrics,
  onSubmit,
}: {
  score: number;
  metrics: { communication: number; voiceConfidence: number; facialExpression: number; eyeContact: number };
  onSubmit: () => void;
}) {
  const [experience, setExperience] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const getScoreLabel = (s: number) => {
    if (s >= 85) return { label: 'Excellent', color: '#10b981' };
    if (s >= 70) return { label: 'Good', color: '#3b82f6' };
    if (s >= 55) return { label: 'Average', color: '#f59e0b' };
    return { label: 'Needs Improvement', color: '#ef4444' };
  };

  const { label, color } = getScoreLabel(score);

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(() => {
      onSubmit();
    }, 1200);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '720px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}>

        {/* Header card */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '1.5rem',
          padding: '2.5rem',
          textAlign: 'center',
        }}>
          {/* Green checkmark circle */}
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'rgba(16,185,129,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem',
            border: '2px solid rgba(16,185,129,0.3)',
          }}>
            <CheckCircle2 size={40} style={{ color: '#10b981' }} />
          </div>

          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
            Thank You!
          </h1>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: '0 0 0.25rem' }}>
            Your AI interview has been completed successfully.
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            Candidate: Anugrah Prasetya &bull; Role: Frontend Developer
          </p>
        </div>

        {/* AI Score card */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '1.25rem',
          padding: '1.75rem',
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BrainCircuit size={18} style={{ color: '#8b5cf6' }} /> AI Interview Report
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Overall score */}
            <div style={{
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              borderRadius: '1rem', padding: '1.25rem', textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall Score</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color }}>
                {score}<span style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/100</span>
              </div>
              <div style={{ color, fontSize: '0.875rem', fontWeight: 600, marginTop: '0.5rem' }}>{label}</div>
            </div>

            {/* Metrics breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', justifyContent: 'center' }}>
              {[
                { label: 'Communication', value: Math.round(metrics.communication) },
                { label: 'Voice Confidence', value: Math.round(metrics.voiceConfidence) },
                { label: 'Facial Expression', value: Math.round(metrics.facialExpression) },
                { label: 'Eye Contact', value: Math.round(metrics.eyeContact) },
              ].map((m) => (
                <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{m.label}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Experience feedback card */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '1.25rem',
          padding: '1.75rem',
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageSquare size={18} style={{ color: '#3b82f6' }} /> Share Your Experience
          </h3>

          {!submitted ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Star rating */}
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.625rem' }}>
                  How was your interview experience?
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '2rem', lineHeight: 1, padding: '0.125rem',
                        color: star <= (hoverRating || rating) ? '#f59e0b' : 'var(--border)',
                        transition: 'color 0.15s',
                      }}
                    >
                      &#9733;
                    </button>
                  ))}
                  {rating > 0 && (
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', alignSelf: 'center', marginLeft: '0.5rem' }}>
                      {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
                    </span>
                  )}
                </div>
              </div>

              {/* Experience text area */}
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.625rem' }}>
                  Tell us about your interview experience <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="How did the AI interview feel? Were the questions relevant? Any suggestions for improvement..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.75rem',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    lineHeight: 1.6,
                    resize: 'vertical',
                    outline: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.375rem', textAlign: 'right' }}>
                  {experience.length} / 500
                </div>
              </div>

              {/* Submit button — moved to bottom action bar */}
            </div>
          ) : (
            <div style={{
              textAlign: 'center', padding: '2rem 1rem',
              background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: '1rem',
            }}>
              <CheckCircle2 size={40} style={{ color: '#10b981', marginBottom: '0.75rem' }} />
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
                Thank you for your feedback!
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Your response helps us improve the AI interview experience.
              </div>
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button
            onClick={handleSubmit}
            style={{
              flex: 1, padding: '0.875rem',
              fontSize: '0.9375rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <CheckCircle2 size={18} /> {submitted ? 'Redirecting...' : 'Submit Feedback'}
          </Button>
          <Button
            onClick={() => {}}
            style={{
              flex: 1, padding: '0.875rem',
              fontSize: '0.9375rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <Download size={18} /> Download Report
          </Button>
        </div>

      </div>
    </div>
  );
}

export default function AIVideoInterviewPage() {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  // 'welcome' -> guidelines + consent, 'systemcheck' -> camera/mic check, 'interview' -> live, 'thankyou' -> done
  const [phase, setPhase] = useState<'welcome' | 'setup' | 'interview' | 'thankyou'>('welcome');

  const candidateVideoRef = useRef<HTMLVideoElement>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);

  const getLoggedInUserName = () => {
    return (
      localStorage.getItem("candidate_userName") ||
      localStorage.getItem("hr_userName") ||
      localStorage.getItem("userName") ||
      "Candidate"
    );
  };

  const currentUserName = useMemo(() => getLoggedInUserName(), []);

  const handleStreamAcquired = useCallback((s: MediaStream) => {
    setMediaStream(s);
  }, []);

  const interviewQuestions = useMemo(() => [
    "For a fair assessment, please do not use any external help. This session is being recorded, and any form of cheating may result in a permanent ban from our platform. Let's get started.",
    "Question 1: Welcome to the interview! To begin, could you introduce yourself and talk about your experience with React and modern frontend development?",
    "Question 2: That's great. How do you approach state management in a large-scale React application? When do you choose Redux/Zustand vs React Context?",
    "Question 3: Interesting. Can you describe how you optimize performance in a web app, specifically focusing on core web vitals and reducing bundle size?",
    "Question 4: Excellent. Lastly, can you give an example of a challenging technical problem you solved in a past project and how you resolved it?",
    "Thank you! That concludes the interview. Please click 'Complete Assessment' to view your AI analysis report."
  ], []);

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    if (phase === 'interview') {
      speakText(interviewQuestions[0]);
    }
  }, [phase, interviewQuestions]);

  useEffect(() => {
    if (phase === 'interview' && mediaStream && !('getVideoTracks' in mediaStream)) {
      // Re-request if stream was lost/stopped
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then((s) => {
          setMediaStream(s);
        })
        .catch((err) => {
          console.error("Failed to re-acquire media stream in interview phase", err);
        });
    }
  }, [phase, mediaStream]);

  useEffect(() => {
    let active = true;
    // Bind video element when in interview phase
    if (phase === 'interview' && mediaStream && active) {
      const timer = setTimeout(() => {
        if (candidateVideoRef.current && active) {
          candidateVideoRef.current.srcObject = mediaStream;
        }
      }, 100);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [phase, mediaStream, isVideoOn]);

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [mediaStream]);


  const [interviewStatus, setInterviewStatus] = useState<'ongoing' | 'ended'>('ongoing');
  
  // Real-time simulated metrics
  const [metrics, setMetrics] = useState({
    communication: 85,
    voiceConfidence: 78,
    facialExpression: 92,
    eyeContact: 88,
  });

  const [sentimentData, setSentimentData] = useState<{ time: string, score: number }[]>([
    { time: '00:00', score: 50 },
  ]);

  const [keywords, setKeywords] = useState<{word: string, time: string}[]>([
    { word: 'React', time: '00:01' }
  ]);

  const possibleKeywords = useMemo(() => [
    'TypeScript', 'Node.js', 'Redux', 'System Design', 'Microservices', 'API', 'Docker', 'AWS', 'Scalability', 'GraphQL', 'Next.js'
  ], []);

  // Cleanup media streams when interview ends or component unmounts
  useEffect(() => {
    if (interviewStatus === 'ended' || phase !== 'interview') {
      // Stop all media tracks when interview ends
      const mediaElements = document.querySelectorAll<HTMLVideoElement>('video');
      mediaElements.forEach((video) => {
        if (video.srcObject instanceof MediaStream) {
          video.srcObject.getTracks().forEach((track) => {
            track.stop();
          });
        }
      });
    }
  }, [interviewStatus, phase]);

  // Stop simulation when phase changes to thankyou
  useEffect(() => {
    if (phase === 'thankyou') {
      setTimeout(() => {
        setInterviewStatus('ended');
      }, 0);
    }
  }, [phase]);

  // Simulation effect
  useEffect(() => {
    if (interviewStatus === 'ended') return;

    let timeSec = 0;
    
    const interval = setInterval(() => {
      timeSec += 2;
      
      // Update metrics slightly
      setMetrics(prev => ({
        communication: Math.min(100, Math.max(0, prev.communication + (Math.random() * 6 - 3))),
        voiceConfidence: Math.min(100, Math.max(0, prev.voiceConfidence + (Math.random() * 8 - 4))),
        facialExpression: Math.min(100, Math.max(0, prev.facialExpression + (Math.random() * 4 - 2))),
        eyeContact: Math.min(100, Math.max(0, prev.eyeContact + (Math.random() * 10 - 5))),
      }));

      // Update sentiment chart
      setSentimentData(prev => {
        const newScore = Math.min(100, Math.max(0, (prev[prev.length - 1]?.score || 50) + (Math.random() * 20 - 10)));
        const newData = [...prev, { time: `00:${timeSec.toString().padStart(2, '0')}`, score: newScore }];
        if (newData.length > 20) newData.shift();
        return newData;
      });

      // Occasionally detect a keyword
      if (Math.random() > 0.7) {
        const randomWord = possibleKeywords[Math.floor(Math.random() * possibleKeywords.length)];
        setKeywords(prev => {
          const newK = [{ word: randomWord, time: `00:${timeSec.toString().padStart(2, '0')}` }, ...prev];
          if (newK.length > 8) newK.pop();
          return newK;
        });
      }

    }, 2000);

    return () => clearInterval(interval);
  }, [interviewStatus, possibleKeywords]);


  const textColor = 'var(--text-secondary)';
  const gridColor = isDark ? '#334155' : '#e2e8f0';

  const radarData = [
    { subject: 'Communication', A: metrics.communication, fullMark: 100 },
    { subject: 'Voice', A: metrics.voiceConfidence, fullMark: 100 },
    { subject: 'Expressions', A: metrics.facialExpression, fullMark: 100 },
    { subject: 'Eye Contact', A: metrics.eyeContact, fullMark: 100 },
    { subject: 'Technical', A: 85, fullMark: 100 },
  ];

  return (
    <div className="animate-fade-in ai-interview-page">
      {/* Step 1: Welcome + Guidelines */}
      {phase === 'welcome' && (
        <InterviewWelcome onContinue={() => setPhase('setup')} />
      )}

      {/* Step 2: System check + camera preview */}
      {phase === 'setup' && (
        <InterviewInstructions 
          onProceed={() => setPhase('interview')} 
          userName={currentUserName}
          onStreamAcquired={handleStreamAcquired}
        />
      )}

      {/* Thank You page — shown after interview ends */}
      {phase === 'thankyou' && (
        <ThankYouPage
          score={Math.round((metrics.communication + metrics.voiceConfidence + metrics.facialExpression + metrics.eyeContact) / 4)}
          metrics={metrics}
          onSubmit={() => { window.location.href = '/'; }}
        />
      )}

      {/* Live interview — only rendered after setup */}
      {phase === 'interview' && (
        <div style={{
          background: '#0c0c0c',
          color: '#ffffff',
          fontFamily: 'Inter, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem 2rem',
          boxSizing: 'border-box',
          width: '100%',
          minHeight: 'calc(100vh - 100px)',
          borderRadius: '1rem',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
            width: '100%'
          }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ color: '#00c0f0', display: 'flex', alignItems: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(15deg)' }}>
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </div>
              <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '0.05em', color: '#ffffff' }}>
                ZENVORA
              </span>
            </div>

            {/* Exit button */}
            <button 
              onClick={() => {
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                if (mediaStream) {
                  mediaStream.getTracks().forEach(t => t.stop());
                  setMediaStream(null);
                }
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate('/');
                }
              }}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '0.375rem',
                color: '#ffffff',
                padding: '0.4rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.8)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Exit
            </button>
          </div>

          <div className="ai-interview-grid" style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', minHeight: 0 }}>
            <div style={{
              background: '#141416',
              borderRadius: '0.875rem',
              border: '2px solid #0084ff', 
              boxShadow: '0 0 15px rgba(0, 132, 255, 0.2)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              aspectRatio: '16/10',
              overflow: 'hidden'
            }}>
              {/* Interviewer Avatar */}
              <div style={{
                width: '180px',
                height: '180px',
                borderRadius: '50%',
                background: '#232326',
                border: '4px solid #2e2e33',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                <img 
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=256&auto=format&fit=crop" 
                  alt="Interviewer (IRA)" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              </div>

              {/* Name badge */}
              <div style={{
                position: 'absolute',
                bottom: '0.75rem',
                left: '0.75rem',
                background: 'rgba(0, 0, 0, 0.65)',
                color: '#ffffff',
                padding: '0.35rem 0.85rem',
                borderRadius: '999px',
                fontSize: '0.8rem',
                fontWeight: 600,
                backdropFilter: 'blur(4px)'
              }}>
                Interviewer (IRA)
              </div>
            </div>

            {/* Right Card: Candidate (Nikunj Agrawal) */}
            <div style={{
              background: '#141416',
              borderRadius: '0.875rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              aspectRatio: '16/10',
              overflow: 'hidden'
            }}>
              {/* Webcam stream video element */}
              {isVideoOn && mediaStream ? (
                <video 
                  ref={candidateVideoRef} 
                  autoPlay 
                  muted 
                  playsInline 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '0.75rem', 
                  color: '#6b7280' 
                }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: '#232326',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <VideoOff size={30} />
                  </div>
                  <span style={{ fontSize: '0.875rem' }}>Camera is off</span>
                </div>
              )}

              {/* Blinking REC indicator at top-right */}
              <div style={{
                position: 'absolute',
                top: '0.75rem',
                right: '0.75rem',
                background: 'rgba(0,0,0,0.65)',
                color: '#ffffff',
                padding: '0.35rem 0.85rem',
                borderRadius: '999px',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                backdropFilter: 'blur(4px)'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  animation: 'pulse 1.5s infinite'
                }} />
                Rec
              </div>

              {/* Name badge */}
              <div style={{
                position: 'absolute',
                bottom: '0.75rem',
                left: '0.75rem',
                background: 'rgba(0, 0, 0, 0.65)',
                color: '#ffffff',
                padding: '0.35rem 0.85rem',
                borderRadius: '999px',
                fontSize: '0.8rem',
                fontWeight: 600,
                backdropFilter: 'blur(4px)'
              }}>
                {currentUserName}
              </div>

              {/* Overlay controls (Mic & Cam) */}
              <div style={{
                position: 'absolute',
                bottom: '0.75rem',
                right: '0.75rem',
                display: 'flex',
                gap: '0.5rem',
                zIndex: 10
              }}>
                <button 
                  onClick={() => setIsMicOn(!isMicOn)} 
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: isMicOn ? 'rgba(0,0,0,0.6)' : '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backdropFilter: 'blur(4px)'
                  }}
                  title={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
                >
                  {isMicOn ? <Mic size={16} /> : <MicOff size={16} />}
                </button>
                <button 
                  onClick={() => {
                    if (isVideoOn) {
                      alert("Warning: Turning off the camera is not allowed during the interview. Your video feed must remain active for a fair assessment.");
                    } else {
                      setIsVideoOn(true);
                    }
                  }} 
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: isVideoOn ? 'rgba(0,0,0,0.6)' : '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backdropFilter: 'blur(4px)'
                  }}
                  title={isVideoOn ? 'Turn Video Off' : 'Turn Video On'}
                >
                  {isVideoOn ? <Video size={16} /> : <VideoOff size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Transcription Container */}
          <div style={{
            background: '#141416',
            borderRadius: '0.875rem',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '1.25rem 1.5rem',
            marginTop: '1.5rem',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            {/* Tag / Badge */}
            <div>
              <span style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: 'rgba(255, 255, 255, 0.7)',
                padding: '0.25rem 0.6rem',
                fontSize: '0.75rem',
                borderRadius: '4px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Transcription
              </span>
            </div>

            {/* Transcription text */}
            <div style={{
              fontSize: '1rem',
              lineHeight: 1.6,
              color: '#d1d5db',
              fontWeight: 400
            }}>
              {interviewQuestions[questionIndex]}
            </div>

            {/* Interaction Button (Next Question / Complete Assessment) */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '0.5rem'
            }}>
              <button
                onClick={() => {
                  if (questionIndex < interviewQuestions.length - 1) {
                    const nextIdx = questionIndex + 1;
                    setQuestionIndex(nextIdx);
                    speakText(interviewQuestions[nextIdx]);
                  } else {
                    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                    if (mediaStream) {
                      mediaStream.getTracks().forEach(t => t.stop());
                      setMediaStream(null);
                    }
                    setPhase('thankyou');
                  }
                }}
                style={{
                  background: '#0084ff',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.375rem',
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#0070d9'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#0084ff'}
              >
                {questionIndex === 0 ? 'Start Assessment' : 
                 questionIndex === interviewQuestions.length - 1 ? 'Complete Assessment' : 
                 'Next Question'}
              </button>
            </div>
          </div>

          {/* Styling overrides */}
          <style>{`
            @keyframes pulse {
              0% { opacity: 1; }
              50% { opacity: 0.4; }
              100% { opacity: 1; }
            }

            @media (max-width: 1024px) {
              .ai-interview-grid {
                grid-template-columns: 1fr !important;
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
const Badge = ({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string, color: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '0.5rem 1rem', borderRadius: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
    <div style={{ color }}>{icon}</div>
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>{value}</span>
    </div>
  </div>
);

const controlBtnStyle = (bg: string, color: string) => ({
  width: '48px', height: '48px', borderRadius: '50%',
  background: bg, color: color, border: 'none',
  display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
  cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0
});
