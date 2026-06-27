import { getApiBaseUrl } from "../config/apiConfig";

const BASE = () => `${getApiBaseUrl()}/api`;

export type SprintCard = {
  id: string;
  title: string;
  description: string;
  tags: { label: string; color: string }[];
  progress: number;
  startDate: string;
  endDate: string;
  locked: boolean;
  accentColor: string;
};

export async function fetchSprints(): Promise<{ success: boolean; data?: SprintCard[] }> {
  const res = await fetch(`${BASE()}/sprints`);
  return res.json();
}

export async function fetchSprintById(id: string) {
  const res = await fetch(`${BASE()}/sprints/${id}`);
  return res.json();
}
