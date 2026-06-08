import { describe, expect, it } from 'vitest';

import {
  OVERDUE_BADGE,
  STATUS_PRESENTATION,
  getStatusPresentation,
  type StatusBadgeKey,
} from '@/lib/domain/status-presentation';
import type { PhaseStatus } from '@/lib/domain/types';

/**
 * Unit tests for the status presentation map. These cover concrete labels,
 * color tokens, totality, and pairwise distinctness. Property 36 is implemented
 * separately in task 10.14.
 */

const WORKFLOW_STATUSES: PhaseStatus[] = [
  'Draft',
  'Sent to Client',
  'Waiting for Feedback',
  'Changes Requested',
  'Approved',
  'Completed',
];

const ALL_KEYS: StatusBadgeKey[] = [...WORKFLOW_STATUSES, OVERDUE_BADGE];

describe('STATUS_PRESENTATION', () => {
  it('maps every status (incl. derived Overdue) to the design label/color', () => {
    expect(getStatusPresentation('Draft')).toMatchObject({
      label: 'Draft',
      colorToken: 'grey',
      colorClass: 'status-grey',
    });
    expect(getStatusPresentation('Sent to Client')).toMatchObject({
      label: 'Sent to Client',
      colorToken: 'blue',
    });
    expect(getStatusPresentation('Waiting for Feedback')).toMatchObject({
      label: 'Waiting for Feedback',
      colorToken: 'indigo',
    });
    expect(getStatusPresentation('Changes Requested')).toMatchObject({
      label: 'Changes Requested',
      colorToken: 'amber',
    });
    expect(getStatusPresentation('Approved')).toMatchObject({
      label: 'Approved',
      colorToken: 'green',
    });
    expect(getStatusPresentation('Completed')).toMatchObject({
      label: 'Completed',
      colorToken: 'teal',
    });
    expect(getStatusPresentation(OVERDUE_BADGE)).toMatchObject({
      label: 'Overdue',
      colorToken: 'red',
    });
  });

  it('is total over all seven presentable statuses', () => {
    for (const key of ALL_KEYS) {
      expect(STATUS_PRESENTATION[key]).toBeDefined();
      expect(STATUS_PRESENTATION[key].label.length).toBeGreaterThan(0);
    }
    expect(Object.keys(STATUS_PRESENTATION)).toHaveLength(ALL_KEYS.length);
  });

  it('is deterministic across repeated lookups', () => {
    for (const key of ALL_KEYS) {
      expect(getStatusPresentation(key)).toEqual(getStatusPresentation(key));
    }
  });

  it('assigns pairwise-distinct color tokens and classes', () => {
    const tokens = ALL_KEYS.map((k) => STATUS_PRESENTATION[k].colorToken);
    const classes = ALL_KEYS.map((k) => STATUS_PRESENTATION[k].colorClass);
    expect(new Set(tokens).size).toBe(ALL_KEYS.length);
    expect(new Set(classes).size).toBe(ALL_KEYS.length);
  });
});
