import axios from "axios";
import API_BASE_URL from "../../../config/apiConfig";

const API = axios.create({ baseURL: API_BASE_URL, withCredentials: true });
const INTERVIEW_API = "/api/ai-interview/interview";

export type GenerateQuestionIn = {
  resume_text: string;
  interview_id?: number;
  candidate_id?: number;
  job_role?: string;
  previous_questions: string[];
  previous_answers: string[];
  current_difficulty: string;
};

export type GenerateQuestionOut = {
  question: string;
  current_difficulty: string;
};

export const interviewAiApi = {
  generateQuestion: (payload: GenerateQuestionIn) =>
    API.post<GenerateQuestionOut>(`${INTERVIEW_API}/generate-question`, payload)
      .then((r) => r.data)
      .catch((err) => {
        const detail = err?.response?.data?.detail;
        const message =
          typeof detail === "string"
            ? detail
            : err?.message || "Failed to generate question from Hugging Face.";
        throw new Error(message);
      }),
};

