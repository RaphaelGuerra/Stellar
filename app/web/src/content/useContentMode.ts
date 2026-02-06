import { useEffect, useMemo, useState } from "react";
import { EN, PT_HOT } from "./index";
import type { ContentPack } from "../lib/cards";

export type Mode = "normal" | "carioca";

const STORAGE_KEY = "stellar-mode";

interface UseContentModeReturn {
  mode: Mode;
  setMode: (mode: Mode) => void;
  content: ContentPack;
}

export function useContentMode(): UseContentModeReturn {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "normal";
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "carioca" || saved === "normal" ? saved : "normal";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const content = useMemo((): ContentPack => {
    return mode === "carioca" ? PT_HOT : EN;
  }, [mode]);

  return { mode, setMode, content };
}
