"use client";

/**
 * Client Detail Page — enhanced CRM profile with card-based sections.
 *
 * Sections:
 * 1. Overview Card (name, business, status badge, created date)
 * 2. Contact Information Card (ContactInfoCard component)
 * 3. Projects Card (IndexTable of linked projects)
 * 4. Sign-offs Card (pending count, approval history)
 * 5. Email History Card (EmailHistoryTable component)
 * 6. Notes Card (editable textarea, 5000 char limit)
 * 7. Activity Log Card (chronological feed)
 *
 * Lifecycle actions (Archive/Restore, Delete Profile, Permanent Delete) remain.
 *
 * _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Banner } from "@/components/ui/Banner";
import { Modal } from "@/components/ui/Modal";
import { IndexTable, type IndexTableColumn } from "@/components/ui/IndexTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ContactInfoCard } from "@/components/client/ContactInfoCard";
import { EmailHistoryTable } from "@/components/email-history/EmailHistoryTable";
import {
  archiveClient,
  restoreClient,
  deleteClientProfile,
  permanentDeleteClient,
} from "@/lib/actions/client-lifecycle";
import {
  getClientProfileDetail,
  updateClientProfile,
  type ClientProfileDetailData,
} from "@/lib/actions/client-profile";
import type { ClientCRMInput, Project, ActivityLog } from "@/lib/domain/types";

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();

  const [data, setData] = useState<ClientProfileDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Notes editing state
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Archive/Restore
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Delete Profile
  const [deleteProfileModalOpen, setDeleteProfileModalOpen] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState(false);

  // Permanent Delete
  const [permanentDeleteStep, setPermanentDeleteStep] = useState<0 | 1 | 2>(0);
  const [typedName, setTypedName] = useState("");
  const [permanentDeleting, setPermanentDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getClientProfileDetail(params.id);
    if (!result) {
      setError("Client not found.");
      setLoading(false);
      return;
    }
    setData(result);
    setNotesValue(result.client.notes ?? "");
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Contact Info Update ---
  const handleContactUpdate = useCallback(
    async (fields: ClientCRMInput) => {
      const result = await updateClientProfile(params.id, fields);
      if (!result.ok) {
        showToast(result.error.message, { tone: "error" });
        throw new Error(result.error.message);
      }
      showToast("Contact information updated");
      await loadData();
    },
    [params.id, showToast, loadData]
  );

  // --- Notes Save ---
  const handleSaveNotes = useCallback(async () => {
    if (notesValue.length > 5000) {
      showToast("Notes cannot exceed 5000 characters", { tone: "error" });
      return;
    }
    setSavingNotes(true);
    try {
      const result = await updateClientProfile(params.id, {
        notes: notesValue.trim() || null,
      });
      if (!result.ok) {
        showToast(result.error.message, { tone: "error" });
      } else {
        showToast("Notes saved");
        setEditingNotes(false);
        await loadData();
      }
    } finally {
      setSavingNotes(false);
    }
  }, [params.id, notesValue, showToast, loadData]);

  // --- Archive / Restore ---
  const handleArchiveRestore = useCallback(async () => {
    if (!data) return;
    setArchiving(true);
    try {
      const result =
        data.client.status === "active"
          ? await archiveClient(params.id)
          : await restoreClient(params.id);
      if (!result.ok) {
        showToast(result.error.message, { tone: "error" });
      } else {
        showToast(
          data.client.status === "active"
            ? "Client archived"
            : "Client restored"
        );
        await loadData();
      }
    } finally {
      setArchiving(false);
      setArchiveModalOpen(false);
    }
  }, [data, params.id, showToast, loadData]);

  // --- Delete Profile ---
  const handleDeleteProfile = useCallback(async () => {
    setDeletingProfile(true);
    try {
      const result = await deleteClientProfile(params.id);
      if (!result.ok) {
        showToast(result.error.message, { tone: "error" });
      } else {
        showToast("Client profile deleted");
        await loadData();
      }
    } finally {
      setDeletingProfile(false);
      setDeleteProfileModalOpen(false);
    }
  }, [params.id, showToast, loadData]);

  // --- Permanent Delete ---
  const handlePermanentDelete = useCallback(async () => {
    if (!data) return;
    setPermanentDeleting(true);
    try {
      const result = await permanentDeleteClient(params.id, typedName);
      if (!result.ok) {
        showToast(result.error.message, { tone: "error" });
        setPermanentDeleting(false);
        return;
      }
      showToast("Client permanently deleted");
      router.push("/clients");
    } finally {
      setPermanentDeleting(false);
    }
  }, [data, params.id, typedName, showToast, router]);

  if (loading) {
    return (
      <div className="space-y-token-4">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-surface-subdued" />
        <div className="h-48 animate-pulse rounded-lg bg-surface" />
        <div className="h-32 animate-pulse rounded-lg bg-surface" />
        <div className="h-32 animate-pulse rounded-lg bg-surface" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Banner tone="critical" title="Error">
        {error ?? "Unable to load client."}
      </Banner>
    );
  }

  const { client, projects, emailHistory, activityLogs } = data;
  const isArchived = client.status === "archived";
  const isProfileDeleted = client.deletedAt !== null;

  return (
    <div className="space-y-token-6">
      {/* Back nav + header */}
      <div className="flex flex-col gap-token-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.push("/clients")}
            className="mb-token-2 inline-flex items-center gap-1 text-xs font-medium text-text-subdued hover:text-text transition-colors"
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Clients
          </button>
          <h1 className="text-xl font-bold text-text">{client.name}</h1>
        </div>

        {/* Primary action: Archive or Restore */}
        {!isProfileDeleted && (
          <div className="flex items-center gap-token-2">
            <button
              type="button"
              onClick={() => setArchiveModalOpen(true)}
              className={`inline-flex items-center gap-token-2 rounded-lg px-token-4 py-[9px] text-sm font-semibold shadow-sm transition-all ${
                isArchived
                  ? "bg-primary text-text-on-primary hover:bg-primary-hovered"
                  : "border border-border bg-surface text-text hover:bg-surface-hovered"
              }`}
            >
              {isArchived ? "Restore Client" : "Archive Client"}
            </button>
          </div>
        )}
      </div>

      {/* ─── Overview Card ─── */}
      <OverviewCard
        name={client.fullName ?? client.name}
        businessName={client.businessName}
        status={client.status}
        isProfileDeleted={isProfileDeleted}
        createdAt={client.createdAt}
      />

      {/* ─── Contact Information Card ─── */}
      <ContactInfoCard client={client} onUpdate={handleContactUpdate} />

      {/* ─── Projects Card ─── */}
      <ProjectsCard projects={projects} onRowClick={(project) => router.push(`/projects/${project.id}`)} />

      {/* ─── Sign-offs Card ─── */}
      <SignoffsCard projects={projects} activityLogs={activityLogs} />

      {/* ─── Email History Card ─── */}
      <Card title="Email History">
        <div className="p-token-4">
          <EmailHistoryTable emailHistory={emailHistory} projects={projects} />
        </div>
      </Card>

      {/* ─── Notes Card ─── */}
      <NotesCard
        notes={client.notes}
        editingNotes={editingNotes}
        notesValue={notesValue}
        savingNotes={savingNotes}
        onEdit={() => {
          setNotesValue(client.notes ?? "");
          setEditingNotes(true);
        }}
        onCancel={() => {
          setNotesValue(client.notes ?? "");
          setEditingNotes(false);
        }}
        onSave={handleSaveNotes}
        onChange={setNotesValue}
      />

      {/* ─── Activity Log Card ─── */}
      <ActivityLogCard activityLogs={activityLogs} />

      {/* ─── Lifecycle Actions ─── */}
      {/* Delete Profile section */}
      {!isProfileDeleted && (
        <Card>
          <div className="p-token-5">
            <h2 className="text-sm font-semibold text-text">
              Delete Client Profile
            </h2>
            <p className="mt-token-1 text-sm text-text-subdued">
              Remove the client&apos;s profile data while preserving all project
              history, approvals, and audit records. Active share links will be
              revoked.
            </p>
            <button
              type="button"
              onClick={() => setDeleteProfileModalOpen(true)}
              className="mt-token-3 inline-flex items-center rounded-lg border border-status-amber bg-status-amber/5 px-token-4 py-[9px] text-sm font-medium text-status-amber hover:bg-status-amber/10 transition-colors"
            >
              Delete Client Profile
            </button>
          </div>
        </Card>
      )}

      {/* Danger Zone: Permanent Delete */}
      <div className="rounded-lg border-2 border-status-red/30 bg-status-red/5">
        <div className="p-token-5">
          <div className="flex items-center gap-token-2 mb-token-2">
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="text-status-red"
              strokeLinecap="round"
            >
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <h2 className="text-sm font-semibold text-status-red">
              Danger Zone
            </h2>
          </div>
          <p className="text-sm text-text-subdued">
            Permanently delete this client and all associated data including
            projects, phases, approvals, comments, tasks, and share links. This
            action is irreversible.
          </p>
          <button
            type="button"
            onClick={() => setPermanentDeleteStep(1)}
            className="mt-token-3 inline-flex items-center rounded-lg bg-status-red px-token-4 py-[9px] text-sm font-semibold text-white hover:bg-status-red/90 transition-colors"
          >
            Permanently Delete Client
          </button>
        </div>
      </div>

      {/* ─── Modals ─── */}

      {/* Archive/Restore Confirmation Modal */}
      <Modal
        open={archiveModalOpen}
        title={isArchived ? "Restore Client" : "Archive Client"}
        description={
          isArchived
            ? `Restore "${client.name}" to active status? The client will appear in active lists and share links can be generated again.`
            : `Archive "${client.name}"? The client will be hidden from active lists and new share links will be blocked. All project history is preserved.`
        }
        onCancel={() => setArchiveModalOpen(false)}
        onConfirm={handleArchiveRestore}
        confirmLabel={isArchived ? "Restore" : "Archive"}
        tone={isArchived ? undefined : "critical"}
        busy={archiving}
        size="sm"
      />

      {/* Delete Profile Confirmation Modal */}
      <Modal
        open={deleteProfileModalOpen}
        title="Delete Client Profile"
        onCancel={() => setDeleteProfileModalOpen(false)}
        onConfirm={handleDeleteProfile}
        confirmLabel="Delete Profile"
        tone="critical"
        busy={deletingProfile}
        size="sm"
      >
        <div className="space-y-token-3">
          <p className="text-sm text-text">This will:</p>
          <div className="rounded-lg border border-status-red/20 bg-status-red/5 p-token-3">
            <p className="text-sm font-medium text-status-red mb-token-1">
              Removed:
            </p>
            <ul className="text-sm text-text-subdued space-y-0.5 list-disc list-inside">
              <li>Client name and contact information</li>
              <li>All active share links (revoked)</li>
            </ul>
          </div>
          <div className="rounded-lg border border-status-green/20 bg-status-green/5 p-token-3">
            <p className="text-sm font-medium text-status-green mb-token-1">
              Preserved:
            </p>
            <ul className="text-sm text-text-subdued space-y-0.5 list-disc list-inside">
              <li>All projects and phases</li>
              <li>Approval records and sign-offs</li>
              <li>Comments and activity logs</li>
              <li>Uploaded files and design links</li>
              <li>Tasks and checklist items</li>
            </ul>
          </div>
        </div>
      </Modal>

      {/* Permanent Delete — Step 1: Type client name */}
      <Modal
        open={permanentDeleteStep === 1}
        title="Permanently Delete Client"
        onCancel={() => {
          setPermanentDeleteStep(0);
          setTypedName("");
        }}
        onConfirm={() => setPermanentDeleteStep(2)}
        confirmLabel="Continue"
        confirmDisabled={typedName !== client.name}
        tone="critical"
        size="sm"
      >
        <div className="space-y-token-3">
          <Banner tone="critical" title="This action is irreversible">
            All data associated with this client will be permanently destroyed.
          </Banner>
          <p className="text-sm text-text">
            Type <strong className="font-semibold">{client.name}</strong> to
            confirm:
          </p>
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Type the client name"
            className="w-full rounded-lg border border-border bg-surface px-token-3 py-[10px] text-sm text-text placeholder:text-text-subdued focus:border-status-red focus:outline-none focus:ring-1 focus:ring-status-red"
            autoFocus
          />
        </div>
      </Modal>

      {/* Permanent Delete — Step 2: Final confirmation */}
      <Modal
        open={permanentDeleteStep === 2}
        title="Final Confirmation"
        onCancel={() => {
          setPermanentDeleteStep(0);
          setTypedName("");
        }}
        onConfirm={handlePermanentDelete}
        confirmLabel="Delete Forever"
        tone="critical"
        busy={permanentDeleting}
        size="sm"
      >
        <div className="space-y-token-3">
          <Banner tone="critical" title="Point of no return">
            You are about to permanently delete &quot;{client.name}&quot; and
            ALL associated data. This cannot be undone.
          </Banner>
          <p className="text-sm text-text-subdued">
            The following will be destroyed: projects, phases, checklist items,
            design links, comments, approvals, tasks, activity logs, and share
            links.
          </p>
        </div>
      </Modal>
    </div>
  );
}

// ─── Overview Card ──────────────────────────────────────────────────────────

interface OverviewCardProps {
  name: string;
  businessName: string | null;
  status: "active" | "archived";
  isProfileDeleted: boolean;
  createdAt: string;
}

function OverviewCard({
  name,
  businessName,
  status,
  isProfileDeleted,
  createdAt,
}: OverviewCardProps) {
  return (
    <Card title="Overview">
      <div className="p-token-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-token-4">
          <div>
            <p className="text-xs font-medium text-text-subdued uppercase tracking-wide">
              Name
            </p>
            <p className="mt-token-1 text-sm text-text font-medium">{name}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-text-subdued uppercase tracking-wide">
              Business
            </p>
            <p className="mt-token-1 text-sm text-text">
              {businessName ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-text-subdued uppercase tracking-wide">
              Status
            </p>
            <div className="mt-token-1">
              {isProfileDeleted ? (
                <span className="inline-flex items-center rounded-sm px-token-2 py-token-1 text-xs font-medium bg-status-red/10 text-status-red">
                  Profile Deleted
                </span>
              ) : status === "archived" ? (
                <span className="inline-flex items-center rounded-sm px-token-2 py-token-1 text-xs font-medium bg-status-amber/10 text-status-amber">
                  Archived
                </span>
              ) : (
                <span className="inline-flex items-center rounded-sm px-token-2 py-token-1 text-xs font-medium bg-status-green/10 text-status-green">
                  Active
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-text-subdued uppercase tracking-wide">
              Created
            </p>
            <p className="mt-token-1 text-sm text-text">
              {new Date(createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Projects Card ──────────────────────────────────────────────────────────

interface ProjectsCardProps {
  projects: Project[];
  onRowClick: (project: Project) => void;
}

function ProjectsCard({ projects, onRowClick }: ProjectsCardProps) {
  const columns: IndexTableColumn<Project>[] = [
    {
      key: "name",
      header: "Project Name",
      render: (row) => (
        <span className="font-medium text-text">{row.name}</span>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      render: (row) => (
        <span className="whitespace-nowrap text-text-subdued">
          {new Date(row.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      ),
      hideOnStacked: true,
    },
  ];

  return (
    <Card title="Projects">
      <div className="p-token-4">
        <IndexTable<Project>
          columns={columns}
          rows={projects}
          rowKey={(row) => row.id}
          onRowClick={(row) => onRowClick(row)}
          caption="Client projects"
          emptyState={
            <EmptyState
              title="No projects yet"
              description="Projects linked to this client will appear here."
              icon={<ProjectsIcon />}
            />
          }
        />
      </div>
    </Card>
  );
}

// ─── Sign-offs Card ─────────────────────────────────────────────────────────

interface SignoffsCardProps {
  projects: Project[];
  activityLogs: ActivityLog[];
}

function SignoffsCard({ activityLogs }: SignoffsCardProps) {
  // Extract approval-related activity from the logs
  const approvalLogs = activityLogs.filter(
    (log) => log.type === "approval_created"
  );

  // Count pending (phases in "Sent to Client" or "Waiting for Feedback" are implicit pending sign-offs)
  // Since we only have activity logs, we count approval_created entries as completed sign-offs
  const completedSignoffs = approvalLogs.length;

  if (completedSignoffs === 0) {
    return (
      <Card title="Sign-offs">
        <div className="p-token-4">
          <EmptyState
            title="No sign-offs yet"
            description="Client approvals and sign-off history will appear here."
            icon={<SignoffIcon />}
          />
        </div>
      </Card>
    );
  }

  return (
    <Card title="Sign-offs">
      <div className="p-token-4 space-y-token-4">
        {/* Summary */}
        <div className="flex items-center gap-token-4">
          <div className="rounded-lg bg-status-green/10 px-token-3 py-token-2">
            <p className="text-xs font-medium text-text-subdued">
              Completed Approvals
            </p>
            <p className="text-lg font-bold text-status-green">
              {completedSignoffs}
            </p>
          </div>
        </div>

        {/* Approval history (most recent first) */}
        <div className="space-y-token-2">
          <p className="text-xs font-medium text-text-subdued uppercase tracking-wide">
            Approval History
          </p>
          <ul className="space-y-token-2">
            {approvalLogs.slice(0, 5).map((log) => (
              <li
                key={log.id}
                className="flex items-center justify-between rounded-md border border-border px-token-3 py-token-2"
              >
                <div className="flex items-center gap-token-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-status-green/10">
                    <svg
                      width={12}
                      height={12}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      className="text-status-green"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <span className="text-sm text-text">
                    {(log.detail as { name?: string })?.name ?? log.actor}
                  </span>
                </div>
                <span className="text-xs text-text-subdued">
                  {new Date(log.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </li>
            ))}
          </ul>
          {approvalLogs.length > 5 && (
            <p className="text-xs text-text-subdued">
              +{approvalLogs.length - 5} more
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Notes Card ─────────────────────────────────────────────────────────────

interface NotesCardProps {
  notes: string | null;
  editingNotes: boolean;
  notesValue: string;
  savingNotes: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onChange: (value: string) => void;
}

function NotesCard({
  notes,
  editingNotes,
  notesValue,
  savingNotes,
  onEdit,
  onCancel,
  onSave,
  onChange,
}: NotesCardProps) {
  const charCount = notesValue.length;
  const isOverLimit = charCount > 5000;

  const editButton = !editingNotes ? (
    <button
      type="button"
      onClick={onEdit}
      className="inline-flex items-center gap-1 rounded-md px-token-3 py-token-1 text-xs font-medium text-primary hover:bg-surface-hovered transition-colors"
    >
      <svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
      Edit
    </button>
  ) : null;

  return (
    <Card title="Notes" actions={editButton}>
      <div className="p-token-4">
        {editingNotes ? (
          <div className="space-y-token-3">
            <textarea
              value={notesValue}
              onChange={(e) => onChange(e.target.value)}
              rows={6}
              placeholder="Add notes about this client…"
              className={`w-full rounded-lg border bg-surface px-token-3 py-[10px] text-sm text-text placeholder:text-text-subdued transition-colors focus:outline-none focus:ring-1 resize-y ${
                isOverLimit
                  ? "border-status-red focus:border-status-red focus:ring-status-red"
                  : "border-border focus:border-primary focus:ring-primary"
              }`}
              aria-label="Client notes"
              aria-invalid={isOverLimit}
            />
            <div className="flex items-center justify-between">
              <p
                className={`text-xs ${
                  isOverLimit ? "text-status-red" : "text-text-subdued"
                }`}
              >
                {charCount}/5000 characters
              </p>
              <div className="flex items-center gap-token-2">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={savingNotes}
                  className="inline-flex items-center rounded-lg px-token-4 py-[9px] text-sm font-medium text-text hover:bg-surface-hovered transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={savingNotes || isOverLimit}
                  className="inline-flex items-center rounded-lg bg-primary px-token-4 py-[9px] text-sm font-semibold text-text-on-primary hover:bg-primary-hovered transition-colors disabled:opacity-50"
                >
                  {savingNotes ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        ) : notes ? (
          <p className="text-sm text-text whitespace-pre-wrap">{notes}</p>
        ) : (
          <EmptyState
            title="No notes"
            description="Add internal notes about this client."
            icon={<NotesIcon />}
            action={
              <button
                type="button"
                onClick={onEdit}
                className="text-sm font-medium text-primary hover:text-primary-hovered transition-colors"
              >
                Add notes
              </button>
            }
          />
        )}
      </div>
    </Card>
  );
}

// ─── Activity Log Card ──────────────────────────────────────────────────────

interface ActivityLogCardProps {
  activityLogs: ActivityLog[];
}

function ActivityLogCard({ activityLogs }: ActivityLogCardProps) {
  if (activityLogs.length === 0) {
    return (
      <Card title="Activity Log">
        <div className="p-token-4">
          <EmptyState
            title="No activity yet"
            description="Client interactions and system events will appear here."
            icon={<ActivityIcon />}
          />
        </div>
      </Card>
    );
  }

  return (
    <Card title="Activity Log">
      <div className="p-token-4">
        <ul className="space-y-token-3">
          {activityLogs.slice(0, 20).map((log) => (
            <li
              key={log.id}
              className="flex items-start gap-token-3 rounded-md border border-border px-token-3 py-token-2"
            >
              <span className="mt-0.5 shrink-0">
                <ActivityTypeIcon type={log.type} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text">
                  <span className="font-medium">{log.actor}</span>{" "}
                  {formatActivityDescription(log)}
                </p>
                <p className="mt-token-1 text-xs text-text-subdued">
                  {new Date(log.createdAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </li>
          ))}
        </ul>
        {activityLogs.length > 20 && (
          <p className="mt-token-3 text-xs text-text-subdued text-center">
            Showing 20 of {activityLogs.length} entries
          </p>
        )}
      </div>
    </Card>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatActivityDescription(log: ActivityLog): string {
  switch (log.type) {
    case "comment_created":
      return "added a comment";
    case "approval_created": {
      const decision = (log.detail as { decision?: string })?.decision;
      return decision === "Changes Requested"
        ? "requested changes"
        : "approved a phase";
    }
    case "phase_status_changed": {
      const from = (log.detail as { from?: string })?.from;
      const to = (log.detail as { to?: string })?.to;
      return `changed phase status${from ? ` from "${from}"` : ""}${to ? ` to "${to}"` : ""}`;
    }
    case "review_link_sent": {
      const email = (log.detail as { recipientEmail?: string })?.recipientEmail;
      return email ? `sent review link to ${email}` : "sent a review link";
    }
    default:
      return "performed an action";
  }
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function ProjectsIcon() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function SignoffIcon() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

function NotesIcon() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ActivityTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "comment_created":
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </span>
      );
    case "approval_created":
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-status-green/10 text-status-green">
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
      );
    case "phase_status_changed":
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-status-amber/10 text-status-amber">
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </span>
      );
    case "review_link_sent":
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-purple-600">
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13" />
            <path d="M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </span>
      );
    default:
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface-hovered text-text-subdued">
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
          </svg>
        </span>
      );
  }
}
