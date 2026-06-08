/**
 * ReviewHeader — Client_Portal header block (Requirement 15.2).
 *
 * Displays the project title and current phase title at the top of the
 * review page, positioned above all other review content. Uses the
 * Polaris-inspired design tokens for typography and spacing.
 */

export interface ReviewHeaderProps {
  /** The name of the project being reviewed. */
  projectTitle: string;
  /** The title of the current phase being reviewed. */
  phaseTitle: string;
}

export function ReviewHeader({ projectTitle, phaseTitle }: ReviewHeaderProps) {
  return (
    <header className="mb-token-6">
      <h1 className="text-2xl font-semibold text-text">{projectTitle}</h1>
      <h2 className="mt-token-1 text-lg font-medium text-text-subdued">
        {phaseTitle}
      </h2>
    </header>
  );
}
