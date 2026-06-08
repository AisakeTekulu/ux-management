"use client";

/**
 * Filters — filtering controls for list views (Requirement 14.1, supporting).
 *
 * A Polaris-inspired filter row used to narrow list views (Clients, Projects,
 * Tasks, Sign-offs, Activity). It provides an optional search field plus a set
 * of select-style filter controls, and surfaces the currently applied filters
 * as removable "tags" with a single "Clear all" affordance.
 *
 * The component is presentation-only and fully controlled: it renders the
 * provided `query`, `filters`, and `appliedFilters` and reports every change
 * through callbacks. It holds no internal filter state, so the parent owns the
 * actual list-narrowing logic. This keeps the control reusable across every
 * admin list view without coupling it to any particular data shape.
 */

import { useId } from "react";
import { cn } from "@/lib/utils";

/** A single selectable value within a filter control. */
export interface FilterOption {
  /** Stable value reported through `onChange`. */
  value: string;
  /** Visible label. */
  label: string;
}

/** A select-style filter control (e.g. Status, Client). */
export interface FilterControl {
  /** Stable key identifying this filter (used in `onChange`). */
  key: string;
  /** Visible label for the control. */
  label: string;
  /** Available options. */
  options: readonly FilterOption[];
  /** Currently selected value, or "" when no value is applied. */
  value: string;
}

/** A currently-applied filter rendered as a removable tag. */
export interface AppliedFilter {
  /** Key of the originating control (used in `onRemove`). */
  key: string;
  /** Human-readable description, e.g. "Status: Approved". */
  label: string;
}

export interface FiltersProps {
  /** Current search query. When undefined, the search field is not rendered. */
  query?: string;
  /** Called as the search query changes. Required to render the search field. */
  onQueryChange?: (value: string) => void;
  /** Placeholder for the search field. */
  queryPlaceholder?: string;
  /** Select-style filter controls. */
  filters?: readonly FilterControl[];
  /** Called when a filter control's value changes. */
  onFilterChange?: (key: string, value: string) => void;
  /** Applied filters rendered as removable tags below the controls. */
  appliedFilters?: readonly AppliedFilter[];
  /** Called to remove a single applied filter. */
  onRemoveFilter?: (key: string) => void;
  /** Called to clear the search query and all applied filters. */
  onClearAll?: () => void;
  /** Optional additional classes for the outer container. */
  className?: string;
}

export function Filters({
  query,
  onQueryChange,
  queryPlaceholder = "Search",
  filters = [],
  onFilterChange,
  appliedFilters = [],
  onRemoveFilter,
  onClearAll,
  className,
}: FiltersProps) {
  const showSearch = query !== undefined && typeof onQueryChange === "function";
  const hasApplied = appliedFilters.length > 0 || (showSearch && query!.trim().length > 0);

  return (
    <div className={cn("flex flex-col gap-token-3", className)}>
      {/* Control row: search + select filters */}
      <div className="flex flex-col gap-token-2 sm:flex-row sm:flex-wrap sm:items-end">
        {showSearch && (
          <SearchField
            value={query!}
            placeholder={queryPlaceholder}
            onChange={onQueryChange!}
          />
        )}

        {filters.map((control) => (
          <SelectFilter
            key={control.key}
            control={control}
            onChange={(value) => onFilterChange?.(control.key, value)}
          />
        ))}
      </div>

      {/* Applied filter tags + clear all */}
      {hasApplied && (
        <div className="flex flex-wrap items-center gap-token-2">
          {appliedFilters.map((applied) => (
            <FilterTag
              key={applied.key}
              label={applied.label}
              onRemove={onRemoveFilter ? () => onRemoveFilter(applied.key) : undefined}
            />
          ))}
          {onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="rounded-md px-token-2 py-token-1 text-sm font-medium text-primary hover:bg-surface-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface SearchFieldProps {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

function SearchField({ value, placeholder, onChange }: SearchFieldProps) {
  return (
    <div className="relative min-w-0 flex-1 sm:max-w-xs">
      <span
        className="pointer-events-none absolute left-token-2 top-1/2 -translate-y-1/2 text-text-subdued"
        aria-hidden="true"
      >
        <SearchIcon />
      </span>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-surface py-token-2 pl-8 pr-token-3 text-sm text-text placeholder:text-text-subdued focus:border-focus focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      />
    </div>
  );
}

interface SelectFilterProps {
  control: FilterControl;
  onChange: (value: string) => void;
}

function SelectFilter({ control, onChange }: SelectFilterProps) {
  const selectId = useId();
  return (
    <div className="flex min-w-0 flex-col gap-token-1">
      <label htmlFor={selectId} className="text-xs font-medium text-text-subdued">
        {control.label}
      </label>
      <select
        id={selectId}
        value={control.value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-surface px-token-3 py-token-2 text-sm text-text focus:border-focus focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <option value="">All</option>
        {control.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface FilterTagProps {
  label: string;
  onRemove?: () => void;
}

function FilterTag({ label, onRemove }: FilterTagProps) {
  return (
    <span className="inline-flex items-center gap-token-1 rounded-md bg-surface-hovered px-token-2 py-token-1 text-sm text-text">
      <span className="truncate">{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove filter ${label}`}
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-text-subdued hover:bg-border hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <CloseIcon />
        </button>
      )}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
