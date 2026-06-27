import { useEffect, useRef, useState } from "react";
import {
  MoreHorizontal,
  Paperclip,
  Pin,
  PinOff,
  Send,
  Search,
  Trash2,
  UserCircle,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { clearChatThread, fetchChatContacts, fetchChatMessages, markChatRead, sendChatMessage, upsertChatContact } from "../../services/chatApi";
import { useTheme } from "../../context/ThemeContext";

interface Contact {
  id: string;
  initials: string;
  name: string;
  lastMessage: string;
  lastMessageAt: number;   // epoch ms — used to sort by most recent
  unreadCount: number;     // messages not yet read
  color: string;
  isOnline: boolean;
  role?: string;
  email?: string;
  employee_id?: string;
  username?: string;
}

interface ChatMessage {
  text: string;
  isSender: boolean;
  timestamp: string;
}

const emojiCategories = [
  {
    id: "smileys",
    label: "😀",
    name: "Smileys",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😂", "🤣", "😊", "😇", "🙂", "😉", "😍", "😘", "😗", "😋", "😎", "🤩", "🥳", "😔", "😢", "😭", "😡", "🤔", "🙄"],
  },
  {
    id: "hands",
    label: "👍",
    name: "Hands",
    emojis: ["👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "👏", "🙌", "🙏", "🤝", "💪", "👋", "🤙", "🫶", "☝️", "👇", "👈", "👉", "✋"],
  },
  {
    id: "hearts",
    label: "❤️",
    name: "Hearts",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"],
  },
  {
    id: "work",
    label: "💼",
    name: "Work",
    emojis: ["✅", "☑️", "📌", "📍", "📎", "📝", "📋", "📁", "📊", "📈", "💼", "💻", "📞", "📧", "⏰", "📅", "🚀", "🔥", "🎯", "💯"],
  },
  {
    id: "celebration",
    label: "🎉",
    name: "Celebration",
    emojis: ["🎉", "🎊", "✨", "⭐", "🌟", "🏆", "🥇", "🎁", "🎈", "🥂", "🍰", "🍕", "☕", "🌈", "⚡", "💥", "🙈", "💬"],
  },
];

const chatCacheKey = (isHrChat: boolean) =>
  isHrChat ? "zenvora_chat_history_hr" : "zenvora_chat_history_employee";

const mutedChatCacheKey = (isHrChat: boolean) =>
  isHrChat ? "zenvora_muted_chats_hr" : "zenvora_muted_chats_employee";

const pinnedChatCacheKey = (isHrChat: boolean) =>
  isHrChat ? "zenvora_pinned_chats_hr" : "zenvora_pinned_chats_employee";

const hiddenChatCacheKey = (isHrChat: boolean) =>
  isHrChat ? "zenvora_hidden_chats_hr" : "zenvora_hidden_chats_employee";

function readChatCache(isHrChat: boolean): Record<string, ChatMessage[]> {
  try {
    return JSON.parse(localStorage.getItem(chatCacheKey(isHrChat)) || "{}");
  } catch {
    return {};
  }
}

function readMutedChatCache(isHrChat: boolean): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(mutedChatCacheKey(isHrChat)) || "{}");
  } catch {
    return {};
  }
}

function readPinnedChatCache(isHrChat: boolean): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(pinnedChatCacheKey(isHrChat)) || "{}");
  } catch {
    return {};
  }
}

function readHiddenChatCache(isHrChat: boolean): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(hiddenChatCacheKey(isHrChat)) || "{}");
  } catch {
    return {};
  }
}

function messagesLookSame(a: ChatMessage[], b: ChatMessage[]) {
  if (a.length !== b.length) return false;
  return a.every((message, index) => (
    message.text === b[index]?.text &&
    message.isSender === b[index]?.isSender &&
    message.timestamp === b[index]?.timestamp
  ));
}

function ChatAvatar({ contact, size = 40 }: { contact: Contact; size?: number }) {
  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        background: "var(--icon-accent-bg)",
        border: "1px solid var(--border)",
        color: "var(--accent)",
        fontSize: size > 40 ? "0.95rem" : "0.78rem",
      }}
      title={contact.name}
    >
      {contact.initials}
      {contact.isOnline && (
        <span
          className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 bg-green-500"
          style={{ borderColor: "var(--bg-secondary)" }}
        />
      )}
    </div>
  );
}

export default function ColleagueChatPage() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isHrChat =
    !location.pathname.startsWith("/dashboard") &&
    !location.pathname.startsWith("/manager") &&
    !location.pathname.startsWith("/candidatedashboard");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const contactMenuRef = useRef<HTMLDivElement>(null);
  const profileModalRef = useRef<HTMLDivElement>(null);
  const sendingThreadRef = useRef<Record<string, boolean>>({});
  const clearedThreadRef = useRef<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newContactList, setNewContactList] = useState<Contact[]>([]);
  const [activeChat, setActiveChat] = useState<Contact | null>(null);
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>(() => readChatCache(isHrChat));
  const [mutedChats, setMutedChats] = useState<Record<string, boolean>>(() => readMutedChatCache(isHrChat));
  const [pinnedChats, setPinnedChats] = useState<Record<string, boolean>>(() => readPinnedChatCache(isHrChat));
  const [hiddenChats, setHiddenChats] = useState<Record<string, boolean>>(() => readHiddenChatCache(isHrChat));
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [chatApiError, setChatApiError] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [openContactMenuId, setOpenContactMenuId] = useState("");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [attachedFileName, setAttachedFileName] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState(emojiCategories[0].id);
  const [emojiSearch, setEmojiSearch] = useState("");

  const selectedCategory =
    emojiCategories.find((category) => category.id === selectedEmojiCategory) || emojiCategories[0];
  const visibleEmojis = emojiSearch.trim()
    ? emojiCategories.flatMap((category) => category.emojis).filter((emoji) => emoji.includes(emojiSearch.trim()))
    : selectedCategory.emojis;

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const filterContacts = (list: Contact[]) => {
    const q = debouncedSearch.toLowerCase();
    if (!q) return list;
    return list.filter((contact) => 
      contact.name.toLowerCase().includes(q) ||
      (contact.email && contact.email.toLowerCase().includes(q)) ||
      (contact.username && contact.username.toLowerCase().includes(q)) ||
      (contact.employee_id && contact.employee_id.toLowerCase().includes(q)) ||
      (contact.role && contact.role.toLowerCase().includes(q))
    );
  };


  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setChatHistory(readChatCache(isHrChat));
      setMutedChats(readMutedChatCache(isHrChat));
      setPinnedChats(readPinnedChatCache(isHrChat));
      setHiddenChats(readHiddenChatCache(isHrChat));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isHrChat]);

  useEffect(() => {
    localStorage.setItem(chatCacheKey(isHrChat), JSON.stringify(chatHistory));
  }, [chatHistory, isHrChat]);

  useEffect(() => {
    localStorage.setItem(mutedChatCacheKey(isHrChat), JSON.stringify(mutedChats));
  }, [mutedChats, isHrChat]);

  useEffect(() => {
    localStorage.setItem(pinnedChatCacheKey(isHrChat), JSON.stringify(pinnedChats));
  }, [pinnedChats, isHrChat]);

  useEffect(() => {
    localStorage.setItem(hiddenChatCacheKey(isHrChat), JSON.stringify(hiddenChats));
  }, [hiddenChats, isHrChat]);

  useEffect(() => {
    let active = true;
    const currentUserName = isHrChat
      ? localStorage.getItem("hr_userName") || localStorage.getItem("userName") || "HR User"
      : localStorage.getItem("userName") || localStorage.getItem("userEmail") || "Employee";
    const currentUserId =
      localStorage.getItem("userId") ||
      localStorage.getItem("hr_userEmail") ||
      localStorage.getItem("userEmail") ||
      "user-current";
    const currentRole = isHrChat ? "HR" : "Employee";
    const initials = currentUserName
      .split(/[.\s@]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || (isHrChat ? "HR" : "E");

    const loadContacts = async () => {
      await Promise.resolve();
      if (!active) return;
      setIsLoadingContacts(true);
      setChatApiError("");

      try {
        await upsertChatContact({
          contact_id: currentUserId,
          name: currentUserName,
          initials,
          role: currentRole,
          avatar_color: isHrChat ? "#111827" : "#2563eb",
          is_online: true,
        }).catch(() => undefined);

        const apiContacts = await fetchChatContacts();
        if (!active) return;

        const currentName = currentUserName.toLowerCase();
        const currentId = currentUserId.toLowerCase();
        const visibleContacts = apiContacts.filter((contact) => {
          const name = contact.name.toLowerCase();
          const contactId = contact.contact_id.toLowerCase();

          if (currentId && contactId === currentId) return false;
          if (currentName && name === currentName) return false;

          return true;
        });

        const mappedContacts = visibleContacts.map((contact) => ({
          id: contact.contact_id,
          initials: contact.initials,
          name: contact.name,
          lastMessage: contact.last_message || "Ready to chat",
          lastMessageAt: contact.last_message_at ? new Date(contact.last_message_at).getTime() : 0,
          unreadCount: contact.unread_count || 0,
          color: contact.avatar_color,
          isOnline: contact.is_online,
          role: contact.role || (isHrChat ? "employee" : "hr"),
          email: contact.email || undefined,
          employee_id: contact.employee_id || undefined,
          username: contact.username || undefined,
        }));

        const finalContacts = mappedContacts;
        setContacts(finalContacts);
        setNewContactList([]);
        setActiveChat((current) => current ?? finalContacts[0] ?? null);
      } catch {
        if (!active) return;
        setContacts([]);
        setNewContactList([]);
        setActiveChat(null);
        setChatApiError("Chat API connect nahi ho rahi. Backend main1.py run karein.");
      } finally {
        if (active) {
          setIsLoadingContacts(false);
        }
      }
    };

    void loadContacts();
    return () => {
      active = false;
    };
  }, [isHrChat]);

  useEffect(() => {
    const loadLatestContacts = () => {
      const currentUserName = isHrChat
        ? localStorage.getItem("hr_userName") || localStorage.getItem("userName") || "HR User"
        : localStorage.getItem("userName") || localStorage.getItem("userEmail") || "Employee";
      const currentUserId =
        localStorage.getItem("userId") ||
        localStorage.getItem("hr_userEmail") ||
        localStorage.getItem("userEmail") ||
        "user-current";

      fetchChatContacts()
        .then((apiContacts) => {
          const currentName = currentUserName.toLowerCase();
          const currentId = currentUserId.toLowerCase();
          const visibleContacts = apiContacts.filter((contact) => {
            const name = contact.name.toLowerCase();
            const contactId = contact.contact_id.toLowerCase();

            if (currentId && contactId === currentId) return false;
            if (currentName && name === currentName) return false;

            return true;
          });

          const mappedContacts = visibleContacts.map((contact) => ({
            id: contact.contact_id,
            initials: contact.initials,
            name: contact.name,
            lastMessage: contact.last_message || "Ready to chat",
            lastMessageAt: contact.last_message ? Date.now() : 0,
            unreadCount: 0,
            color: contact.avatar_color,
            isOnline: contact.is_online,
            role: contact.role || (isHrChat ? "employee" : "hr"),
          }));

          // Preserve existing lastMessageAt and unreadCount — only update if we don't have them
          setContacts((prev) => {
            const prevMap = new Map(prev.map((c) => [c.id, c]));
            return mappedContacts.map((c) => {
              const existing = prevMap.get(c.id);
              if (existing) {
                return {
                  ...c,
                  lastMessage: existing.lastMessage !== "Ready to chat" ? existing.lastMessage : c.lastMessage,
                  lastMessageAt: existing.lastMessageAt || c.lastMessageAt,
                  unreadCount: existing.unreadCount || c.unreadCount,
                };
              }
              return c;
            });
          });
          setActiveChat((current) => {
            if (current && mappedContacts.some((contact) => contact.id === current.id)) return current;
            return mappedContacts[0] ?? null;
          });
          setChatApiError("");
        })
        .catch(() => undefined);
    };

    const timer = window.setInterval(loadLatestContacts, 3000);
    return () => window.clearInterval(timer);
  }, [isHrChat]);

  const activeMessages: ChatMessage[] = activeChat
    ? chatHistory[activeChat.id] || []
    : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeChat?.id, activeMessages.length]);

  useEffect(() => {
    if (!activeChat) return;

    const loadLatestMessages = () => {
      fetchChatMessages(activeChat.id)
      .then((messages) => {
        const mappedMessages = messages.map((message) => ({
          text: message.attachment_name ? `${message.text} (${message.attachment_name})` : message.text,
          isSender: message.sender_id !== activeChat.id,
          timestamp: new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }));
        setChatHistory((prev) => {
          const existingMessages = prev[activeChat.id] || [];
          const isSending = sendingThreadRef.current[activeChat.id];
          const wasCleared = clearedThreadRef.current[activeChat.id];

          if (!wasCleared && existingMessages.length > 0 && mappedMessages.length === 0) {
            return prev;
          }

          if (isSending && mappedMessages.length < existingMessages.length) {
            return prev;
          }

          if (messagesLookSame(existingMessages, mappedMessages)) {
            return prev;
          }

          clearedThreadRef.current[activeChat.id] = false;
          return { ...prev, [activeChat.id]: mappedMessages };
        });
        markChatRead(activeChat.id).catch(() => undefined);
      })
      .catch(() => undefined);
    };

    loadLatestMessages();
    const timer = window.setInterval(loadLatestMessages, 2000);
    return () => window.clearInterval(timer);
  }, [activeChat]);

  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (emojiPickerRef.current?.contains(target) || emojiButtonRef.current?.contains(target)) {
        return;
      }

      setShowEmojiPicker(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  useEffect(() => {
    if (!openContactMenuId && !showChatMenu && !showProfileModal) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (contactMenuRef.current?.contains(target)) return;
      if (headerMenuRef.current?.contains(target)) return;
      if (profileModalRef.current?.contains(target)) return;

      setOpenContactMenuId("");
      setShowChatMenu(false);
      setShowProfileModal(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openContactMenuId, showChatMenu, showProfileModal]);

  async function handleSendMessage() {
    if (!activeChat || (!messageInput.trim() && !attachedFileName)) return;

    const text = attachedFileName
      ? `${messageInput.trim() || "File attached"} (${attachedFileName})`
      : messageInput.trim();
    const currentChatId = activeChat.id;
    const newMessage: ChatMessage = {
      text,
      isSender: true,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatHistory((prev) => ({
      ...prev,
      [currentChatId]: [...(prev[currentChatId] || []), newMessage],
    }));
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === currentChatId ? { ...contact, lastMessage: text } : contact
      )
    );

    sendingThreadRef.current[currentChatId] = true;
    sendChatMessage(currentChatId, messageInput.trim() || "File attached", attachedFileName || undefined)
      .catch(() => {
        setChatApiError("Message send nahi hua. API connection check karein.");
      })
      .finally(() => {
        sendingThreadRef.current[currentChatId] = false;
      });

    setMessageInput("");
    setAttachedFileName("");
    setShowEmojiPicker(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") handleSendMessage();
  }

  async function handleChatMenuAction(action: string) {
    if (!activeChat) return;

    if (action === "Mute chat" || action === "Unmute chat") {
      setMutedChats((prev) => ({
        ...prev,
        [activeChat.id]: !prev[activeChat.id],
      }));
      setShowChatMenu(false);
      return;
    }

    if (action === "View profile") {
      setShowProfileModal(true);
      setShowChatMenu(false);
      return;
    }

    if (action === "Clear chat") {
      const confirmed = window.confirm(`Clear chat with ${activeChat.name}?`);
      if (!confirmed) return;

      const previousMessages = chatHistory[activeChat.id] || [];
      clearedThreadRef.current[activeChat.id] = true;
      setChatHistory((prev) => ({ ...prev, [activeChat.id]: [] }));
      setContacts((prev) =>
        prev.map((contact) =>
          contact.id === activeChat.id ? { ...contact, lastMessage: "Ready to chat" } : contact
        )
      );
      setShowChatMenu(false);

      try {
        await clearChatThread(activeChat.id);
      } catch {
        clearedThreadRef.current[activeChat.id] = false;
        setChatHistory((prev) => ({ ...prev, [activeChat.id]: previousMessages }));
        window.alert("Failed to clear chat. Please check chat API.");
      }
      return;
    }

    setShowChatMenu(false);
  }

  async function handleSidebarMenuAction(action: string, contact: Contact) {
    if (action === "Pin chat" || action === "Unpin chat") {
      setPinnedChats((prev) => ({ ...prev, [contact.id]: !prev[contact.id] }));
      setOpenContactMenuId("");
      return;
    }

    if (action === "Mute chat" || action === "Unmute chat") {
      setMutedChats((prev) => ({ ...prev, [contact.id]: !prev[contact.id] }));
      setOpenContactMenuId("");
      return;
    }

    if (action === "View profile") {
      setActiveChat(contact);
      setShowProfileModal(true);
      setOpenContactMenuId("");
      return;
    }

    if (action === "Clear chat" || action === "Delete chat") {
      const isDelete = action === "Delete chat";
      const confirmed = window.confirm(`${isDelete ? "Delete" : "Clear"} chat with ${contact.name}?`);
      if (!confirmed) return;

      clearedThreadRef.current[contact.id] = true;
      setChatHistory((prev) => ({ ...prev, [contact.id]: [] }));
      setContacts((prev) =>
        prev.map((item) =>
          item.id === contact.id ? { ...item, lastMessage: "Ready to chat" } : item
        )
      );

      if (isDelete) {
        setPinnedChats((prev) => ({ ...prev, [contact.id]: false }));
        setMutedChats((prev) => ({ ...prev, [contact.id]: false }));
        setHiddenChats((prev) => ({ ...prev, [contact.id]: true }));
        setActiveChat((current) => current?.id === contact.id ? null : current);
      }

      setOpenContactMenuId("");

      try {
        await clearChatThread(contact.id);
      } catch {
        clearedThreadRef.current[contact.id] = false;
        window.alert("Failed to update chat. Please check chat API.");
      }
    }
  }

  const allFilteredContacts = filterContacts(contacts).filter((c) => !hiddenChats[c.id]);
  const visibleRecentContacts = allFilteredContacts
    .filter((c) => c.lastMessage !== "Ready to chat" || pinnedChats[c.id])
    .sort((a, b) => {
      if (pinnedChats[a.id] && !pinnedChats[b.id]) return -1;
      if (!pinnedChats[a.id] && pinnedChats[b.id]) return 1;
      return b.lastMessageAt - a.lastMessageAt;
    });

  const visibleNewContacts = allFilteredContacts
    .filter((c) => c.lastMessage === "Ready to chat" && !pinnedChats[c.id])
    .sort((a, b) => a.name.localeCompare(b.name));

  const renderContact = (contact: Contact) => (
    <div
      key={contact.id}
      role="button"
      tabIndex={0}
      onClick={() => setActiveChat(contact)}
      onKeyDown={(event) => {
        if (event.key === "Enter") setActiveChat(contact);
      }}
      className="group relative mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors"
      style={{ background: activeChat?.id === contact.id ? "var(--bg-hover)" : "transparent" }}
    >
      <ChatAvatar contact={contact} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {contact.name}
        </span>
        <span className="block truncate text-xs" style={{ color: "var(--text-secondary)" }}>
          {pinnedChats[contact.id] ? "Pinned • " : ""}{mutedChats[contact.id] ? "Muted" : contact.lastMessage || "Ready to chat"}
        </span>
      </span>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpenContactMenuId((current) => current === contact.id ? "" : contact.id);
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
        style={{ color: "var(--text-secondary)", background: "transparent" }}
        title="Chat options"
      >
        <MoreHorizontal size={17} />
      </button>
      {openContactMenuId === contact.id && (
        <div
          ref={contactMenuRef}
          className="absolute right-3 top-12 z-20 w-44 rounded-lg border p-1 shadow-lg"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
          onClick={(event) => event.stopPropagation()}
        >
          {[
            {
              label: pinnedChats[contact.id] ? "Unpin chat" : "Pin chat",
              icon: pinnedChats[contact.id] ? <PinOff size={14} /> : <Pin size={14} />,
            },
            {
              label: mutedChats[contact.id] ? "Unmute chat" : "Mute chat",
              icon: mutedChats[contact.id] ? <Volume2 size={14} /> : <VolumeX size={14} />,
            },
            { label: "View profile", icon: <UserCircle size={14} /> },
            { label: "Clear chat", icon: <X size={14} /> },
            { label: "Delete chat", icon: <Trash2 size={14} /> },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleSidebarMenuAction(item.label, contact)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium"
              style={{ color: item.label === "Delete chat" ? "#ef4444" : "var(--text-primary)" }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="chat-page-slide-right min-h-[calc(100vh-125px)] w-full p-2 sm:p-4" style={{ background: "var(--bg-primary)" }}>
      <div
        className="mx-auto flex h-[calc(100vh-125px)] min-h-160 w-full max-w-7xl overflow-hidden rounded-lg border shadow-sm"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <aside
          className={`w-full shrink-0 flex-col border-r md:flex md:w-90 ${activeChat ? "hidden" : "flex"}`}
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
        >
          <div className="flex items-center justify-between border-b px-4 py-4" style={{ borderColor: "var(--border)" }}>
            <div>
              <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                Messages
              </h1>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Team conversations
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="flex h-9 w-9 items-center justify-center rounded-lg border"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--bg-primary)" }}
              title="Close messages"
            >
              <X size={17} />
            </button>
          </div>

          <div className="p-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
              <input
                type="text"
                placeholder="Search messages..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-10 w-full rounded-lg border pl-9 pr-3 text-sm outline-none"
                style={{
                  background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                  color: "var(--text-primary)",
                  borderColor: "var(--border)",
                }}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4" style={{ scrollbarWidth: "none" }}>
            {isLoadingContacts ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-3 mb-1">
                  <div className="shrink-0 rounded-full animate-pulse" style={{ width: 40, height: 40, background: "var(--bg-hover)" }} />
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="animate-pulse rounded" style={{ height: 12, width: "60%", background: "var(--bg-hover)" }} />
                    <div className="animate-pulse rounded" style={{ height: 10, width: "80%", background: "var(--bg-hover)" }} />
                  </div>
                </div>
              ))
            ) : chatApiError ? (
              <div className="px-3 py-4 text-xs rounded-lg mx-1" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
                {chatApiError}
              </div>
            ) : debouncedSearch && visibleRecentContacts.length === 0 && visibleNewContacts.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <Search size={32} className="mx-auto mb-3 opacity-20" style={{ color: "var(--text-primary)" }} />
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No results found</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Try a different name or email</p>
              </div>
            ) : (
              <>
                {visibleRecentContacts.length > 0 && (
                  <>
                    <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                      Recent
                    </p>
                    {visibleRecentContacts.map(renderContact)}
                  </>
                )}
                
                {visibleNewContacts.length > 0 && (
                  <>
                    <p className="px-2 pb-2 pt-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                      Start New Chat
                    </p>
                    {visibleNewContacts.map(renderContact)}
                  </>
                )}

                {visibleRecentContacts.length === 0 && visibleNewContacts.length === 0 && (
                  <p className="px-3 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>No contacts yet.</p>
                )}
              </>
            )}
          </div>
        </aside>

        <section className={`min-w-0 flex-1 flex-col ${activeChat ? "flex" : "hidden md:flex"}`} style={{ background: "var(--bg-primary)" }}>
          {activeChat && (
            <>
              <div className="flex items-center justify-between border-b px-4 py-4 sm:px-5" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveChat(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border md:hidden"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                    title="Back to conversations"
                  >
                    <X size={17} />
                  </button>
                  <ChatAvatar contact={activeChat} size={42} />
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      {activeChat.name}
                    </h2>
                    <p className="text-xs font-medium text-green-500">{activeChat.isOnline ? "Active now" : "Offline"}</p>
                  </div>
                </div>

                <div className="relative" ref={headerMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowChatMenu((value) => !value)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--bg-primary)" }}
                    title="Chat options"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {showChatMenu && (
                    <div
                      className="absolute right-0 top-11 z-10 w-40 rounded-lg border p-1 shadow-lg"
                      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
                    >
                      {[
                        mutedChats[activeChat.id] ? "Unmute chat" : "Mute chat",
                        "View profile",
                        "Clear chat",
                      ].map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => handleChatMenuAction(item)}
                          className="w-full rounded-md px-3 py-2 text-left text-xs font-medium"
                          style={{ color: item === "Clear chat" ? "#ef4444" : "var(--text-primary)" }}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-7" style={{ scrollbarWidth: "thin" }}>
                {activeMessages.length === 0 && (
                  <div className="text-center text-sm mt-4" style={{ color: "var(--text-secondary)" }}>
                    No messages yet. Start the conversation!
                  </div>
                )}
                <div
                  className="mx-auto mb-6 w-fit rounded-full border px-3 py-1 text-[11px] font-medium"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-secondary)" }}
                >
                  Today, 10:16 PM
                </div>

                {activeMessages.map((msg, index) => (
                  <div key={`${msg.timestamp}-${index}`} className={`mb-4 flex ${msg.isSender ? "justify-end" : "justify-start"}`}>
                    <div
                      className="max-w-[78%] rounded-lg px-4 py-2.5 text-sm leading-relaxed shadow-sm"
                      style={{
                        background: msg.isSender ? "var(--accent)" : "var(--bg-secondary)",
                        color: msg.isSender ? "var(--accent-text)" : "var(--text-primary)",
                        border: msg.isSender ? "1px solid var(--accent)" : "1px solid var(--border)",
                      }}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="relative border-t p-4" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
                {showEmojiPicker && (
                  <div
                    ref={emojiPickerRef}
                    className="absolute bottom-19 left-4 z-20 w-75 overflow-hidden rounded-xl border shadow-xl"
                    style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
                  >
                    <div className="border-b p-2" style={{ borderColor: "var(--border)" }}>
                    </div>

                    <div className="flex items-center justify-between border-b px-2 py-1.5" style={{ borderColor: "var(--border)" }}>
                      {emojiCategories.map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => {
                            setSelectedEmojiCategory(category.id);
                            setEmojiSearch("");
                          }}
                          className="flex h-8 w-9 items-center justify-center rounded-lg transition-colors"
                          style={{
                            background: selectedEmojiCategory === category.id && !emojiSearch ? "var(--bg-hover)" : "transparent",
                            color: "var(--text-primary)",
                          }}
                          title={category.name}
                        >
                          {category.label}
                        </button>
                      ))}
                    </div>

                    <div className="max-h-56 overflow-y-auto p-2" style={{ scrollbarWidth: "thin" }}>
                      <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                        {emojiSearch ? "Search results" : selectedCategory.name}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {visibleEmojis.map((emoji, index) => (
                          <button
                            key={`${emoji}-${index}`}
                            type="button"
                            onClick={() => {
                              setMessageInput((current) => `${current}${emoji}`);
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition-colors hover:opacity-80"
                            style={{ background: "transparent", color: "var(--text-primary)" }}
                            title={emoji}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}


                {attachedFileName && (
                  <div className="mb-2 flex items-center justify-between rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--bg-primary)" }}>
                    <span className="truncate">Attached: {attachedFileName}</span>
                    <button type="button" onClick={() => setAttachedFileName("")} className="ml-3 font-semibold" style={{ color: "var(--text-secondary)" }}>
                      Remove
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ background: "var(--bg-primary)", borderColor: "var(--border)" }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ color: "var(--text-secondary)" }}
                    title="Attach file"
                  >
                    <Paperclip size={18} />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(event) => setAttachedFileName(event.target.files?.[0]?.name || "")}
                  />
                  <input
                    type="text"
                    placeholder="Type your message..."
                    value={messageInput}
                    onChange={(event) => setMessageInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    style={{ color: "var(--text-primary)" }}
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                    title="Send message"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {showProfileModal && activeChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div
            ref={profileModalRef}
            className="w-full max-w-sm rounded-lg border p-5 shadow-xl"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                Profile
              </h3>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--bg-primary)" }}
                title="Close profile"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <ChatAvatar contact={activeChat} size={54} />
              <div className="min-w-0">
                <div className="truncate text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  {activeChat.name}
                </div>
                <div className="text-xs capitalize" style={{ color: "var(--text-secondary)" }}>
                  {activeChat.role || (isHrChat ? "employee" : "hr")}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span style={{ color: "var(--text-secondary)" }}>Status</span>
                <span className="font-semibold" style={{ color: activeChat.isOnline ? "#22c55e" : "var(--text-primary)" }}>
                  {activeChat.isOnline ? "Active now" : "Offline"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span style={{ color: "var(--text-secondary)" }}>Chat</span>
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {mutedChats[activeChat.id] ? "Muted" : "Notifications on"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span style={{ color: "var(--text-secondary)" }}>Contact ID</span>
                <span className="truncate font-semibold" style={{ color: "var(--text-primary)" }}>
                  {activeChat.id}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
