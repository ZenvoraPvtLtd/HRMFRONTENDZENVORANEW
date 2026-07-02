import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Briefcase, FileText, Calendar, CheckCheck, CheckCircle2, MessageSquare, Trash2, Clock, Inbox } from "lucide-react";
import api from "../../utils/axiosInstance";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

const LOCAL_HR_NOTIFICATIONS_KEY = "zenvora_hr_notifications";

function getLocalHrNotifications(): NotificationItem[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_HR_NOTIFICATIONS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalHrNotifications(notifications: NotificationItem[]) {
  localStorage.setItem(LOCAL_HR_NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

function isHrNotificationArea() {
  const path = window.location.pathname;
  return !path.startsWith("/dashboard");
}

function mergeNotifications(apiItems: NotificationItem[], localItems: NotificationItem[]) {
  const seen = new Set<string>();
  return [...localItems, ...apiItems]
    .filter((item) => item.type !== "pip")
    .filter((item) => {
      const key = `${item.type}-${item.title}-${item.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const fetchNotifications = async () => {
    const localNotifications = isHrNotificationArea() ? getLocalHrNotifications() : [];
    try {
      const res = await api.get("/api/notifications");
      if (res.data?.success) {
        setNotifications(mergeNotifications(res.data.notifications, localNotifications));
      }
    } catch {
      setNotifications(localNotifications);
    }
  };

  useEffect(() => {
    // Defer initial fetch to avoid synchronous setState within effect
    const initTimer = window.setTimeout(() => fetchNotifications(), 0);

    // Poll every 10 seconds for near real-time updates
    const interval = setInterval(fetchNotifications, 10000);

    // Add click listener to close dropdown when clicking outside
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("zenvora-notification-updated", fetchNotifications);
    window.addEventListener("storage", fetchNotifications);

    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("zenvora-notification-updated", fetchNotifications);
      window.removeEventListener("storage", fetchNotifications);
    };
  }, []);

  const markAsRead = async (id: string, type: string, message = "") => {
    try {
      await api.put(`/api/notifications/${id}/read`);
      // Update local state
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );

      // Close dropdown and navigate to relevant section based on notification type
      setIsOpen(false);
      const isEmployee = window.location.pathname.startsWith("/dashboard");

      if (type === "event") {
        // Extract the event title from the message format:
        // "<title> is scheduled on <date> at <time>."
        const match = message.match(/^(.+?) is scheduled on /);
        const eventTitle = match?.[1] ?? "";
        navigate(
          eventTitle
            ? `/dashboard/events?highlight=${encodeURIComponent(eventTitle)}`
            : "/dashboard/events"
        );
      } else if (type === "announcement") {
        // Extract the announcement title from the message format:
        // "<title> has been published."
        const match = message.match(/^(.+?) has been published\./);
        const announcementTitle = match?.[1] ?? "";
        navigate(
          announcementTitle
            ? `/dashboard/announcements?highlight=${encodeURIComponent(announcementTitle)}`
            : "/dashboard/announcements"
        );
      } else if (type.includes("job")) {
        navigate("/createjobs");
      } else if (type.includes("application")) {
        navigate("/candidates");
      } else if (type.includes("interview")) {
        navigate("/interviews");
      } else if (type.includes("leave")) {
        navigate(isEmployee ? "/dashboard/leave" : "/leave-management");
      } else if (type.includes("sprint")) {
        navigate(isEmployee ? "/dashboard/sprint-board" : "/sprint-board");
      } else if (type.includes("grievance")) {
        navigate("/dashboard/grievances");
      }
    } catch {
      const localNotifications = getLocalHrNotifications();
      const updatedLocal = localNotifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      saveLocalHrNotifications(updatedLocal);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setIsOpen(false);
      if (type === "event") navigate("/dashboard/events");
      if (type === "announcement") navigate("/dashboard/announcements");
      if (type.includes("leave")) navigate("/leave-management");
      if (type.includes("grievance")) navigate("/dashboard/grievances");
    }
  };

  const markAllAsRead = async () => {
    try {
      setLoading(true);
      await api.put("/api/notifications/read-all");
      saveLocalHrNotifications(getLocalHrNotifications().map((n) => ({ ...n, read: true })));
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      saveLocalHrNotifications(getLocalHrNotifications().map((n) => ({ ...n, read: true })));
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } finally {
      setLoading(false);
    }
  };

  const deleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent trigger navigation/read on clicking delete
    try {
      await api.delete(`/api/notifications/${id}`);
      saveLocalHrNotifications(getLocalHrNotifications().filter((n) => n.id !== id));
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      saveLocalHrNotifications(getLocalHrNotifications().filter((n) => n.id !== id));
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "announcement":
        return <MessageSquare size={16} style={{ color: "var(--accent)" }} />;
      case "event":
        return <Calendar size={16} className="text-emerald-400" />;
      case "job_created":
      case "job_updated":
      case "job_deleted":
        return <Briefcase size={16} style={{ color: "var(--accent)" }} />;
      case "resume_uploaded":
        return <FileText size={16} className="text-blue-400" />;
      case "interview_scheduled":
      case "application_submitted":
        return <Calendar size={16} className="text-emerald-400" />;
      case "leave_approved":
        return <Calendar size={16} className="text-emerald-400" />;
      case "leave_rejected":
      case "leave_deleted":
        return <Calendar size={16} className="text-red-400" />;
      case "leave_status_updated":
        return <Calendar size={16} className="text-amber-400" />;
      case "sprint_created":
        return <CheckCircle2 size={16} className="text-blue-400" />;
      case "sprint_deleted":
        return <CheckCircle2 size={16} className="text-red-400" />;
      default:
        return <Bell size={16} className="text-amber-400" />;
    }
  };

  // Helper to format timestamps (e.g. 2 hours ago)
  const formatTime = (dateString: string) => {
    const normalizedDateString = /(?:Z|[+-]\d{2}:?\d{2})$/.test(dateString)
      ? dateString
      : `${dateString}Z`;
    const date = new Date(normalizedDateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) {
      const hours = Math.floor(diffMins / 60);
      return `${hours}h ago`;
    }
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "rgba(255, 255, 255, 0.7)",
          display: "flex",
          padding: "8px",
          borderRadius: "50%",
          position: "relative",
          transition: "background-color 0.2s, color 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
          e.currentTarget.style.color = "#ffffff";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)";
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "4px",
              right: "4px",
              minWidth: "16px",
              height: "16px",
              borderRadius: "50%",
              backgroundColor: "#ef4444",
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              border: "2px solid var(--bg-secondary)",
              boxShadow: "0 0 10px rgba(239, 68, 68, 0.4)",
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Card */}
      {isOpen && (
        <div
          className="animate-fade-in"
          style={{
            position: "absolute",
            top: "44px",
            right: "0",
            width: "360px",
            maxHeight: "480px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)",
            display: "flex",
            flexDirection: "column",
            zIndex: 1000,
            overflow: "hidden",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    backgroundColor: "var(--icon-accent-bg)",
                    color: "var(--accent)",
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "10px",
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={loading}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--accent)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--icon-accent-bg)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: "auto", maxHeight: "360px" }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "40px 20px",
                  textAlign: "center",
                  color: "var(--text-secondary)",
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    backgroundColor: "var(--icon-accent-bg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "12px",
                    color: "var(--accent)",
                  }}
                >
                  <Inbox size={20} />
                </div>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                  No Notifications yet
                </span>
                <span style={{ fontSize: "12px", opacity: 0.8 }}>
                  We'll notify you when actions are performed!
                </span>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => markAsRead(item.id, item.type, item.message)}
                  style={{
                    display: "flex",
                    gap: "12px",
                    padding: "16px",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    transition: "background-color 0.2s",
                    position: "relative",
                    background: item.read ? "transparent" : "var(--icon-accent-bg)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = item.read ? "transparent" : "var(--icon-accent-bg)")}
                >
                  {/* Unread indicator dot */}
                  {!item.read && (
                    <div
                      style={{
                        position: "absolute",
                        left: "6px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor: "var(--accent)",
                      }}
                    />
                  )}

                  {/* Icon */}
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "10px",
                      backgroundColor: "var(--bg-primary)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {getNotificationIcon(item.type)}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: item.read ? 600 : 700,
                        color: "var(--text-primary)",
                        marginBottom: "4px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "8px",
                      }}
                    >
                      <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                        {item.title}
                      </span>
                      <button
                        onClick={(e) => deleteNotification(e, item.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-secondary)",
                          opacity: 0.6,
                          padding: "2px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "4px",
                          transition: "opacity 0.2s, background-color 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = "1";
                          e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
                          e.currentTarget.style.color = "#ef4444";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = "0.6";
                          e.currentTarget.style.backgroundColor = "transparent";
                          e.currentTarget.style.color = "var(--text-secondary)";
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        lineHeight: "1.4",
                        margin: "0 0 6px 0",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.message}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "10px",
                        color: "var(--text-secondary)",
                        opacity: 0.8,
                      }}
                    >
                      <Clock size={10} />
                      {formatTime(item.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

