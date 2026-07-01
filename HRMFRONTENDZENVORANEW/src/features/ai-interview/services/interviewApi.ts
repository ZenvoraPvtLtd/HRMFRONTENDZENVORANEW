import api from "../../../utils/axiosInstance";
import type { Interview, Question, Result } from "../types/interview";
const INTERVIEW_API = "/api/ai-interview/interview";

export type ProctoringEventType =
  | "multiple_faces"
  | "no_face"
  | "background_voice"
  | "tab_switch"
  | "fullscreen_exit"
  | "paste_detected"
  | "network_disconnect"
  | "termination_screenshot"
  | "multiple_faces_terminated"
  | "no_face_terminated"
  | "background_voice_terminated"
  | "tab_switch_terminated"
  | "fullscreen_exit_terminated"
  | "paste_detected_terminated";

const log = (event: string, interviewId?: number | string) =>
  console.log(`[SESSION] interview_id=${interviewId ?? "?"} → ${event}`);

export const interviewApi = {
  create: (d: Partial<Interview>) => api.post<Interview>(`${INTERVIEW_API}/create`, d).then(r => r.data),
  list: () => api.get<Interview[]>(`${INTERVIEW_API}/list`).then(r => r.data),
  get: (id: number) => api.get<Interview>(`${INTERVIEW_API}/${id}`).then(r => r.data),
  questions: (id: number) => api.get<Question[]>(`${INTERVIEW_API}/${id}/questions`).then(r => r.data),
  start: (interview_id: number, candidate_id: number) => {
    log("start", interview_id);
    return api.post(`${INTERVIEW_API}/start`, null, { params: { iv_id: interview_id, candidate_id } }).then(r => r.data);
  },
  submitAnswer: (d: { candidate_id: number; question_id: number; answer_text: string }) =>
    api.post(`${INTERVIEW_API}/submit-answer`, d).then(r => r.data),
  analyze: (candidate_id: number, interview_id: number) =>
    api.post<Result>(`${INTERVIEW_API}/analyze`, null, { params: { candidate_id, interview_id } }).then(r => r.data),
  results: (candidate_id: number) => api.get<Result>(`${INTERVIEW_API}/results/${candidate_id}`).then(r => r.data),
  history: () => api.get<any[]>(`${INTERVIEW_API}/history`).then(r => r.data),
  saveProctoringEvent: (d: {
    candidate_id: number;
    interview_id: number;
    event_type: ProctoringEventType;
    severity: "warning" | "critical";
    message: string;
  }) => api.post(`${INTERVIEW_API}/proctoring-events`, d).then(r => r.data),
  uploadTerminationScreenshot: (d: { candidate_id: number; interview_id: number; file: Blob }) => {
    const form = new FormData();
    form.append("candidate_id", String(d.candidate_id));
    form.append("interview_id", String(d.interview_id));
    form.append("file", d.file, `termination-${d.interview_id}-${d.candidate_id}.jpg`);
    return api.post(`${INTERVIEW_API}/termination-screenshot`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data);
  },
  terminate: (interview_id: number) => {
    log("terminate", interview_id);
    return api.post(`${INTERVIEW_API}/${interview_id}/terminate`).then(r => r.data);
  },
  complete: (interview_id: number) => {
    log("complete", interview_id);
    return api.post(`${INTERVIEW_API}/${interview_id}/complete`).then(r => r.data);
  },
};
export default api;
