/**
 * Dashboard view (Requirement 11) — Server Component.
 *
 * Fetches data and passes serializable props to the Client Component.
 */

import { getDashboard } from "@/lib/actions/dashboard";
import DashboardContent from "./DashboardContent";
import type { Phase } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";

export default async function DashboardPage() {
  const { dashboard, recentActivity, openTasks } = await getDashboard();

  // Load phases grouped by project for the pipeline display
  const supabase = await createClient();
  const repos = createSupabaseRepositories(supabase);

  // Fetch all phases in parallel to avoid sequential waterfall
  const phaseResults = await Promise.all(
    dashboard.projectStatusTable.map((row) =>
      repos.phases.listByProject(row.projectId),
    ),
  );
  const phasesByProject: Record<string, Phase[]> = {};
  dashboard.projectStatusTable.forEach((row, i) => {
    phasesByProject[row.projectId] = phaseResults[i];
  });

  return (
    <DashboardContent
      dashboard={dashboard}
      recentActivity={recentActivity}
      openTasks={openTasks}
      phasesByProject={phasesByProject}
    />
  );
}
