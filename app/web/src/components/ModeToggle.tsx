import type { Mode } from "../content/useContentMode";

interface ModeToggleProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
  ariaLabel?: string;
}

export function ModeToggle({ mode, setMode, ariaLabel = "Content mode" }: ModeToggleProps) {
  return (
    <div className="mode-toggle" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className={`mode-toggle__btn ${mode === "normal" ? "mode-toggle__btn--active" : ""}`}
        data-mode="normal"
        aria-pressed={mode === "normal"}
        onClick={() => setMode("normal")}
      >
        English
      </button>
      <button
        type="button"
        className={`mode-toggle__btn ${mode === "carioca" ? "mode-toggle__btn--active" : ""}`}
        data-mode="carioca"
        aria-pressed={mode === "carioca"}
        onClick={() => setMode("carioca")}
      >
        Carioca
      </button>
    </div>
  );
}
