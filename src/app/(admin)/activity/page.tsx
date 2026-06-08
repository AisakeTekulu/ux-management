/**
 * Activity view (Requirements 13.4, 13.5).
 *
 * Renders the per-project activity timeline for all projects owned by the
 * authenticated designer. Activity logs are loaded from all projects via
 * Supabase repositories, merged, sorted in reverse chronological order, and
 * limited to 50 entries (R13.4). An empty state is shown when no activity
 * exists (R13.5).
 */

import { createClient } from "@/lib/supabase/server";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Timeline, type TimelineEntry } from "@/components/ui/Timeline";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ActivityLog } from "@/lib/domain/types";

/** Maximum number of activity entries displayed per the spec (R13.4). */
const ACTIVITY_VIEW_LIMIT = 50;

export default async function ActivityPage() {
  const supabase = await createClient();

  // 1. Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized: no authenticated session");
  }

  const ownerId = user.id;
  const repos = createSupabaseRepositories(supabase);

  // 2. Load all projects owned by the designer
  const projects = await repos.projects.listByOwner(ownerId);

  // 3. Load activity logs for all projects (limit per project to avoid over-fetching)
  const activityByProject = await Promise.all(
    projects.map((project) =>
      repos.activityLogs.listByProject(project.id, ACTIVITY_VIEW_LIMIT)
    )
  );

  // 4. Merge all activity entries, sort reverse-chronologically, limit to 50
  const allActivity = activityByProject.flat();
  allActivity.sort((a, b) =>
    a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : 0
  );
  const activityEntries = allActivity.slice(0, ACTIVITY_VIEW_LIMIT);

  // 5. Map to timeline entries for the Timeline component
  const timelineEntries: TimelineEntry[] = activityEntries.map((entry) => ({
    id: entry.id,
    actor: entry.actor,
    type: entry.type,
    description: buildActivityDescription(entry),
    timestamp: entry.createdAt,
  }));

  return (
    <div className="flex flex-col gap-token-6">
      <PageHeader title="Activity" />

      <Card title="Activity Timeline">
        <Timeline
          entries={timelineEntries}
          aria-label="Per-project activity timeline"
          emptyFallback={
            <EmptyState
              title="No activity recorded"
              description="Activity will appear here as comments, approvals, and status changes occur across your projects."
            />
          }
        />
      </Card>
    </div>
  );
}

/** Build a human-readable description from an activity log entry's detail. */
function buildActivityDescription(entry: ActivityLog): string {
  switch (entry.type) {
    case "comment_created":
      return "added a comment";
    case "approval_created": {
      const decision = (entry.detail as { decision?: string }).decision;
      return decision ? `recorded: ${decision}` : "recorded a sign-off";
    }
    case "phase_status_changed": {
      const detail = entry.detail as { from?: string; to?: string };
      if (detail.from && detail.to) {
        return `changed status from ${detail.from} to ${detail.to}`;
      }
      return "changed phase status";
    }
    default:
      return "performed an action";
  }
}
