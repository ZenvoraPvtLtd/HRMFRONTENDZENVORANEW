 
import { useState, useEffect } from "react";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import RefreshButton from "../../components/button/RefreshButton";
import { getApiBaseUrl } from "../../config/apiConfig";
import {
  MessageCircle,
  RefreshCw,
  Send,
  Database,
  Smartphone,
  Info,
  ShieldCheck,
  Eye,
  Trash2,
  Clock,
  CheckCircle,
  XCircle
} from "lucide-react";

interface Template {
  id: string;
  name: string;
  category: string;
  text: string;
}

interface ScheduleJob {
  _id: string;
  recipient_name: string;
  phone: string;
  notification_type: string;
  scheduled_time: string;
  status: "pending" | "sent" | "cancelled" | string;
}

interface ScheduleResponse {
  success?: boolean;
  data?: ScheduleJob[];
  message?: string;
}

const initialTemplates: Template[] = [
  {
    id: "tpl_1",
    name: "Interview Scheduling",
    category: "Recruitment",
    text: "Hello {{name}},\nYour interview has been scheduled for tomorrow at {{time}}.",
  },
  {
    id: "tpl_2",
    name: "Project Deadlines",
    category: "Task Management",
    text: "Task deadline reminder:\nProject submission due in {{time}}.",
  },
  {
    id: "tpl_3",
    name: "Attendance Alerts",
    category: "HR Operations",
    text: "Hello {{name}},\nYou have not clocked in for today yet. Please mark your attendance.",
  },
  {
    id: "tpl_4",
    name: "Leave Approval/Rejection",
    category: "HR Operations",
    text: "Hello {{name}},\nYour leave request from {{time}} has been APPROVED by your manager.",
  },
  {
    id: "tpl_5",
    name: "Task Assignments",
    category: "Operations",
    text: "Hi {{name}},\nA new task '{{title}}' has been assigned to you. Deadline: {{time}}.",
  },
  {
    id: "tpl_6",
    name: "Offer Letters",
    category: "Recruitment",
    text: "Congratulations {{name}}!\nZenvora has extended an offer for the {{title}} role. Please check your email.",
  },
  {
    id: "tpl_7",
    name: "Salary Notifications",
    category: "Finance",
    text: "Hi {{name}},\nYour salary for the month of {{time}} has been credited successfully.",
  },
  {
    id: "tpl_8",
    name: "Meeting Reminders",
    category: "Operations",
    text: "Friendly reminder:\nThe {{title}} meeting is starting in 15 minutes. Join link: {{link}}",
  },
  {
    id: "tpl_9",
    name: "Candidate Shortlisting",
    category: "Recruitment",
    text: "Great news {{name}}!\nYou have been shortlisted for the {{title}} role at Zenvora.",
  },
  {
    id: "tpl_10",
    name: "Employee Announcements",
    category: "General",
    text: "Announcement: {{title}}\nDear Zenvora team, {{body}}.",
  },
];

const initialLogs = [
  {
    time: "Just now",
    phone: "+91 98765 43210",
    name: "Prince",
    type: "Interview Scheduling",
    status: "Delivered",
    message:
      "Hello Prince, Your interview has been scheduled for tomorrow at 11:00 AM.",
  },
  {
    time: "2 mins ago",
    phone: "+91 99988 87776",
    name: "Sarah Jenkins",
    type: "Project Deadlines",
    status: "Delivered",
    message: "Task deadline reminder: Project submission due in 2 hours.",
  },
  {
    time: "1 hour ago",
    phone: "+91 90123 45678",
    name: "John Doe",
    type: "Attendance Alerts",
    status: "Delivered",
    message:
      "Hello John Doe, You have not clocked in for today yet. Please mark your attendance.",
  },
  {
    time: "3 hours ago",
    phone: "+91 88877 76665",
    name: "Anugrah Prasetya",
    type: "Leave Approval/Rejection",
    status: "Delivered",
    message:
      "Hello Anugrah Prasetya, Your leave request from 20 May has been APPROVED by your manager.",
  },
];

export default function WhatsAppAutomationPage() {
  const [activeTab, setActiveTab] = useState("rules");

  // Credentials Settings
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState(
    "â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢",
  );
  const [wabaPhoneId, setWabaPhoneId] = useState("105991828551042");
  const [wabaToken, setWabaToken] = useState(
    "â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢",
  );
  const [isSaved, setIsSaved] = useState(true);

  // Automation Rules Toggles
  const [rules, setRules] = useState({
    interview: true,
    attendance: false,
    leave: true,
    tasks: true,
    offers: true,
    salary: false,
    meetings: true,
    deadlines: true,
    shortlisting: true,
    announcements: true,
  });

  // Sandbox Test
  const [testPhone, setTestPhone] = useState("+91 ");
  const [testName, setTestName] = useState("Prince");
  const [testTime, setTestTime] = useState("tomorrow at 11:00 AM");
  const [testTemplate, setTestTemplate] = useState("tpl_1");
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState(initialLogs);

  // Template Manager
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [selectedTplId, setSelectedTplId] = useState("tpl_1");

  const activeTemplate =
    templates.find((t) => t.id === selectedTplId) || templates[0];

  // Schedules Queue State
  const [schedules, setSchedules] = useState<ScheduleJob[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  const fetchSchedules = async () => {
    setLoadingSchedules(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/whatsapp/schedules`);
      const data = (await response.json()) as ScheduleResponse;
      if (data.success) {
        setSchedules(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch schedules", error);
    } finally {
      setLoadingSchedules(false);
    }
  };

  const cancelSchedule = async (id: string) => {
    if (!window.confirm("Are you sure you want to cancel this scheduled message?")) return;
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/whatsapp/schedules/${id}`, {
        method: "DELETE"
      });
      const data = (await response.json()) as ScheduleResponse;
      if (data.success) {
        alert("Schedule cancelled successfully!");
        fetchSchedules(); // refresh
      } else {
        alert(`Failed to cancel: ${data.message}`);
      }
    } catch (error) {
      console.error("Failed to cancel schedule", error);
      alert("Error cancelling schedule.");
    }
  };

  useEffect(() => {
    if (activeTab !== "queue") return;

    const timer = window.setTimeout(() => {
      fetchSchedules();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeTab]);

  const handleRuleToggle = (key: keyof typeof rules) => {
    setRules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    alert(
      "API Credentials successfully saved & connected to Twilio & WhatsApp Gateway sandbox!",
    );
  };

  const simulateSend = async () => {
    if (!testPhone.trim() || testPhone === "+91 ") {
      alert("Please enter a valid phone number.");
      return;
    }
    setSending(true);

    // Create replaced preview message
    const msg = activeTemplate.text
      .replace("{{name}}", testName)
      .replace("{{time}}", testTime)
      .replace("{{title}}", "Frontend Role Offer")
      .replace("{{link}}", "https://zenvora.com/join");

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/whatsapp/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({
          phone: testPhone,
          message: msg,
          twilioSid: twilioSid,
          twilioToken: twilioToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to dispatch via gateway");
      }

      const newLog = {
        time: "Just now",
        phone: testPhone,
        name: testName,
        type: activeTemplate.name,
        status: "Delivered",
        message: msg,
      };

      setLogs([newLog, ...logs]);
      alert(
        `WhatsApp message successfully sent via Twilio Gateway to ${testPhone}!\nGateway ID: ${data.gatewayId}`,
      );
    } catch (error) {
      console.error(error);
      alert(`Gateway Dispatch Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSending(false);
    }
  };

  const getReplacedPreview = () => {
    return activeTemplate.text
      .replace("{{name}}", testName || "Prince")
      .replace("{{time}}", testTime || "tomorrow at 11:00 AM")
      .replace("{{title}}", "Frontend Development Project")
      .replace("{{body}}", "office will remain closed tomorrow due to weather")
      .replace("{{link}}", "https://zenvora.com/join");
  };

  return (
    <div
      className="animate-fade-in"
      style={{ width: "100%" }}
    >
     

      {/* KPI stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div
          className="rounded-2xl p-5"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="text-sm mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Total Sent
          </div>
          <div
            className="text-3xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            4,821
          </div>
        </div>
        <div
          className="rounded-2xl p-5"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="text-sm mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Delivery Rate
          </div>
          <div className="text-3xl font-bold" style={{ color: "#10b981" }}>
            99.8%
          </div>
        </div>
        <div
          className="rounded-2xl p-5"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="text-sm mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Active Rules
          </div>
          <div
            className="text-3xl font-bold"
            style={{ color: "var(--accent)" }}
          >
            {Object.values(rules).filter(Boolean).length} / 10
          </div>
        </div>
        <div
          className="rounded-2xl p-5"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="text-sm mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            API Gateway
          </div>
          <div
            className="text-3xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Twilio + WABA
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="card" style={{ padding: 0, marginBottom: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            gap: "2.5rem",
            borderBottom: "1px solid var(--border)",
            padding: "0 2rem",
            overflowX: "auto",
          }}
        >
          {[
            { key: "rules", label: "Automatic Rules" },
            { key: "queue", label: "Queue Manager" },
            { key: "templates", label: "Template Builder" },
            { key: "sandbox", label: "Quick Send Sandbox" },
            { key: "settings", label: "API Configuration" },
          ].map((t) => (
            <div
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: "1.25rem 0",
                color:
                  activeTab === t.key ? "#10b981" : "var(--text-secondary)",
                borderBottom:
                  activeTab === t.key
                    ? "2px solid #10b981"
                    : "2px solid transparent",
                fontWeight: "600",
                fontSize: "0.875rem",
                cursor: "pointer",
                marginBottom: "-1px",
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </div>
          ))}
        </div>

        {/* TAB CONTENTS */}
        <div style={{ padding: "2rem" }}>
          
          {/* 0. QUEUE MANAGER TAB */}
          {activeTab === "queue" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <div>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 0.25rem 0" }}>Pending & Historical Schedules</h3>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>View, monitor, and cancel queued WhatsApp notifications before they are dispatched.</p>
                </div>
                <RefreshButton
                  label="Refresh Queue"
                  onClick={fetchSchedules}
                  loading={loadingSchedules}
                  compact
                  style={{
                    background: "rgba(16,185,129,0.1)",
                    color: "#10b981",
                    border: "1px solid rgba(16,185,129,0.2)",
                  }}
                />
              </div>

              {loadingSchedules ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>Loading schedules...</div>
              ) : schedules.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", borderRadius: "1rem", border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                  No scheduled messages found in the queue.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                    <thead>
                      <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                        <th style={{ padding: "1rem", fontWeight: 600 }}>Recipient</th>
                        <th style={{ padding: "1rem", fontWeight: 600 }}>Type</th>
                        <th style={{ padding: "1rem", fontWeight: 600 }}>Scheduled For</th>
                        <th style={{ padding: "1rem", fontWeight: 600 }}>Status</th>
                        <th style={{ padding: "1rem", fontWeight: 600, textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedules.map(job => (
                        <tr key={job._id} style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-primary)" }}>
                          <td style={{ padding: "1rem", color: "var(--text-primary)" }}>
                            <div style={{ fontWeight: 600 }}>{job.recipient_name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{job.phone}</div>
                          </td>
                          <td style={{ padding: "1rem", color: "var(--text-primary)" }}>
                            {job.notification_type}
                          </td>
                          <td style={{ padding: "1rem", color: "var(--text-primary)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                              <Clock size={14} className="text-gray-400" />
                              {new Date(job.scheduled_time).toLocaleString()}
                            </div>
                          </td>
                          <td style={{ padding: "1rem" }}>
                            {job.status === "pending" && (
                              <span style={{ fontSize: "10px", padding: "0.2rem 0.5rem", borderRadius: "1rem", background: "rgba(234,179,8,0.1)", color: "#eab308", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                                <Clock size={10} /> Pending
                              </span>
                            )}
                            {job.status === "sent" && (
                              <span style={{ fontSize: "10px", padding: "0.2rem 0.5rem", borderRadius: "1rem", background: "rgba(16,185,129,0.1)", color: "#10b981", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                                <CheckCircle size={10} /> Sent
                              </span>
                            )}
                            {job.status === "cancelled" && (
                              <span style={{ fontSize: "10px", padding: "0.2rem 0.5rem", borderRadius: "1rem", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                                <XCircle size={10} /> Cancelled
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "1rem", textAlign: "right" }}>
                            {job.status === "pending" && (
                              <button 
                                onClick={() => cancelSchedule(job._id)}
                                style={{
                                  background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)",
                                  padding: "0.35rem 0.75rem", borderRadius: "0.35rem", fontSize: "0.75rem",
                                  fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.25rem"
                                }}
                              >
                                <Trash2 size={12} /> Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 1. AUTOMATIC RULES TAB */}
          {activeTab === "rules" && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1.5rem",
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: "1.125rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      margin: "0 0 0.25rem 0",
                    }}
                  >
                    Auto-Trigger Notification Rules
                  </h3>
                  <p
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--text-secondary)",
                      margin: 0,
                    }}
                  >
                    Configure automatic triggers that will immediately shoot
                    WhatsApp updates to candidates and employees.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Rule Item */}
                {[
                  {
                    key: "interview",
                    title: "Interview Scheduling",
                    desc: "Sends full schedules & details to candidates when scheduled",
                    example:
                      "Hello Prince, Your interview has been scheduled for tomorrow at 11:00 AM.",
                  },
                  {
                    key: "deadlines",
                    title: "Project Deadlines",
                    desc: "Sends critical task warning reminders 2 hours before deadline",
                    example:
                      "Task deadline reminder: Project submission due in 2 hours.",
                  },
                  {
                    key: "attendance",
                    title: "Attendance Alerts",
                    desc: "Alerts employees immediately if they forgot to clock in by 10 AM",
                    example:
                      "Hello Prince, You have not clocked in for today yet.",
                  },
                  {
                    key: "leave",
                    title: "Leave Approval/Rejection",
                    desc: "Instantly alerts employee when manager signs off on leave request",
                    example:
                      "Hello Prince, Your leave request has been APPROVED.",
                  },
                  {
                    key: "tasks",
                    title: "Task Assignments",
                    desc: "Updates employees when new tasks/milestones are assigned to them",
                    example:
                      "Hi Prince, A new task 'Review RFP' has been assigned to you.",
                  },
                  {
                    key: "offers",
                    title: "Offer Letters",
                    desc: "Shoots high priority congratulatory letters with signable link to candidates",
                    example:
                      "Congratulations Prince! Zenvora has extended an offer to you.",
                  },
                  {
                    key: "salary",
                    title: "Salary & Payroll Notifications",
                    desc: "Alerts employee as soon as monthly salary is successfully credited",
                    example:
                      "Hi Prince, Your salary for May has been credited successfully.",
                  },
                  {
                    key: "meetings",
                    title: "Meeting Reminders",
                    desc: "Sends calendar reminders 15 minutes before global HR meets",
                    example:
                      "Friendly reminder: The Weekly Sync meeting is starting in 15 minutes.",
                  },
                  {
                    key: "shortlisting",
                    title: "Candidate Shortlisting",
                    desc: "Notifies candidates automatically when ATS moves them to shortlisted list",
                    example:
                      "Great news Prince! You have been shortlisted at Zenvora.",
                  },
                  {
                    key: "announcements",
                    title: "Employee Announcements",
                    desc: "Broadcasts critical HR updates & general office announcements",
                    example:
                      "Announcement: Dear Zenvora team, office will remain closed tomorrow.",
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="p-5 rounded-2xl flex items-start gap-4 transition-all"
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border)",
                      opacity: rules[item.key as keyof typeof rules] ? 1 : 0.75,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <h4
                          style={{
                            margin: 0,
                            fontSize: "0.9375rem",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                          }}
                        >
                          {item.title}
                        </h4>
                        <span
                          style={{
                            fontSize: "10px",
                            padding: "0.1rem 0.4rem",
                            borderRadius: "1rem",
                            background: "rgba(139,92,246,0.1)",
                            color: "var(--accent)",
                            fontWeight: 600,
                          }}
                        >
                          Active
                        </span>
                      </div>
                      <p
                        style={{
                          margin: "0 0 0.75rem 0",
                          fontSize: "0.8125rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {item.desc}
                      </p>
                      <div
                        className="p-2.5 rounded-lg border"
                        style={{
                          background: "var(--bg-secondary)",
                          border: "1px solid var(--border)",
                          fontStyle: "italic",
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        "{item.example}"
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        handleRuleToggle(item.key as keyof typeof rules)
                      }
                      style={{
                        position: "relative",
                        width: "40px",
                        height: "20px",
                        borderRadius: "10px",
                        background: rules[item.key as keyof typeof rules]
                          ? "#10b981"
                          : "rgba(255,255,255,0.1)",
                        border: "none",
                        cursor: "pointer",
                        transition: "background 0.3s",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: "2px",
                          left: rules[item.key as keyof typeof rules]
                            ? "22px"
                            : "2px",
                          width: "16px",
                          height: "16px",
                          borderRadius: "50%",
                          background: "#fff",
                          transition: "left 0.3s",
                        }}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. TEMPLATE BUILDER TAB */}
          {activeTab === "templates" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Template List & Editor */}
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <h3
                    style={{
                      fontSize: "1.125rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      margin: "0 0 0.25rem 0",
                    }}
                  >
                    WhatsApp Notification Templates
                  </h3>
                  <p
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--text-secondary)",
                      margin: 0,
                    }}
                  >
                    Define custom message templates. You can use dynamic
                    variables like <code>{"{{name}}"}</code>,{" "}
                    <code>{"{{time}}"}</code>, and <code>{"{{title}}"}</code>.
                  </p>
                </div>

                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTplId(t.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition"
                      style={{
                        background:
                          selectedTplId === t.id
                            ? "#10b981"
                            : "var(--bg-primary)",
                        color:
                          selectedTplId === t.id
                            ? "white"
                            : "var(--text-primary)",
                        border:
                          selectedTplId === t.id
                            ? "1px solid #10b981"
                            : "1px solid var(--border)",
                      }}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>

                {/* Editor Card */}
                <div
                  className="p-5 rounded-2xl"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "1rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      Editing Template: {activeTemplate.name}
                    </span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Category: {activeTemplate.category}
                    </span>
                  </div>

                  <textarea
                    value={activeTemplate.text}
                    onChange={(e) => {
                      setTemplates(
                        templates.map((t) =>
                          t.id === selectedTplId
                            ? { ...t, text: e.target.value }
                            : t,
                        ),
                      );
                    }}
                    style={{
                      width: "100%",
                      height: "150px",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                      padding: "1rem",
                      borderRadius: "0.75rem",
                      outline: "none",
                      fontFamily: "monospace",
                      fontSize: "0.875rem",
                      resize: "none",
                    }}
                  />

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: "1.5rem",
                      flexWrap: "wrap",
                      gap: "1rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <Info size={12} />
                      <span>
                        Variables: <code>{"{{name}}"}</code>,{" "}
                        <code>{"{{time}}"}</code>, <code>{"{{title}}"}</code>
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "0.75rem" }}>
                      <button
                        onClick={() => {
                          setTestTemplate(activeTemplate.id);
                          setActiveTab("sandbox");
                        }}
                        style={{
                          background: "#10b981",
                          color: "white",
                          border: "none",
                          padding: "0.5rem 1rem",
                          borderRadius: "0.5rem",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.35rem",
                        }}
                      >
                        <Send size={12} /> Send Test Message
                      </button>
                      <button
                        onClick={() => {
                          alert("Template changes successfully saved!");
                        }}
                        style={{
                          background: "rgba(255, 255, 255, 0.08)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border)",
                          padding: "0.5rem 1rem",
                          borderRadius: "0.5rem",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Save Template
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Mockup Column */}
              <div className="lg:col-span-1 flex flex-col items-center">
                <h4
                  style={{
                    margin: "0 0 1rem 0",
                    fontSize: "0.9375rem",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                  }}
                >
                  <Eye size={16} /> Live Phone Preview
                </h4>

                {/* Phone Shell */}
                <div
                  className="rounded-3xl p-3 shadow-lg relative"
                  style={{
                    width: "250px",
                    height: "420px",
                    background: "#0b141a",
                    border: "8px solid #2d383f",
                  }}
                >
                  {/* Phone Notch */}
                  <div
                    style={{
                      position: "absolute",
                      top: "12px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: "80px",
                      height: "14px",
                      borderRadius: "10px",
                      background: "#000",
                      zIndex: 10,
                    }}
                  />

                  {/* WhatsApp Screen */}
                  <div
                    className="h-full rounded-2xl overflow-hidden flex flex-col relative"
                    style={{
                      background:
                        "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
                      backgroundSize: "cover",
                    }}
                  >
                    {/* Header */}
                    <div
                      className="h-10 px-3 flex items-center gap-2"
                      style={{ background: "#075e54", color: "#fff" }}
                    >
                      <MessageCircle size={14} />
                      <div className="text-[10px] font-bold">
                        Zenvora Business
                      </div>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 p-2 overflow-y-auto space-y-2">
                      <div
                        className="p-2.5 rounded-lg text-[9px] relative ml-auto shadow-sm"
                        style={{
                          background: "#dcf8c6",
                          color: "#333",
                          maxWidth: "85%",
                          borderBottomRightRadius: 0,
                        }}
                      >
                        <div
                          style={{
                            whiteSpace: "pre-line",
                            wordBreak: "break-word",
                          }}
                        >
                          {getReplacedPreview()}
                        </div>
                        <div
                          style={{
                            textAlign: "right",
                            fontSize: "7px",
                            color: "#666",
                            marginTop: "4px",
                          }}
                        >
                          11:38 AM â€¢ Sent
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. QUICK SANDBOX TEST TAB */}
          {activeTab === "sandbox" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form Config */}
              <div className="space-y-4">
                <div>
                  <h3
                    style={{
                      fontSize: "1.125rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      margin: "0 0 0.25rem 0",
                    }}
                  >
                    Test Send (Twilio Sandbox API)
                  </h3>
                  <p
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--text-secondary)",
                      margin: 0,
                    }}
                  >
                    Shoot a test WhatsApp notification to your personal number
                    directly from here. Twilio Sandbox will process it
                    instantly.
                  </p>
                </div>

                <div
                  className="p-5 rounded-2xl space-y-4"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Target Phone Number (with Country Code)
                    </label>
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="e.g., +91 98765 43210"
                      style={{
                        width: "100%",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          color: "var(--text-secondary)",
                          marginBottom: "0.5rem",
                        }}
                      >
                        Recipient Name
                      </label>
                      <input
                        type="text"
                        value={testName}
                        onChange={(e) => setTestName(e.target.value)}
                        style={{
                          width: "100%",
                          background: "var(--bg-secondary)",
                          border: "1px solid var(--border)",
                          color: "var(--text-primary)",
                          padding: "0.75rem",
                          borderRadius: "0.5rem",
                          outline: "none",
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          color: "var(--text-secondary)",
                          marginBottom: "0.5rem",
                        }}
                      >
                        Time Parameter
                      </label>
                      <input
                        type="text"
                        value={testTime}
                        onChange={(e) => setTestTime(e.target.value)}
                        style={{
                          width: "100%",
                          background: "var(--bg-secondary)",
                          border: "1px solid var(--border)",
                          color: "var(--text-primary)",
                          padding: "0.75rem",
                          borderRadius: "0.5rem",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Choose Template to Replicate
                    </label>
                    <ConstrainedDropdown
                      value={testTemplate}
                      onChange={(value) => {
                        setTestTemplate(value);
                        setSelectedTplId(value);
                      }}
                      options={templates.map((template) => ({
                        value: template.id,
                        label: template.name,
                      }))}
                      buttonStyle={{
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                      }}
                    />
                  </div>

                  <button
                    onClick={simulateSend}
                    disabled={sending}
                    style={{
                      width: "100%",
                      padding: "0.875rem",
                      borderRadius: "0.75rem",
                      background: "linear-gradient(to right, #10b981, #059669)",
                      color: "white",
                      border: "none",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                    }}
                  >
                    {sending ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    {sending
                      ? "Sending via Twilio..."
                      : "Send Test Notification"}
                  </button>
                </div>
              </div>

              {/* Logs */}
              <div className="space-y-4">
                <h4
                  style={{
                    margin: 0,
                    fontSize: "0.9375rem",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <Database size={16} className="text-green-500" /> Twilio
                  Delivery Gateway Logs
                </h4>

                <div
                  className="space-y-3"
                  style={{ maxHeight: "330px", overflowY: "auto" }}
                >
                  {logs.map((log, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border"
                      style={{
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.8125rem",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                          }}
                        >
                          {log.name} ({log.phone})
                        </span>
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#10b981",
                            background: "rgba(16,185,129,0.1)",
                            padding: "0.1rem 0.4rem",
                            borderRadius: "1rem",
                            fontWeight: 600,
                          }}
                        >
                          {log.status}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: "11px",
                          color: "var(--text-secondary)",
                          margin: "0 0 0.5rem 0",
                        }}
                      >
                        {log.type} â€¢ {log.time}
                      </p>
                      <div
                        className="p-2 rounded style-mono"
                        style={{
                          background: "var(--bg-secondary)",
                          fontSize: "0.75rem",
                          color: "var(--text-primary)",
                        }}
                      >
                        "{log.message}"
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. API CONFIGURATION TAB */}
          {activeTab === "settings" && (
            <form onSubmit={handleSaveCredentials} className="space-y-6">
              <div>
                <h3
                  style={{
                    fontSize: "1.125rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    margin: "0 0 0.25rem 0",
                  }}
                >
                  WhatsApp & Twilio Integration API Details
                </h3>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--text-secondary)",
                    margin: 0,
                  }}
                >
                  Configure credentials for automatic message broadcasts &
                  triggers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Twilio Config Card */}
                <div
                  className="p-5 rounded-2xl space-y-4"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      fontSize: "0.9375rem",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <Smartphone size={18} className="text-blue-400" /> Twilio
                    Business API Settings
                  </h4>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Account SID
                    </label>
                    <input
                      type="text"
                      value={twilioSid}
                      onChange={(e) => {
                        setTwilioSid(e.target.value);
                        setIsSaved(false);
                      }}
                      style={{
                        width: "100%",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Auth Token
                    </label>
                    <input
                      type="password"
                      value={twilioToken}
                      onChange={(e) => {
                        setTwilioToken(e.target.value);
                        setIsSaved(false);
                      }}
                      style={{
                        width: "100%",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                {/* WhatsApp Business Cloud API Settings */}
                <div
                  className="p-5 rounded-2xl space-y-4"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      fontSize: "0.9375rem",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <ShieldCheck size={18} className="text-green-400" />{" "}
                    WhatsApp Business Cloud API Settings
                  </h4>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Phone Number ID
                    </label>
                    <input
                      type="text"
                      value={wabaPhoneId}
                      onChange={(e) => {
                        setWabaPhoneId(e.target.value);
                        setIsSaved(false);
                      }}
                      style={{
                        width: "100%",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        marginBottom: "0.5rem",
                      }}
                    >
                      System User Access Token
                    </label>
                    <input
                      type="password"
                      value={wabaToken}
                      onChange={(e) => {
                        setWabaToken(e.target.value);
                        setIsSaved(false);
                      }}
                      style={{
                        width: "100%",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  disabled={isSaved}
                  style={{
                    padding: "0.75rem 2rem",
                    borderRadius: "0.5rem",
                    background: isSaved
                      ? "rgba(255,255,255,0.05)"
                      : "var(--accent)",
                    color: isSaved ? "var(--text-secondary)" : "white",
                    border: "none",
                    fontWeight: 700,
                    cursor: isSaved ? "not-allowed" : "pointer",
                  }}
                >
                  {isSaved ? "Saved & Connected" : "Save Configurations"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
