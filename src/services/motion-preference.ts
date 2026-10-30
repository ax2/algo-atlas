import { useSyncExternalStore } from "react";
const media =
  typeof window === "undefined"
    ? undefined
    : window.matchMedia("(prefers-reduced-motion: reduce)");
const subscribe = (listener: () => void) => {
  media?.addEventListener("change", listener);
  return () => media?.removeEventListener("change", listener);
};
/** Respond immediately to an OS preference change, including during playback. */
export function useMotionPreference() {
  return useSyncExternalStore(
    subscribe,
    () => media?.matches ?? false,
    () => false,
  );
}
