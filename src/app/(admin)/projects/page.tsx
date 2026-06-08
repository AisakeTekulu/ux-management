"use client";

/**
 * Projects view — card-based layout with progress indicators.
 * Clicking a project navigates to the project hub.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { createProject } from "@/lib/actions/projects";
import { getProjectsPageData, type ProjectRowData } from "./actions";
import type { StatusBadgeKey } from "@/lib/domain/status-presentation";

export default function ProjectsPage() {
  const { showToast } = useToast();
  const router = useRouter();

  const [projects, setProjects] = useState<ProjectRowData[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formClientId, setFormClientId] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (projects.length === 0) setLoading(true);
    const data = await getProjectsPageData();
    setProjects(data.projects);
    setClients(data.clients);
    setLoading(false);
  }, [projects.length]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const openCreateModal = useCallback(() => {
    setFormName("");
    setFormClientId(clients[0]?.id ?? "");
    setFormErrors({});
    setModalOpen(true);
  }, [clients]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setFormErrors({});
  }, []);

  const handleSubmit = useCallback(async () => {
    setFormErrors({});
    setSubmitting(true);
    try {
      if (!formClientId) { setFormErrors({ clientId: "Client is required." }); return; }
      const result = await createProject({ name: formName, clientId: formClientId });
      if (!result.ok) {
        const e = result.error;
        if (e.kind === "validation") {
          const fe: Record<string, string> = {};
          for (const f of e.fields) fe[f.field] = f.message;
          setFormErrors(Object.keys(fe).length ? fe : { name: e.message });
        } else setFormErrors({ _general: e.message });
        return;
      }
      showToast("Project created");
      closeModal();
      await loadData();
      // Navigate to the new project
      if (result.value?.id) {
        router.push(`/projects/${result.value.id}`);
      }
    } finally { setSubmitting(false); }
  }, [formName, formClientId, closeModal, loadData, showToast, router]);

  return (
    <div className="space-y-token-6">
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} project${projects.length !== 1 ? "s" : ""}`}
        primaryAction={
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-token-2 rounded-lg bg-primary px-token-4 py-[10px] text-sm font-semibold text-text-on-primary shadow-sm hover:bg-primary-hovered transition-all"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Project
          </button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-token-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <div className="p-token-8">
            <EmptyState
              title="No projects yet"
              description="Create your first project to start managing client deliverables."
              action={
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="rounded-lg bg-primary px-token-4 py-[10px] text-sm font-semibold text-text-on-primary shadow-sm hover:bg-primary-hovered"
                >
                  Create your first project
                </button>
              }
            />
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-token-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => router.push(`/projects/${project.id}`)}
              className="group flex flex-col rounded-lg border border-border bg-surface p-token-5 text-left shadow-card transition-all hover:shadow-card-hovered hover:border-primary/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {/* Project header */}
              <div className="flex items-start justify-between w-full">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-text group-hover:text-primary transition-colors truncate">
                    {project.name}
                  </h3>
                  <p className="mt-token-1 text-xs text-text-subdued">{project.clientName}</p>
                </div>
                <StatusBadge status={project.currentPhaseStatus as StatusBadgeKey} />
              </div>

              {/* Current phase */}
              <div className="mt-token-4 w-full">
                <p className="text-xs text-text-subdued">Current Phase</p>
                <p className="mt-0.5 text-sm font-medium text-text truncate">{project.currentPhase}</p>
              </div>

              {/* Due date */}
              {project.dueDate && (
                <div className="mt-token-3 w-full">
                  <p className="text-xs text-text-subdued">
                    Due {new Date(project.dueDate + "T00:00:00Z").toLocaleDateString("en-US", {
                      month: "short", day: "numeric"
                    })}
                  </p>
                </div>
              )}

              {/* Arrow indicator */}
              <div className="mt-token-4 flex items-center justify-end w-full">
                <span className="text-xs font-medium text-text-subdued group-hover:text-primary transition-colors flex items-center gap-1">
                  Open
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <Modal open={modalOpen} title="Create project" onCancel={closeModal} onConfirm={handleSubmit} confirmLabel="Create" confirmDisabled={submitting || !formName.trim()} busy={submitting}>
        <div className="space-y-token-4">
          {formErrors._general && <p className="text-sm text-status-red">{formErrors._general}</p>}
          <div>
            <label htmlFor="pn" className="block text-sm font-medium text-text">Project name</label>
            <input id="pn" type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Website Redesign" maxLength={120} className="mt-token-1 w-full rounded-lg border border-border bg-surface px-token-3 py-[10px] text-sm text-text placeholder:text-text-subdued focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus" autoFocus />
            {formErrors.name && <p className="mt-token-1 text-xs text-status-red">{formErrors.name}</p>}
          </div>
          <div>
            <label htmlFor="pc" className="block text-sm font-medium text-text">Client</label>
            <select id="pc" value={formClientId} onChange={e => setFormClientId(e.target.value)} className="mt-token-1 w-full rounded-lg border border-border bg-surface px-token-3 py-[10px] text-sm text-text focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus">
              <option value="">Select a client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {formErrors.clientId && <p className="mt-token-1 text-xs text-status-red">{formErrors.clientId}</p>}
            {clients.length === 0 && <p className="mt-token-1 text-xs text-text-subdued">No clients yet. Create a client first from the Clients page.</p>}
          </div>
        </div>
      </Modal>
    </div>
  );
}
