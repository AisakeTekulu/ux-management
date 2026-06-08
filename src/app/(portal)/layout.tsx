/**
 * Portal route-group layout (Client_Portal surface).
 *
 * Uses the ReviewLayout component to provide a centered, single-column
 * review layout with no admin sidebar (R15.1). Renders with no horizontal
 * overflow from 320px to 1920px (R16.6).
 */

import { ReviewLayout } from "@/components/portal/ReviewLayout";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ReviewLayout>{children}</ReviewLayout>;
}
