import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axiosInstance';
import { useTopHeaderSearch } from '../../hooks/useTopHeaderSearch';
import {
    ChatSidebar, ChatTopBar, ChatFullHeader, ZeroState,
    MessageBubble, TypingIndicator, ChatInput, FloatingTriggerButton,
    type Message, type ChatSession, type PromptCard
} from './ChatbotShared';

type BrowserSpeechRecognition = {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: ((event: { error: string }) => void) | null;
    onresult: ((event: { results: { [index: number]: { transcript: string } }[] }) => void) | null;
    start: () => void;
    stop: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechWindow = Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type StoredInterview = {
    id: string;
    candidate: {
        name: string;
        role: string;
        avatarColor: string;
        email: string;
        phone: string;
        aiFit: number;
    };
    datetime: string;
    duration: string;
    type: string;
    status: string;
    meetingLink?: string;
    timestamp?: number;
    rawDate?: string;
    rawTime?: string;
};

const initialSessions: ChatSession[] = [
    {
        id: '1', title: 'Leave Balance Check', timestamp: 'Today, 10:45 AM',
        messages: [
            { id: 'm1', sender: 'user', text: 'Check my leave balance', timestamp: '10:45 AM' },
            { id: 'm2', sender: 'bot', text: 'You currently have 4 Paid Leaves, 2 Sick Leaves, and 3 Casual Leaves remaining.', timestamp: '10:45 AM', actionLink: { label: 'Request Leave', url: '/attendance' } }
        ]
    },
    {
        id: '2', title: 'Salary & Payslip Details', timestamp: 'Yesterday',
        messages: [
            { id: 'm3', sender: 'user', text: 'Show my salary details and payslip', timestamp: 'Yesterday' },
            { id: 'm4', sender: 'bot', text: 'Your last payslip for April 2026 has been generated. Basic: $4,500, HRA: $1,200. Total Net Pay: $5,350.', timestamp: 'Yesterday', actionLink: { label: 'Download Payslip', url: '/dashboard' } }
        ]
    },
    {
        id: '3', title: 'HR Policy Explanation', timestamp: 'May 16',
        messages: [
            { id: 'm5', sender: 'user', text: 'Explain the work from home policy', timestamp: 'May 16' },
            { id: 'm6', sender: 'bot', text: 'Our Remote Work Policy allows up to 2 days of WFH per week. You must inform your manager at least 24 hours in advance.', timestamp: 'May 16' }
        ]
    }
];

const hrPromptSets: PromptCard[][] = [
    [
        { title: "Leave Approvals", desc: "Manage and approve pending leave requests", query: "Pending leave approvals list" },
        { title: "Interview Scheduling", desc: "Schedule a new candidate interview slot", query: "Schedule an interview" },
        { title: "Candidate Management", desc: "Review applicants & resume matches", query: "Show recent candidate applications" },
        { title: "Attendance Reports", desc: "Get employee monthly attendance breakdown", query: "Show attendance reports" },
    ],
    [
        { title: "Payroll Generation", desc: "Process salary & download latest payslips", query: "Generate monthly payroll reports" },
        { title: "Leave Balance", desc: "Check personal leave breakdown", query: "Check my leave balance" },
        { title: "Company Policies", desc: "Review work-from-home rules", query: "Explain the work from home policy" },
        { title: "Hiring Pipeline", desc: "Get updates on recent openings status", query: "Get real-time updates on the hiring pipeline" },
    ]
];

export default function HRChatbot({ isFullScreen = false }: { isFullScreen?: boolean }) {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(isFullScreen);
    const [isMinimized, setIsMinimized] = useState(false);
    const [sessions, setSessions] = useState<ChatSession[]>(initialSessions);
    const [activeSessionId, setActiveSessionId] = useState('1');
    const [searchQuery, setSearchQuery] = useTopHeaderSearch();
    const [messages, setMessages] = useState<Message[]>(initialSessions[0].messages);
    const [inputMessage, setInputMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [promptSetIndex, setPromptSetIndex] = useState(0);
    const [aiModel, setAiModel] = useState<'Smart' | 'Advanced'>('Smart');
    const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
    const messagesRef = useRef(messages);
    const activeSessionIdRef = useRef(activeSessionId);

    useEffect(() => {
        messagesRef.current = messages;
        activeSessionIdRef.current = activeSessionId;
    }, [messages, activeSessionId]);

    const userName = localStorage.getItem('hr_userName') || localStorage.getItem('userName') || 'User';
    const hour = new Date().getHours();
    const greetingTime = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    useEffect(() => {
        const speechWindow = window as SpeechWindow;
        const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        const rec = new SpeechRecognition();
        rec.continuous = false; rec.interimResults = false; rec.lang = 'en-US';
        rec.onstart = () => setIsListening(true);
        rec.onend = () => setIsListening(false);
        rec.onerror = (e) => { console.error("Speech error", e.error); setIsListening(false); };
        rec.onresult = (e) => setInputMessage(prev => prev ? prev + ' ' + e.results[0][0].transcript : e.results[0][0].transcript);
        recognitionRef.current = rec;
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) { alert("Speech recognition not supported. Try Google Chrome."); return; }
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
    };

    useEffect(() => {
        if ((isOpen || isFullScreen) && !isMinimized && messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen, isMinimized, isTyping, isFullScreen]);

    const updateSessionMessages = (newMsgs: Message[], sessId: string) => {
        setSessions(prev => prev.map(s => {
            if (s.id !== sessId) return s;
            let title = s.title;
            if (s.title === 'New Copilot Thread' && newMsgs.length > 0) {
                const first = newMsgs.find(m => m.sender === 'user');
                if (first) title = first.text.slice(0, 26) + (first.text.length > 26 ? '...' : '');
            }
            return { ...s, title, timestamp: 'Just now', messages: newMsgs };
        }));
    };

    const handleSelectSession = (id: string) => {
        setActiveSessionId(id);
        const s = sessions.find(x => x.id === id);
        if (s) setMessages(s.messages);
    };

    const handleDeleteSession = (id: string) => {
        const remaining = sessions.filter(s => s.id !== id);
        setSessions(remaining);
        if (activeSessionId === id) {
            if (remaining.length > 0) { setActiveSessionId(remaining[0].id); setMessages(remaining[0].messages); }
            else setMessages([]);
        }
    };

    const handleNewSession = () => {
        const newId = Date.now().toString();
        const newSess: ChatSession = { id: newId, title: 'New Copilot Thread', timestamp: 'Just now', messages: [] };
        setSessions(prev => [newSess, ...prev]);
        setActiveSessionId(newId);
        setMessages([]);
    };

    const filteredSessions = sessions.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.messages.some(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleConfirmCalendarSchedule = (msgId: string, email: string, date: string, time: string) => {
        const parsedDate = new Date(date);
        const dateStr = isNaN(parsedDate.getTime()) ? date : parsedDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long' });
        const meetCode = `${Math.random().toString(36).substring(2,5)}-${Math.random().toString(36).substring(2,6)}-${Math.random().toString(36).substring(2,5)}`;
        const meetLink = `https://meet.google.com/${meetCode}`;
        const candidateName = email.split('@')[0].split(/[._-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        api.post("/api/notifications", { title: "Interview Scheduled", message: `A Technical Interview has been scheduled with "${candidateName}" (${email}) for ${dateStr} at ${time}.`, type: "interview_scheduled", role: "hr" }).catch(console.error);
        api.post("/api/notifications", { title: "Interview Scheduled", message: `A Technical Interview has been scheduled for you on ${dateStr} at ${time}.`, type: "interview_scheduled", role: "candidate" }).catch(console.error);

        setMessages(prev => {
            const updated = prev.map(msg => msg.id !== msgId ? msg : {
                ...msg, isScheduled: true,
                text: ` **Meeting Successfully Scheduled!**\n\nI have scheduled a **Technical Interview** with **${candidateName}** (${email}):\n\n*   **Date:** ${dateStr}\n*   **Time:** ${time}\n*   **Platform:** Google Meet\n*   **Meeting Link:** [${meetLink}](${meetLink})\n\n Email notification dispatched to **${email}**!`,
                actionLink: { label: "View Interviews Dashboard", url: "/interviews" }
            });
            setTimeout(() => updateSessionMessages(updated, activeSessionIdRef.current), 50);
            return updated;
        });

        const defaultInterviews = [
            { id: "INT-21918", candidate: { name: "Anugrah Prasetya", role: "Frontend Developer", avatarColor: "#3b82f6", email: "anugrah.p@devmail.com", phone: "+62 812 3456 7890", aiFit: 94 }, datetime: "24 July, 10:00 AM", duration: "45 Mins", type: "Technical Round", status: "pending" },
            { id: "INT-37189", candidate: { name: "Denny Malik", role: "Backend Developer", avatarColor: "#f59e0b", email: "denny.malik@coder.io", phone: "+62 813 9876 5432", aiFit: 88 }, datetime: "22 August, 02:00 PM", duration: "60 Mins", type: "System Design", status: "rejected" },
            { id: "INT-41621", candidate: { name: "Silvia Cintia Bakri", role: "Product Designer", avatarColor: "#10b981", email: "silvia@designstudio.net", phone: "+62 811 2345 6789", aiFit: 96 }, datetime: "01 August, 11:30 AM", duration: "30 Mins", type: "HR Round", status: "approved" }
        ];
        let stored: StoredInterview[];
        try { 
            const parsed = JSON.parse(localStorage.getItem('scheduled_interviews') || '');
            stored = Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultInterviews;
        } catch { 
            stored = [...defaultInterviews]; 
        }
        stored.unshift({ id: `INT-${Math.floor(10000 + Math.random() * 90000)}`, candidate: { name: candidateName, role: "Frontend Developer", avatarColor: ["#3b82f6","#f59e0b","#10b981","#8b5cf6","#ec4899"][Math.floor(Math.random()*5)], email, phone: "+91 98765 43210", aiFit: Math.floor(75 + Math.random() * 21) }, datetime: `${dateStr}, ${time}`, duration: "45 Mins", type: "Technical Round", status: "pending", meetingLink: meetLink, timestamp: Date.now(), rawDate: date, rawTime: time });
        localStorage.setItem('scheduled_interviews', JSON.stringify(stored));
    };

    const handleSendMessage = (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const messageContent = attachedFileName ? `${trimmed}\n[Attached File: ${attachedFileName}]` : trimmed;
        const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: messageContent, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
        const updatedUserMsgs = [...messages, userMsg];
        setMessages(updatedUserMsgs);
        updateSessionMessages(updatedUserMsgs, activeSessionIdRef.current);
        setInputMessage('');
        setAttachedFileName(null);
        setIsTyping(true);

        setTimeout(() => {
            let botResponseText = `I have processed your query regarding "${trimmed}". Feel free to ask about leaves, candidates, payroll, or attendance!`;
            let botOptions: string[] | undefined;
            let actionLink: { label: string; url: string } | undefined;
            const lower = trimmed.toLowerCase();

            if (lower.includes('schedule') || lower.includes('meeting') || lower.includes('interview') || lower.includes('calender') || lower.includes('calendar')) {
                const emailMatch = trimmed.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                const email = emailMatch ? emailMatch[0] : "";
                const botMsg: Message = {
                    id: (Date.now() + 1).toString(), sender: 'bot',
                    text: email ? `I detected the candidate email **${email}**. Please choose a date and time slot below!` : `Sure! Fill in the candidate email, date, and time slot below to schedule.`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    isCalendarSelector: true, candidateEmail: email || undefined
                };
                const updatedBotMsgs = [...messagesRef.current, botMsg];
                setMessages(updatedBotMsgs);
                updateSessionMessages(updatedBotMsgs, activeSessionIdRef.current);
                setIsTyping(false);
                return;
            } else if (lower.includes('leave approvals') || lower.includes('pending leave')) {
                botResponseText = "Pending Leave Approvals:\n\n*   **Sarah Jenkins:** Annual Leave (July 24–28) - *Pending*\n*   **Alex River:** Sick Leave (May 20) - *Pending*\n\nWould you like to approve these?";
                actionLink = { label: "Go to Attendance & Leaves", url: "/attendance" };
            } else if (lower.includes('candidate') || lower.includes('applicant')) {
                botResponseText = "Zenvora Candidate Pipeline:\n\n*   **Active Candidates:** 15\n*   **New Applications Today:** 3\n*   **Highest AI Fit:** 96% (Silvia Cintia Bakri)";
                actionLink = { label: "Manage Candidates", url: "/candidates" };
            } else if (lower.includes('attendance')) {
                botResponseText = "Attendance Summary (May 2026):\n\n*   **Avg Attendance:** 94.2%\n*   **Present Today:** 10/12 employees\n*   **On Leave:** 2 employees";
                actionLink = { label: "View Attendance", url: "/attendance" };
            } else if (lower.includes('payroll') || lower.includes('generate payroll')) {
                botResponseText = "Payroll Status:\n\n*   **Disbursement:** $48,500\n*   **Employees Processed:** 12\n*   **Status:** 12 payslips generated successfully.";
                actionLink = { label: "Review Salary Sheets", url: "/" };
            } else if (lower.includes('leave') || lower.includes('balance')) {
                botResponseText = "You currently have 4 Paid Leaves, 2 Sick Leaves, and 3 Casual Leaves remaining.";
                actionLink = { label: "Request Leave", url: "/attendance" };
            } else if (lower.includes('salary') || lower.includes('payslip')) {
                botResponseText = "Your last payslip for April 2026: Basic $4,500, HRA $1,200, Deductions $350. Net Pay: $5,350.";
                actionLink = { label: "Download Payslip", url: "/" };
            } else if (lower.includes('policy') || lower.includes('wfh')) {
                botResponseText = "Our Remote Work Policy allows up to 2 days WFH per week. Inform your manager at least 24 hours in advance.";
            } else if (lower.includes('pipeline') || lower.includes('hiring')) {
                botResponseText = "Hiring pipeline: 5 in screening, 2 technical interviews today, 1 offer pending approval.";
                actionLink = { label: "View Candidates", url: "/candidates" };
            } else {
                botOptions = [" Leave Approvals", " Candidate Management", " Attendance Reports", " Payroll Generation"];
            }

            const botMsg: Message = { id: (Date.now() + 1).toString(), sender: 'bot', text: botResponseText, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), options: botOptions, actionLink };
            const updatedBotMsgs = [...messagesRef.current, botMsg];
            setMessages(updatedBotMsgs);
            updateSessionMessages(updatedBotMsgs, activeSessionIdRef.current);
            setIsTyping(false);
        }, 1200);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(inputMessage); }
    };

    const handleResetChat = () => {
        setMessages([]); setAttachedFileName(null);
        updateSessionMessages([], activeSessionIdRef.current);
    };

    const activePrompts = hrPromptSets[promptSetIndex];

    const renderChatContent = (full: boolean) => (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: full ? 'var(--bg-primary)' : 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'inherit', position: 'relative' }}>
            {!full && <ChatTopBar isMinimized={isMinimized} onReset={handleResetChat} onToggleMinimize={() => setIsMinimized(!isMinimized)} onClose={() => setIsOpen(false)} />}
            {full && <ChatFullHeader label="Smart HR Assistant" onReset={handleResetChat} onClose={() => navigate('/')} />}

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {messages.length === 0 && (
                    <ZeroState full={full} greetingTime={greetingTime} userName={userName} activePrompts={activePrompts} onSendMessage={handleSendMessage} onTogglePromptSet={() => setPromptSetIndex(p => (p + 1) % hrPromptSets.length)} />
                )}
                {messages.length > 0 && (
                    <div style={{ padding: full ? '2.5rem 4rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, maxWidth: full ? '1200px' : '100%', margin: '0 auto', width: '100%' }}>
                        {messages.map(msg => (
                            <MessageBubble key={msg.id} msg={msg} full={full} onSendMessage={handleSendMessage} onConfirmCalendar={handleConfirmCalendarSchedule} />
                        ))}
                        {isTyping && <TypingIndicator />}
                        <div ref={messagesEndRef} />
                    </div>
                )}
                <ChatInput
                    full={full} inputMessage={inputMessage} isTyping={isTyping} isListening={isListening}
                    attachedFileName={attachedFileName} aiModel={aiModel}
                    onInputChange={setInputMessage} onKeyDown={handleKeyDown}
                    onSend={() => handleSendMessage(inputMessage)} onToggleListening={toggleListening}
                    onAttachClick={() => fileInputRef.current?.click()}
                    onRemoveAttachment={() => setAttachedFileName(null)}
                    onToggleModel={() => setAiModel(p => p === 'Smart' ? 'Advanced' : 'Smart')}
                    fileInputRef={fileInputRef} onFileChange={e => { const f = e.target.files?.[0]; if (f) setAttachedFileName(f.name); }}
                />
            </div>
        </div>
    );

    if (isFullScreen) {
        return (
            <div className="animate-fade-in" style={{ width: '100%', height: 'calc(100vh - 70px)', background: 'var(--bg-primary)', display: 'flex', overflow: 'hidden' }}>
                <ChatSidebar
                    sessions={filteredSessions} activeSessionId={activeSessionId} searchQuery={searchQuery}
                    onSearchChange={setSearchQuery} onSelectSession={handleSelectSession}
                    onDeleteSession={handleDeleteSession} onNewSession={handleNewSession}
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    {renderChatContent(true)}
                </div>
            </div>
        );
    }

    return (
        <>
            {!isOpen && <FloatingTriggerButton onOpen={() => { setIsOpen(true); setIsMinimized(false); }} />}
            {isOpen && (
                <div className="card animate-fade-in" style={{ position: 'fixed', bottom: '2rem', right: '2rem', width: '100%', maxWidth: '480px', height: isMinimized ? '68px' : '650px', maxHeight: 'calc(100vh - 4rem)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 1000, transition: 'height 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
                    {renderChatContent(false)}
                </div>
            )}
        </>
    );
}
