"use server";

/**
 * Server action to fetch sign-offs view data (Requirements 8.1, 8.5, 9.7).
 *
 * Loads all share links and approvals owned by the authenticated designer,
 * enriched with display labels (project/phase names) for the UI.
 */

import { createClient } from "@/lib/supabase/server";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";

interface ShareLinkRow {
  id: string;
  ownerId: string;
  token: string;
  scopeType: "project" | "phase";
  projectId: string | null;
  phaseId: string | null;
  revokedAt: string | null;
  firstAccessedAt: string | null;
  createdAt: string;
  scopeLabel: string;
}

interface ApprovalRow {
  id: string;
  phaseId: string;
  decision: "Approved" | "Changes Requested";
  reviewerName: string;
  reviewerInitials: string;
  checklistSnapshot: Array<{ checklistItemId: string; text: string; complete: boolean }>;
  createdAt: string;
  phaseTitle: string;
}

interface SignOffsData {
  shareLinks: ShareLinkRow[];
  approvals: ApprovalRow[];
  projects: Array<{ id: string; name: string }>;
  phases: Array<{ id: string; title: string; projectName: string }>;
}

export async function getSignOffsData(): Promise<SignOffsData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { shareLinks: [], approvals: [], projects: [], phases: [] };
  }

  const repos = createSupabaseRepositories(supabase);

  // Load share links
  const rawLinks = await repos.shareLinks.listByOwner(user.id);

  // Load projects and phases for label resolution
  const rawProjects = await repos.projects.listByOwner(user.id);
  const projectMap = new Map(rawProjects.map((p) => [p.id, p.name]));

  // Load all phases across all projects
  const allPhases: Array<{ id: string; title: string; projectId: string }> = [];
  for (const project of rawProjects) {
    const projectPhases = await repos.phases.listByProject(project.id);
    for (const phase of projectPhases) {
      allPhases.push({ id: phase.id, title: phase.title, projectId: phase.projectId });
    }
  }
  const phaseMap = new Map(allPhases.map((p) => [p.id, p]));

  // Enrich share links with scope labels
  const shareLinks: ShareLinkRow[] = rawLinks
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((link) => {
      let scopeLabel = "Unknown";
      if (link.scopeType === "project" && link.projectId) {
        scopeLabel = projectMap.get(link.projectId) ?? "Unknown project";
      } else if (link.scopeType === "phase" && link.phaseId) {
        const phase = phaseMap.get(link.phaseId);
        if (phase) {
          const projectName = projectMap.get(phase.projectId) ?? "Unknown project";
          scopeLabel = `${phase.title} (${projectName})`;
        } else {
          scopeLabel = "Unknown phase";
        }
      }
      return { ...link, scopeLabel };
    });

  // Load all approvals across all phases (reverse chronological for audit trail)
  const approvals: ApprovalRow[] = [];
  for (const phase of allPhases) {
    const phaseApprovals = await repos.approvals.listByPhase(phase.id);
    for (const approval of phaseApprovals) {
      approvals.push({
        ...approval,
        phaseTitle: phase.title,
      });
    }
  }
  // Sort reverse chronological (R9.7 — audit trail)
  approvals.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Build project and phase options for the generate form
  const projects = rawProjects
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const phases = allPhases
    .map((p) => ({
      id: p.id,
      title: p.title,
      projectName: projectMap.get(p.projectId) ?? "Unknown project",
    }))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));

  return { shareLinks, approvals, projects, phases };
}
