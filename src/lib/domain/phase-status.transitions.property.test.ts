import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { ApprovalDecision, PhaseStatus } from '@/lib/domain/types';
import {
  nextStatusOnShare,
  nextStatusOnFirstAccess,
  nextStatusOnApproval,
} from '@/lib/domain/phase-status';

/**
 * Property-based test for phase status transitions (design Property 23).
 *
 * Exercises the three pure transition functions across all PhaseStatus values,
 * both ApprovalDecision values, and both hasApproval states. The property
 * verifies:
 *
 * - share → always yields 'Sent to Client' regardless of current status (R10.2)
 * - first access without approval → always yields 'Waiting for Feedback' (R10.3)
 * - first access with approval → retains the current status (R10.3)
 * - Approved decision → yields 'Approved' (R10.5)
 * - Changes Requested decision → yields 'Changes Requested' (R10.4)
 */

// Feature: client-sign-off-dashboard, Property 23: Phase status transitions

const allPhaseStatuses: PhaseStatus[] = [
  'Draft',
  'Sent to Client',
  'Waiting for Feedback',
  'Changes Requested',
  'Approved',
  'Completed',
];

const allApprovalDecisions: ApprovalDecision[] = ['Approved', 'Changes Requested'];

const phaseStatusArb = fc.constantFrom(...allPhaseStatuses);
const approvalDecisionArb = fc.constantFrom(...allApprovalDecisions);
const hasApprovalArb = fc.boolean();

describe('Phase status transitions (Property 23)', () => {
  // Feature: client-sign-off-dashboard, Property 23: Phase status transitions
  // Validates: Requirements 10.2, 10.3, 10.4, 10.5
  it('share → Sent to Client; first access w/o approval → Waiting for Feedback; Approved/Changes Requested decisions map correctly', () => {
    fc.assert(
      fc.property(
        phaseStatusArb,
        approvalDecisionArb,
        hasApprovalArb,
        (currentStatus, decision, hasApproval) => {
          // R10.2: Sharing always advances to 'Sent to Client'
          const shareResult = nextStatusOnShare(currentStatus);
          expect(shareResult).toBe('Sent to Client');

          // R10.3: First access behavior depends on hasApproval
          const firstAccessResult = nextStatusOnFirstAccess(currentStatus, hasApproval);
          if (!hasApproval) {
            // Without an existing approval, first access → 'Waiting for Feedback'
            expect(firstAccessResult).toBe('Waiting for Feedback');
          } else {
            // With an existing approval, status is retained unchanged
            expect(firstAccessResult).toBe(currentStatus);
          }

          // R10.4, R10.5: Approval decision maps to the corresponding status
          const approvalResult = nextStatusOnApproval(decision);
          if (decision === 'Approved') {
            expect(approvalResult).toBe('Approved');
          } else {
            expect(approvalResult).toBe('Changes Requested');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
