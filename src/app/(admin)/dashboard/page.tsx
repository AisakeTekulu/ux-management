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

  const phasesByProject: Record<string, Phase[]> = {};
  for (const row of dashboard.projectStatusTable) {
    const phases = await repos.phases.listByProject(row.projectId);
    phasesByProject[row.projectId] = phases;
  }

  return (
    <DashboardContent
      dashboard={dashboard}
      recentActivity={recentActivity}
      openTasks={openTasks}
      phasesByProject={phasesByProject}
    />
  );
}
