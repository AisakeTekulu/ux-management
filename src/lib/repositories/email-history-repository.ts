/**
 * Supabase-backed implementation of {@link EmailHistoryRepository}.
 *
 * Email history is append-only (immutable audit trail). Records are created
 * and queried but never updated or deleted.
 *
 * _Requirements: 8.1, 8.3, 8.4_
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { ClientEmailHistory, UUID } from '@/lib/domain/types';
import type {
  EmailHistoryRepository,
  NewClientEmailHistory,
} from '@/lib/repositories/interfaces';

// ---------------------------------------------------------------------------
// Row type & mapper
// ---------------------------------------------------------------------------

/** Database row shape for the `client_email_history` table. */
export interface EmailHistoryRow {
  id: string;
  client_id: string;
  project_id: string;
  phase_id: string | null;
  recipient_email: string;
  subject: string;
  message: string;
  sent_by: string;
  sent_at: string;
  delivery_status: string;
}

/** Map a database row to the domain `ClientEmailHistory` type. */
export function emailHistoryRowToDomain(row: EmailHistoryRow): ClientEmailHistory {
  return {
    id: row.id,
    clientId: row.client_id,
    projectId: row.project_id,
    phaseId: row.phase_id,
    recipientEmail: row.recipient_email,
    subject: row.subject,
    message: row.message,
    sentBy: row.sent_by,
    sentAt: row.sent_at,
    deliveryStatus: row.delivery_status as ClientEmailHistory['deliveryStatus'],
  };
}

// ---------------------------------------------------------------------------
// Repository implementation
// ---------------------------------------------------------------------------

export class SupabaseEmailHistoryRepository implements EmailHistoryRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(input: NewClientEmailHistory): Promise<ClientEmailHistory> {
    const result = await this.db
      .from('client_email_history')
      .insert({
        client_id: input.clientId,
        project_id: input.projectId,
        phase_id: input.phaseId,
        recipient_email: input.recipientEmail,
        subject: input.subject,
        message: input.message,
        sent_by: input.sentBy,
        sent_at: input.sentAt,
        delivery_status: input.deliveryStatus,
      })
      .select()
      .single();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] client_email_history.create: ${result.error.message}`,
      );
    }
    return emailHistoryRowToDomain(result.data as EmailHistoryRow);
  }

  async findById(id: UUID): Promise<ClientEmailHistory | null> {
    const result = await this.db
      .from('client_email_history')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] client_email_history.findById: ${result.error.message}`,
      );
    }
    return result.data ? emailHistoryRowToDomain(result.data as EmailHistoryRow) : null;
  }

  async listByClient(clientId: UUID, limit?: number): Promise<ClientEmailHistory[]> {
    let query = this.db
      .from('client_email_history')
      .select('*')
      .eq('client_id', clientId)
      .order('sent_at', { ascending: false });
    if (limit !== undefined) {
      query = query.limit(limit);
    }
    const result = await query;
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] client_email_history.listByClient: ${result.error.message}`,
      );
    }
    return (result.data as EmailHistoryRow[]).map(emailHistoryRowToDomain);
  }

  async listByProject(projectId: UUID, limit?: number): Promise<ClientEmailHistory[]> {
    let query = this.db
      .from('client_email_history')
      .select('*')
      .eq('project_id', projectId)
      .order('sent_at', { ascending: false });
    if (limit !== undefined) {
      query = query.limit(limit);
    }
    const result = await query;
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] client_email_history.listByProject: ${result.error.message}`,
      );
    }
    return (result.data as EmailHistoryRow[]).map(emailHistoryRowToDomain);
  }

  async countByClient(clientId: UUID): Promise<number> {
    const result = await this.db
      .from('client_email_history')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId);
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] client_email_history.countByClient: ${result.error.message}`,
      );
    }
    return result.count ?? 0;
  }

  async lastSentForClientProject(
    clientId: UUID,
    projectId: UUID,
  ): Promise<ClientEmailHistory | null> {
    const result = await this.db
      .from('client_email_history')
      .select('*')
      .eq('client_id', clientId)
      .eq('project_id', projectId)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] client_email_history.lastSentForClientProject: ${result.error.message}`,
      );
    }
    return result.data ? emailHistoryRowToDomain(result.data as EmailHistoryRow) : null;
  }
}
