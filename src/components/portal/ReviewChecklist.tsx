/**
 * ReviewChecklist — Client_Portal read-only checklist (Requirements 9.1, 15.3).
 *
 * Displays checklist items with their completion states in a read-only
 * format for the Client_Reviewer. Items are rendered in the order provided
 * (caller is responsible for sorting by creation time per R5.5).
 *
 * This is a presentation-only component — no interactivity or state mutation.
 */

export interface ReviewChecklistItem {
  /** Unique identifier for the checklist item. */
  id: string;
  /** The text content of the checklist item. */
  text: string;
  /** Whether the item has been marked complete by the designer. */
  complete: boolean;
}

export interface ReviewChecklistProps {
  /** The ordered list of checklist items to display. */
  items: ReviewChecklistItem[];
}

export function ReviewChecklist({ items }: ReviewChecklistProps) {
  if (items.length === 0) {
    return (
      <section aria-labelledby="checklist-heading" className="mb-token-6">
        <h3
          id="checklist-heading"
          className="mb-token-2 text-sm font-semibold uppercase tracking-wide text-text-subdued"
        >
          Checklist
        </h3>
        <p className="text-sm text-text-subdued">No checklist items.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="checklist-heading" className="mb-token-6">
      <h3
        id="checklist-heading"
        className="mb-token-2 text-sm font-semibold uppercase tracking-wide text-text-subdued"
      >
        Checklist
      </h3>
      <ul className="space-y-token-2" role="list">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-token-2">
            <span
              aria-label={item.complete ? "Complete" : "Incomplete"}
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                item.complete
                  ? "border-status-green bg-status-green text-white"
                  : "border-border bg-surface"
              }`}
            >
              {item.complete && (
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 12 12"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2 6l3 3 5-5"
                  />
                </svg>
              )}
            </span>
            <span
              className={`text-sm ${
                item.complete ? "text-text-subdued line-through" : "text-text"
              }`}
            >
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
