import { useRef, useEffect, useCallback } from "react";

interface ScrollPickerItem {
  value: number;
  label: string;
}

interface ScrollPickerProps {
  items: ScrollPickerItem[];
  selected: number;
  onChange: (value: number) => void;
  itemHeight?: number;
  visibleItems?: number;
  ariaLabel?: string;
}

export function ScrollPicker({
  items,
  selected,
  onChange,
  itemHeight = 36,
  visibleItems = 5,
  ariaLabel,
}: ScrollPickerProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const programmaticScroll = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const containerHeight = itemHeight * visibleItems;
  const paddingItems = Math.floor(visibleItems / 2);

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "instant") => {
      const track = trackRef.current;
      if (!track) return;
      programmaticScroll.current = true;
      track.scrollTo({ top: index * itemHeight, behavior });
      // Clear the flag after scroll settles
      setTimeout(() => {
        programmaticScroll.current = false;
      }, behavior === "instant" ? 50 : 200);
    },
    [itemHeight],
  );

  // Scroll to selected on mount and when selected changes externally
  useEffect(() => {
    const index = items.findIndex((item) => item.value === selected);
    if (index >= 0) {
      scrollToIndex(index);
    }
  }, [selected, items, scrollToIndex]);

  const handleScroll = useCallback(() => {
    if (programmaticScroll.current) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const track = trackRef.current;
      if (!track) return;
      const index = Math.round(track.scrollTop / itemHeight);
      const clamped = Math.max(0, Math.min(index, items.length - 1));
      const item = items[clamped];
      if (item && item.value !== selected) {
        onChange(item.value);
      }
    }, 120);
  }, [itemHeight, items, selected, onChange]);

  function handleItemClick(index: number) {
    const item = items[index];
    if (!item) return;
    scrollToIndex(index, "smooth");
    onChange(item.value);
  }

  return (
    <div
      className="scroll-picker"
      style={{ height: containerHeight }}
      role="listbox"
      aria-label={ariaLabel}
    >
      <div
        ref={trackRef}
        className="scroll-picker__track"
        onScroll={handleScroll}
      >
        {/* Top padding */}
        <div style={{ height: paddingItems * itemHeight, flexShrink: 0 }} />
        {items.map((item, i) => {
          const isSelected = item.value === selected;
          return (
            <div
              key={item.value}
              className={`scroll-picker__item ${isSelected ? "scroll-picker__item--selected" : ""}`}
              style={{ height: itemHeight }}
              role="option"
              aria-selected={isSelected}
              onClick={() => handleItemClick(i)}
            >
              {item.label}
            </div>
          );
        })}
        {/* Bottom padding */}
        <div style={{ height: paddingItems * itemHeight, flexShrink: 0 }} />
      </div>
    </div>
  );
}
