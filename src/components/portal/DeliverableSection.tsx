/**
 * DeliverableSection — Client_Portal deliverable statement (Requirement 15.3).
 *
 * Displays a labeled section that states the specific deliverable the
 * Client_Reviewer is being asked to approve. This is a presentation-only
 * component that accepts the deliverable description via props.
 */

export interface DeliverableSectionProps {
  /** The deliverable statement describing what the client is approving. */
  deliverable: string;
}

export function DeliverableSection({ deliverable }: DeliverableSectionProps) {
  return (
    <section aria-labelledby="deliverable-heading" className="mb-token-6">
      <h3
        id="deliverable-heading"
        className="mb-token-2 text-sm font-semibold uppercase tracking-wide text-text-subdued"
      >
        Deliverable
      </h3>
      <p className="text-base text-text">{deliverable}</p>
    </section>
  );
}
