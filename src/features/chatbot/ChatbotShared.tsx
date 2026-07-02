import { useRef, useState, type KeyboardEvent } from 'react';
import {
    Bot, Sparkles, Send, X, User, Paperclip,
    Loader2, ChevronDown, Info, Plus, Trash2,
    Calendar, Mic, MicOff
} from 'lucide-react';
import RefreshButton from '../../components/button/RefreshButton';
import ResetButton from '../../components/button/ResetButton';

// Types 

export interface Message {
    id: string;
    sender: 'bot' | 'user';
    text: string;
    timestamp: string;
    options?: string[];
    actionLink?: { label: string; url: string };
    isCalendarSelector?: boolean;
    candidateEmail?: string;
    isScheduled?: boolean;
}

export interface ChatSession {
    id: string;
    title: string;
    timestamp: string;
    messages: Message[];
}

export interface PromptCard {
    title: string;
    desc: string;
    query: string;
}

//  Markdown renderer

import React from 'react';

export const MarkdownRenderer: React.FC<{ text: string }> = ({ text }) => {
    const lines = text.split('\n');
    return <>
        {lines.map((line, i) => {
            const parseBold = (str: string) => {
                const parts = str.split(/\*\*(.*?)\*\*/g);
                return parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part);
            };
            if (/^\s*[*-]\s{1,3}/.test(line)) {
                const content = line.replace(/^\s*[*-]\s{1,3}/, '');
                return (
                    <div key={i} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <span style={{ opacity: 0.5, flexShrink: 0 }}>•</span>
                        <span>{parseBold(content)}</span>
                    </div>
                );
            }
            if (line.trim() === '') return <div key={i} style={{ height: '0.5rem' }} />;
            return <div key={i}>{parseBold(line)}</div>;
        })}
    </>;
};

//  ChatSidebar 

interface ChatSidebarProps {
    sessions: ChatSession[];
    activeSessionId: string;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    onSelectSession: (id: string) => void;
    onDeleteSession: (id: string) => void;
    onNewSession: () => void;
}

export function ChatSidebar({
    sessions, activeSessionId,
    onSelectSession, onDeleteSession, onNewSession
}: ChatSidebarProps) {
    return (
        <div style={{
            width: '280px', height: '100%', background: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
            flexShrink: 0, boxShadow: '4px 0 24px rgba(0,0,0,0.05)', zIndex: 10
        }}>
            {/* Brand */}
            <div style={{ padding: '1.5rem 1.25rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '0.5rem',
                    background: 'var(--accent)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', boxShadow: '0 0 16px rgba(0,0,0,0.15)'
                }}>
                    <Bot size={18} color="var(--accent-text)" />
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    Zenvora <span style={{ color: 'var(--accent)', opacity: 0.7 }}>AI</span>
                </div>
            </div>

            {/* New Chat */}
            <div style={{ padding: '0.25rem 1.25rem 1rem' }}>
                <button
                    onClick={onNewSession}
                    style={{
                        width: '100%', padding: '0.75rem 1rem', borderRadius: '0.5rem',
                        background: 'var(--icon-accent-bg)', color: 'var(--text-primary)',
                        border: '1px solid var(--border)', fontWeight: 600, fontSize: '0.85rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: '0.5rem', cursor: 'pointer', transition: 'all 0.3s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--icon-accent-bg)'}
                >
                    <Plus size={16} /> New Chat
                </button>
            </div>

            {/* Search */}
            <div style={{ padding: '0 1.25rem 1rem' }}>
            </div>

            {/* Sessions */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', padding: '0.5rem 0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Recent Chats
                </div>
                {sessions.map(sess => (
                    <div
                        key={sess.id}
                        onClick={() => onSelectSession(sess.id)}
                        style={{
                            padding: '0.75rem', borderRadius: '0.5rem',
                            background: sess.id === activeSessionId ? 'var(--bg-hover)' : 'transparent',
                            border: `1px solid ${sess.id === activeSessionId ? 'var(--border)' : 'transparent'}`,
                            cursor: 'pointer', display: 'flex', flexDirection: 'column',
                            gap: '0.25rem', transition: 'all 0.2s', position: 'relative', overflow: 'hidden'
                        }}
                        onMouseEnter={e => { if (sess.id !== activeSessionId) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                        onMouseLeave={e => { if (sess.id !== activeSessionId) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                        {sess.id === activeSessionId && (
                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', paddingLeft: sess.id === activeSessionId ? '6px' : '0', transition: 'padding 0.2s' }}>
                            <span style={{
                                fontSize: '0.85rem', fontWeight: sess.id === activeSessionId ? 600 : 400,
                                color: sess.id === activeSessionId ? 'var(--text-primary)' : 'var(--text-secondary)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>
                                {sess.title}
                            </span>
                            <button
                                onClick={e => { e.stopPropagation(); onDeleteSession(sess.id); }}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.125rem', opacity: sess.id === activeSessionId ? 0.8 : 0.3 }}
                                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
                {sessions.length === 0 && (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        No history found
                    </div>
                )}
            </div>
        </div>
    );
}

// ChatTopBar (floating mode)

interface ChatTopBarProps {
    isMinimized: boolean;
    onReset: () => void;
    onToggleMinimize: () => void;
    onClose: () => void;
}

export function ChatTopBar({ isMinimized, onReset, onToggleMinimize, onClose }: ChatTopBarProps) {
    return (
        <div style={{
            padding: '1rem 1.5rem', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', borderBottom: '1px solid var(--border)',
            background: 'var(--bg-secondary)', userSelect: 'none', flexShrink: 0
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '0.75rem',
                    background: 'var(--accent)', color: 'var(--accent-text)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}>
                    <Bot size={18} />
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Zenvora AI
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '1rem', background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                        3.5 Smart
                    </span>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ResetButton onClick={onReset} compact />
                <button
                    onClick={onToggleMinimize}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '0.375rem', borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                    <ChevronDown size={18} style={{ transform: isMinimized ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                <button
                    onClick={onClose}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '0.375rem', borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
}

// ChatFullHeader (fullscreen mode)

interface ChatFullHeaderProps {
    label: string;
    onReset: () => void;
    onClose: () => void;
}

export function ChatFullHeader({ label, onReset, onClose }: ChatFullHeaderProps) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '1.25rem 2.5rem', borderBottom: '1px solid var(--border)',
            background: 'var(--bg-secondary)', zIndex: 10
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    Zenvora AI Copilot
                </div>
                <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--icon-accent-bg)', padding: '0.25rem 0.625rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)', animation: 'pulse 2s infinite' }} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {label}
                    </span>
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <ResetButton onClick={onReset} compact />
                <button
                    onClick={onClose}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '38px', height: '38px', borderRadius: '50%',
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                        color: '#f87171', cursor: 'pointer', transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.16)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.6)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.color = '#f87171'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
}

//  ZeroState (empty chat)

interface ZeroStateProps {
    full: boolean;
    greetingTime: string;
    userName: string;
    activePrompts: PromptCard[];
    onSendMessage: (text: string) => void;
    onTogglePromptSet: () => void;
}

export function ZeroState({ full, greetingTime, userName, activePrompts, onSendMessage, onTogglePromptSet }: ZeroStateProps) {
    return (
        <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: full ? '4rem 4rem 2rem' : '2.5rem 1.5rem 1.5rem',
            textAlign: 'center', maxWidth: full ? '1400px' : '800px', margin: '0 auto', width: '100%'
        }}>
            <div style={{
                width: full ? '88px' : '64px', height: full ? '88px' : '64px', borderRadius: '50%', margin: '0 auto 1.5rem',
                background: 'var(--accent)', opacity: 0.9,
                boxShadow: '0 12px 36px rgba(0,0,0,0.15)',
                animation: 'float 3s ease-in-out infinite'
            }} />

            <h1 style={{ fontSize: full ? '2.5rem' : '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {greetingTime}, {userName}
            </h1>
            <h2 style={{ fontSize: full ? '2.25rem' : '1.35rem', fontWeight: 800, color: 'var(--text-secondary)', margin: '0 0 1rem', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                Can I help you with anything?
            </h2>
            <p style={{ fontSize: full ? '1rem' : '0.85rem', color: 'var(--text-secondary)', margin: '0 0 2.5rem', opacity: 0.7, maxWidth: '460px' }}>
                Choose a prompt below or write your own to start chatting with Zenvora AI
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: full ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)', gap: '1rem', width: '100%', marginBottom: '1.25rem' }}>
                {activePrompts.map((p, idx) => (
                    <div
                        key={idx}
                        onClick={() => onSendMessage(p.query)}
                        style={{
                            padding: '1.25rem 1rem', borderRadius: '1.25rem',
                            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                            cursor: 'pointer', textAlign: 'left', transition: 'all 0.25s',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                            display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)'; }}
                    >
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', lineHeight: 1.3 }}>{p.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.8, lineHeight: 1.4 }}>{p.desc}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', marginBottom: '2rem' }}>
                <RefreshButton label="Refresh prompts" onClick={onTogglePromptSet} compact style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)' }} />
            </div>
        </div>
    );
}

//  MessageBubble 

interface CalendarSelectorProps {
    msgId: string;
    candidateEmail?: string;
    onConfirm: (msgId: string, email: string, date: string, time: string) => void;
}

function CalendarSelector({ msgId, candidateEmail, onConfirm }: CalendarSelectorProps) {
    const selectedSlotRef = useRef<string | null>(null);
    const [minDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [defaultDate] = useState(() => new Date(Date.now() + 86400000).toISOString().split('T')[0]);

    const handleConfirm = () => {
        const dateVal = (document.getElementById(`date-input-${msgId}`) as HTMLInputElement)?.value;
        const emailInput = document.getElementById(`email-input-${msgId}`) as HTMLInputElement;
        const emailVal = candidateEmail || emailInput?.value;

        if (!emailVal || !emailVal.includes('@')) {
            alert("Please provide a valid candidate email!");
            return;
        }

        onConfirm(msgId, emailVal, dateVal, selectedSlotRef.current || "03:00 PM");
    };

    return (
        <div style={{
            marginTop: '1rem', padding: '1.25rem', borderRadius: '1.25rem',
            background: 'var(--bg-primary)', border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)', maxWidth: '400px',
            display: 'flex', flexDirection: 'column', gap: '1rem'
        }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <Calendar size={18} /> Schedule Interview Slot
            </div>

            {!candidateEmail && (
                <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>Candidate Email</label>
                    <input
                        type="email"
                        id={`email-input-${msgId}`}
                        placeholder="candidate@example.com"
                        style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.75rem', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none' }}
                    />
                </div>
            )}

            <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>Select Interview Date</label>
                <input
                    type="date"
                    id={`date-input-${msgId}`}
                    min={minDate}
                    defaultValue={defaultDate}
                    style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.75rem', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none', colorScheme: 'dark' }}
                />
            </div>

            <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Select Time Slot</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    {["10:00 AM", "11:30 AM", "02:00 PM", "04:30 PM"].map(slot => (
                        <button
                            key={slot}
                            type="button"
                            onClick={e => {
                                selectedSlotRef.current = slot;
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                    parent.querySelectorAll('button').forEach(btn => {
                                        (btn as HTMLButtonElement).style.background = 'var(--bg-secondary)';
                                        (btn as HTMLButtonElement).style.borderColor = 'var(--border)';
                                        (btn as HTMLButtonElement).style.color = 'var(--text-primary)';
                                    });
                                }
                                e.currentTarget.style.background = 'var(--accent)';
                                e.currentTarget.style.borderColor = 'var(--accent)';
                                e.currentTarget.style.color = 'var(--accent-text)';
                            }}
                            style={{ padding: '0.5rem', borderRadius: '0.75rem', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                            {slot}
                        </button>
                    ))}
                </div>
            </div>

            <button
                type="button"
                onClick={handleConfirm}
                style={{
                    marginTop: '0.5rem', padding: '0.75rem', borderRadius: '0.875rem',
                    border: 'none', background: 'var(--accent)', color: 'var(--accent-text)',
                    fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)', textAlign: 'center'
                }}
            >
                Confirm Schedule & Send Link
            </button>
        </div>
    );
}

interface MessageBubbleProps {
    msg: Message;
    full: boolean;
    onSendMessage: (text: string) => void;
    onConfirmCalendar?: (msgId: string, email: string, date: string, time: string) => void;
}

export function MessageBubble({ msg, full, onSendMessage, onConfirmCalendar }: MessageBubbleProps) {
    function renderMarkdown(text: string): React.ReactNode {
        if (!text) return null;

        // Handle fenced code blocks first
        const parts: React.ReactNode[] = [];
        const fenceSplit = text.split(/```([\s\S]*?)```/g);
        for (let i = 0; i < fenceSplit.length; i++) {
            const chunk = fenceSplit[i];
            if (i % 2 === 1) {
                // code block
                parts.push(
                    <pre key={`code-${i}`} style={{ whiteSpace: 'pre-wrap', overflowX: 'auto', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '0.5rem' }}>
                        <code>{chunk}</code>
                    </pre>
                );
                continue;
            }

            // process inline markdown within this non-code chunk
            // split by inline code, bold, italic, and links
            const inlineRegex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(https?:\/\/\S+)/g;
            let lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = inlineRegex.exec(chunk)) !== null) {
                if (match.index > lastIndex) {
                    parts.push(chunk.substring(lastIndex, match.index));
                }
                const m = match[0];
                if (m.startsWith('`')) {
                    parts.push(<code key={`incode-${i}-${match.index}`} style={{ background: 'rgba(0,0,0,0.04)', padding: '0 .25rem', borderRadius: '3px' }}>{m.slice(1, -1)}</code>);
                } else if (m.startsWith('**')) {
                    parts.push(<strong key={`bold-${i}-${match.index}`}>{m.slice(2, -2)}</strong>);
                } else if (m.startsWith('*')) {
                    parts.push(<em key={`em-${i}-${match.index}`}>{m.slice(1, -1)}</em>);
                } else if (m.startsWith('http')) {
                    parts.push(<a key={`link-${i}-${match.index}`} href={m} target="_blank" rel="noopener noreferrer">{m}</a>);
                } else {
                    parts.push(m);
                }
                lastIndex = inlineRegex.lastIndex;
            }
            if (lastIndex < chunk.length) parts.push(chunk.substring(lastIndex));
        }

        // Split by double newlines into paragraphs
        const joined = parts.map((p) => typeof p === 'string' ? p : p).reduce<React.ReactNode[]>((acc, cur) => {
            acc.push(cur);
            return acc;
        }, []);

        return <div>{joined}</div>;
    }

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ display: 'flex', gap: '1rem', maxWidth: full ? '85%' : '90%', flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row' }}>
                {/* Avatar */}
                <div style={{
                    width: '36px', height: '36px', borderRadius: '1rem', flexShrink: 0,
                    background: msg.sender === 'user' ? 'var(--icon-accent-bg)' : 'var(--accent)',
                    color: msg.sender === 'user' ? 'var(--text-primary)' : 'var(--accent-text)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '0.95rem',
                    border: msg.sender === 'bot' ? '1px solid var(--border)' : 'none',
                    boxShadow: msg.sender === 'bot' ? '0 4px 16px rgba(0,0,0,0.1)' : 'none'
                }}>
                    {msg.sender === 'user' ? <User size={18} /> : <Sparkles size={18} />}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                    {/* Text bubble */}
                    <div style={{
                        padding: '1.125rem 1.375rem',
                        borderRadius: msg.sender === 'user' ? '1.25rem 0 1.25rem 1.25rem' : '0 1.25rem 1.25rem 1.25rem',
                        background: msg.sender === 'user' ? 'var(--icon-accent-bg)' : 'var(--bg-secondary)',
                        color: 'var(--text-primary)', fontSize: '1rem', lineHeight: 1.6,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.06)', border: '1px solid var(--border)',
                    }}>
                        {msg.sender === 'bot' ? renderMarkdown(msg.text) : msg.text}
                    </div>

                    {/* Calendar selector */}
                    {msg.isCalendarSelector && !msg.isScheduled && onConfirmCalendar && (
                        <CalendarSelector
                            msgId={msg.id}
                            candidateEmail={msg.candidateEmail}
                            onConfirm={onConfirmCalendar}
                        />
                    )}

                    {/* Action link */}
                    {msg.actionLink && (
                        <div style={{ marginTop: '0.875rem' }}>
                            <a
                                href={msg.actionLink.url}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                    background: 'var(--icon-accent-bg)', color: 'var(--text-primary)',
                                    border: '1px solid var(--border)', padding: '0.625rem 1.25rem',
                                    borderRadius: '0.875rem', fontSize: '0.875rem', fontWeight: 700,
                                    textDecoration: 'none', transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                <Sparkles size={14} /> {msg.actionLink.label}
                            </a>
                        </div>
                    )}

                    {/* Option chips */}
                    {msg.options && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', marginTop: '0.875rem' }}>
                            {msg.options.map(option => (
                                <button
                                    key={option}
                                    onClick={() => onSendMessage(option)}
                                    style={{
                                        background: 'var(--bg-hover)', border: '1px solid var(--border)',
                                        color: 'var(--text-primary)', padding: '0.625rem 1.125rem',
                                        borderRadius: '1rem', fontSize: '0.875rem', fontWeight: 700,
                                        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.375rem'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--border)'; e.currentTarget.style.borderColor = 'var(--text-primary)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    )}

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', textAlign: msg.sender === 'user' ? 'right' : 'left', padding: '0 0.5rem' }}>
                        {msg.timestamp}
                    </div>
                </div>
            </div>
        </div>
    );
}

//  TypingIndicator

export function TypingIndicator() {
    return (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '1rem', background: 'var(--accent)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={18} />
            </div>
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '0.875rem 1.375rem', borderRadius: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>
                <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-primary)' }} />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Zenvora AI is thinking...</span>
            </div>
        </div>
    );
}

// ChatInput

interface ChatInputProps {
    full: boolean;
    inputMessage: string;
    isTyping: boolean;
    isListening: boolean;
    attachedFileName: string | null;
    aiModel: 'Smart' | 'Advanced';
    onInputChange: (val: string) => void;
    onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
    onSend: () => void;
    onToggleListening: () => void;
    onAttachClick: () => void;
    onRemoveAttachment: () => void;
    onToggleModel: () => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ChatInput({
    full, inputMessage, isTyping, isListening, attachedFileName, aiModel,
    onInputChange, onKeyDown, onSend, onToggleListening, onAttachClick,
    onRemoveAttachment, onToggleModel, fileInputRef, onFileChange
}: ChatInputProps) {
    return (
        <div style={{ padding: full ? '0 4rem 2rem' : '0 1rem 1.25rem', width: '100%', maxWidth: full ? '1400px' : '100%', margin: '0 auto', marginTop: 'auto' }}>
            <div style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: full ? '1.75rem' : '1.5rem',
                boxShadow: '0 12px 36px rgba(0,0,0,0.15)', display: 'flex',
                flexDirection: 'column', overflow: 'hidden', padding: '0.5rem', position: 'relative'
            }}>
                {attachedFileName && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 1rem', background: 'var(--bg-hover)', color: 'var(--text-primary)', borderRadius: '1rem', margin: '0.5rem 0.5rem 0', fontWeight: 700, fontSize: '0.85rem', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Paperclip size={16} /> <span>{attachedFileName}</span>
                        </div>
                        <button onClick={onRemoveAttachment} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
                            <X size={16} />
                        </button>
                    </div>
                )}

                <input type="file" ref={fileInputRef} onChange={onFileChange} style={{ display: 'none' }} />

                <textarea
                    rows={2}
                    value={inputMessage}
                    onChange={e => onInputChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="How can Zenvora AI help you today?..."
                    style={{ width: '100%', padding: '1rem 1.25rem', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                            onClick={onToggleModel}
                            style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', padding: '0.4rem 0.875rem', borderRadius: '1rem', color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                            <Sparkles size={13} style={{ color: 'var(--accent)' }} /> Zenvora AI 3.5 {aiModel} <ChevronDown size={12} />
                        </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                            onClick={onToggleListening}
                            title={isListening ? "Listening... Click to stop" : "Speak to type"}
                            style={{ width: '36px', height: '36px', borderRadius: '0.75rem', background: isListening ? 'rgba(239,68,68,0.15)' : 'transparent', border: 'none', color: isListening ? '#ef4444' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseEnter={e => { if (!isListening) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                            onMouseLeave={e => { if (!isListening) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                        >
                            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                        </button>
                        <button
                            onClick={onAttachClick}
                            title="Attach file"
                            style={{ width: '36px', height: '36px', borderRadius: '0.75rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        >
                            <Paperclip size={18} />
                        </button>
                        <button
                            onClick={onSend}
                            disabled={!inputMessage.trim() || isTyping}
                            title="Send message"
                            style={{
                                width: '38px', height: '38px', borderRadius: '0.875rem', border: 'none',
                                background: inputMessage.trim() && !isTyping ? 'var(--accent)' : 'var(--bg-hover)',
                                color: inputMessage.trim() && !isTyping ? 'var(--accent-text)' : 'var(--text-secondary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: inputMessage.trim() && !isTyping ? 'pointer' : 'not-allowed',
                                boxShadow: inputMessage.trim() && !isTyping ? '0 6px 16px rgba(0,0,0,0.2)' : 'none',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { if (inputMessage.trim() && !isTyping) e.currentTarget.style.transform = 'scale(1.08)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.5rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Info size={12} /> Zenvora AI can make mistakes. Please double-check responses.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    Use <kbd style={{ background: 'var(--border)', padding: '0.1rem 0.3rem', borderRadius: '0.25rem', fontSize: '0.7rem' }}>shift + return</kbd> for new line
                </div>
            </div>
        </div>
    );
}

//  FloatingTriggerButton 

interface FloatingTriggerProps {
    onOpen: () => void;
    showBadge?: boolean;
}

export function FloatingTriggerButton({ onOpen, showBadge = true }: FloatingTriggerProps) {
    return (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 999 }}>
            <button
                onClick={onOpen}
                className="card hover-effect"
                style={{
                    width: '64px', height: '64px', borderRadius: '50%',
                    background: 'var(--accent)', border: 'none', color: 'var(--accent-text)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', boxShadow: '0 12px 28px rgba(0,0,0,0.2)',
                    position: 'relative', transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1) translateY(-4px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1) translateY(0)'}
                title="Open Zenvora AI Copilot"
            >
                <Bot size={28} />
                {showBadge && (
                    <div style={{
                        position: 'absolute', top: '-2px', right: '-2px',
                        background: 'var(--bg-primary)', color: 'var(--text-primary)',
                        borderRadius: '50%', width: '20px', height: '20px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '2px solid var(--accent)', animation: 'pulse 2s infinite'
                    }}>
                        <Sparkles size={10} />
                    </div>
                )}
            </button>
        </div>
    );
}
