import { create } from "zustand";

const useToastStore = create((set) => ({
  toasts: [],
  addToast: ({ type = "info", title, message, duration = 4000 }) => {
    const id =
      Date.now().toString() + Math.random().toString(36).substring(2, 6);
    const newToast = { id, type, title, message, duration };
    set((state) => ({
      toasts: [...state.toasts.slice(-4), newToast], // Keep at most 5 visible toasts
    }));
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
    return id;
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

export const toast = {
  success: (title, message, duration) =>
    useToastStore.getState().addToast({
      type: "success",
      title: title || "Success",
      message,
      duration,
    }),
  error: (title, message, duration) =>
    useToastStore.getState().addToast({
      type: "error",
      title: title || "Error",
      message,
      duration: duration || 5000,
    }),
  info: (title, message, duration) =>
    useToastStore.getState().addToast({
      type: "info",
      title: title || "Notice",
      message,
      duration,
    }),
  warning: (title, message, duration) =>
    useToastStore.getState().addToast({
      type: "warning",
      title: title || "Warning",
      message,
      duration,
    }),
};

export default useToastStore;
