"use server";

/**
 * Server actions for the Tasks view page.
 *
 * Provides a read path to fetch the authenticated designer's tasks,
 * complementing the create/complete mutations in `@/lib/actions/tasks`.
 */

import { createClient } from "@/lib/supabase/server";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import type { Task } from "@/lib/domain/types";
import {
  type Result,
  type AppError,
  ok,
  err,
  appError,
} from "@/lib/domain/result";

/**
 * Fetch all tasks owned by the authenticated designer.
 *
 * The caller is responsible for filtering/sorting (e.g. via `sortOpenTasks`).
 * Returns all tasks regardless of state so the client can apply domain ordering.
 */
export async function getOpenTasks(): Promise<Result<Task[], AppError>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err(appError("unauthorized", "Authentication required."));
  }

  const repos = createSupabaseRepositories(supabase);
  const tasks = await repos.tasks.listByOwner(user.id);

  return ok(tasks);
}
