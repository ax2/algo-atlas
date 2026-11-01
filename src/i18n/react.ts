import { useSyncExternalStore } from "react";
import { getLocale, subscribeLocale } from "./text";
export const useLocale = () =>
  useSyncExternalStore(subscribeLocale, getLocale, () => "zh" as const);
