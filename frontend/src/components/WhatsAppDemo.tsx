import { useState } from "react";
import { Send, Phone, Clock, AlertCircle } from "lucide-react";
import useWhatsAppNotification from "../hooks/useWhatsAppNotification";

interface WhatsAppDemoProps {
    onClose?: () => void;
}

export default function WhatsAppDemo({ onClose }: WhatsAppDemoProps) {
    const [phone, setPhone] = useState("+91 ");
    const [message, setMessage] = useState("");
    const [recipientName, setRecipientName] = useState("");
    const [notificationType, setNotificationType] = useState("interview_scheduling");
    const [scheduledTime, setScheduledTime] = useState("");
    const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
    const [successMsg, setSuccessMsg] = useState("");

    const { sendMessage, scheduleMessage, loading } = useWhatsAppNotification({
        onSuccess: (msg) => setSuccessMsg(msg),
        onError: (err) => alert(`Error: ${err.message}`),
    });

    const handleSendNow = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone.trim() || !message.trim()) {
            alert("Please fill in all required fields");
            return;
        }
        try {
            await sendMessage(phone, message);
            setPhone("+91 ");
            setMessage("");
            setSuccessMsg("Message sent successfully!");
            setTimeout(() => setSuccessMsg(""), 3000);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone.trim() || !recipientName.trim() || !scheduledTime) {
            alert("Please fill in all required fields");
            return;
        }
        try {
            await scheduleMessage(
                recipientName,
                phone,
                notificationType,
                {
                    interview_time: "tomorrow at 11:00 AM",
                    position: "Frontend Developer",
                    location: "Zenvora HQ",
                    interview_type: "Technical Round",
                },
                scheduledTime
            );
            setPhone("+91 ");
            setRecipientName("");
            setScheduledTime("");
            setSuccessMsg("Message scheduled successfully!");
            setTimeout(() => setSuccessMsg(""), 3000);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
                style={{
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
                        WhatsApp Demo
                    </h2>
                    {onClose && (
                        <button
                            onClick={onClose}
                            style={{
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "1.5rem",
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>

                {successMsg && (
                    <div
                        style={{
                            marginBottom: "1rem",
                            padding: "0.75rem 1rem",
                            borderRadius: "0.5rem",
                            background: "rgba(16,185,129,0.1)",
                            color: "#10b981",
                            fontSize: "0.875rem",
                            border: "1px solid rgba(16,185,129,0.2)",
                        }}
                    >
                        ✓ {successMsg}
                    </div>
                )}

                <div className="flex gap-2 mb-6">
                    {(["now", "schedule"] as const).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setSendMode(mode)}
                            style={{
                                flex: 1,
                                padding: "0.75rem",
                                borderRadius: "0.5rem",
                                border: "1px solid var(--border)",
                                background: sendMode === mode ? "var(--accent)" : "var(--bg-secondary)",
                                color: sendMode === mode ? "white" : "var(--text-primary)",
                                cursor: "pointer",
                                fontWeight: 600,
                                fontSize: "0.875rem",
                            }}
                        >
                            {mode === "now" ? "Send Now" : "Schedule"}
                        </button>
                    ))}
                </div>

                <form onSubmit={sendMode === "now" ? handleSendNow : handleSchedule}>
                    <div className="space-y-4">
                        <div>
                            <label style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.5rem", fontWeight: 600 }}>
                                Phone Number *
                            </label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+91 98765 43210"
                                style={{
                                    width: "100%",
                                    padding: "0.75rem",
                                    borderRadius: "0.5rem",
                                    border: "1px solid var(--border)",
                                    background: "var(--bg-secondary)",
                                    color: "var(--text-primary)",
                                    fontSize: "0.875rem",
                                    boxSizing: "border-box",
                                }}
                            />
                        </div>

                        {sendMode === "now" ? (
                            <div>
                                <label style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.5rem", fontWeight: 600 }}>
                                    Message *
                                </label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Type your message here..."
                                    rows={4}
                                    style={{
                                        width: "100%",
                                        padding: "0.75rem",
                                        borderRadius: "0.5rem",
                                        border: "1px solid var(--border)",
                                        background: "var(--bg-secondary)",
                                        color: "var(--text-primary)",
                                        fontSize: "0.875rem",
                                        boxSizing: "border-box",
                                        fontFamily: "inherit",
                                    }}
                                />
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.5rem", fontWeight: 600 }}>
                                        Recipient Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={recipientName}
                                        onChange={(e) => setRecipientName(e.target.value)}
                                        placeholder="e.g., Prince"
                                        style={{
                                            width: "100%",
                                            padding: "0.75rem",
                                            borderRadius: "0.5rem",
                                            border: "1px solid var(--border)",
                                            background: "var(--bg-secondary)",
                                            color: "var(--text-primary)",
                                            fontSize: "0.875rem",
                                            boxSizing: "border-box",
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.5rem", fontWeight: 600 }}>
                                        Notification Type
                                    </label>
                                    <select
                                        value={notificationType}
                                        onChange={(e) => setNotificationType(e.target.value)}
                                        style={{
                                            width: "100%",
                                            padding: "0.75rem",
                                            borderRadius: "0.5rem",
                                            border: "1px solid var(--border)",
                                            background: "var(--bg-secondary)",
                                            color: "var(--text-primary)",
                                            fontSize: "0.875rem",
                                            boxSizing: "border-box",
                                        }}
                                    >
                                        <option value="interview_scheduling">Interview Scheduling</option>
                                        <option value="attendance_alerts">Attendance Alerts</option>
                                        <option value="leave_approval_rejection">Leave Approval</option>
                                        <option value="task_assignments">Task Assignments</option>
                                        <option value="salary_notifications">Salary Notification</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.5rem", fontWeight: 600 }}>
                                        Schedule Time *
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={scheduledTime}
                                        onChange={(e) => setScheduledTime(e.target.value)}
                                        style={{
                                            width: "100%",
                                            padding: "0.75rem",
                                            borderRadius: "0.5rem",
                                            border: "1px solid var(--border)",
                                            background: "var(--bg-secondary)",
                                            color: "var(--text-primary)",
                                            fontSize: "0.875rem",
                                            boxSizing: "border-box",
                                        }}
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: "100%",
                            marginTop: "1.5rem",
                            padding: "0.75rem",
                            borderRadius: "0.5rem",
                            background: loading ? "rgba(139,92,246,0.5)" : "var(--accent)",
                            color: "white",
                            border: "none",
                            cursor: loading ? "not-allowed" : "pointer",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "0.5rem",
                            fontSize: "0.875rem",
                        }}
                    >
                        {sendMode === "now" ? (
                            <>
                                <Send size={16} /> Send Message
                            </>
                        ) : (
                            <>
                                <Clock size={16} /> Schedule Message
                            </>
                        )}
                    </button>
                </form>

                <div
                    style={{
                        marginTop: "1rem",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                        background: "rgba(139,92,246,0.1)",
                        border: "1px solid rgba(139,92,246,0.2)",
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                        display: "flex",
                        gap: "0.5rem",
                    }}
                >
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: "0.125rem" }} />
                    <span>
                        Running in sandbox mode. Messages will not be sent via Twilio unless API keys are configured.
                    </span>
                </div>
            </div>
        </div>
    );
}
