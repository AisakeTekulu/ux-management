import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";

/**
 * GET /api/projects/[id]/phases/[phaseId]
 *
 * Returns the phase detail data needed by the Phase detail view (task 18.4).
 * Authenticates the request, verifies ownership, and returns the phase along
 * with its checklist items, design links, comments, approvals, sibling phases,
 * and the parent project name.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> },
) {
  const { id: projectId, phaseId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const repos = createSupabaseRepositories(supabase);

  // Verify project ownership
  const project = await repos.projects.findById(projectId);
  if (!project || project.ownerId !== user.id) {
    return NextResponse.json(
      { error: "Project not found." },
      { status: 404 },
    );
  }

  // Load the target phase
  const phase = await repos.phases.findById(phaseId);
  if (!phase || phase.projectId !== projectId) {
    return NextResponse.json(
      { error: "Phase not found." },
      { status: 404 },
    );
  }

  // Load all sibling phases ordered by ordinal (R4.1)
  const phases = await repos.phases.listByProject(projectId);
  const orderedPhases = [...phases].sort((a, b) => a.ordinal - b.ordinal);

  // Load phase children
  const [checklistItems, designLinks, comments, approvals] =
    await Promise.all([
      repos.checklistItems.listByPhase(phaseId),
      repos.designLinks.listByPhase(phaseId),
      repos.comments.listByPhase(phaseId),
      repos.approvals.listByPhase(phaseId),
    ]);

  // Sort checklist items by creation time ascending (R5.5)
  const sortedChecklist = [...checklistItems].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  // Sort comments oldest to newest (R7.6)
  const sortedComments = [...comments].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  // Sort approvals newest first (reverse chronological)
  const sortedApprovals = [...approvals].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return NextResponse.json({
    phase,
    phases: orderedPhases,
    checklistItems: sortedChecklist,
    designLinks,
    comments: sortedComments,
    approvals: sortedApprovals,
    projectName: project.name,
  });
}
