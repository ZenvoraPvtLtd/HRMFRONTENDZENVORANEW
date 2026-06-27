import { useState, useRef, useEffect } from "react";
import { X, Plus, Eye, Share2, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import type { BoardTask } from "./SprintBoardDetailPage";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import { getApiBaseUrl } from "../../config/apiConfig";
import { deleteTask } from "../../services/taskApi";

interface TaskDetailModalProps {
  task: BoardTask;
  onClose: () => void;
}

type SubModal = "assignee" | "reporter" | null;

function MemberSelectModal({
  title,
  buttonLabel,
  members,
  onSelect,
  onClose,
}: {
  title: string;
  buttonLabel: string;
  members: { name: string; email: string; color: string }[];
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 340, background: "var(--bg-secondary)",
          borderRadius: "0.75rem", border: "1px solid var(--border)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)" }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}><X size={16} /></button>
        </div>

        {/* Search */}
        <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
          <input
            autoFocus
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "0.5rem 0.75rem",
              borderRadius: "0.5rem", border: "1px solid var(--border)",
              background: "var(--bg-primary)", color: "var(--text-primary)",
              fontSize: "0.8125rem", outline: "none",
            }}
          />
        </div>

        {/* Members list */}
        <div style={{ maxHeight: 280, overflowY: "auto" }}>
          {filtered.map((m) => (
            <div
              key={m.email}
              style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                padding: "0.75rem 1.25rem",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: m.color, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: "0.875rem", flexShrink: 0,
              }}>
                {m.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>{m.name}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</div>
              </div>
              <button
                onClick={() => { onSelect(m.name); onClose(); }}
                style={{
                  padding: "0.35rem 0.875rem", borderRadius: "0.375rem",
                  background: "var(--accent)", color: "var(--accent-text)",
                  border: "none", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", flexShrink: 0,
                }}
              >
                {buttonLabel}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0.75rem 1.25rem", borderTop: "1px solid var(--border)" }}>
          <button
            onClick={onClose}
            style={{ padding: "0.4rem 1.25rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-secondary)", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface WorkLogEntry {
  id: string;
  user: string;
  color: string;
  hours: number;
  minutes: number;
  date: string;
  description: string;
}

type CommentEntry = {
  id: string;
  user: string;
  text: string;
  time: string;
};

type HistoryEntry = {
  id: string;
  user: string;
  action: string;
  time: string;
};

type TaskUpdate = Partial<{
  status: string;
  priority: string;
  assignee: string;
  reporter: string;
  comments: CommentEntry[];
  history: HistoryEntry[];
  worklogs: WorkLogEntry[];
  linkedIssues: string[];
  subtasks: string[];
}>;

export default function TaskDetailModal({ task, onClose }: TaskDetailModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>(task.status || "TO DO");
  const [assignee, setAssignee] = useState(task.assignee?.name || "Unassigned");
  const [reporter, setReporter] = useState(task.reporter?.name || localStorage.getItem("userName") || "Reporter");
  const [comment, setComment] = useState("");
  const [activeTab, setActiveTab] = useState<"comments" | "worklog" | "history">("comments");
  const [subModal, setSubModal] = useState<SubModal>(null);
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [attachments, setAttachments] = useState<{ name: string; size: string; url: string }[]>([]);
  const [realMembers, setRealMembers] = useState<{ name: string; email: string; color: string }[]>([]);
  const [linkedIssues, setLinkedIssues] = useState<string[]>(task.linkedIssues || []);
  const [subtasks, setSubtasks] = useState<string[]>(task.subtasks || []);
  const [linkedIssueInput, setLinkedIssueInput] = useState("");
  const [subtaskInput, setSubtaskInput] = useState("");
  const [showLinkedIssueInput, setShowLinkedIssueInput] = useState(false);
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [deleting, setDeleting] = useState(false);

  const [priority, setPriority] = useState<string>(task.priority || "Medium");
  const [commentsList, setCommentsList] = useState<{ id: string; user: string; text: string; time: string }[]>(task.comments || []);
  const [historyList, setHistoryList] = useState<{ id: string; user: string; action: string; time: string }[]>(task.history || []);

  // Load real members from API
  useEffect(() => {
    fetch(`${getApiBaseUrl()}/api/employees`).then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        setRealMembers(data.map((e: { name?: string; fullName?: string; email?: string }, i: number) => ({
          name: e.name || e.fullName || "Employee",
          email: e.email || "",
          color: ["var(--accent)", "#10b981", "#f59e0b", "#0ea5e9", "#8b5cf6"][i % 5],
        })));
      }
    }).catch(() => {});
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const url = URL.createObjectURL(file);
      const size = file.size < 1024 * 1024
        ? `${(file.size / 1024).toFixed(1)} KB`
        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
      setAttachments(prev => [...prev, { name: file.name, size, url }]);
    });
    e.target.value = "";
  };

  // Work log state
  const [workLogs, setWorkLogs] = useState<WorkLogEntry[]>(
    () => (task.worklogs || []).map((log) => ({ color: "var(--accent)", ...log })),
  );
  const [wlHours, setWlHours] = useState("0");
  const [wlMinutes, setWlMinutes] = useState("0");
  const [wlDate, setWlDate] = useState(new Date().toISOString().slice(0, 10));
  const [wlDesc, setWlDesc] = useState("");

  const statuses = ["TO DO", "IN PROGRESS", "IN REVIEW", "DONE", "BLOCKED"];

  const getTaskLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("task", task.id);
    return url.toString();
  };

  const copyTaskLink = async () => {
    const link = getTaskLink();
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Task link copied.");
    } catch {
      const input = document.createElement("textarea");
      input.value = link;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(input);
      if (!copied) {
        toast.error("Unable to copy task link.");
        return;
      }
      toast.success("Task link copied.");
    }
  };

  const handleViewTask = () => {
    const opened = window.open(getTaskLink(), "_blank");
    if (!opened) {
      window.location.href = getTaskLink();
      return;
    }
    opened.opener = null;
  };

  const handleDeleteTask = async () => {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    setDeleting(true);
    try {
      const data = await deleteTask(task.id);
      if (!data?.success) {
        throw new Error(data?.message || "Task delete failed.");
      }
      toast.success("Task deleted successfully.");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Task delete failed.");
      setDeleting(false);
    }
  };

  const addUniqueItem = (
    value: string,
    setItems: React.Dispatch<React.SetStateAction<string[]>>,
    afterAdd: () => void
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setItems((prev) => {
      const updated = prev.some((item) => item.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed];
      afterAdd();
      if (setItems === setLinkedIssues) {
        saveTaskDetails({ linkedIssues: updated });
      } else if (setItems === setSubtasks) {
        saveTaskDetails({ subtasks: updated });
      }
      return updated;
    });
    setSaveState("idle");
  };

  const saveTaskDetails = async (updates: TaskUpdate) => {
    setSaveState("saving");
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Save failed.");
      }
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (e) {
      console.error(e);
      setSaveState("error");
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    const hist = {
      id: Date.now().toString(),
      user: localStorage.getItem("userName") || "Employee",
      action: `changed status from "${status}" to "${newStatus}"`,
      time: new Date().toLocaleString("en-GB"),
    };
    const updatedHistory = [...historyList, hist];
    setHistoryList(updatedHistory);
    saveTaskDetails({ status: newStatus, history: updatedHistory });
  };

  const handlePriorityChange = (newPriority: string) => {
    setPriority(newPriority);
    const hist = {
      id: Date.now().toString(),
      user: localStorage.getItem("userName") || "Employee",
      action: `changed priority from "${priority}" to "${newPriority}"`,
      time: new Date().toLocaleString("en-GB"),
    };
    const updatedHistory = [...historyList, hist];
    setHistoryList(updatedHistory);
    saveTaskDetails({ priority: newPriority, history: updatedHistory });
  };

  const handleAssigneeChange = (newAssignee: string) => {
    setAssignee(newAssignee);
    const hist = {
      id: Date.now().toString(),
      user: localStorage.getItem("userName") || "Employee",
      action: `changed assignee to "${newAssignee}"`,
      time: new Date().toLocaleString("en-GB"),
    };
    const updatedHistory = [...historyList, hist];
    setHistoryList(updatedHistory);
    saveTaskDetails({ assignee: newAssignee, history: updatedHistory });
  };

  const handleReporterChange = (newReporter: string) => {
    setReporter(newReporter);
    const hist = {
      id: Date.now().toString(),
      user: localStorage.getItem("userName") || "Employee",
      action: `changed reporter to "${newReporter}"`,
      time: new Date().toLocaleString("en-GB"),
    };
    const updatedHistory = [...historyList, hist];
    setHistoryList(updatedHistory);
    saveTaskDetails({ reporter: newReporter, history: updatedHistory });
  };

  const handleAddComment = () => {
    if (!comment.trim()) return;
    const newComment = {
      id: Date.now().toString(),
      user: localStorage.getItem("userName") || "Employee",
      text: comment.trim(),
      time: new Date().toLocaleString("en-GB"),
    };
    const updatedComments = [...commentsList, newComment];
    setCommentsList(updatedComments);
    setComment("");

    const hist = {
      id: Date.now().toString() + "-comment",
      user: localStorage.getItem("userName") || "Employee",
      action: `added a comment: "${comment.trim().slice(0, 30)}..."`,
      time: new Date().toLocaleString("en-GB"),
    };
    const updatedHistory = [...historyList, hist];
    setHistoryList(updatedHistory);

    saveTaskDetails({ comments: updatedComments, history: updatedHistory });
  };

  const handleLogWork = () => {
    if (!wlDesc.trim()) return;
    const entry: WorkLogEntry = {
      id: Date.now().toString(),
      user: localStorage.getItem("userName") || "Employee",
      color: "var(--accent)",
      hours: parseInt(wlHours),
      minutes: parseInt(wlMinutes),
      date: wlDate,
      description: wlDesc.trim(),
    };
    const updatedWorkLogs = [entry, ...workLogs];
    setWorkLogs(updatedWorkLogs);
    setWlHours("0");
    setWlMinutes("0");
    setWlDate(new Date().toISOString().slice(0, 10));
    setWlDesc("");

    const hist = {
      id: Date.now().toString() + "-worklog",
      user: localStorage.getItem("userName") || "Employee",
      action: `logged ${wlHours}h ${wlMinutes}m of work: "${wlDesc.trim().slice(0, 30)}..."`,
      time: new Date().toLocaleString("en-GB"),
    };
    const updatedHistory = [...historyList, hist];
    setHistoryList(updatedHistory);

    saveTaskDetails({ worklogs: updatedWorkLogs, history: updatedHistory });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !subModal) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, subModal]);

  const labelStyle: React.CSSProperties = {
    fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
    color: "var(--text-secondary)", marginBottom: "0.375rem",
    textTransform: "uppercase",
  };

  return (
    <>
      <div
        ref={overlayRef}
        onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
        style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "1rem",
        }}
      >
        <div
          style={{
            width: "100%", maxWidth: 880, height: "90vh",
            background: "var(--bg-secondary)",
            borderRadius: "0.875rem",
            border: "1px solid var(--border)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, marginBottom: 2 }}>{task.taskId}</div>
              <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)" }}>{task.title}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button title="View" onClick={handleViewTask} style={iconBtnStyle}><Eye size={15} /></button>
              <button title="Share" onClick={copyTaskLink} style={iconBtnStyle}><Share2 size={15} /></button>
              <button title="Delete" onClick={handleDeleteTask} disabled={deleting} style={{ ...iconBtnStyle, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1 }}><Trash2 size={15} /></button>
              <button onClick={onClose} style={iconBtnStyle}><X size={15} /></button>
            </div>
          </div>

          {/* Body */}
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

            {/* Left panel */}
            <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

              {/* Description */}
              <section style={sectionStyle}>
                <div style={sectionLabelStyle}>DESCRIPTION</div>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-primary)", lineHeight: 1.6 }}>
                  {task.title} — {task.taskId}
                </p>
              </section>

              {/* Attachments */}
              <section style={sectionStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={sectionLabelStyle}>ATTACHMENTS ({attachments.length})</div>
                  <button style={addBtnStyle} onClick={() => fileInputRef.current?.click()}>
                    <Plus size={13} /> Add
                  </button>
                  <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={handleFileUpload} />
                </div>
                {attachments.length === 0 ? (
                  <div style={emptyStyle}>No attachments yet.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
                    {attachments.map((att, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.6rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                        <span style={{ fontSize: "0.8rem", flex: 1, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <a href={att.url} download={att.name} style={{ color: "var(--accent)", textDecoration: "none" }}>{att.name}</a>
                        </span>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", flexShrink: 0 }}>{att.size}</span>
                        <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: 0, display: "flex" }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Linked Issues */}
              <section style={sectionStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={sectionLabelStyle}>LINKED ISSUES</div>
                  <button style={iconBtnStyle} onClick={() => setShowLinkedIssueInput((prev) => !prev)}><Plus size={14} /></button>
                </div>
                {showLinkedIssueInput && (
                  <div style={addRowStyle}>
                    <input
                      autoFocus
                      value={linkedIssueInput}
                      onChange={(e) => setLinkedIssueInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          addUniqueItem(linkedIssueInput, setLinkedIssues, () => {
                            setLinkedIssueInput("");
                            setShowLinkedIssueInput(false);
                          });
                        }
                      }}
                      placeholder="Issue key or title"
                      style={inlineInputStyle}
                    />
                    <button
                      style={smallPrimaryBtnStyle}
                      onClick={() => addUniqueItem(linkedIssueInput, setLinkedIssues, () => {
                        setLinkedIssueInput("");
                        setShowLinkedIssueInput(false);
                      })}
                    >
                      Add
                    </button>
                  </div>
                )}
                {linkedIssues.length === 0 ? (
                  <div style={emptyStyle}>No linked issues</div>
                ) : (
                  <div style={itemListStyle}>
                    {linkedIssues.map((issue) => (
                      <div key={issue} style={pillRowStyle}>
                        <span style={pillTextStyle}>{issue}</span>
                        <button onClick={() => { setLinkedIssues((prev) => prev.filter((item) => item !== issue)); setSaveState("idle"); }} style={removeBtnStyle}>x</button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Subtasks */}
              <section style={sectionStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={sectionLabelStyle}>SUBTASKS</div>
                  <button style={iconBtnStyle} onClick={() => setShowSubtaskInput((prev) => !prev)}><Plus size={14} /></button>
                </div>
                {showSubtaskInput && (
                  <div style={addRowStyle}>
                    <input
                      autoFocus
                      value={subtaskInput}
                      onChange={(e) => setSubtaskInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          addUniqueItem(subtaskInput, setSubtasks, () => {
                            setSubtaskInput("");
                            setShowSubtaskInput(false);
                          });
                        }
                      }}
                      placeholder="Subtask title"
                      style={inlineInputStyle}
                    />
                    <button
                      style={smallPrimaryBtnStyle}
                      onClick={() => addUniqueItem(subtaskInput, setSubtasks, () => {
                        setSubtaskInput("");
                        setShowSubtaskInput(false);
                      })}
                    >
                      Add
                    </button>
                  </div>
                )}
                {subtasks.length === 0 ? (
                  <div style={emptyStyle}>No child issues</div>
                ) : (
                  <div style={itemListStyle}>
                    {subtasks.map((subtask) => (
                      <div key={subtask} style={pillRowStyle}>
                        <span style={pillTextStyle}>{subtask}</span>
                        <button onClick={() => { setSubtasks((prev) => prev.filter((item) => item !== subtask)); setSaveState("idle"); }} style={removeBtnStyle}>x</button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Comments / Worklog / History tabs */}
              <section style={{ ...sectionStyle, flex: 1 }}>
                <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: "0.75rem" }}>
                  {(["comments", "worklog", "history"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      style={{
                        padding: "0.5rem 1rem", fontSize: "0.8125rem", fontWeight: 600,
                        border: "none", background: "transparent", cursor: "pointer",
                        color: activeTab === tab ? "var(--accent)" : "var(--text-secondary)",
                        borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                        textTransform: "capitalize",
                      }}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>

                {activeTab === "comments" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--icon-accent-bg)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", fontWeight: 700, fontSize: "0.8rem", flexShrink: 0 }}>
                        {(localStorage.getItem("userName") || "E").charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, display: "flex", gap: "0.5rem" }}>
                        <input
                          type="text"
                          placeholder="Add a comment..."
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleAddComment(); }}
                          style={{ flex: 1, padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "0.8125rem", outline: "none" }}
                        />
                        <button
                          onClick={handleAddComment}
                          disabled={saveState === "saving"}
                          style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", background: "var(--accent)", color: "var(--accent-text)", border: "none", fontSize: "0.8rem", fontWeight: 600, cursor: saveState === "saving" ? "not-allowed" : "pointer", opacity: saveState === "saving" ? 0.7 : 1 }}
                        >
                          {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : "Save"}
                        </button>
                      </div>
                    </div>
                    {saveState === "error" && (
                      <div style={{ fontSize: "0.75rem", color: "#ef4444", paddingLeft: "2.5rem" }}>
                        Save failed. Please try again.
                      </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", marginTop: "0.5rem" }}>
                      {commentsList.length === 0 ? (
                        <div style={emptyStyle}>No comments yet.</div>
                      ) : (
                        commentsList.map((c) => (
                          <div key={c.id} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-secondary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.8rem", flexShrink: 0, color: "var(--text-primary)" }}>
                              {c.user.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>
                                {c.user} <span style={{ fontWeight: 400, color: "var(--text-secondary)", fontSize: "0.75rem", marginLeft: "0.5rem" }}>{c.time}</span>
                              </div>
                              <div style={{ fontSize: "0.8125rem", color: "var(--text-primary)", background: "var(--bg-secondary)", borderRadius: "0.375rem", padding: "0.4rem 0.6rem", border: "1px solid var(--border)", marginTop: "0.25rem", whiteSpace: "pre-wrap" }}>
                                {c.text}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "worklog" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", background: "var(--bg-secondary)", borderRadius: "0.5rem", padding: "0.875rem", border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", gap: "1rem" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Hours</div>
                          <select
                            value={wlHours}
                            onChange={(e) => setWlHours(e.target.value)}
                            style={{ width: "100%", padding: "0.45rem 0.5rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "0.8125rem", outline: "none" }}
                          >
                            {Array.from({ length: 25 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Minutes</div>
                          <select
                            value={wlMinutes}
                            onChange={(e) => setWlMinutes(e.target.value)}
                            style={{ width: "100%", padding: "0.45rem 0.5rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "0.8125rem", outline: "none" }}
                          >
                            {[0, 15, 30, 45].map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Date</div>
                        <input
                          type="date"
                          value={wlDate}
                          onChange={(e) => setWlDate(e.target.value)}
                          style={{ width: "100%", padding: "0.45rem 0.5rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "0.8125rem", outline: "none" }}
                        />
                      </div>

                      <div>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Description <span style={{ color: "#ef4444" }}>*</span></div>
                        <textarea
                          value={wlDesc}
                          onChange={(e) => setWlDesc(e.target.value)}
                          placeholder="Describe the work done (required)"
                          rows={3}
                          style={{ width: "100%", padding: "0.45rem 0.5rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "0.8125rem", outline: "none", resize: "vertical", fontFamily: "inherit" }}
                        />
                      </div>

                      <button
                        onClick={handleLogWork}
                        style={{ alignSelf: "flex-start", padding: "0.45rem 1.25rem", borderRadius: "0.5rem", background: "var(--accent)", color: "var(--accent-text)", border: "none", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
                      >
                        Log time
                      </button>
                    </div>

                    {workLogs.length === 0
                      ? <div style={emptyStyle}>No work logged yet.</div>
                      : workLogs.map((log) => (
                        <div key={log.id} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: log.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.8rem", flexShrink: 0 }}>
                            {log.user.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>
                              {log.user} <span style={{ fontWeight: 400, color: "var(--text-secondary)" }}>logged</span> {log.hours}h {log.minutes}m
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 4 }}>{log.date}</div>
                            <div style={{ fontSize: "0.8125rem", color: "var(--text-primary)", background: "var(--bg-secondary)", borderRadius: "0.375rem", padding: "0.4rem 0.6rem", border: "1px solid var(--border)" }}>{log.description}</div>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}

                {activeTab === "history" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                    {historyList.length === 0 ? (
                      <div style={emptyStyle}>No history logs yet.</div>
                    ) : (
                      historyList.slice().reverse().map((h) => (
                        <div key={h.id} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-secondary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.8rem", flexShrink: 0, color: "var(--text-primary)" }}>
                            {h.user.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: "0.8125rem", color: "var(--text-primary)" }}>
                              <span style={{ fontWeight: 600 }}>{h.user}</span> — {h.action}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 2 }}>{h.time}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </section>
            </div>

            {/* Right panel */}
            <div style={{ width: 220, overflowY: "auto", padding: "1rem", flexShrink: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>


              {/* Status dropdown — uses handleStatusChange to persist + record history */}
              <ConstrainedDropdown
                value={status}
                onChange={handleStatusChange}
                options={statuses}
                buttonStyle={{
                  padding: "0.45rem 0.75rem",
                  borderRadius: "0.5rem",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                }}
              />

              {/* Pinned fields */}
              <div style={rightSectionStyle}>
                <button onClick={() => setPinnedOpen(!pinnedOpen)} style={collapseBtnStyle}>
                  <span style={{ fontWeight: 700, fontSize: "0.8125rem", color: "var(--text-primary)" }}>Pinned fields</span>
                  {pinnedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {pinnedOpen && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", marginTop: "0.5rem" }}>
                    <div>
                      <div style={labelStyle}>Priority</div>
                      <select
                        value={priority}
                        onChange={(e) => handlePriorityChange(e.target.value)}
                        style={{
                          width: "100%", padding: "0.45rem 0.5rem",
                          borderRadius: "0.375rem", border: "1px solid var(--border)",
                          background: "var(--bg-primary)", color: "var(--text-primary)",
                          fontSize: "0.8125rem", outline: "none", cursor: "pointer",
                        }}
                      >
                        {["Low", "Medium", "High", "Critical"].map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div style={labelStyle}>Epic Link</div>
                      <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>None</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Details */}
              <div style={rightSectionStyle}>
                <button onClick={() => setDetailsOpen(!detailsOpen)} style={collapseBtnStyle}>
                  <span style={{ fontWeight: 700, fontSize: "0.8125rem", color: "var(--text-primary)" }}>Details</span>
                  {detailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {detailsOpen && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>

                    <div>
                      <div style={labelStyle}>Due Date</div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--text-primary)" }}>{task.dueDate || "—"}</div>
                    </div>

                    <div>
                      <div style={labelStyle}>Labels</div>
                      {task.tags && task.tags.length > 0
                        ? task.tags.map((t) => (
                            <span key={t.label} style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "0.25rem", background: t.color + "20", color: t.color, marginRight: 4 }}>{t.label}</span>
                          ))
                        : <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "0.25rem", background: "#0ea5e920", color: "#0ea5e9", fontWeight: 600 }}>Development</span>
                      }
                    </div>

                    <div>
                      <div style={labelStyle}>Assignee</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: task.assignee?.color || "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.7rem", fontWeight: 700, flexShrink: 0 }}>
                          {assignee.charAt(0).toUpperCase()}
                        </div>
                        <button
                          onClick={() => setSubModal("assignee")}
                          style={{ fontSize: "0.8125rem", color: "var(--text-primary)", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
                        >
                          {assignee}
                        </button>
                        <button onClick={() => handleAssigneeChange("Unassigned")} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "0.75rem", padding: 0 }}>×</button>
                      </div>
                    </div>
   
                    <div>
                      <div style={labelStyle}>Reporter</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.7rem", fontWeight: 700, flexShrink: 0 }}>
                          {reporter.charAt(0).toUpperCase()}
                        </div>
                        <button
                          onClick={() => setSubModal("reporter")}
                          style={{ fontSize: "0.8125rem", color: "var(--text-primary)", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
                        >
                          {reporter}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div style={labelStyle}>Created</div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--text-primary)" }}>{task.dueDate || "15/02/2026"}</div>
                    </div>

                    <div>
                      <div style={labelStyle}>Time Tracking</div>
                      <div style={{ height: 4, borderRadius: 2, background: "var(--border)", marginBottom: 4 }}>
                        <div style={{ height: 4, borderRadius: 2, width: "0%", background: "var(--accent)" }} />
                         </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>0h logged</div>
                    </div>

                    <div>
                      <div style={labelStyle}>Updated</div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--text-primary)" }}>
                        {new Date().toLocaleDateString("en-GB")} {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} pm
                      </div>
                    </div>

                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-modals */}
      {subModal === "assignee" && (
        <MemberSelectModal
          title="Select Assignee"
          buttonLabel="Assign"
          members={realMembers}
          onSelect={(name) => handleAssigneeChange(name)}
          onClose={() => setSubModal(null)}
        />
      )}
      {subModal === "reporter" && (
        <MemberSelectModal
          title="Select Reporter"
          buttonLabel="Set reporter"
          members={realMembers}
          onSelect={(name) => handleReporterChange(name)}
          onClose={() => setSubModal(null)}
        />
      )}
    </>
  );
}

// Shared style objects
const iconBtnStyle: React.CSSProperties = {
  background: "transparent", border: "none", cursor: "pointer",
  color: "var(--text-secondary)", display: "flex", alignItems: "center",
  justifyContent: "center", padding: "0.35rem", borderRadius: "0.375rem",
};

const sectionStyle: React.CSSProperties = {
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: "0.625rem",
  padding: "1rem",
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em",
  color: "var(--text-secondary)", marginBottom: "0.625rem",
  textTransform: "uppercase",
};

const emptyStyle: React.CSSProperties = {
  fontSize: "0.8125rem", color: "var(--text-secondary)",
  textAlign: "center", padding: "1rem 0",
};

const addRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  marginTop: "0.25rem",
  marginBottom: "0.75rem",
};

const inlineInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "0.45rem 0.6rem",
  borderRadius: "0.4rem",
  border: "1px solid var(--border)",
  background: "var(--bg-secondary)",
  color: "var(--text-primary)",
  fontSize: "0.8125rem",
  outline: "none",
};

const smallPrimaryBtnStyle: React.CSSProperties = {
  padding: "0.45rem 0.75rem",
  borderRadius: "0.4rem",
  border: "none",
  background: "var(--accent)", 
  color: "var(--accent-text)",
  fontSize: "0.75rem",
  fontWeight: 700,
  cursor: "pointer",
};

const itemListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  marginTop: "0.5rem",
};

const pillRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.45rem 0.6rem",
  borderRadius: "0.45rem",
  border: "1px solid var(--border)",
  background: "var(--bg-secondary)",
};

const pillTextStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--text-primary)",
  fontSize: "0.8125rem",
};

const removeBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--text-secondary)",
  cursor: "pointer",
  fontSize: "0.8rem",
  lineHeight: 1,
  padding: "0.1rem",
};

const addBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "0.25rem",
  fontSize: "0.75rem", fontWeight: 600, padding: "0.25rem 0.625rem",
  borderRadius: "0.375rem", background: "var(--bg-secondary)",
  border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer",
};

const rightSectionStyle: React.CSSProperties = {
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  padding: "0.75rem",
};

const collapseBtnStyle: React.CSSProperties = {
  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
  background: "none", border: "none", cursor: "pointer",
  color: "var(--text-secondary)", padding: 0,
};
