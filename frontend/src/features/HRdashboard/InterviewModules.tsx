import React, { useState } from "react";
import {
  Brain,
  Code,
  Sliders,
  Video,
  Plus,
  Search,
  Trash2,
  Clock,
  BookOpen,
  CheckCircle,
  XCircle,
  Sparkles,
} from "lucide-react";
import Button from "../../components/button/Button";

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
        return <Video className="text-blue-500" size={20} />;
      case "coding":
        return <Code className="text-green-500" size={20} />;
      case "cognitive":
        return <Brain className="text-purple-500" size={20} />;
      default:
        return <Sliders className="text-orange-500" size={20} />;
    }
  };

  return (
    <div className="animate-fade-in p-4 sm:p-6">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Sparkles className="text-amber-500" size={24} /> Interview Modules
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Create, configure and manage AI-powered dynamic evaluation modules for candidates.
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          style={{
            width: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.625rem 1.25rem",
          }}
        >
          <Plus size={16} /> Create Module
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="p-4 rounded-xl mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
      >
        <div className="relative w-full sm:w-80">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2"
            size={18}
            style={{ color: "var(--text-secondary)" }}
          />
          <input
            type="text"
            placeholder="Search modules..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg text-sm bg-transparent"
            style={{
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0" style={{ scrollbarWidth: "none" }}>
          {["all", "video", "coding", "cognitive", "behavioral"].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all"
              style={{
                background: selectedType === type ? "var(--accent)" : "var(--bg-hover)",
                color: selectedType === type ? "#fff" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Modules */}
      {filteredModules.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
            No interview modules found matching the criteria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredModules.map((mod) => (
            <div
              key={mod.id}
              className="rounded-2xl p-5 flex flex-col justify-between transition-all hover:shadow-md"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              <div>
                <div className="flex justify-between items-start gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="p-2.5 rounded-xl flex items-center justify-center"
                      style={{ background: "var(--bg-hover)" }}
                    >
                      {getIcon(mod.type)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>
                        {mod.name}
                      </h3>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {mod.type}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Toggle Switch */}
                    <button
                      onClick={() => handleToggleActive(mod.id)}
                      className="focus:outline-none bg-transparent border-none p-0 cursor-pointer"
                      title={mod.isActive ? "Deactivate Module" : "Activate Module"}
                    >
                      {mod.isActive ? (
                        <CheckCircle size={22} className="text-emerald-500" />
                      ) : (
                        <XCircle size={22} className="text-rose-400" />
                      )}
                    </button>

                    <button
                      onClick={() => handleDeleteModule(mod.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-none cursor-pointer"
                      title="Delete Module"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <p className="text-sm mb-4 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                  {mod.description}
                </p>

                {/* Info Pills */}
                <div className="flex flex-wrap gap-4 text-xs font-medium mb-4" style={{ color: "var(--text-secondary)" }}>
                  <span className="flex items-center gap-1">
                    <BookOpen size={14} /> {mod.questionsCount} Qs
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={14} /> {mod.duration} Mins
                  </span>
                  <span className="flex items-center gap-1">
                    Difficulty:{" "}
                    <strong
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
                    </strong>
                  </span>
                </div>
              </div>

              {/* AI Parameters */}
              <div
                className="pt-3 border-t border-dashed flex flex-wrap gap-1.5 items-center"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "var(--text-secondary)" }}>
                  AI Parameters:
                </span>
                {mod.aiParameters.map((param, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: "var(--icon-accent-bg)",
                      color: "var(--accent)",
                    }}
                  >
                    {param}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 animate-fade-in">
          <div
            className="w-full max-w-lg rounded-2xl p-6 shadow-2xl relative overflow-hidden"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          >
            <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
              Create New Interview Module
            </h2>
            <form onSubmit={handleCreateModule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                  Module Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. System Design Interview"
                  value={newModuleName}
                  onChange={(e) => setNewModuleName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-transparent"
                  style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                  Description *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe what skills and competencies are evaluated..."
                  value={newModuleDesc}
                  onChange={(e) => setNewModuleDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-transparent"
                  style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                    Type
                  </label>
                  <select
                    value={newModuleType}
                    onChange={(e) => setNewModuleType(e.target.value as InterviewModule['type'])}
                    className="w-full px-2 py-2 rounded-lg text-sm bg-transparent"
                    style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  >
                    <option value="video">Video AI</option>
                    <option value="coding">Coding</option>
                    <option value="cognitive">Cognitive</option>
                    <option value="behavioral">Behavioral</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                    Questions
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={newModuleQuestions}
                    onChange={(e) => setNewModuleQuestions(parseInt(e.target.value) || 1)}
                    className="w-full px-2 py-2 rounded-lg text-sm bg-transparent"
                    style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                    Difficulty
                  </label>
                  <select
                    value={newModuleDifficulty}
                    onChange={(e) => setNewModuleDifficulty(e.target.value as InterviewModule['difficulty'])}
                    className="w-full px-2 py-2 rounded-lg text-sm bg-transparent"
                    style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={newModuleDuration}
                    onChange={(e) => setNewModuleDuration(parseInt(e.target.value) || 5)}
                    className="w-full px-2 py-2 rounded-lg text-sm bg-transparent"
                    style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                    AI Parameters (Comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Speech rate, Eye focus"
                    value={newModuleParams}
                    onChange={(e) => setNewModuleParams(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg text-sm bg-transparent"
                    style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <Button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    background: "var(--bg-hover)",
                    color: "var(--text-secondary)",
                    width: "auto",
                    padding: "0.5rem 1rem",
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" style={{ width: "auto", padding: "0.5rem 1.25rem" }}>
                  Add Module
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

