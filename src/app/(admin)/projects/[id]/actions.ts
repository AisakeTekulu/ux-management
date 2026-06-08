"use server";

/**
 * Server action for the Project Detail hub — data fetching.
 */

import { createClient } from "@/lib/supabase/server";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import type { Phase, ShareLink } from "@/lib/domain/types";

export interface ProjectDetailData {
  project: {
    id: string;
    name: string;
    clientId: string;
  };
  clientName: string;
  phases: Phase[];
  shareLinks: ShareLink[];
}

export async function getProjectDetail(
  projectId: string
): Promise<ProjectDetailData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const repos = createSupabaseRepositories(supabase);

  const project = await repos.projects.findById(projectId);
  if (!project || project.ownerId !== user.id) return null;

  const [client, phases, allLinks] = await Promise.all([
    repos.clients.findById(project.clientId),
    repos.phases.listByProject(projectId),
    repos.shareLinks.listByOwner(user.id),
  ]);

  // Filter share links to this project
  const projectLinks = allLinks.filter(
    (link) =>
      (link.scopeType === "project" && link.projectId === projectId) ||
      (link.scopeType === "phase" &&
        link.phaseId &&
        phases.some((p) => p.id === link.phaseId))
  );

  // Sort phases by ordinal
  const sortedPhases = [...phases].sort((a, b) => a.ordinal - b.ordinal);

  return {
    project: {
      id: project.id,
      name: project.name,
      clientId: project.clientId,
    },
    clientName: client?.name ?? "Unknown",
    phases: sortedPhases,
    shareLinks: projectLinks.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
  };
}
