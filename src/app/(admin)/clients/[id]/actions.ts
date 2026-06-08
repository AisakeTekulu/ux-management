"use server";

/**
 * Server actions for the Client Detail page — data fetching.
 */

import { createClient } from "@/lib/supabase/server";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import type { ClientStatus } from "@/lib/domain/types";

export interface ClientDetailData {
  client: {
    id: string;
    name: string;
    status: ClientStatus;
    deletedAt: string | null;
    createdAt: string;
  };
  projectCount: number;
}

export async function getClientDetail(
  id: string
): Promise<ClientDetailData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const repos = createSupabaseRepositories(supabase);
  const client = await repos.clients.findById(id);
  if (!client || client.ownerId !== user.id) return null;

  const projects = await repos.projects.listByClient(client.id);

  return {
    client: {
      id: client.id,
      name: client.name,
      status: client.status,
      deletedAt: client.deletedAt,
      createdAt: client.createdAt,
    },
    projectCount: projects.length,
  };
}
