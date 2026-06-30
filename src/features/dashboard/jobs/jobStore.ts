import type { JobFormData } from './JobForm';
import { getApiBaseUrl } from '../../../config/apiConfig';

export interface JobCard {
  id: string;
  _id: string;
  title: string;
  department?: string;
  location?: string;
  jobType?: string;
  type?: string;
  experienceLevel?: string;
  experience?: string;
  salaryMin?: number;
  salaryMax?: number;
  description?: string;
  skills?: string[];
  responsibilities?: string[];
  qualifications?: string[];
  openings?: number;
  status?: string;
  applicationDeadline?: string;
  createdAt?: string;
  role?: string;
  isActive?: boolean;
  logoLetter: string;
  logoBg: string;
  posted: string;
  company: string;
  field: string;
  salary: string;
  tags: string[];
  skillsList: string[];
  responsibilitiesList: string[];
  qualificationsList: string[];
  whoYouAre: string[];
}

interface JobsApiResponse {
  jobs?: ApiJob[];
  job?: ApiJob;
  message?: string;
}

type ApiJob = Partial<JobCard> & {
  _id?: string;
  id?: string;
};

export const createEmptyJobForm = (): JobFormData => ({
  title: '',
  department: '',
  location: '',
  jobType: 'FullTime',
  experienceLevel: '',
  salaryMin: '',
  salaryMax: '',
  description: '',
  skills: '',
  responsibilities: '',
  qualifications: '',
  openings: '1',
  status: 'Open',
  applicationDeadline: '',
});

const authHeaders = () => {
  const token = localStorage.getItem('hr_accessToken') || localStorage.getItem('accessToken');

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const splitLines = (value: string) => {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
};

const splitCommaList = (value: string) => {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const formatSalary = (salaryMin?: string | number, salaryMax?: string | number) => {
  if (salaryMin && salaryMax) return `${salaryMin} - ${salaryMax}`;
  if (salaryMin) return `From ${salaryMin}`;
  if (salaryMax) return `Up to ${salaryMax}`;
  return 'Not disclosed';
};

const formatDateForInput = (value?: string) => {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
};

export const buildJobPayload = (form: JobFormData) => ({
  title: form.title,
  department: form.department,
  location: form.location,
  jobType: form.jobType,
  experienceLevel: form.experienceLevel,
  salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
  salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
  description: form.description,
  skills: splitCommaList(form.skills),
  responsibilities: splitLines(form.responsibilities),
  qualifications: splitLines(form.qualifications),
  openings: form.openings ? Number(form.openings) : 1,
  status: form.status,
  applicationDeadline: form.applicationDeadline || undefined,
});

export const mapApiJobToCard = (job: ApiJob): JobCard => {
  const id = job._id || job.id || `job-${Date.now()}`;
  const title = job.title || job.role || 'Untitled Job';
  const skills = Array.isArray(job.skills) ? job.skills : [];
  const responsibilities = Array.isArray(job.responsibilities) ? job.responsibilities : [];
  const qualifications = Array.isArray(job.qualifications) ? job.qualifications : [];
  const tags = [job.jobType, job.department || 'General', job.status || 'Open'].filter(
    (tag): tag is string => Boolean(tag)
  );

  return {
    ...job,
    id,
    _id: id,
    title,
    logoLetter: title.charAt(0).toUpperCase(),
    logoBg: '#a855f7',
    posted: job.createdAt ? `Posted ${new Date(job.createdAt).toLocaleDateString()}` : 'Posted recently',
    company: 'Zenvora',
    field: job.department || 'General',
    experience: job.experienceLevel || 'Freshers',
    salary: formatSalary(job.salaryMin, job.salaryMax),
    tags,
    skillsList: skills,
    responsibilities,
    responsibilitiesList: responsibilities,
    qualificationsList: qualifications,
    whoYouAre: qualifications,
  };
};

export const toJobFormData = (job: JobCard): JobFormData => ({
  title: job.title || '',
  department: job.department || '',
  location: job.location || '',
  jobType: job.jobType || 'FullTime',
  experienceLevel: job.experienceLevel || job.experience || '',
  salaryMin: job.salaryMin ? String(job.salaryMin) : '',
  salaryMax: job.salaryMax ? String(job.salaryMax) : '',
  description: job.description || '',
  skills: Array.isArray(job.skills) ? job.skills.join(', ') : '',
  responsibilities: Array.isArray(job.responsibilities) ? job.responsibilities.join('\n') : '',
  qualifications: Array.isArray(job.qualifications) ? job.qualifications.join('\n') : '',
  openings: job.openings ? String(job.openings) : '1',
  status: job.status || 'Open',
  applicationDeadline: formatDateForInput(job.applicationDeadline),
});

const parseJobResponse = async (response: Response) => {
  const text = await response.text();
  let data: JobsApiResponse = {};

  try {
    data = text ? (JSON.parse(text) as JobsApiResponse) : {};
  } catch {
    throw new Error('Jobs API did not return valid JSON. Please check that the backend server is running on port 5000.');
  }

  if (!response.ok) {
    throw new Error(data?.message || 'Job request failed');
  }

  return data;
};

export const fetchJobs = async () => {
  const response = await fetch(`${getApiBaseUrl()}/api/jobs`, {
    headers: authHeaders(),
  });
  const data = await parseJobResponse(response);
  return (data.jobs || []).map(mapApiJobToCard);
};

export const createJob = async (form: JobFormData) => {
  const response = await fetch(`${getApiBaseUrl()}/api/jobs`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(buildJobPayload(form)),
  });
  const data = await parseJobResponse(response);
  if (!data.job) throw new Error("Create job response empty hai.");
  return mapApiJobToCard(data.job);
};

export const updateJob = async (id: string | number, form: JobFormData) => {
  const response = await fetch(`${getApiBaseUrl()}/api/jobs/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(buildJobPayload(form)),
  });
  const data = await parseJobResponse(response);
  if (!data.job) throw new Error("Update job response empty hai.");
  return mapApiJobToCard(data.job);
};

export const deleteJob = async (id: string | number) => {
  const response = await fetch(`${getApiBaseUrl()}/api/jobs/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await parseJobResponse(response);
};
