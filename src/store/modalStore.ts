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
  | { kind: 'prompt'; title: string; message: string; label: string; placeholder: string; initialValue: string; confirmLabel: string; resolve: (v: string | null) => void }
  | { kind: 'newProject'; resolve: (v: NewProjectResult | null) => void }
  | { kind: 'taskExtractionReview'; tasks: ExtractedTask[]; resolve: (v: ExtractedTask[] | null) => void };

interface ModalStoreState {
  modal: ModalSpec;
  confirm: (message: string, opts?: { confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
  alert: (message: string) => Promise<void>;
  prompt: (options: { title: string; message: string; label: string; placeholder?: string; initialValue?: string; confirmLabel?: string }) => Promise<string | null>;
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
  prompt: (options) =>
    new Promise<string | null>((resolve) => {
      set({
        modal: {
          kind: 'prompt',
          title: options.title,
          message: options.message,
          label: options.label,
          placeholder: options.placeholder || '',
          initialValue: options.initialValue || '',
          confirmLabel: options.confirmLabel || 'Übernehmen',
          resolve,
        },
      });
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
