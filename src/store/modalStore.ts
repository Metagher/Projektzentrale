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
  | { kind: 'choice'; title: string; message: string; label: string; options: string[]; initialValue: string; confirmLabel: string; resolve: (v: string | null) => void }
  | { kind: 'newProject'; resolve: (v: NewProjectResult | null) => void }
  | { kind: 'taskExtractionReview'; tasks: ExtractedTask[]; resolve: (v: ExtractedTask[] | null) => void }
  | { kind: 'timeEntryReview'; startedAt: string; endedAt: string; assignmentLabel: string; resolve: (v: TimeEntryReviewResult | null) => void };

export interface TimeEntryReviewResult {
  startedAt: string;
  endedAt: string;
  note: string;
}

interface ModalStoreState {
  modal: ModalSpec;
  confirm: (message: string, opts?: { confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
  alert: (message: string) => Promise<void>;
  prompt: (options: { title: string; message: string; label: string; placeholder?: string; initialValue?: string; confirmLabel?: string }) => Promise<string | null>;
  choice: (options: { title: string; message: string; label: string; options: string[]; initialValue?: string; confirmLabel?: string }) => Promise<string | null>;
  newProjectForm: () => Promise<NewProjectResult | null>;
  taskExtractionReview: (tasks: ExtractedTask[]) => Promise<ExtractedTask[] | null>;
  timeEntryReview: (options: { startedAt: string; endedAt: string; assignmentLabel: string }) => Promise<TimeEntryReviewResult | null>;
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
  choice: (options) =>
    new Promise<string | null>((resolve) => set({ modal: { kind: 'choice', title: options.title, message: options.message, label: options.label, options: options.options, initialValue: options.initialValue || '', confirmLabel: options.confirmLabel || 'Übernehmen', resolve } })),
  newProjectForm: () =>
    new Promise<NewProjectResult | null>((resolve) => {
      set({ modal: { kind: 'newProject', resolve } });
    }),
  taskExtractionReview: (tasks) =>
    new Promise<ExtractedTask[] | null>((resolve) => {
      set({ modal: { kind: 'taskExtractionReview', tasks, resolve } });
    }),
  timeEntryReview: (options) =>
    new Promise<TimeEntryReviewResult | null>((resolve) => {
      set({ modal: { kind: 'timeEntryReview', startedAt: options.startedAt, endedAt: options.endedAt, assignmentLabel: options.assignmentLabel, resolve } });
    }),
  close: () => set({ modal: { kind: 'none' } }),
}));
