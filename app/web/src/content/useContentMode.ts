import { useEffect, useMemo, useState } from "react";
import { PT_HOT, PT_LIGHT } from "./index";

export type Mode = "normal" | "carioca";

const STORAGE_KEY = "stellar-mode";

export function useContentMode() {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "normal";
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "carioca" || saved === "normal" ? saved : "normal";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const content = useMemo(() => {
    return mode === "carioca" ? PT_HOT : PT_LIGHT;
  }, [mode]);

  return { mode, setMode, content };
}
