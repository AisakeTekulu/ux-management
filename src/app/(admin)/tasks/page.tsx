"use client";

/**
 * Tasks view — admin page for managing open tasks (Requirements 12.1–12.4).
 *
 * Renders the open-task list ordered by due date (null-due last), with create
 * and complete controls. Uses `createTask`/`completeTask` from
 * `@/lib/actions/tasks` and composes from PageHeader, IndexTable, Card,
 * EmptyState, and Toast.
 *
 * This is a Client Component because it manages form state, optimistic UI for
 * task completion, and toast notifications.
 */

import { useCallback, useEffect, useState, useTransition } from "react";

import { createTask, completeTask } from "@/lib/actions/tasks";
import { sortOpenTasks } from "@/lib/domain/ordering";
import type { Task } from "@/lib/domain/types";

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IndexTable, type IndexTableColumn } from "@/components/ui/IndexTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";

/**
 * Fetch open tasks for the current user via the tasks action layer.
 * We call createTask/completeTask for mutations but need a read path.
 * Since the task actions don't expose a list action, we use a lightweight
 * server action wrapper that queries tasks directly.
 */
import { getOpenTasks } from "./actions";

export default function TasksPage() {
  const { showToast } = useToast();

  // Task list state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Load tasks on mount
  const loadTasks = useCallback(async () => {
    const result = await getOpenTasks();
    if (result.ok) {
      setTasks(sortOpenTasks(result.value));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Handle task creation
  const handleCreate = () => {
    setCreateError(null);
    startTransition(async () => {
      const result = await createTask({
        title: newTitle,
        dueDate: newDueDate || undefined,
      });

      if (!result.ok) {
        setCreateError(result.error.message);
        return;
      }

      showToast("Task created");
      setNewTitle("");
      setNewDueDate("");
      setShowCreateForm(false);
      await loadTasks();
    });
  };

  // Handle task completion
  const handleComplete = (task: Task) => {
    startTransition(async () => {
      const result = await completeTask(task.id);
      if (result.ok) {
        showToast("Task completed");
        await loadTasks();
      } else {
        showToast("Failed to complete task", { tone: "error" });
      }
    });
  };

  // Format due date for display
  const formatDueDate = (dueDate: string | null): string => {
    if (!dueDate) return "No due date";
    return dueDate;
  };

  // Table columns
  const columns: IndexTableColumn<Task>[] = [
    {
      key: "title",
      header: "Title",
      render: (row) => <span className="font-medium">{row.title}</span>,
    },
    {
      key: "dueDate",
      header: "Due Date",
      render: (row) => (
        <span className={row.dueDate ? "text-text" : "text-text-subdued"}>
          {formatDueDate(row.dueDate)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "end",
      hideOnStacked: false,
      render: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleComplete(row);
          }}
          disabled={isPending}
          className="rounded-md border border-border bg-surface px-token-3 py-token-1 text-xs font-medium text-text transition-colors hover:bg-surface-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
        >
          Complete
        </button>
      ),
    },
  ];

  // Primary action button for the page header
  const primaryAction = (
    <button
      type="button"
      onClick={() => setShowCreateForm(true)}
      className="rounded-md bg-interactive px-token-4 py-token-2 text-sm font-medium text-on-interactive transition-colors hover:bg-interactive-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      Create task
    </button>
  );

  if (loading) {
    return (
      <div className="space-y-token-4">
        <PageHeader title="Tasks" />
        <Card>
          <p className="text-sm text-text-subdued">Loading tasks…</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-token-4">
      <PageHeader title="Tasks" primaryAction={primaryAction} />

      {/* Create task form */}
      {showCreateForm && (
        <Card title="New Task">
          <div className="space-y-token-3 p-token-4">
            <div>
              <label
                htmlFor="task-title"
                className="block text-sm font-medium text-text"
              >
                Title
              </label>
              <input
                id="task-title"
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter task title (1–200 characters)"
                maxLength={200}
                className="mt-token-1 w-full rounded-md border border-border bg-surface px-token-3 py-token-2 text-sm text-text placeholder:text-text-subdued focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
              />
            </div>

            <div>
              <label
                htmlFor="task-due-date"
                className="block text-sm font-medium text-text"
              >
                Due date (optional)
              </label>
              <input
                id="task-due-date"
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="mt-token-1 w-full rounded-md border border-border bg-surface px-token-3 py-token-2 text-sm text-text focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
              />
            </div>

            {createError && (
              <p className="text-sm text-status-red" role="alert">
                {createError}
              </p>
            )}

            <div className="flex items-center gap-token-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={isPending}
                className="rounded-md bg-interactive px-token-4 py-token-2 text-sm font-medium text-on-interactive transition-colors hover:bg-interactive-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
              >
                {isPending ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewTitle("");
                  setNewDueDate("");
                  setCreateError(null);
                }}
                className="rounded-md border border-border bg-surface px-token-4 py-token-2 text-sm font-medium text-text transition-colors hover:bg-surface-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                Cancel
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Task list */}
      <Card>
        <IndexTable<Task>
          columns={columns}
          rows={tasks}
          rowKey={(row) => row.id}
          caption="Open tasks ordered by due date"
          emptyState={
            <EmptyState
              title="No open tasks"
              description="Create a task to track your next follow-up."
              action={
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="rounded-md bg-interactive px-token-4 py-token-2 text-sm font-medium text-on-interactive transition-colors hover:bg-interactive-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  Create task
                </button>
              }
            />
          }
        />
      </Card>
    </div>
  );
}
