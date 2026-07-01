import React, { useEffect, useState } from "react";
import {
  Brain,
  Code,
  Video,
  Plus,
  Trash2,
  Clock,
  BookOpen,
  CheckCircle,
  XCircle,
  Search,
  LayoutTemplate,
  MonitorPlay,
  Settings2,
  Activity
} from "lucide-react";
import Button from "../../components/button/Button";
import { SEARCH_EVENT } from "../../components/layout/TopHeader";

interface InterviewModule {
  id: string;
  name: string; 
  description: string;
  type: "video" | "coding" | "cognitive" | "behavioral";
  questionsCount: number;
  duration: number; // in minutes
  difficulty: "Easy" | "Medium" | "Hard";
  isActive: boolean;
  aiParameters: string[];
}

const initialModules: InterviewModule[] = [
  {
    id: "mod-1",
    name: "AI Behavioral Assessment",
    description: "Evaluates candidates on soft skills, communication, leadership, and culture fit using sentiment and facial analysis.",
    type: "behavioral",
    questionsCount: 8,
    duration: 25,
    difficulty: "Medium",
    isActive: true,
    aiParameters: ["Tone Analysis", "Sentiment Detection", "Facial Expression"],
  },
  {
    id: "mod-2",
    name: "Frontend Coding Challenge",
    description: "Automated coding test focusing on React, modern JavaScript, CSS capabilities, and algorithmic efficiency.",
    type: "coding",
    questionsCount: 3,
    duration: 60,
    difficulty: "Hard",
    isActive: true,
    aiParameters: ["Code Correctness", "Complexity Analysis", "Anti-cheat Detection"],
  },
  {
    id: "mod-3",
    name: "AI Video Technical Screening",
    description: "Asynchronous video screening where candidates answer core computer science and system architecture questions.",
    type: "video",
    questionsCount: 5,
    duration: 30,
    difficulty: "Medium",
    isActive: true,
    aiParameters: ["Speech-to-text Accuracy", "Keyword Matching", "Confidence Scoring"],
  },
  {
    id: "mod-4",
    name: "Logical & Cognitive Ability",
    description: "Gamified and pattern-based test assessing analytical thinking, logical reasoning, and puzzle-solving speed.",
    type: "cognitive",
    questionsCount: 15,
    duration: 20,
    difficulty: "Easy",
    isActive: false,
    aiParameters: ["Response Speed", "Pattern Recognition", "Focus Deviation"],
  },
];

export default function InterviewModules() {
  const [modules, setModules] = useState<InterviewModule[]>(initialModules);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states for new module
  const [newModuleName, setNewModuleName] = useState("");
  const [newModuleDesc, setNewModuleDesc] = useState("");
  const [newModuleType, setNewModuleType] = useState<"video" | "coding" | "cognitive" | "behavioral">("video");
  const [newModuleQuestions, setNewModuleQuestions] = useState(5);
  const [newModuleDuration, setNewModuleDuration] = useState(30);
  const [newModuleDifficulty, setNewModuleDifficulty] = useState<"Easy" | "Medium" | "Hard">("Medium");
  const [newModuleParams, setNewModuleParams] = useState("");

  useEffect(() => {
    const handleSearch = (event: Event) => {
      setSearchTerm((event as CustomEvent<string>).detail || "");
    };

    window.addEventListener(SEARCH_EVENT, handleSearch);
    return () => window.removeEventListener(SEARCH_EVENT, handleSearch);
  }, []);

  const handleToggleActive = (id: string) => {
    setModules(
      modules.map((mod) =>
        mod.id === id ? { ...mod, isActive: !mod.isActive } : mod
      )
    );
  };

  const handleDeleteModule = (id: string) => {
    if (window.confirm("Are you sure you want to delete this interview module?")) {
      setModules(modules.filter((mod) => mod.id !== id));
    }
  };

  const handleCreateModule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleName.trim() || !newModuleDesc.trim()) return;

    const newModule: InterviewModule = {
      id: `mod-${Date.now()}`,
      name: newModuleName,
      description: newModuleDesc,
      type: newModuleType,
      questionsCount: newModuleQuestions,
      duration: newModuleDuration,
      difficulty: newModuleDifficulty,
      isActive: true,
      aiParameters: newModuleParams
        ? newModuleParams.split(",").map((p) => p.trim())
        : ["AI Evaluation"],
    };

    setModules([newModule, ...modules]);
    setShowCreateModal(false);

    // Reset Form
    setNewModuleName("");
    setNewModuleDesc("");
    setNewModuleType("video");
    setNewModuleQuestions(5);
    setNewModuleDuration(30);
    setNewModuleDifficulty("Medium");
    setNewModuleParams("");
  };

  const filteredModules = modules.filter((mod) => {
    const matchesSearch =
      mod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mod.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === "all" || mod.type === selectedType;
    return matchesSearch && matchesType;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "video":
        return <MonitorPlay className="text-blue-500" size={24} />;
      case "coding":
        return <Code className="text-emerald-500" size={24} />;
      case "cognitive":
        return <Brain className="text-indigo-500" size={24} />;
      default:
        return <Activity className="text-amber-500" size={24} />;
    }
  };

  return (
    <div className="animate-fade-in p-4 sm:p-8 max-w-[1600px] mx-auto">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 bg-gradient-to-r from-[var(--bg-secondary)] to-transparent p-6 rounded-3xl border border-[var(--border)] shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-3 tracking-tight" style={{ color: "var(--text-primary)" }}>
            <LayoutTemplate className="text-indigo-500" size={32} /> Interview Modules
          </h1>
          <p className="text-base mt-2 font-medium opacity-80" style={{ color: "var(--text-secondary)" }}>
            Create, configure and manage AI-powered dynamic evaluation modules for candidates.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus size={18} /> Create Module
        </button>
      </div>

      {/* Filter Bar */}
      <div
        className="p-2 mb-8 inline-flex flex-wrap gap-2 items-center justify-start rounded-2xl shadow-sm"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
      >
        {["all", "video", "coding", "cognitive", "behavioral"].map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-5 py-2 rounded-xl text-sm font-bold capitalize transition-all ${
              selectedType === type ? "shadow-sm scale-100" : "hover:scale-105"
            }`}
            style={{
              background: selectedType === type ? "var(--bg-primary)" : "transparent",
              color: selectedType === type ? "var(--text-primary)" : "var(--text-secondary)",
              border: "none",
              cursor: "pointer",
            }}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Grid of Modules */}
      {filteredModules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border)]">
          <Search size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No modules found</h3>
          <p className="text-[var(--text-secondary)]">Try adjusting your search or filters to find what you're looking for.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredModules.map((mod) => (
            <div
              key={mod.id}
              className="group relative rounded-3xl p-6 flex flex-col justify-between transition-all hover:shadow-2xl hover:-translate-y-1 bg-gradient-to-b from-[var(--bg-secondary)] to-[var(--bg-primary)] overflow-hidden"
              style={{
                border: "1px solid var(--border)",
              }}
            >
              {/* Decorative background blur */}
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-500"></div>

              <div className="relative z-10">
                <div className="flex justify-between items-start gap-4 mb-5">
                  <div className="flex items-center gap-4">
                    <div
                      className="p-3.5 rounded-2xl flex items-center justify-center shadow-inner"
                      style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
                    >
                      {getIcon(mod.type)}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg leading-tight mb-1" style={{ color: "var(--text-primary)" }}>
                        {mod.name}
                      </h3>
                      <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                        {mod.type}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleActive(mod.id)}
                      className="p-2 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5 border-none cursor-pointer"
                      title={mod.isActive ? "Deactivate Module" : "Activate Module"}
                    >
                      {mod.isActive ? (
                        <CheckCircle size={22} className="text-emerald-500 drop-shadow-sm" />
                      ) : (
                        <XCircle size={22} className="text-slate-400" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteModule(mod.id)}
                      className="p-2 rounded-xl text-rose-500 transition-colors hover:bg-rose-50 dark:hover:bg-rose-500/10 border-none cursor-pointer"
                      title="Delete Module"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <p className="text-sm mb-6 line-clamp-3 leading-relaxed opacity-90" style={{ color: "var(--text-secondary)" }}>
                  {mod.description}
                </p>

                {/* Info Pills */}
                <div className="flex flex-wrap gap-2 text-[11px] font-bold mb-6" style={{ color: "var(--text-primary)" }}>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)]">
                    <BookOpen size={14} className="text-indigo-500" /> {mod.questionsCount} Qs
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)]">
                    <Clock size={14} className="text-emerald-500" /> {mod.duration} Mins
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)]">
                    Difficulty:{" "}
                    <span
                      style={{
                        color:
                          mod.difficulty === "Easy"
                            ? "#10b981"
                            : mod.difficulty === "Medium"
                            ? "#f59e0b"
                            : "#ef4444",
                      }}
                    >
                      {mod.difficulty}
                    </span>
                  </span>
                </div>
              </div>

              {/* AI Parameters */}
              <div
                className="pt-4 border-t relative z-10"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Settings2 size={14} className="text-slate-400" />
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                    AI Parameters
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {mod.aiParameters.map((param, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] px-2.5 py-1 rounded-md font-semibold border"
                      style={{
                        background: "var(--bg-primary)",
                        color: "var(--text-secondary)",
                        borderColor: "var(--border)"
                      }}
                    >
                      {param}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div
            className="w-full max-w-xl rounded-3xl p-8 shadow-2xl relative overflow-hidden"
            style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
                Create Module
              </h2>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-full hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-secondary)] border-none bg-transparent cursor-pointer"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleCreateModule} className="space-y-5">
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                  Module Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. System Design Interview"
                  value={newModuleName}
                  onChange={(e) => setNewModuleName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                  Description *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe what skills and competencies are evaluated..."
                  value={newModuleDesc}
                  onChange={(e) => setNewModuleDesc(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow resize-none"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                    Type
                  </label>
                  <select
                    value={newModuleType}
                    onChange={(e) => setNewModuleType(e.target.value as InterviewModule['type'])}
                    className="w-full px-3 py-3 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                    style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  >
                    <option value="video">Video AI</option>
                    <option value="coding">Coding</option>
                    <option value="cognitive">Cognitive</option>
                    <option value="behavioral">Behavioral</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                    Questions
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={newModuleQuestions}
                    onChange={(e) => setNewModuleQuestions(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-3 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                    Difficulty
                  </label>
                  <select
                    value={newModuleDifficulty}
                    onChange={(e) => setNewModuleDifficulty(e.target.value as InterviewModule['difficulty'])}
                    className="w-full px-3 py-3 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                    style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={newModuleDuration}
                    onChange={(e) => setNewModuleDuration(parseInt(e.target.value) || 5)}
                    className="w-full px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                    AI Parameters
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Speech rate, Eye focus"
                    value={newModuleParams}
                    onChange={(e) => setNewModuleParams(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t mt-6" style={{ borderColor: "var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-3 rounded-xl font-bold transition-colors border-none cursor-pointer"
                  style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-transform active:scale-95 border-none cursor-pointer"
                >
                  Add Module
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
