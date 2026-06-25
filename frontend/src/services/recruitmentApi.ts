import { getFastApiBaseUrl } from "../config/fastApiConfig";

const RECRUITMENT_API_BASE_URL = getFastApiBaseUrl() + "/api/recruitment";

export type JobStatus = "Published" | "Draft" | "Closed";
export type CandidateStatus = "Accepted" | "Offered" | "Applied" | "Rejected";

export type RecruitmentJob = {
  id: string;
  title: string;
  type: string;
  location: string;
  department: string;
  status: JobStatus;
  posted: string;
  description: string;
};

export type RecruitmentCandidate = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: CandidateStatus;
  applied: string;
  source: string;
};

export type RecruitmentInterview = {
  id: string;
  candidate: string;
  role: string;
  date: string;
  time: string;
  mode: string;
  interviewer: string;
  meetingLink: string;
};

type ApiErrorBody = { detail?: string; message?: string };

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(RECRUITMENT_API_BASE_URL + endpoint, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(error.detail || error.message || `Recruitment request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

export async function fetchRecruitmentJobs() {
  const data = await request<{ jobs: RecruitmentJob[] }>("/jobs");
  return data.jobs;
}

export async function createRecruitmentJob(payload: Omit<RecruitmentJob, "id">) {
  const data = await request<{ job: RecruitmentJob }>("/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.job;
}

export async function fetchRecruitmentCandidates() {
  const data = await request<{ candidates: RecruitmentCandidate[] }>("/candidates");
  return data.candidates;
}

export async function createRecruitmentCandidate(payload: Omit<RecruitmentCandidate, "id">) {
  const data = await request<{ candidate: RecruitmentCandidate }>("/candidates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.candidate;
}

export async function fetchRecruitmentInterviews() {
  const data = await request<{ interviews: RecruitmentInterview[] }>("/interviews");
  return data.interviews;
}

export async function createRecruitmentInterview(payload: Omit<RecruitmentInterview, "id">) {
  const data = await request<{ interview: RecruitmentInterview }>("/interviews", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.interview;
}
