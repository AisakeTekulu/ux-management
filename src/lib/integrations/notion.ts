/**
 * Notion integration — push tasks and project milestones to a Notion database.
 *
 * This module provides fire-and-forget sync functions that push data from the
 * UX Management app to a connected Notion database. If Notion credentials are
 * not configured, all sync functions silently no-op (no errors thrown).
 *
 * Environment variables:
 * - NOTION_API_TOKEN — Internal integration token (starts with ntn_ or secret_)
 * - NOTION_TASKS_DATABASE_ID — The 32-char hex ID of the Notion database for tasks
 *
 * The Notion database should have these properties:
 * - Title (title type) — task title
 * - Status (select) — "Open" or "Complete"
 * - Client (rich_text) — client name
 * - Project (rich_text) — project name
 * - Due Date (date) — task due date
 * - Type (select) — "Task", "Phase Update", "Sign-off", "Review Link Sent"
 * - Phase (rich_text) — phase title (for phase updates)
 */

import { Client } from "@notionhq/client";

// ─── Configuration ──────────────────────────────────────────────────────────

function getNotionClient(): Client | null {
  const token = process.env.NOTION_API_TOKEN;
  if (!token) return null;
  return new Client({ auth: token });
}

function getDatabaseId(): string | null {
  return process.env.NOTION_TASKS_DATABASE_ID || null;
}

function isConfigured(): boolean {
  return !!(process.env.NOTION_API_TOKEN && process.env.NOTION_TASKS_DATABASE_ID);
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface NotionTaskInput {
  title: string;
  status: "Open" | "Complete";
  clientName: string;
  projectName: string;
  dueDate?: string | null;
}

interface NotionPhaseUpdateInput {
  phaseTitle: string;
  projectName: string;
  clientName: string;
  status: string;
  dueDate?: string | null;
}

interface NotionActivityInput {
  title: string;
  type: "Sign-off" | "Review Link Sent" | "Comment" | "Status Change";
  projectName: string;
  clientName: string;
  detail?: string;
}

// ─── Sync Functions (fire-and-forget) ───────────────────────────────────────

/**
 * Push a task to the Notion database.
 * Called when a task is created or updated in the app.
 */
export async function syncTaskToNotion(input: NotionTaskInput): Promise<void> {
  if (!isConfigured()) return;

  const notion = getNotionClient();
  const databaseId = getDatabaseId();
  if (!notion || !databaseId) return;

  try {
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Name: { title: [{ text: { content: input.title } }] },
      },
      // Add content as page body (works regardless of database schema)
      children: [
        {
          object: "block" as const,
          type: "paragraph" as const,
          paragraph: {
            rich_text: [
              {
                text: {
                  content: `Client: ${input.clientName}\nProject: ${input.projectName}\nStatus: ${input.status}${input.dueDate ? `\nDue: ${input.dueDate}` : ""}\nType: Task`,
                },
              },
            ],
          },
        },
      ],
    });
    console.log("[Notion] ✓ Task synced:", input.title);
  } catch (error) {
    // Log the full error for debugging
    console.error("[Notion] Failed to sync task:", error instanceof Error ? error.message : error);
  }
}

/**
 * Push a phase status update to the Notion database.
 * Called when a phase changes status (e.g., Draft → Sent to Client → Approved).
 */
export async function syncPhaseUpdateToNotion(input: NotionPhaseUpdateInput): Promise<void> {
  if (!isConfigured()) return;

  const notion = getNotionClient();
  const databaseId = getDatabaseId();
  if (!notion || !databaseId) return;

  try {
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Name: { title: [{ text: { content: `${input.phaseTitle} → ${input.status}` } }] },
      },
      children: [
        {
          object: "block" as const,
          type: "paragraph" as const,
          paragraph: {
            rich_text: [
              {
                text: {
                  content: `Client: ${input.clientName}\nProject: ${input.projectName}\nPhase: ${input.phaseTitle}\nStatus: ${input.status}${input.dueDate ? `\nDue: ${input.dueDate}` : ""}\nType: Phase Update`,
                },
              },
            ],
          },
        },
      ],
    });
    console.log("[Notion] ✓ Phase update synced:", input.phaseTitle, "→", input.status);
  } catch (error) {
    console.error("[Notion] Failed to sync phase update:", error instanceof Error ? error.message : error);
  }
}

/**
 * Push an activity event to the Notion database.
 * Called for sign-offs, review link sends, etc.
 */
export async function syncActivityToNotion(input: NotionActivityInput): Promise<void> {
  if (!isConfigured()) return;

  const notion = getNotionClient();
  const databaseId = getDatabaseId();
  if (!notion || !databaseId) return;

  try {
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Name: { title: [{ text: { content: input.title } }] },
      },
      children: [
        {
          object: "block" as const,
          type: "paragraph" as const,
          paragraph: {
            rich_text: [
              {
                text: {
                  content: `Client: ${input.clientName}\nProject: ${input.projectName}\nType: ${input.type}${input.detail ? `\nDetail: ${input.detail}` : ""}`,
                },
              },
            ],
          },
        },
      ],
    });
    console.log("[Notion] ✓ Activity synced:", input.title);
  } catch (error) {
    console.error("[Notion] Failed to sync activity:", error instanceof Error ? error.message : error);
  }
}

/**
 * Mark a task as complete in Notion by searching for it and updating.
 * Best-effort — if the task isn't found in Notion, silently no-ops.
 */
export async function markTaskCompleteInNotion(taskTitle: string): Promise<void> {
  if (!isConfigured()) return;

  const notion = getNotionClient();
  const databaseId = getDatabaseId();
  if (!notion || !databaseId) return;

  try {
    // Search for the task by title in the database
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: "Name",
        title: { equals: taskTitle },
      },
      page_size: 1,
    });

    if (response.results.length > 0) {
      const pageId = response.results[0].id;
      // Add a strikethrough or "✓ DONE" prefix to indicate completion
      await notion.pages.update({
        page_id: pageId,
        properties: {
          Name: { title: [{ text: { content: `✓ ${taskTitle}` } }] },
        },
      });
      console.log("[Notion] ✓ Task marked complete:", taskTitle);
    }
  } catch (error) {
    console.error("[Notion] Failed to mark task complete:", error instanceof Error ? error.message : error);
  }
}
