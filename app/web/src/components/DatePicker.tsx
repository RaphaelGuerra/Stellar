import { useState, useRef, useEffect, useCallback } from "react";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  locale?: string;
  name?: string;
  required?: boolean;
}

interface CalendarDay {
  day: number;
  month: number;
  year: number;
  isCurrentMonth: boolean;
}

function buildCalendarGrid(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const days: CalendarDay[] = [];

  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    days.push({
      day: daysInPrevMonth - i,
      month: prevMonth,
      year: prevYear,
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, month, year, isCurrentMonth: true });
  }

  // Next month leading days (fill to complete last row)
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    for (let d = 1; d <= remaining; d++) {
      days.push({ day: d, month: nextMonth, year: nextYear, isCurrentMonth: false });
    }
  }

  return days;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function parseDate(value: string): { year: number; month: number; day: number } {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || isNaN(m) || isNaN(d)) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }
  return { year: y, month: m - 1, day: d };
}

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1900;

export function DatePicker({ value, onChange, locale = "en-US", name, required }: DatePickerProps) {
  const parsed = parseDate(value);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(parsed.year);
  const [viewMonth, setViewMonth] = useState(parsed.month);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Sync view when value changes externally
  useEffect(() => {
    const p = parseDate(value);
    setViewYear(p.year);
    setViewMonth(p.month);
  }, [value]);

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

  const monthFormatter = useCallback(
    () => new Intl.DateTimeFormat(locale, { month: "long" }),
    [locale]
  );

  const weekdayFormatter = useCallback(
    () => new Intl.DateTimeFormat(locale, { weekday: "short" }),
    [locale]
  );

  const triggerFormatter = useCallback(
    () => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }),
    [locale]
  );

  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, i); // Jan 2024 starts on Monday; we need Sun=0
    // Jan 7 2024 is a Sunday
    const base = new Date(2024, 0, 7 + i); // Sun=7, Mon=8, ...
    return weekdayFormatter().format(base);
  });

  const monthLabel = monthFormatter().format(new Date(viewYear, viewMonth, 1));

  const grid = buildCalendarGrid(viewYear, viewMonth);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

  function selectDay(cell: CalendarDay) {
    const dateStr = `${cell.year}-${pad2(cell.month + 1)}-${pad2(cell.day)}`;
    onChange(dateStr);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const triggerLabel = value
    ? triggerFormatter().format(new Date(parsed.year, parsed.month, parsed.day))
    : "";

  const yearOptions: number[] = [];
  for (let y = CURRENT_YEAR; y >= MIN_YEAR; y--) {
    yearOptions.push(y);
  }

  return (
    <div className="datepicker">
      <button
        ref={triggerRef}
        type="button"
        className="datepicker__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {triggerLabel || <span className="datepicker__placeholder">&nbsp;</span>}
      </button>
      <input type="hidden" name={name} value={value} required={required} />

      {open && (
        <div ref={panelRef} className="datepicker__panel" role="dialog" aria-label="Choose date">
          <div className="datepicker__controls">
            <select
              className="datepicker__year-select"
              value={viewYear}
              onChange={(e) => setViewYear(Number(e.target.value))}
              aria-label="Year"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <div className="datepicker__month-nav">
              <button type="button" className="datepicker__nav-btn" onClick={prevMonth} aria-label="Previous month">
                &#8249;
              </button>
              <span className="datepicker__month-label">{monthLabel}</span>
              <button type="button" className="datepicker__nav-btn" onClick={nextMonth} aria-label="Next month">
                &#8250;
              </button>
            </div>
          </div>

          <div className="datepicker__weekdays">
            {weekdays.map((wd, i) => (
              <span key={i} className="datepicker__weekday">{wd}</span>
            ))}
          </div>

          <div className="datepicker__grid">
            {grid.map((cell, i) => {
              const cellStr = `${cell.year}-${pad2(cell.month + 1)}-${pad2(cell.day)}`;
              const isSelected = cellStr === value;
              const isToday = cellStr === todayStr;
              let cls = "datepicker__cell";
              if (!cell.isCurrentMonth) cls += " datepicker__cell--outside";
              if (isSelected) cls += " datepicker__cell--selected";
              if (isToday) cls += " datepicker__cell--today";
              return (
                <button
                  key={i}
                  type="button"
                  className={cls}
                  onClick={() => selectDay(cell)}
                  tabIndex={cell.isCurrentMonth ? 0 : -1}
                  aria-label={new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
                    new Date(cell.year, cell.month, cell.day)
                  )}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
