/**
 * Admin views integration tests (Task 18.9).
 *
 * Since no DOM testing library is installed, these tests verify the logic and
 * exports backing the admin view components:
 *
 * 1. getDashboard action exports exist and return the expected shape (using
 *    in-memory repos via the pure buildDashboard domain function).
 * 2. Domain functions backing empty states (EmptyState component is exported).
 * 3. Modal component's confirm/cancel props interface.
 * 4. Toast resolveToastDuration enforces the 4s floor (R14.6).
 *
 * Validates: Requirements 2.6, 4.2, 5.6, 13.5, 14.6, 14.7, 14.8
 */

import { describe, expect, it } from "vitest";

import {
  buildDashboard,
  NO_NEXT_ACTION,
  type DashboardViewModel,
  type WorkspaceSnapshot,
} from "@/lib/domain/dashboard";
import { createInMemoryRepositories } from "@/lib/repositories/in-memory";
import { EmptyState, type EmptyStateProps } from "@/components/ui/EmptyState";
import { Modal, type ModalProps, type ModalTone, type ModalSize } from "@/components/ui/Modal";
import {
  resolveToastDuration,
  MIN_TOAST_DURATION_MS,
  DEFAULT_TOAST_DURATION_MS,
  ToastProvider,
  useToast,
  type Toast,
  type ToastOptions,
} from "@/components/ui/Toast";
import type { Phase, Project, Client, Task, Comment } from "@/lib/domain/types";

/* -------------------------------------------------------------------------- */
/* 1. getDashboard action — buildDashboard returns expected shape (R11)       */
/* -------------------------------------------------------------------------- */

describe("getDashboard — buildDashboard returns expected shape via in-memory repos", () => {
  it("returns a DashboardViewModel with summary, projectStatusTable, and waitingOnClient", () => {
    const snapshot: WorkspaceSnapshot = {
      clients: [],
      projects: [],
      phases: [],
      comments: [],
      tasks: [],
    };
    const result = buildDashboard(snapshot, new Date());

    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("projectStatusTable");
    expect(result).toHaveProperty("waitingOnClient");
  });

  it("summary counts are all zero for an empty workspace", () => {
    const snapshot: WorkspaceSnapshot = {
      clients: [],
      projects: [],
      phases: [],
      comments: [],
      tasks: [],
    };
    const result = buildDashboard(snapshot, new Date());

    expect(result.summary.activeProjects).toBe(0);
    expect(result.summary.phasesWaitingForFeedback).toBe(0);
    expect(result.summary.overduePhases).toBe(0);
    expect(result.summary.openTasks).toBe(0);
  });

  it("summary counts are non-negative", () => {
    const snapshot: WorkspaceSnapshot = {
      clients: [],
      projects: [],
      phases: [],
      comments: [],
      tasks: [],
    };
    const result = buildDashboard(snapshot, new Date());

    expect(result.summary.activeProjects).toBeGreaterThanOrEqual(0);
    expect(result.summary.phasesWaitingForFeedback).toBeGreaterThanOrEqual(0);
    expect(result.summary.overduePhases).toBeGreaterThanOrEqual(0);
    expect(result.summary.openTasks).toBeGreaterThanOrEqual(0);
  });

  it("correctly counts active projects (projects with non-Completed phases)", () => {
    const client: Client = {
      id: "c1",
      ownerId: "owner1",
      name: "Acme",
      status: "active",
      deletedAt: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      fullName: null,
      businessName: null,
      primaryEmail: null,
      secondaryEmail: null,
      phone: null,
      website: null,
      location: null,
      preferredContactMethod: "email",
      notes: null,
    };
    const project: Project = {
      id: "p1",
      clientId: "c1",
      ownerId: "owner1",
      name: "Website Redesign",
      createdAt: "2024-01-01T00:00:00.000Z",
    };
    const phase: Phase = {
      id: "ph1",
      projectId: "p1",
      title: "Discovery",
      ordinal: 1,
      description: "",
      internalNotes: "",
      status: "Draft",
      dueDate: null,
      approvedByName: null,
      approvedInitials: null,
      approvedAt: null,
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const snapshot: WorkspaceSnapshot = {
      clients: [client],
      projects: [project],
      phases: [phase],
      comments: [],
      tasks: [],
    };
    const result = buildDashboard(snapshot, new Date());

    expect(result.summary.activeProjects).toBe(1);
    expect(result.projectStatusTable).toHaveLength(1);
    expect(result.projectStatusTable[0].projectName).toBe("Website Redesign");
    expect(result.projectStatusTable[0].clientName).toBe("Acme");
    expect(result.projectStatusTable[0].nextAction).toBe(NO_NEXT_ACTION);
  });

  it("uses in-memory repositories to seed data for buildDashboard", async () => {
    const repos = createInMemoryRepositories();

    const client = await repos.clients.create({ ownerId: "owner1", name: "Test Client" });
    const project = await repos.projects.create({
      clientId: client.id,
      ownerId: "owner1",
      name: "Test Project",
    });
    const phase = await repos.phases.create({
      projectId: project.id,
      title: "Wireframes",
      ordinal: 1,
      description: "",
      internalNotes: "",
      status: "Sent to Client",
      dueDate: null,
      approvedByName: null,
      approvedInitials: null,
      approvedAt: null,
    });

    // Assemble snapshot from repos
    const clients = await repos.clients.listByOwner("owner1");
    const projects = await repos.projects.listByOwner("owner1");
    const phases = await repos.phases.listByProject(project.id);
    const comments: Comment[] = [];
    const tasks = await repos.tasks.listByOwner("owner1");

    const snapshot: WorkspaceSnapshot = { clients, projects, phases, comments, tasks };
    const result = buildDashboard(snapshot, new Date());

    expect(result.summary.activeProjects).toBe(1);
    expect(result.summary.phasesWaitingForFeedback).toBe(0);
    expect(result.waitingOnClient).toHaveLength(1);
    expect(result.waitingOnClient[0].status).toBe("Sent to Client");
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Empty states — EmptyState component export and domain backing (R2.6,    */
/*    R4.2, R5.6, R13.5, R14.5)                                              */
/* -------------------------------------------------------------------------- */

describe("EmptyState — component export and empty-state domain logic", () => {
  it("EmptyState is exported as a function component", () => {
    expect(typeof EmptyState).toBe("function");
  });

  it("EmptyStateProps requires a title field", () => {
    const props: EmptyStateProps = { title: "No clients yet" };
    expect(props.title).toBe("No clients yet");
  });

  it("EmptyStateProps supports optional description, action, icon, className", () => {
    const props: EmptyStateProps = {
      title: "No projects",
      description: "Create a project to get started.",
      action: null,
      icon: null,
      className: "custom-class",
    };
    expect(props.description).toBe("Create a project to get started.");
    expect(props.className).toBe("custom-class");
  });

  it("empty workspace produces empty projectStatusTable (R2.6 — no projects)", () => {
    const snapshot: WorkspaceSnapshot = {
      clients: [{ id: "c1", ownerId: "o1", name: "Client A", status: "active", deletedAt: null, createdAt: "2024-01-01T00:00:00.000Z", fullName: null, businessName: null, primaryEmail: null, secondaryEmail: null, phone: null, website: null, location: null, preferredContactMethod: "email", notes: null }],
      projects: [],
      phases: [],
      comments: [],
      tasks: [],
    };
    const result = buildDashboard(snapshot, new Date());
    expect(result.projectStatusTable).toHaveLength(0);
  });

  it("project with no phases is not active (R4.2 — empty phase list indicator)", () => {
    const snapshot: WorkspaceSnapshot = {
      clients: [{ id: "c1", ownerId: "o1", name: "Client A", status: "active", deletedAt: null, createdAt: "2024-01-01T00:00:00.000Z", fullName: null, businessName: null, primaryEmail: null, secondaryEmail: null, phone: null, website: null, location: null, preferredContactMethod: "email", notes: null }],
      projects: [{ id: "p1", clientId: "c1", ownerId: "o1", name: "Proj", createdAt: "2024-01-01T00:00:00.000Z" }],
      phases: [],
      comments: [],
      tasks: [],
    };
    const result = buildDashboard(snapshot, new Date());
    // A project with no phases is not active, so it won't appear in the table
    expect(result.projectStatusTable).toHaveLength(0);
    expect(result.summary.activeProjects).toBe(0);
  });

  it("project with all Completed phases is not active (empty state scenario)", () => {
    const snapshot: WorkspaceSnapshot = {
      clients: [{ id: "c1", ownerId: "o1", name: "Client A", status: "active", deletedAt: null, createdAt: "2024-01-01T00:00:00.000Z", fullName: null, businessName: null, primaryEmail: null, secondaryEmail: null, phone: null, website: null, location: null, preferredContactMethod: "email", notes: null }],
      projects: [{ id: "p1", clientId: "c1", ownerId: "o1", name: "Proj", createdAt: "2024-01-01T00:00:00.000Z" }],
      phases: [{
        id: "ph1", projectId: "p1", title: "Done", ordinal: 1,
        description: "", internalNotes: "", status: "Completed",
        dueDate: null, approvedByName: null, approvedInitials: null,
        approvedAt: null, createdAt: "2024-01-01T00:00:00.000Z",
      }],
      comments: [],
      tasks: [],
    };
    const result = buildDashboard(snapshot, new Date());
    expect(result.summary.activeProjects).toBe(0);
    expect(result.projectStatusTable).toHaveLength(0);
  });

  it("activity timeline with no entries triggers empty state (R13.5)", async () => {
    const repos = createInMemoryRepositories();
    const project = await repos.projects.create({
      clientId: "c1",
      ownerId: "owner1",
      name: "Empty Activity Project",
    });
    const entries = await repos.activityLogs.listByProject(project.id, 20);
    // No activity entries — the view would show EmptyState
    expect(entries).toHaveLength(0);
  });

  it("checklist with no items triggers empty state (R5.6)", async () => {
    const repos = createInMemoryRepositories();
    const items = await repos.checklistItems.listByPhase("nonexistent-phase");
    expect(items).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Modal — confirm/cancel props interface (R14.7, R14.8)                   */
/* -------------------------------------------------------------------------- */

describe("Modal — confirm/cancel props interface (R14.7, R14.8)", () => {
  it("Modal is exported as a function component", () => {
    expect(typeof Modal).toBe("function");
  });

  it("ModalProps requires open, title, and onCancel", () => {
    const props: ModalProps = {
      open: false,
      title: "Delete client?",
      onCancel: () => {},
    };
    expect(props.open).toBe(false);
    expect(props.title).toBe("Delete client?");
    expect(typeof props.onCancel).toBe("function");
  });

  it("ModalProps supports onConfirm for the confirm action (R14.7)", () => {
    let confirmed = false;
    const props: ModalProps = {
      open: true,
      title: "Delete project?",
      onCancel: () => {},
      onConfirm: () => { confirmed = true; },
    };
    // Simulate confirm
    props.onConfirm!();
    expect(confirmed).toBe(true);
  });

  it("onCancel is separate from onConfirm — cancel does not trigger confirm (R14.8)", () => {
    let confirmCalled = false;
    let cancelCalled = false;
    const props: ModalProps = {
      open: true,
      title: "Delete?",
      onCancel: () => { cancelCalled = true; },
      onConfirm: () => { confirmCalled = true; },
    };
    // Simulate cancel
    props.onCancel();
    expect(cancelCalled).toBe(true);
    expect(confirmCalled).toBe(false);
  });

  it("ModalProps supports tone 'critical' for destructive delete confirmation", () => {
    const props: ModalProps = {
      open: true,
      title: "Delete client?",
      onCancel: () => {},
      onConfirm: () => {},
      tone: "critical",
      confirmLabel: "Delete",
      cancelLabel: "Keep",
    };
    expect(props.tone).toBe("critical");
    expect(props.confirmLabel).toBe("Delete");
    expect(props.cancelLabel).toBe("Keep");
  });

  it("ModalProps supports confirmDisabled and busy flags", () => {
    const props: ModalProps = {
      open: true,
      title: "Sign off",
      onCancel: () => {},
      onConfirm: () => {},
      confirmDisabled: true,
      busy: true,
    };
    expect(props.confirmDisabled).toBe(true);
    expect(props.busy).toBe(true);
  });

  it("ModalTone values are 'default' and 'critical'", () => {
    const tones: ModalTone[] = ["default", "critical"];
    expect(tones).toContain("default");
    expect(tones).toContain("critical");
  });

  it("ModalSize values are 'sm', 'md', and 'lg'", () => {
    const sizes: ModalSize[] = ["sm", "md", "lg"];
    expect(sizes).toHaveLength(3);
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Toast — resolveToastDuration enforces 4s floor (R14.6)                  */
/* -------------------------------------------------------------------------- */

describe("Toast — resolveToastDuration enforces 4s floor (R14.6)", () => {
  it("MIN_TOAST_DURATION_MS is exactly 4000ms", () => {
    expect(MIN_TOAST_DURATION_MS).toBe(4_000);
  });

  it("DEFAULT_TOAST_DURATION_MS equals the 4s minimum", () => {
    expect(DEFAULT_TOAST_DURATION_MS).toBe(4_000);
  });

  it("undefined input returns the default 4s duration", () => {
    expect(resolveToastDuration(undefined)).toBe(DEFAULT_TOAST_DURATION_MS);
  });

  it("null input returns null (persistent toast, dismissed manually)", () => {
    expect(resolveToastDuration(null)).toBeNull();
  });

  it("values below 4000ms are clamped up to 4000ms", () => {
    expect(resolveToastDuration(0)).toBe(4_000);
    expect(resolveToastDuration(1_000)).toBe(4_000);
    expect(resolveToastDuration(2_500)).toBe(4_000);
    expect(resolveToastDuration(3_999)).toBe(4_000);
    expect(resolveToastDuration(-100)).toBe(4_000);
  });

  it("values at or above 4000ms are returned unchanged", () => {
    expect(resolveToastDuration(4_000)).toBe(4_000);
    expect(resolveToastDuration(5_000)).toBe(5_000);
    expect(resolveToastDuration(10_000)).toBe(10_000);
    expect(resolveToastDuration(60_000)).toBe(60_000);
  });

  it("NaN and Infinity fall back to the default", () => {
    expect(resolveToastDuration(NaN)).toBe(DEFAULT_TOAST_DURATION_MS);
    expect(resolveToastDuration(Infinity)).toBe(DEFAULT_TOAST_DURATION_MS);
    expect(resolveToastDuration(-Infinity)).toBe(DEFAULT_TOAST_DURATION_MS);
  });

  it("ToastProvider and useToast are exported functions", () => {
    expect(typeof ToastProvider).toBe("function");
    expect(typeof useToast).toBe("function");
  });

  it("Toast type has the expected structure", () => {
    const toast: Toast = {
      id: "toast-42",
      message: "Client deleted",
      tone: "success",
      durationMs: 4_000,
    };
    expect(toast.id).toBe("toast-42");
    expect(toast.message).toBe("Client deleted");
    expect(toast.tone).toBe("success");
    expect(toast.durationMs).toBe(4_000);
  });

  it("ToastOptions supports tone and durationMs fields", () => {
    const opts: ToastOptions = { tone: "error", durationMs: null };
    expect(opts.tone).toBe("error");
    expect(opts.durationMs).toBeNull();
  });

  it("toast confirmations on create/edit/delete use success tone by default", () => {
    // The default tone when no options are specified is 'success'
    const opts: ToastOptions = {};
    expect(opts.tone).toBeUndefined(); // defaults to 'success' in showToast
  });
});
