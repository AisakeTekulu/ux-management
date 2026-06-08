"use server";

/**
 * Server actions for the Projects view page — data fetching.
 */

import { createClient } from "@/lib/supabase/server";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import { sortProjectsByName } from "@/lib/domain/ordering";
import type { Client, Phase, Project } from "@/lib/domain/types";

export interface ProjectRowData {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  currentPhase: string;
  currentPhaseStatus: string;
  dueDate: string | null;
}

export interface ProjectsPageData {
  projects: ProjectRowData[];
  clients: Array<{ id: string; name: string }>;
}

export async function getProjectsPageData(): Promise<ProjectsPageData> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { projects: [], clients: [] };

  const repos = createSupabaseRepositories(supabase);

  const [clients, projects] = await Promise.all([
    repos.clients.listByOwner(user.id),
    repos.projects.listByOwner(user.id),
  ]);

  // Load phases for each project to determine current phase
  const projectRows: ProjectRowData[] = [];
  for (const project of sortProjectsByName(projects)) {
    const phases = await repos.phases.listByProject(project.id);
    const sorted = [...phases].sort((a, b) => a.ordinal - b.ordinal);
    const current = sorted.find(p => p.status !== "Completed") ?? sorted[sorted.length - 1];
    const client = clients.find(c => c.id === project.clientId);

    projectRows.push({
      id: project.id,
      name: project.name,
      clientId: project.clientId,
      clientName: client?.name ?? "Unknown",
      currentPhase: current?.title ?? "—",
      currentPhaseStatus: current?.status ?? "Draft",
      dueDate: current?.dueDate ?? null,
    });
  }

  return {
    projects: projectRows,
    clients: clients.map(c => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}
