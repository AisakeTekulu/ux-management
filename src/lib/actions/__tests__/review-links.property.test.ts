/**
 * Property-based tests for the review-links server action logic.
 *
 * Contains:
 * - Property 12: Auto-fill inheritance from client to project context
 *
 * Since the actual `getReviewLinkModalContext` action requires Supabase auth,
 * this test validates the auto-fill extraction logic directly using the
 * in-memory repository: it creates a client with non-null primaryEmail and
 * fullName, creates a linked project, fetches the client through the project's
 * clientId, and verifies the auto-filled fields match the client record.
 *
 * Feature: client-crm-review-links
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createInMemoryRepositories } from '@/lib/repositories/in-memory';
import type { ReviewLinkModalContext } from '@/lib/domain/types';

// ─── Shared Generators ──────────────────────────────────────────────────────

/** Generate a valid UUID v4 string. */
const arbUuid = fc.uuid();

/** Generate a non-empty string suitable for fullName. */
const arbFullName = fc.string({ minLength: 1, maxLength: 100 });

/** Generate a valid non-null email string (local@domain.tld). */
const arbEmail = fc
  .tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{0,10}$/),
    fc.stringMatching(/^[a-z][a-z0-9]{0,8}$/),
    fc.stringMatching(/^[a-z]{2,4}$/),
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

// ─── Property 12: Auto-fill inheritance from client to project context ──────

describe('Feature: client-crm-review-links, Property 12: Auto-fill inheritance from client to project context', () => {
  /**
   * **Validates: Requirements 3.3, 4.4, 4.5**
   *
   * For any client with non-null primaryEmail and fullName, when building the
   * modal context from this client (via a linked project), the auto-filled
   * recipientEmail equals client.primaryEmail and the auto-filled clientName
   * equals client.fullName.
   */
  it('auto-filled recipientEmail equals client.primaryEmail and clientName equals client.fullName', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUuid,
        arbFullName,
        arbEmail,
        fc.string({ minLength: 1, maxLength: 100 }),
        async (ownerId, fullName, primaryEmail, projectName) => {
          // Arrange: create repositories and seed a client with non-null CRM fields
          const repos = createInMemoryRepositories();

          const client = await repos.clients.create({
            ownerId,
            name: fullName,
            fullName,
            primaryEmail,
          });

          // Create a project linked to this client
          const project = await repos.projects.create({
            clientId: client.id,
            ownerId,
            name: projectName,
          });

          // Act: simulate the auto-fill logic from getReviewLinkModalContext
          // This mirrors the server action's data flow:
          // 1. Fetch project by ID
          // 2. Fetch client by project.clientId
          // 3. Extract auto-fill values from client
          const fetchedProject = await repos.projects.findById(project.id);
          expect(fetchedProject).not.toBeNull();

          const fetchedClient = await repos.clients.findById(fetchedProject!.clientId);
          expect(fetchedClient).not.toBeNull();

          // Build auto-fill fields exactly as the server action does
          const autoFilledEmail = fetchedClient!.primaryEmail ?? undefined;
          const autoFilledName = fetchedClient!.fullName ?? undefined;

          // Assert: auto-filled values match the original client data
          expect(autoFilledEmail).toBe(primaryEmail);
          expect(autoFilledName).toBe(fullName);

          // Additionally verify the constructed context shape matches expectations
          const context: Partial<ReviewLinkModalContext> = {
            client: fetchedClient!,
            project: fetchedProject!,
            autoFilledEmail,
            autoFilledName,
          };

          expect(context.autoFilledEmail).toBe(client.primaryEmail);
          expect(context.autoFilledName).toBe(client.fullName);
        },
      ),
      { numRuns: 100 },
    );
  });
});
