import axios from "axios";
import type { Interview, Question, Result } from "../types/interview";
import API_BASE_URL from "../../../config/apiConfig";

const API = axios.create({ baseURL: API_BASE_URL, withCredentials: true });
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

export const interviewApi = {
  create: (d: Partial<Interview>) => API.post<Interview>(`${INTERVIEW_API}/create`, d).then(r => r.data),
  list: () => API.get<Interview[]>(`${INTERVIEW_API}/list`).then(r => r.data),
  get: (id: number) => API.get<Interview>(`${INTERVIEW_API}/${id}`).then(r => r.data),
  questions: (id: number) => API.get<Question[]>(`${INTERVIEW_API}/${id}/questions`).then(r => r.data),
  start: (interview_id: number, candidate_id: number) =>
    API.post(`${INTERVIEW_API}/start`, null, { params: { iv_id: interview_id, candidate_id } }).then(r => r.data),
  submitAnswer: (d: { candidate_id: number; question_id: number; answer_text: string }) =>
    API.post(`${INTERVIEW_API}/submit-answer`, d).then(r => r.data),
  analyze: (candidate_id: number, interview_id: number) =>
    API.post<Result>(`${INTERVIEW_API}/analyze`, null, { params: { candidate_id, interview_id } }).then(r => r.data),
  results: (candidate_id: number) => API.get<Result>(`${INTERVIEW_API}/results/${candidate_id}`).then(r => r.data),
  history: () => API.get<any[]>(`${INTERVIEW_API}/history`).then(r => r.data),
  saveProctoringEvent: (d: {
    candidate_id: number;
    interview_id: number;
    event_type: ProctoringEventType;
    severity: "warning" | "critical";
    message: string;
  }) => API.post(`${INTERVIEW_API}/proctoring-events`, d).then(r => r.data),
  uploadTerminationScreenshot: (d: { candidate_id: number; interview_id: number; file: Blob }) => {
    const form = new FormData();
    form.append("candidate_id", String(d.candidate_id));
    form.append("interview_id", String(d.interview_id));
    form.append("file", d.file, `termination-${d.interview_id}-${d.candidate_id}.jpg`);
    return API.post(`${INTERVIEW_API}/termination-screenshot`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data);
  },
  terminate: (interview_id: number) =>
    API.post(`${INTERVIEW_API}/${interview_id}/terminate`).then(r => r.data),
};
export default API;
