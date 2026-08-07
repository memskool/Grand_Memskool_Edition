import { useSyncExternalStore } from "react";

/**
 * Tiny global store that tracks whether the student is inside an active
 * examination. While active, all AI surfaces (Crane5 webview, AI Toolkit,
 * nav entry) are hidden to prevent cheating.
 */

const KEY = "memskool:exam-active";
let active = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setExamMode(next: boolean) {
  if (active === next) return;
  active = next;
  try {
    if (next) sessionStorage.setItem(KEY, "1");
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return active;
}

export function isExamActive() {
  if (active) return true;
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function useExamMode() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
