export type TaskStatus = "TO DO" | "IN PROGRESS" | "IN REVIEW" | "DONE" | "BLOCKED";

export interface BoardTask {
  id: string;
  title: string;
  status?: TaskStatus;
  type: "Task" | "Bug" | "Feature";
  taskId: string;
  dueDate: string;
  startDate?: string;
  createdDate?: string;
  completedDate?: string;
  lastUpdated?: string;
  tags?: { label: string; color: string }[];
  assignee?: { name: string; color: string };
  reporter?: { name: string; color: string };
  estimate?: string;
  logged?: string;
  priority?: "Low" | "Medium" | "High" | "Critical";
  linkedIssues?: string[];
  subtasks?: string[];
  description?: string;
  comments?: { id: string; user: string; text: string; time: string }[];
  worklogs?: { id: string; user: string; hours: number; minutes: number; date: string; description: string }[];
  history?: { id: string; user: string; action: string; time: string }[];
}

export interface BoardColumn {
  status: TaskStatus;
  tasks: BoardTask[];
}

export interface SprintBoard {
  title: string;
  team: string;
  columns: BoardColumn[];
}

export const avatarColor = (name: string) =>
  name.toLowerCase().includes("mgr") || name.toLowerCase().includes("manager") ? "#ec4899" : "#3b82f6";

export const statusColor: Record<TaskStatus, string> = {
  "TO DO": "#9ca3af",
  "IN PROGRESS": "#f59e0b",
  "IN REVIEW": "#0ea5e9",
  DONE: "#10b981",
  BLOCKED: "#ef4444",
};

export const defaultBoard: SprintBoard = {
  title: "Sprint Board",
  team: "Zenvora Product Team",
  columns: [
    { status: "TO DO", tasks: [] },
    { status: "IN PROGRESS", tasks: [] },
    { status: "IN REVIEW", tasks: [] },
    { status: "DONE", tasks: [] },
    { status: "BLOCKED", tasks: [] },
  ],
};

export const sprintData: Record<string, SprintBoard> = {};
