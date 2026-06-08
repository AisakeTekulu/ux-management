"use client";

/**
 * IndexTable — responsive list table for admin list views
 * (Requirements 2.5, 3.8, 11.2, 16.5).
 *
 * Responsiveness strategy (R16.5 — no horizontal overflow or horizontal
 * scrolling from 320px to 1920px):
 *   - At ≥ 768px (Tailwind `md`) the rows render as a real semantic `<table>`.
 *     Cells are allowed to wrap (`break-words`, `min-w-0`) and the table is
 *     constrained to `w-full`, so wide content reflows downward instead of
 *     pushing the layout past the viewport edge — there is no inner
 *     `overflow-x` scroller.
 *   - Below 768px the same rows render as a stacked "label / value" card list
 *     (one card per row). This condenses the columns into vertical stacks so
 *     even at 320px every value remains readable without sideways scrolling.
 *
 * The component is presentation-only and generic over the row shape: callers
 * describe their columns (header + per-row render function) and pass the row
 * data. An optional `onRowClick` makes rows interactive (keyboard accessible).
 *
 * It is a Client Component because rows can carry interactive click/keyboard
 * handlers supplied by the caller.
 */

import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Horizontal alignment for a column's header and cells. */
export type IndexTableAlign = "start" | "center" | "end";

export interface IndexTableColumn<Row> {
  /** Stable, unique identifier for this column. */
  key: string;
  /** Header label (also used as the field label in the stacked layout). */
  header: ReactNode;
  /** Render the cell content for a given row. */
  render: (row: Row) => ReactNode;
  /** Horizontal alignment of the header and cells. Defaults to "start". */
  align?: IndexTableAlign;
  /**
   * Condense behavior: when true, this column is omitted from the narrow
   * stacked layout (kept only in the wide table) to reduce clutter on small
   * screens. Defaults to false (shown in both layouts).
   */
  hideOnStacked?: boolean;
  /** Extra classes applied to this column's header and cells. */
  className?: string;
}

export interface IndexTableProps<Row> {
  /** Column definitions, rendered left-to-right in the wide table. */
  columns: ReadonlyArray<IndexTableColumn<Row>>;
  /** Row data to render. */
  rows: ReadonlyArray<Row>;
  /** Extract a stable React key for a row. */
  rowKey: (row: Row, index: number) => string;
  /** Optional click handler; when provided, rows become interactive. */
  onRowClick?: (row: Row, index: number) => void;
  /** Accessible caption / label describing the table contents. */
  caption?: string;
  /** Content shown in place of the table when there are no rows. */
  emptyState?: ReactNode;
  /** Extra classes for the outer container. */
  className?: string;
}

/** Map a column alignment to its text-alignment utility class. */
function alignClass(align: IndexTableAlign | undefined): string {
  switch (align) {
    case "center":
      return "text-center";
    case "end":
      return "text-right";
    default:
      return "text-left";
  }
}

export function IndexTable<Row>({
  columns,
  rows,
  rowKey,
  onRowClick,
  caption,
  emptyState,
  className,
}: IndexTableProps<Row>) {
  const interactive = typeof onRowClick === "function";

  // Empty state: render the provided node (or nothing) instead of an empty grid.
  if (rows.length === 0) {
    return (
      <div className={cn("w-full max-w-full", className)}>
        {emptyState ?? null}
      </div>
    );
  }

  const handleKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    row: Row,
    index: number,
  ) => {
    if (!interactive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick?.(row, index);
    }
  };

  return (
    // `max-w-full` + `min-w-0` keep the table from forcing the page wider than
    // the viewport at any width (R16.5).
    <div className={cn("w-full min-w-0 max-w-full", className)}>
      {/* Wide layout: semantic table at ≥768px. */}
      <table className="hidden w-full table-auto border-collapse text-sm md:table">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-token-3 py-token-2 align-middle text-xs font-semibold uppercase tracking-wide text-text-subdued",
                  alignClass(column.align),
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              {...(interactive
                ? {
                    role: "button",
                    tabIndex: 0,
                    "aria-label": "Open row",
                    onClick: () => onRowClick?.(row, index),
                    onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) =>
                      handleKeyDown(event, row, index),
                  }
                : {})}
              className={cn(
                "border-b border-border-subdued last:border-b-0",
                interactive &&
                  "cursor-pointer transition-colors hover:bg-surface-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus",
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "min-w-0 break-words px-token-3 py-token-3 align-middle text-text",
                    alignClass(column.align),
                    column.className,
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Narrow layout: stacked label/value cards below 768px. */}
      <ul className="flex flex-col gap-token-3 md:hidden" role="list">
        {rows.map((row, index) => {
          const stackedColumns = columns.filter((column) => !column.hideOnStacked);
          const content = (
            <dl className="flex flex-col gap-token-2">
              {stackedColumns.map((column) => (
                <div
                  key={column.key}
                  className="flex flex-col gap-token-1 sm:flex-row sm:items-start sm:justify-between sm:gap-token-3"
                >
                  <dt className="text-xs font-semibold uppercase tracking-wide text-text-subdued">
                    {column.header}
                  </dt>
                  <dd className="min-w-0 break-words text-sm text-text sm:text-right">
                    {column.render(row)}
                  </dd>
                </div>
              ))}
            </dl>
          );

          return (
            <li key={rowKey(row, index)} className="min-w-0">
              {interactive ? (
                <button
                  type="button"
                  onClick={() => onRowClick?.(row, index)}
                  className="w-full rounded-md border border-border bg-surface p-token-4 text-left shadow-card transition-colors hover:bg-surface-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {content}
                </button>
              ) : (
                <div className="w-full rounded-md border border-border bg-surface p-token-4 shadow-card">
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
