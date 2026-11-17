import { create } from 'zustand';
import { uid } from '../lib/format';

export interface Toast {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastStoreState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

const AUTO_DISMISS_MS = 7000;

export const useToastStore = create<ToastStoreState>((set, get) => ({
  toasts: [],

  push: (toast) => {
    const id = uid();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    window.setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
