/**
 * Property-based tests for the EmailHistoryRepository (in-memory).
 *
 * Contains:
 * - Property 9: Email history query completeness
 *
 * Feature: client-crm-review-links
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { InMemoryEmailHistoryRepository } from '@/lib/repositories/in-memory';
import { createIdFactory } from '@/test/fakes';
import type { NewClientEmailHistory } from '@/lib/repositories/interfaces';
import type { EmailDeliveryStatus } from '@/lib/domain/types';

// ─── Shared Generators ──────────────────────────────────────────────────────

/** Generate a valid UUID v4 string. */
const arbUuid = fc.uuid();

/** Generate a valid ISO timestamp string. */
const arbISOTimestamp = fc
  .date({
    min: new Date('2000-01-01T00:00:00.000Z'),
    max: new Date('2030-12-31T23:59:59.999Z'),
    noInvalidDate: true,
  })
  .map((d) => d.toISOString());

/** Generate a valid email delivery status. */
const arbDeliveryStatus: fc.Arbitrary<EmailDeliveryStatus> = fc.constantFrom(
  'sent',
  'failed',
  'pending',
);

/** Generate a valid email-like string. */
const arbEmail = fc
  .tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{0,10}$/),
    fc.stringMatching(/^[a-z][a-z0-9]{0,8}$/),
    fc.stringMatching(/^[a-z]{2,4}$/),
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

/**
 * Generate a valid NewClientEmailHistory record with specific clientId and projectId.
 */
function arbNewEmailHistory(
  clientId: fc.Arbitrary<string>,
  projectId: fc.Arbitrary<string>,
): fc.Arbitrary<NewClientEmailHistory> {
  return fc.record({
    clientId,
    projectId,
    phaseId: fc.option(arbUuid, { nil: null }),
    recipientEmail: arbEmail,
    subject: fc.string({ minLength: 1, maxLength: 100 }),
    message: fc.string({ minLength: 1, maxLength: 500 }),
    sentBy: arbUuid,
    sentAt: arbISOTimestamp,
    deliveryStatus: arbDeliveryStatus,
  });
}

// ─── Property 9: Email history query completeness ───────────────────────────

describe('Feature: client-crm-review-links, Property 9: Email history query completeness', () => {
  /**
   * **Validates: Requirements 8.3, 8.4**
   *
   * For any set of N entries for a clientId/projectId, listByClient/listByProject
   * returns exactly N results containing all inserted records.
   */
  it('listByClient returns exactly N results containing all inserted records', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUuid,
        fc.integer({ min: 1, max: 10 }),
        async (clientId, n) => {
          const repo = new InMemoryEmailHistoryRepository(createIdFactory('eh'));

          // Generate and insert N records all sharing the same clientId
          const insertedIds: string[] = [];
          for (let i = 0; i < n; i++) {
            const record: NewClientEmailHistory = {
              clientId,
              projectId: `project_${i}`,
              phaseId: null,
              recipientEmail: `user${i}@example.com`,
              subject: `Subject ${i}`,
              message: `Message ${i}`,
              sentBy: `sender_${i}`,
              sentAt: new Date(2024, 0, 1 + i).toISOString(),
              deliveryStatus: 'sent',
            };
            const created = await repo.create(record);
            insertedIds.push(created.id);
          }

          // Query by clientId
          const results = await repo.listByClient(clientId);

          // Should return exactly N results
          expect(results).toHaveLength(n);

          // All inserted IDs should be present in results
          const resultIds = results.map((r) => r.id);
          for (const id of insertedIds) {
            expect(resultIds).toContain(id);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('listByProject returns exactly N results containing all inserted records', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUuid,
        fc.integer({ min: 1, max: 10 }),
        async (projectId, n) => {
          const repo = new InMemoryEmailHistoryRepository(createIdFactory('eh'));

          // Generate and insert N records all sharing the same projectId
          const insertedIds: string[] = [];
          for (let i = 0; i < n; i++) {
            const record: NewClientEmailHistory = {
              clientId: `client_${i}`,
              projectId,
              phaseId: null,
              recipientEmail: `user${i}@example.com`,
              subject: `Subject ${i}`,
              message: `Message ${i}`,
              sentBy: `sender_${i}`,
              sentAt: new Date(2024, 0, 1 + i).toISOString(),
              deliveryStatus: 'sent',
            };
            const created = await repo.create(record);
            insertedIds.push(created.id);
          }

          // Query by projectId
          const results = await repo.listByProject(projectId);

          // Should return exactly N results
          expect(results).toHaveLength(n);

          // All inserted IDs should be present in results
          const resultIds = results.map((r) => r.id);
          for (const id of insertedIds) {
            expect(resultIds).toContain(id);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('listByClient does not return records belonging to other clients', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(arbUuid, arbUuid).filter(([a, b]) => a !== b),
        arbUuid,
        arbNewEmailHistory(fc.constant('placeholder'), fc.constant('placeholder')),
        arbNewEmailHistory(fc.constant('placeholder'), fc.constant('placeholder')),
        async ([clientA, clientB], projectId, recordTemplateA, recordTemplateB) => {
          const repo = new InMemoryEmailHistoryRepository(createIdFactory('eh'));

          // Insert one record for clientA
          await repo.create({ ...recordTemplateA, clientId: clientA, projectId });

          // Insert one record for clientB
          await repo.create({ ...recordTemplateB, clientId: clientB, projectId });

          // listByClient for clientA returns only 1 record
          const resultsA = await repo.listByClient(clientA);
          expect(resultsA).toHaveLength(1);
          expect(resultsA[0]!.clientId).toBe(clientA);

          // listByClient for clientB returns only 1 record
          const resultsB = await repo.listByClient(clientB);
          expect(resultsB).toHaveLength(1);
          expect(resultsB[0]!.clientId).toBe(clientB);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('listByProject does not return records belonging to other projects', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUuid,
        fc.tuple(arbUuid, arbUuid).filter(([a, b]) => a !== b),
        arbNewEmailHistory(fc.constant('placeholder'), fc.constant('placeholder')),
        arbNewEmailHistory(fc.constant('placeholder'), fc.constant('placeholder')),
        async (clientId, [projectA, projectB], recordTemplateA, recordTemplateB) => {
          const repo = new InMemoryEmailHistoryRepository(createIdFactory('eh'));

          // Insert one record for projectA
          await repo.create({ ...recordTemplateA, clientId, projectId: projectA });

          // Insert one record for projectB
          await repo.create({ ...recordTemplateB, clientId, projectId: projectB });

          // listByProject for projectA returns only 1 record
          const resultsA = await repo.listByProject(projectA);
          expect(resultsA).toHaveLength(1);
          expect(resultsA[0]!.projectId).toBe(projectA);

          // listByProject for projectB returns only 1 record
          const resultsB = await repo.listByProject(projectB);
          expect(resultsB).toHaveLength(1);
          expect(resultsB[0]!.projectId).toBe(projectB);
        },
      ),
      { numRuns: 100 },
    );
  });
});
