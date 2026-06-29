export interface Interview {
  id: number;
  title: string;
  department?: string;
  experience_level?: string;
  skills: string[];
  difficulty: string;
  duration: number;
  question_count: number;
  interview_type: string;
  status: string;
  created_by: string;
  created_at: string;
}
export interface Question { id: number; interview_id: number; question_text: string; order: number; }
export interface Result {
  id: number; candidate_id: number; interview_id: number;
  technical_score: number; communication_score: number; confidence_score: number;
  problem_solving_score: number; final_score: number;
  strengths: string[]; weaknesses: string[]; suggestions: string[]; recommendation: string;
}
