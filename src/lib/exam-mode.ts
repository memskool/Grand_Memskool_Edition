import { useSyncExternalStore } from "react";

/**
 * Client deterrent only: hides AI nav while a test/exam attempt is open.
 * This is not a security control. Server functions still enforce attempts.
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
