import { create } from 'zustand';
import type { ProjectTyp } from '../types/entities';
import type { ExtractedTask } from '../lib/ai';

export interface NewProjectResult {
  name: string;
  kunde: string;
  typ: ProjectTyp;
}

type ModalSpec =
  | { kind: 'none' }
  | { kind: 'confirm'; message: string; confirmLabel: string; danger: boolean; resolve: (v: boolean) => void }
  | { kind: 'alert'; message: string; resolve: () => void }
  | { kind: 'newProject'; resolve: (v: NewProjectResult | null) => void }
  | { kind: 'taskExtractionReview'; tasks: ExtractedTask[]; resolve: (v: ExtractedTask[] | null) => void };

interface ModalStoreState {
  modal: ModalSpec;
  confirm: (message: string, opts?: { confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
  alert: (message: string) => Promise<void>;
  newProjectForm: () => Promise<NewProjectResult | null>;
  taskExtractionReview: (tasks: ExtractedTask[]) => Promise<ExtractedTask[] | null>;
  close: () => void;
}

export const useModalStore = create<ModalStoreState>((set) => ({
  modal: { kind: 'none' },
  confirm: (message, opts) =>
    new Promise<boolean>((resolve) => {
      set({
        modal: {
          kind: 'confirm',
          message,
          confirmLabel: opts?.confirmLabel || 'Löschen',
          danger: opts?.danger !== false,
          resolve,
        },
      });
    }),
  alert: (message) =>
    new Promise<void>((resolve) => {
      set({ modal: { kind: 'alert', message, resolve } });
    }),
  newProjectForm: () =>
    new Promise<NewProjectResult | null>((resolve) => {
      set({ modal: { kind: 'newProject', resolve } });
    }),
  taskExtractionReview: (tasks) =>
    new Promise<ExtractedTask[] | null>((resolve) => {
      set({ modal: { kind: 'taskExtractionReview', tasks, resolve } });
    }),
  close: () => set({ modal: { kind: 'none' } }),
}));
