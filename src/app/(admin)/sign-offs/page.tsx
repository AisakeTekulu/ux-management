"use client";

/**
 * Sign-offs view (Requirements 8.1, 8.5, 9.7).
 *
 * Provides:
 * - Generate share-link controls (project or phase scoped)
 * - Revoke share-link controls with confirmation modal
 * - Approval audit-trail listing (reverse chronological)
 *
 * Composes from PageHeader, IndexTable, Card, Modal, EmptyState, and Toast.
 */

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { IndexTable, type IndexTableColumn } from "@/components/ui/IndexTable";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  generateShareLink,
  revokeShareLink,
} from "@/lib/actions/share-links";
import type { ShareLink, Approval } from "@/lib/domain/types";
import { getSignOffsData } from "./actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShareLinkRow extends ShareLink {
  /** Resolved project or phase name for display. */
  scopeLabel: string;
}

interface ApprovalRow extends Approval {
  /** Phase title for display context. */
  phaseTitle: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SignOffsPage() {
  const { showToast } = useToast();

  // Data state
  const [shareLinks, setShareLinks] = useState<ShareLinkRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate link form state
  const [generateOpen, setGenerateOpen] = useState(false);
  const [scopeType, setScopeType] = useState<"project" | "phase">("phase");
  const [scopeId, setScopeId] = useState("");
  const [generating, setGenerating] = useState(false);

  // Revoke modal state
  const [revokeTarget, setRevokeTarget] = useState<ShareLinkRow | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Available projects/phases for the generate form
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [phases, setPhases] = useState<Array<{ id: string; title: string; projectName: string }>>([]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    try {
      const data = await getSignOffsData();
      setShareLinks(data.shareLinks);
      setApprovals(data.approvals);
      setProjects(data.projects);
      setPhases(data.phases);
    } catch {
      showToast("Failed to load sign-offs data", { tone: "error" });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // Generate share link
  // ---------------------------------------------------------------------------

  const handleGenerate = useCallback(async () => {
    if (!scopeId) return;
    setGenerating(true);
    try {
      const result = await generateShareLink({ type: scopeType, id: scopeId });
      if (result.ok) {
        showToast("Share link generated");
        setGenerateOpen(false);
        setScopeId("");
        await loadData();
      } else {
        showToast(result.error.message, { tone: "error" });
      }
    } catch {
      showToast("Failed to generate share link", { tone: "error" });
    } finally {
      setGenerating(false);
    }
  }, [scopeType, scopeId, showToast, loadData]);

  // ---------------------------------------------------------------------------
  // Revoke share link
  // ---------------------------------------------------------------------------

  const handleRevoke = useCallback(async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const result = await revokeShareLink(revokeTarget.id);
      if (result.ok) {
        showToast("Share link revoked");
        setRevokeTarget(null);
        await loadData();
      } else {
        showToast(result.error.message, { tone: "error" });
      }
    } catch {
      showToast("Failed to revoke share link", { tone: "error" });
    } finally {
      setRevoking(false);
    }
  }, [revokeTarget, showToast, loadData]);

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------

  const shareLinkColumns: ReadonlyArray<IndexTableColumn<ShareLinkRow>> = [
    {
      key: "scope",
      header: "Scope",
      render: (row) => (
        <span className="text-sm">
          <span className="font-medium capitalize">{row.scopeType}</span>
          {" — "}
          <span className="text-text-subdued">{row.scopeLabel}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.revokedAt ? (
          <span className="inline-flex items-center rounded-sm bg-status-red/10 px-token-2 py-token-1 text-xs font-medium text-status-red">
            Revoked
          </span>
        ) : (
          <span className="inline-flex items-center rounded-sm bg-status-green/10 px-token-2 py-token-1 text-xs font-medium text-status-green">
            Active
          </span>
        ),
    },
    {
      key: "created",
      header: "Created",
      render: (row) => (
        <span className="text-sm text-text-subdued">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
      hideOnStacked: true,
    },
    {
      key: "actions",
      header: "Actions",
      align: "end",
      render: (row) =>
        !row.revokedAt ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setRevokeTarget(row);
            }}
            className="rounded-md border border-border bg-surface px-token-3 py-token-1 text-xs font-medium text-status-red hover:bg-surface-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            Revoke
          </button>
        ) : null,
    },
  ];

  const approvalColumns: ReadonlyArray<IndexTableColumn<ApprovalRow>> = [
    {
      key: "phase",
      header: "Phase",
      render: (row) => (
        <span className="text-sm font-medium">{row.phaseTitle}</span>
      ),
    },
    {
      key: "decision",
      header: "Decision",
      render: (row) => (
        <StatusBadge
          status={row.decision === "Approved" ? "Approved" : "Changes Requested"}
        />
      ),
    },
    {
      key: "reviewer",
      header: "Reviewer",
      render: (row) => (
        <span className="text-sm">
          {row.reviewerName}{" "}
          <span className="text-text-subdued">({row.reviewerInitials})</span>
        </span>
      ),
    },
    {
      key: "date",
      header: "Date",
      render: (row) => (
        <span className="text-sm text-text-subdued">
          {new Date(row.createdAt).toLocaleString()}
        </span>
      ),
      hideOnStacked: true,
    },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-token-6">
        <PageHeader title="Sign-offs" />
        <Card>
          <p className="py-token-8 text-center text-sm text-text-subdued">
            Loading…
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-token-6">
      <PageHeader
        title="Sign-offs"
        subtitle="Manage share links and view the approval audit trail"
        primaryAction={
          <button
            type="button"
            onClick={() => setGenerateOpen(true)}
            className="inline-flex items-center justify-center rounded-md bg-primary px-token-4 py-token-2 text-sm font-semibold text-text-on-primary hover:bg-primary-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            Generate link
          </button>
        }
      />

      {/* Share Links Section */}
      <Card title="Share Links">
        <IndexTable
          columns={shareLinkColumns}
          rows={shareLinks}
          rowKey={(row) => row.id}
          caption="Share links"
          emptyState={
            <EmptyState
              title="No share links yet"
              description="Generate a share link to let clients review and sign off on your work."
              action={
                <button
                  type="button"
                  onClick={() => setGenerateOpen(true)}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-token-4 py-token-2 text-sm font-semibold text-text-on-primary hover:bg-primary-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                >
                  Generate link
                </button>
              }
            />
          }
        />
      </Card>

      {/* Approval Audit Trail Section */}
      <Card title="Approval Audit Trail">
        <IndexTable
          columns={approvalColumns}
          rows={approvals}
          rowKey={(row) => row.id}
          caption="Approval history"
          emptyState={
            <EmptyState
              title="No approvals yet"
              description="Approvals will appear here once clients sign off on shared phases."
            />
          }
        />
      </Card>

      {/* Generate Share Link Modal */}
      <Modal
        open={generateOpen}
        title="Generate Share Link"
        description="Create a private link for a client to review your work."
        onCancel={() => {
          setGenerateOpen(false);
          setScopeId("");
        }}
        onConfirm={handleGenerate}
        confirmLabel="Generate"
        confirmDisabled={!scopeId || generating}
        busy={generating}
      >
        <div className="space-y-token-4">
          <div>
            <label
              htmlFor="scope-type"
              className="mb-token-1 block text-sm font-medium text-text"
            >
              Scope
            </label>
            <select
              id="scope-type"
              value={scopeType}
              onChange={(e) => {
                setScopeType(e.target.value as "project" | "phase");
                setScopeId("");
              }}
              className="w-full rounded-md border border-border bg-surface px-token-3 py-token-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-focus"
            >
              <option value="phase">Phase</option>
              <option value="project">Project</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="scope-target"
              className="mb-token-1 block text-sm font-medium text-text"
            >
              {scopeType === "project" ? "Project" : "Phase"}
            </label>
            <select
              id="scope-target"
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-token-3 py-token-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-focus"
            >
              <option value="">
                Select a {scopeType === "project" ? "project" : "phase"}…
              </option>
              {scopeType === "project"
                ? projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))
                : phases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} — {p.projectName}
                    </option>
                  ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Revoke Confirmation Modal */}
      <Modal
        open={revokeTarget !== null}
        title="Revoke Share Link"
        description="This will permanently disable access through this link. Clients will no longer be able to view or sign off using it."
        onCancel={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        confirmLabel="Revoke"
        tone="critical"
        busy={revoking}
      >
        {revokeTarget && (
          <p className="text-sm text-text">
            Are you sure you want to revoke the{" "}
            <span className="font-medium">{revokeTarget.scopeType}</span> link
            for <span className="font-medium">{revokeTarget.scopeLabel}</span>?
          </p>
        )}
      </Modal>
    </div>
  );
}
