import { useState } from "react";
import { DatePicker } from "./DatePicker";
import { TimePicker } from "./TimePicker";
import type { UseGeoSearchReturn } from "../lib/useGeoSearch";

interface PersonFormLabels {
  date: string;
  time: string;
  cityAndCountry: string;
  searchPlaceholder: string;
  searching: string;
  noResults: string;
  cityHint: string;
  datePickerDialog: string;
  datePickerYear: string;
  datePickerPreviousMonth: string;
  datePickerNextMonth: string;
  daylightSaving: string;
  daylightSavingAuto: string;
  daylightSavingManual: string;
  daylightSavingManualHint: string;
  yes: string;
  no: string;
  hour: string;
  minute: string;
  datePlaceholder: string;
  timePlaceholder: string;
  cityPlaceholder: string;
}

interface PersonFormProps {
  title?: string;
  framed?: boolean;
  locale?: string;
  date: string;
  time: string;
  daylightSavingValue: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onDaylightSavingChange: (value: string) => void;
  geo: UseGeoSearchReturn;
  labels: PersonFormLabels;
  hintId: string;
  suggestionsId: string;
  namePrefix: string;
  activeIndex: number;
  onKeyDown: (event: React.KeyboardEvent) => void;
  showDaylightSavingOverride?: boolean;
}

export function PersonForm({
  title,
  framed,
  locale,
  date,
  time,
  daylightSavingValue,
  onDateChange,
  onTimeChange,
  onDaylightSavingChange,
  geo,
  labels,
  hintId,
  suggestionsId,
  namePrefix,
  activeIndex,
  onKeyDown,
  showDaylightSavingOverride = false,
}: PersonFormProps) {
  const [manualDstOpen, setManualDstOpen] = useState(false);
  const showManualDst = showDaylightSavingOverride || manualDstOpen;

  return (
    <div className={`form__person ${framed ? "form__person--framed" : ""}`}>
      {title && <h3 className="form__person-title">{title}</h3>}
      <div className="form__row">
        <label className="form__label form__label--date">
          {labels.date}
          <DatePicker
            value={date}
            onChange={onDateChange}
            locale={locale}
            name={`${namePrefix}-date`}
            required
            placeholder={labels.datePlaceholder}
            labels={{
              chooseDate: labels.datePickerDialog,
              year: labels.datePickerYear,
              previousMonth: labels.datePickerPreviousMonth,
              nextMonth: labels.datePickerNextMonth,
            }}
          />
        </label>
        <label className="form__label form__label--time">
          {labels.time}
          <TimePicker
            value={time}
            onChange={onTimeChange}
            name={`${namePrefix}-time`}
            required
            placeholder={labels.timePlaceholder}
            labels={{ hour: labels.hour, minute: labels.minute }}
          />
        </label>
        <label className="form__label form__label--city">
          {labels.cityAndCountry}
          <div className="city-search">
            <input
              type="text"
              name={`${namePrefix}-location`}
              value={geo.locationInput}
              onChange={(e) => geo.setLocationInput(e.target.value)}
              onKeyDown={onKeyDown}
              required
              aria-describedby={hintId}
              aria-autocomplete="list"
              aria-controls={suggestionsId}
              aria-expanded={geo.showSuggestions}
              aria-activedescendant={
                activeIndex >= 0 ? `${suggestionsId}-${activeIndex}` : undefined
              }
              autoComplete="off"
              inputMode="search"
              placeholder={labels.searchPlaceholder}
              role="combobox"
            />
            <div className="city-search__status-area" role="status" aria-live="polite">
              {geo.isSearching && (
                <span className="city-search__status">{labels.searching}</span>
              )}
              {geo.searchError && (
                <span className="city-search__status city-search__status--error">
                  {geo.searchError}
                </span>
              )}
              {geo.showNoResults && (
                <span className="city-search__status">{labels.noResults}</span>
              )}
            </div>
            {geo.showSuggestions && (
              <ul className="city-search__list" role="listbox" id={suggestionsId}>
                {geo.suggestions.map((suggestion, i) => (
                  <li
                    key={suggestion.id}
                    id={`${suggestionsId}-${i}`}
                    className="city-search__item"
                    role="option"
                    aria-selected={i === activeIndex}
                  >
                    <button
                      type="button"
                      className="city-search__option"
                      onClick={() => geo.selectSuggestion(suggestion)}
                    >
                      <span className="city-search__option-label">
                        {suggestion.label}
                      </span>
                      <span className="city-search__option-meta">
                        {suggestion.timezone}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </label>
      </div>
      <p id={hintId} className="form__hint">
        {labels.cityHint}
      </p>
      <div className="form__advanced">
        <button
          type="button"
          className="form__advanced-toggle"
          aria-expanded={showManualDst}
          onClick={() => setManualDstOpen((prev) => !prev)}
        >
          {labels.daylightSavingManual}
          <span className="collapsible-chevron" aria-hidden="true" />
        </button>
        {showManualDst && (
          <>
            <p className="form__advanced-hint">{labels.daylightSavingManualHint}</p>
            <div className="form__row">
              <label className="form__label">
                {labels.daylightSaving}
                <select
                  name={`${namePrefix}-daylight-saving`}
                  value={daylightSavingValue}
                  onChange={(e) => onDaylightSavingChange(e.target.value)}
                >
                  <option value="auto">{labels.daylightSavingAuto}</option>
                  <option value="true">{labels.yes}</option>
                  <option value="false">{labels.no}</option>
                </select>
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
