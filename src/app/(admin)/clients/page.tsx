"use client";

/**
 * Clients view with status filtering (Requirements 2, 3, 4).
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { IndexTable, type IndexTableColumn } from "@/components/ui/IndexTable";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import {
  createClient,
  updateClient,
  deleteClientCascade,
} from "@/lib/actions/clients";
import { getClientsPageData, type ClientRowData } from "./actions";

type FilterTab = "active" | "archived" | "all";

function ClientStatusBadge({ status, deletedAt }: { status: string; deletedAt: string | null }) {
  if (deletedAt) {
    return (
      <span className="inline-flex items-center rounded-sm px-token-2 py-token-1 text-xs font-medium bg-status-red/10 text-status-red">
        Deleted
      </span>
    );
  }
  if (status === "archived") {
    return (
      <span className="inline-flex items-center rounded-sm px-token-2 py-token-1 text-xs font-medium bg-status-amber/10 text-status-amber">
        Archived
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-sm px-token-2 py-token-1 text-xs font-medium bg-status-green/10 text-status-green">
      Active
    </span>
  );
}

export default function ClientsPage() {
  const { showToast } = useToast();
  const router = useRouter();

  const [clients, setClients] = useState<ClientRowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("active");

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRowData | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingClient, setDeletingClient] = useState<ClientRowData | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [formName, setFormName] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async (filter: FilterTab = activeFilter) => {
    setLoading(true);
    const rows = await getClientsPageData(filter);
    setClients(rows);
    setLoading(false);
  }, [activeFilter]);

  useEffect(() => { loadData(activeFilter); }, [activeFilter, loadData]);

  const handleFilterChange = useCallback((filter: FilterTab) => {
    setActiveFilter(filter);
  }, []);

  const openCreateModal = useCallback(() => {
    setEditingClient(null); setFormName(""); setFormErrors({}); setFormModalOpen(true);
  }, []);

  const closeFormModal = useCallback(() => { setFormModalOpen(false); setEditingClient(null); setFormErrors({}); }, []);

  const openDeleteModal = useCallback((row: ClientRowData) => { setDeletingClient(row); setDeleteModalOpen(true); }, []);
  const closeDeleteModal = useCallback(() => { setDeleteModalOpen(false); setDeletingClient(null); }, []);

  const handleFormSubmit = useCallback(async () => {
    setFormErrors({}); setSubmitting(true);
    try {
      if (editingClient) {
        const result = await updateClient(editingClient.id, { name: formName });
        if (!result.ok) {
          const e = result.error;
          if (e.kind === "validation") { const fe: Record<string,string> = {}; for (const f of e.fields) fe[f.field] = f.message; setFormErrors(Object.keys(fe).length ? fe : { name: e.message }); }
          else setFormErrors({ _general: e.message });
          return;
        }
        showToast("Client updated");
      } else {
        const result = await createClient({ name: formName });
        if (!result.ok) {
          const e = result.error;
          if (e.kind === "validation") { const fe: Record<string,string> = {}; for (const f of e.fields) fe[f.field] = f.message; setFormErrors(Object.keys(fe).length ? fe : { name: e.message }); }
          else setFormErrors({ _general: e.message });
          return;
        }
        showToast("Client created");
      }
      closeFormModal(); await loadData(activeFilter);
    } finally { setSubmitting(false); }
  }, [editingClient, formName, closeFormModal, loadData, showToast, activeFilter]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingClient) return;
    setDeleting(true);
    try {
      const result = await deleteClientCascade(deletingClient.id);
      if (!result.ok) { showToast(result.error.message, { tone: "error" }); closeDeleteModal(); return; }
      showToast("Client deleted"); closeDeleteModal(); await loadData(activeFilter);
    } finally { setDeleting(false); }
  }, [deletingClient, closeDeleteModal, loadData, showToast, activeFilter]);

  const handleRowClick = useCallback((row: ClientRowData) => {
    router.push(`/clients/${row.id}`);
  }, [router]);

  const columns: IndexTableColumn<ClientRowData>[] = [
    { key: "name", header: "Client", render: (row) => <span className="font-medium">{row.name}</span> },
    { key: "status", header: "Status", render: (row) => <ClientStatusBadge status={row.status} deletedAt={row.deletedAt} /> },
    { key: "projects", header: "Projects", align: "end", render: (row) => row.projectCount },
    { key: "actions", header: "", align: "end", hideOnStacked: true, render: (row) => (
      <button type="button" onClick={e => { e.stopPropagation(); openDeleteModal(row); }} className="text-xs text-status-red hover:bg-status-red/10 px-token-2 py-token-1 rounded-md" aria-label={`Delete ${row.name}`}>Delete</button>
    )},
  ];

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "active", label: "Active" },
    { key: "archived", label: "Archived" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="space-y-token-5">
      <PageHeader title="Clients" primaryAction={
        <button type="button" onClick={openCreateModal} className="inline-flex items-center rounded-md bg-primary px-token-4 py-token-2 text-sm font-semibold text-text-on-primary hover:bg-primary-hovered">Add client</button>
      } />

      {/* Filter Tabs */}
      <div className="flex items-center gap-token-1 border-b border-border">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleFilterChange(tab.key)}
            className={`px-token-4 py-token-2 text-sm font-medium border-b-2 transition-colors ${
              activeFilter === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-text-subdued hover:text-text hover:border-border"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        {loading ? <p className="py-token-8 text-center text-sm text-text-subdued">Loading…</p> : (
          <IndexTable columns={columns} rows={clients} rowKey={r => r.id} onRowClick={handleRowClick} caption="Clients"
            emptyState={<EmptyState title="No clients yet" description="Create your first client." action={<button type="button" onClick={openCreateModal} className="rounded-md bg-primary px-token-4 py-token-2 text-sm font-semibold text-text-on-primary">Add client</button>} />}
          />
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal open={formModalOpen} title={editingClient ? "Edit client" : "Add client"} onCancel={closeFormModal} onConfirm={handleFormSubmit} confirmLabel={editingClient ? "Save" : "Create"} confirmDisabled={submitting || !formName.trim()} busy={submitting} size="sm">
        <div className="space-y-token-4">
          {formErrors._general && <p className="text-sm text-status-red">{formErrors._general}</p>}
          <div>
            <label htmlFor="cn" className="block text-sm font-medium text-text">Client name</label>
            <input id="cn" type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Acme Corp" maxLength={100} className="mt-token-1 w-full rounded-md border border-border bg-surface px-token-3 py-token-2 text-sm text-text" />
            {formErrors.name && <p className="mt-token-1 text-xs text-status-red">{formErrors.name}</p>}
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={deleteModalOpen} title="Delete client" description={deletingClient ? `Delete "${deletingClient.name}" and all associated projects? This cannot be undone.` : undefined} onCancel={closeDeleteModal} onConfirm={handleDeleteConfirm} confirmLabel="Delete" tone="critical" busy={deleting} size="sm" />
    </div>
  );
}
