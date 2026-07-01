import API from "./interviewApi";
import type { Resume } from "../types/resume";

const RESUME_API = "/api/ai-interview/resume";

export const resumeApi = {
  upload: (file: File, interview_id?: number, role?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    if (interview_id != null) fd.append("interview_id", String(interview_id));
    if (role) fd.append("role", role);
    return API.post<Resume>(`${RESUME_API}/upload`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data);
  },
  match: (candidate_id: number, role = "", interview_id?: number) => {
    const params = new URLSearchParams({ candidate_id: String(candidate_id), role });
    if (interview_id != null) params.set("interview_id", String(interview_id));
    return API.get(`${RESUME_API}/match?${params.toString()}`).then(r => r.data);
  },
};
