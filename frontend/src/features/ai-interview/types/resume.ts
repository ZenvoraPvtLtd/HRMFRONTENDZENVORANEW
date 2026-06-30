export interface Resume {
  id: number;
  candidate_name?: string;
  email?: string;
  resume_url?: string;
  skills: string[];
  projects: string[];
  experience?: string;
  education: string[];
}
