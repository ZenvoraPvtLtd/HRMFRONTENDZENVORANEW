import React, { useState } from 'react';
import styles from './WhatsAppIntegration.module.css';
import { MessageSquare } from 'lucide-react';

interface Message {
  id: number;
  text: string;
  sender: 'me' | 'other';
}

const WhatsAppIntegration: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: 'Welcome to WhatsApp integration demo!', sender: 'other' },
  ]);
  const [input, setInput] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const newMsg: Message = {
      id: Date.now(),
      text: input.trim(),
      sender: 'me',
    };
    setMessages((prev) => [...prev, newMsg]);
    setInput('');
    // Simulate a reply after short delay
    setTimeout(() => {
      const reply: Message = {
        id: Date.now() + 1,
        text: 'Thank you for your message. (Automated reply)',
        sender: 'other',
      };
      setMessages((prev) => [...prev, reply]);
    }, 800);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <MessageSquare size={24} className={styles.icon} />
        <h1>WhatsApp Integration</h1>
      </header>
      <div className={styles.chatBox}>
        <ul className={styles.messageList}>
          {messages.map((msg) => (
            <li
              key={msg.id}
              className={`${styles.messageItem} ${msg.sender === 'me' ? styles.myMessage : styles.otherMessage}`}
            >
              {msg.text}
            </li>
          ))}
        </ul>
        <form className={styles.inputArea} onSubmit={handleSend}>
          <input
            type="text"
            placeholder="Type a message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className={styles.inputField}
          />
          <button type="submit" className={styles.sendButton}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default WhatsAppIntegration;
