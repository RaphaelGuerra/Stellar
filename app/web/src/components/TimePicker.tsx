import { useState, useRef, useEffect, useMemo } from "react";
import { ScrollPicker } from "./ScrollPicker";

interface TimePickerLabels {
  hour: string;
  minute: string;
}

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  required?: boolean;
  labels?: TimePickerLabels;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function parseTime(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(":").map(Number);
  return {
    hour: isNaN(h) ? 12 : Math.max(0, Math.min(23, h)),
    minute: isNaN(m) ? 0 : Math.max(0, Math.min(59, m)),
  };
}

const HOUR_ITEMS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: pad2(i),
}));

const MINUTE_ITEMS = Array.from({ length: 60 }, (_, i) => ({
  value: i,
  label: pad2(i),
}));

export function TimePicker({
  value,
  onChange,
  name,
  required,
  labels = { hour: "Hour", minute: "Minute" },
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { hour, minute } = useMemo(() => parseTime(value), [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  function handleHourChange(h: number) {
    onChange(`${pad2(h)}:${pad2(minute)}`);
  }

  function handleMinuteChange(m: number) {
    onChange(`${pad2(hour)}:${pad2(m)}`);
  }

  const displayValue = value ? `${pad2(hour)}:${pad2(minute)}` : "";

  return (
    <div className="time-picker">
      <button
        ref={triggerRef}
        type="button"
        className="time-picker__trigger"
        onClick={() => setOpen((c) => !c)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {displayValue || <span className="datepicker__placeholder">&nbsp;</span>}
      </button>
      <input type="hidden" name={name} value={value} required={required} />

      {open && (
        <div
          ref={panelRef}
          className="time-picker__panel"
          role="dialog"
          aria-label={`${labels.hour} / ${labels.minute}`}
        >
          <ScrollPicker
            items={HOUR_ITEMS}
            selected={hour}
            onChange={handleHourChange}
            ariaLabel={labels.hour}
          />
          <span className="time-picker__separator">:</span>
          <ScrollPicker
            items={MINUTE_ITEMS}
            selected={minute}
            onChange={handleMinuteChange}
            ariaLabel={labels.minute}
          />
        </div>
      )}
    </div>
  );
}
