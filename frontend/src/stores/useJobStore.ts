import { create } from 'zustand';
import type { JobStatus, SSEEvent } from '../types';

interface ProgressEvent {
  stage: string;
  status: string;
  progress: number;
  message: string;
}

interface JobStore {
  jobId: string | null;
  jobStatus: JobStatus | null;
  progress: ProgressEvent[];
  currentStage: string;
  isConnected: boolean;

  setJobId: (id: string) => void;
  setJobStatus: (status: JobStatus) => void;
  handleSSEEvent: (event: SSEEvent) => void;
  resetJob: () => void;
}

export const useJobStore = create<JobStore>((set) => ({
  jobId: null,
  jobStatus: null,
  progress: [],
  currentStage: '',
  isConnected: false,

  setJobId: (id) => set({ jobId: id }),
  setJobStatus: (status) => set({ jobStatus: status }),

  handleSSEEvent: (event) => set((state) => ({
    currentStage: event.stage || state.currentStage,
    progress: [
      ...state.progress.slice(-20), // Keep last 20 events
      {
        stage: event.stage,
        status: event.status,
        progress: event.progress ?? 0,
        message: event.message || '',
      }
    ],
    isConnected: event.status !== 'failed',
  })),

  resetJob: () => set({
    jobId: null,
    jobStatus: null,
    progress: [],
    currentStage: '',
    isConnected: false,
  }),
}));
