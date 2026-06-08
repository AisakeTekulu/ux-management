"use server";

/**
 * Server actions for the Clients view page — data fetching.
 */

import { createClient } from "@/lib/supabase/server";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import type { ClientStatus } from "@/lib/domain/types";

export interface ClientRowData {
  id: string;
  name: string;
  status: ClientStatus;
  deletedAt: string | null;
  projectCount: number;
}

export async function getClientsPageData(
  statusFilter?: ClientStatus | "all"
): Promise<ClientRowData[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const repos = createSupabaseRepositories(supabase);
  const filter = statusFilter && statusFilter !== "all"
    ? { status: statusFilter }
    : undefined;
  const clients = await repos.clients.listByOwner(user.id, filter);

  const rows: ClientRowData[] = [];
  for (const client of clients) {
    const projects = await repos.projects.listByClient(client.id);
    rows.push({
      id: client.id,
      name: client.name,
      status: client.status,
      deletedAt: client.deletedAt,
      projectCount: projects.length,
    });
  }

  return rows.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}
