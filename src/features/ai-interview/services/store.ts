import { create } from "zustand";
import type { Resume } from "../types/resume";

interface S {
  candidate: Resume | null;
  setCandidate: (c: Resume | null) => void;
}
export const useInterviewStore = create<S>((set) => ({
  candidate: null,
  setCandidate: (c) => set({ candidate: c }),
}));
