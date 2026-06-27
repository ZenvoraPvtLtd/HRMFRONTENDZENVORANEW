import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTopHeaderSearch } from '../../hooks/useTopHeaderSearch';
import {
    ChatSidebar, ChatTopBar, ChatFullHeader, ZeroState,
    MessageBubble, TypingIndicator, ChatInput, FloatingTriggerButton,
    type Message, type ChatSession, type PromptCard
} from './ChatbotShared';

const initialSessions: ChatSession[] = [
    {
        id: '1', title: 'Leave Balance Check', timestamp: 'Today, 10:45 AM',
        messages: [
            { id: 'm1', sender: 'user', text: 'Check my leave balance', timestamp: '10:45 AM' },
            { id: 'm2', sender: 'bot', text: 'You currently have **4 Paid Leaves**, **2 Sick Leaves**, and **3 Casual Leaves** remaining.', timestamp: '10:45 AM', actionLink: { label: 'Request Leave', url: '/dashboard/attendance' } }
        ]
    },
    {
        id: '2', title: 'Salary & Payslip Details', timestamp: 'Yesterday',
        messages: [
            { id: 'm3', sender: 'user', text: 'Show my salary details', timestamp: 'Yesterday' },
            { id: 'm4', sender: 'bot', text: 'Your last payslip for April 2026:\n\n*   **Basic:** $4,500\n*   **HRA:** $1,200\n*   **Deductions:** $350\n*   **Net Pay:** $5,350', timestamp: 'Yesterday' }
        ]
    },
    {
        id: '3', title: 'WFH Policy', timestamp: 'May 16',
        messages: [
            { id: 'm5', sender: 'user', text: 'Explain the work from home policy', timestamp: 'May 16' },
            { id: 'm6', sender: 'bot', text: 'Our **Remote Work Policy** allows up to **2 days of WFH per week**. You must inform your manager at least 24 hours in advance.', timestamp: 'May 16' }
        ]
    }
];

const employeePromptSets: PromptCard[][] = [
    [
        { title: "Leave Balance", desc: "Check remaining paid/sick/casual leaves", query: "Check my leave balance" },
        { title: "Salary & Payslip", desc: "View latest payslip and salary breakdown", query: "Show my salary details and payslip" },
        { title: "Company Policies", desc: "Explains HR policies in simple language", query: "Explain the work from home policy" },
        { title: "My Tasks", desc: "Check pending, in-progress & completed tasks", query: "What is my current task status?" },
    ],
    [
        { title: "Attendance", desc: "View your monthly attendance summary", query: "Show my attendance summary" },
        { title: "Follow-ups", desc: "Check any pending follow-up actions", query: "Show my pending follow-ups" },
        { title: "Leave Balance", desc: "Check remaining paid/sick/casual leaves", query: "Check my leave balance" },
        { title: "Salary & Payslip", desc: "View latest payslip and salary breakdown", query: "Show my salary details and payslip" },
    ]
];

export default function EmployeeChatbot({ isFullScreen = false }: { isFullScreen?: boolean }) {
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

    interface SpeechRecognitionLike {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onstart?: () => void;
        onend?: () => void;
        onerror?: (e: Event) => void;
        onresult?: (e: Event) => void;
        start: () => void;
        stop: () => void;
    }

    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const messagesRef = useRef(messages);
    const activeSessionIdRef = useRef(activeSessionId);

    useEffect(() => {
        messagesRef.current = messages;
        activeSessionIdRef.current = activeSessionId;
    }, [messages, activeSessionId]);

    const userName = localStorage.getItem('userName') || localStorage.getItem('userEmail') || 'Employee';
    const hour = new Date().getHours();
    const greetingTime = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    useEffect(() => {
        const w = window as unknown as { SpeechRecognition?: { new(): SpeechRecognitionLike }; webkitSpeechRecognition?: { new(): SpeechRecognitionLike } };
        const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
        if (!SpeechRecognitionCtor) return;
        const rec = new SpeechRecognitionCtor();
        rec.continuous = false; rec.interimResults = false; rec.lang = 'en-US';
        rec.onstart = () => setIsListening(true);
        rec.onend = () => setIsListening(false);
        type ErrorEventLike = { error?: unknown };
        type RecEvent = { results: { [i: number]: { [j: number]: { transcript: string } } } };
        rec.onerror = (e: Event) => { console.error("Speech error", (e as unknown as ErrorEventLike).error); setIsListening(false); };
        rec.onresult = (e: Event) => {
            const ev = e as unknown as RecEvent;
            const transcript = ev?.results?.[0]?.[0]?.transcript ?? '';
            setInputMessage(prev => prev ? prev + ' ' + transcript : transcript);
        };
        recognitionRef.current = rec;
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) { alert("Speech recognition not supported. Try Google Chrome."); return; }
        if (isListening) recognitionRef.current.stop(); else recognitionRef.current.start();
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
            let botResponseText = `I have processed your query regarding "${trimmed}". Need help with leaves, payslips, or policies? Just ask!`;
            let botOptions: string[] | undefined;
            let actionLink: { label: string; url: string } | undefined;
            const lower = trimmed.toLowerCase();

            if (lower.includes('leave') || lower.includes('balance')) {
                botResponseText = "You currently have **4 Paid Leaves**, **2 Sick Leaves**, and **3 Casual Leaves** remaining.";
                actionLink = { label: "Request Leave", url: "/dashboard/attendance" };
            } else if (lower.includes('salary') || lower.includes('payslip')) {
                botResponseText = "Your last payslip for April 2026:\n\n*   **Basic:** $4,500\n*   **HRA:** $1,200\n*   **Deductions:** $350\n*   **Net Pay:** $5,350";
                actionLink = { label: "View Attendance", url: "/dashboard/attendance" };
            } else if (lower.includes('policy') || lower.includes('work from home') || lower.includes('wfh')) {
                botResponseText = "Our **Remote Work Policy** allows up to **2 days of WFH per week**. Inform your manager at least **24 hours in advance** and ensure core hours overlap.";
            } else if (lower.includes('task') || lower.includes('status')) {
                botResponseText = "Your current task summary:\n\n*   **Pending:** API Integration, UI Audit\n*   **In Progress:** Dashboard Redesign\n*   **Completed:** 3 tasks this week";
            } else if (lower.includes('attendance')) {
                botResponseText = "Your attendance for May 2026:\n\n*   **Present:** 18 days\n*   **Absent:** 1 day\n*   **On Leave:** 2 days\n*   **Attendance Rate:** 94.7%";
                actionLink = { label: "View Attendance", url: "/dashboard/attendance" };
            } else if (lower.includes('follow-up') || lower.includes('followup') || lower.includes('follow up')) {
                botResponseText = "You have **2 pending follow-ups** this week:\n\n*   **Project Review** - Due tomorrow\n*   **Team Sync** - Due Friday";
                actionLink = { label: "View Follow-ups", url: "/dashboard/follow-up" };
            } else {
                botOptions = [" Leave Balance", " Salary Details", " Task Status", " Attendance"];
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

    const activePrompts = employeePromptSets[promptSetIndex];

    const renderChatContent = (full: boolean) => (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: full ? 'var(--bg-primary)' : 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'inherit', position: 'relative' }}>
            {!full && <ChatTopBar isMinimized={isMinimized} onReset={handleResetChat} onToggleMinimize={() => setIsMinimized(!isMinimized)} onClose={() => setIsOpen(false)} />}
            {full && <ChatFullHeader label="Employee Assistant" onReset={handleResetChat} onClose={() => navigate('/dashboard')} />}

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {messages.length === 0 && (
                    <ZeroState full={full} greetingTime={greetingTime} userName={userName} activePrompts={activePrompts} onSendMessage={handleSendMessage} onTogglePromptSet={() => setPromptSetIndex(p => (p + 1) % employeePromptSets.length)} />
                )}
                {messages.length > 0 && (
                    <div style={{ padding: full ? '2.5rem 4rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, maxWidth: full ? '1200px' : '100%', margin: '0 auto', width: '100%' }}>
                        {messages.map(msg => (
                            <MessageBubble key={msg.id} msg={msg} full={full} onSendMessage={handleSendMessage} />
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
            {!isOpen && <FloatingTriggerButton showBadge={false} onOpen={() => { setIsOpen(true); setIsMinimized(false); }} />}
            {isOpen && (
                <div className="card animate-fade-in" style={{ position: 'fixed', bottom: '2rem', right: '2rem', width: 'calc(100vw - 4rem)', maxWidth: '480px', height: isMinimized ? '68px' : '650px', maxHeight: 'calc(100vh - 4rem)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 1000, transition: 'height 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
                    {renderChatContent(false)}
                </div>
            )}
        </>
    );
}
