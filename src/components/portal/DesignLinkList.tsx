/**
 * DesignLinkList — Client_Portal design links display (Requirements 6.7, 9.1).
 *
 * Displays selectable design links and files that, when selected, open the
 * referenced URL or stored file. Links open in a new tab. This is a
 * presentation-only component accepting the list of design links via props.
 */

export interface DesignLinkItem {
  /** Unique identifier for the design link. */
  id: string;
  /** Whether this is a URL link or an uploaded file. */
  kind: "url" | "file";
  /** The URL to open (for kind 'url'). */
  url: string | null;
  /** The public/signed URL for the stored file (for kind 'file'). */
  fileUrl: string | null;
  /** Display name for the link or file. */
  label: string;
}

export interface DesignLinkListProps {
  /** The list of design links/files to display. */
  links: DesignLinkItem[];
}

export function DesignLinkList({ links }: DesignLinkListProps) {
  if (links.length === 0) {
    return (
      <section aria-labelledby="design-links-heading" className="mb-token-6">
        <h3
          id="design-links-heading"
          className="mb-token-2 text-sm font-semibold uppercase tracking-wide text-text-subdued"
        >
          Design Files &amp; Links
        </h3>
        <p className="text-sm text-text-subdued">No design links or files.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="design-links-heading" className="mb-token-6">
      <h3
        id="design-links-heading"
        className="mb-token-2 text-sm font-semibold uppercase tracking-wide text-text-subdued"
      >
        Design Files &amp; Links
      </h3>
      <ul className="space-y-token-2" role="list">
        {links.map((link) => {
          const href = link.kind === "url" ? link.url : link.fileUrl;

          return (
            <li key={link.id}>
              <a
                href={href ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-token-2 rounded-md border border-border bg-surface px-token-3 py-token-2 text-sm text-interactive hover:bg-surface-hovered hover:text-interactive-hovered focus:outline-none focus:ring-2 focus:ring-focus transition-colors"
              >
                {link.kind === "url" ? (
                  <LinkIcon />
                ) : (
                  <FileIcon />
                )}
                <span>{link.label}</span>
                <ExternalIcon />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Small link icon for URL-type design links. */
function LinkIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101"
      />
    </svg>
  );
}

/** Small file icon for file-type design links. */
function FileIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  );
}

/** Small external-link icon indicating the link opens in a new tab. */
function ExternalIcon() {
  return (
    <svg
      className="h-3 w-3 shrink-0 opacity-60"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}
