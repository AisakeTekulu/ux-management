import "server-only";

/**
 * Client Portal review page — GET /review/[token]
 *
 * Document-like layout showing project deliverables with markdown rendering,
 * checklist, design links, comments, and a prominent sign-off area at the
 * bottom for the client to approve or request changes.
 *
 * Requirements: 8.2, 8.3, 8.4, 9.1, 9.4, 10.3, 15.2, 15.3
 */

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import {
  resolveShareLink,
  INVALID_LINK_MESSAGE,
  scopedPhaseIds,
} from "@/lib/domain/share-link";
import { nextStatusOnFirstAccess } from "@/lib/domain/phase-status";
import type {
  Phase,
  ChecklistItem,
  DesignLink,
  Comment,
  Approval,
  Project,
} from "@/lib/domain/types";

import { PortalContent } from "@/components/portal/PortalContent";

// ---------------------------------------------------------------------------
// View model types
// ---------------------------------------------------------------------------

interface PhaseViewModel {
  phase: Phase;
  checklistItems: ChecklistItem[];
  designLinks: DesignLink[];
  comments: Comment[];
  approvals: Approval[];
}

interface ReviewViewModel {
  projectName: string;
  phases: PhaseViewModel[];
  token: string;
}

// ---------------------------------------------------------------------------
// Page component (Server Component — data fetching)
// ---------------------------------------------------------------------------

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const serviceClient = createServiceRoleClient();
  const repos = createSupabaseRepositories(serviceClient);

  const shareLink = await repos.shareLinks.findByToken(token);
  const resolution = resolveShareLink(shareLink);

  if (!resolution.ok) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <div className="rounded-lg border border-border bg-surface p-8 shadow-card">
          <svg className="mx-auto h-12 w-12 text-text-subdued" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <h1 className="mt-4 text-xl font-semibold text-text">Link Invalid</h1>
          <p className="mt-2 text-text-subdued">{INVALID_LINK_MESSAGE}</p>
        </div>
      </div>
    );
  }

  const link = resolution.link;

  // Resolve project
  let project: Project | null = null;
  if (link.scopeType === "project" && link.projectId) {
    project = await repos.projects.findById(link.projectId);
  } else if (link.scopeType === "phase" && link.phaseId) {
    const phase = await repos.phases.findById(link.phaseId);
    if (phase) {
      project = await repos.projects.findById(phase.projectId);
    }
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <div className="rounded-lg border border-border bg-surface p-8 shadow-card">
          <h1 className="text-xl font-semibold text-text">Link Invalid</h1>
          <p className="mt-2 text-text-subdued">{INVALID_LINK_MESSAGE}</p>
        </div>
      </div>
    );
  }

  // Determine scoped phases
  const allProjectPhases = await repos.phases.listByProject(project.id);
  const allProjectPhaseIds = allProjectPhases.map((p) => p.id);
  const inScopePhaseIds = scopedPhaseIds(link, allProjectPhaseIds);
  const inScopePhases = allProjectPhases.filter((p) =>
    inScopePhaseIds.includes(p.id)
  );

  // Set Waiting for Feedback on first access (R10.3)
  if (!link.firstAccessedAt) {
    await repos.shareLinks.update(link.id, {
      firstAccessedAt: new Date().toISOString(),
    });

    for (const phase of inScopePhases) {
      const approvals = await repos.approvals.listByPhase(phase.id);
      const hasApproval = approvals.length > 0;
      const newStatus = nextStatusOnFirstAccess(phase.status, hasApproval);

      if (newStatus !== phase.status) {
        await repos.phases.update(phase.id, { status: newStatus });
        await repos.activityLogs.create({
          projectId: phase.projectId,
          type: "phase_status_changed",
          actor: "system",
          detail: { phaseId: phase.id, from: phase.status, to: newStatus },
        });
        phase.status = newStatus;
      }
    }
  }

  // Build view model
  const phaseViewModels: PhaseViewModel[] = await Promise.all(
    inScopePhases.map(async (phase) => {
      const [checklistItems, designLinks, comments, approvals] =
        await Promise.all([
          repos.checklistItems.listByPhase(phase.id),
          repos.designLinks.listByPhase(phase.id),
          repos.comments.listByPhase(phase.id),
          repos.approvals.listByPhase(phase.id),
        ]);
      return { phase, checklistItems, designLinks, comments, approvals };
    })
  );

  const viewModel: ReviewViewModel = {
    projectName: project.name,
    phases: phaseViewModels,
    token,
  };

  // Render the client-facing portal content (Client Component for interactivity)
  return <PortalContent viewModel={viewModel} />;
}
