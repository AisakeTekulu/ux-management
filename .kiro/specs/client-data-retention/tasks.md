# Implementation Plan: Client Data Retention

## Overview

This plan implements a tiered client lifecycle management system with Archive, Delete Profile, and Permanent Delete operations. The implementation follows the existing layered architecture (Domain → Application → Persistence → UI) and introduces status filtering, immutability enforcement at both domain and database layers, and a tiered confirmation UX with increasing friction for destructive operations.

## Tasks

- [x] 1. Database migration and domain type extensions
  - [x] 1.1 Create Supabase migration for client status and approval immutability
    - Create migration file at `supabase/migrations/20260601194217_client_data_retention.sql`
    - Add `client_status` enum type with values `'active'` and `'archived'`
    - Add `status` column to `clients` table with default `'active'`
    - Add `deleted_at` timestamptz column to `clients` table (nullable)
    - Create composite index `clients_owner_status` on `(owner_id, status)`
    - Create `prevent_approval_mutation()` trigger function
    - Create `approvals_immutable` BEFORE UPDATE OR DELETE trigger on `approvals`
    - _Requirements: 1.1, 1.2, 7.1, 7.4_

  - [x] 1.2 Extend domain types with ClientStatus and updated Client interface
    - Add `ClientStatus = 'active' | 'archived'` type to `src/lib/domain/types.ts`
    - Add `status: ClientStatus` field to the `Client` interface
    - Add `deletedAt: ISOTimestamp | null` field to the `Client` interface
    - _Requirements: 1.1, 1.2_

  - [x] 1.3 Create client-lifecycle domain module
    - Create `src/lib/domain/client-lifecycle.ts`
    - Implement `validateStatusTransition(current, target)` with valid transitions: active→archived, archived→active
    - Implement `canDeleteProfile(client)` guard (rejects if `deletedAt` is non-null)
    - Implement `canCreateShareLink(client)` guard (rejects archived or profile-deleted clients)
    - Implement `rejectApprovalMutation()` guard
    - Implement `validateDeleteConfirmation(clientName, typedName)` with exact case-sensitive match
    - All functions return `Result<T, AppError>` using existing result.ts pattern
    - _Requirements: 3.1, 3.4, 4.1, 5.1, 6.3, 7.4_

- [ ] 2. Property tests for domain logic
  - [ ]* 2.1 Write property test: New clients default to active status
    - **Property 1: New clients default to active status**
    - **Validates: Requirements 1.1, 1.2**
    - Create `src/lib/domain/client-lifecycle.default-status.property.test.ts`
    - Generate random valid client names (1–100 chars) and verify status defaults to `'active'` and `deletedAt` is `null`

  - [ ]* 2.2 Write property test: Status transition validity
    - **Property 10: Status transition validity**
    - **Validates: Requirements 3.1, 4.1**
    - Create `src/lib/domain/client-lifecycle.transitions.property.test.ts`
    - Generate all pairs of statuses, assert `validateStatusTransition` succeeds only for {active→archived, archived→active}

  - [ ]* 2.3 Write property test: Approval record immutability
    - **Property 7: Approval record immutability**
    - **Validates: Requirements 7.1, 7.3, 7.4**
    - Create `src/lib/domain/client-lifecycle.immutability.property.test.ts`
    - Generate random mutation payloads and assert `rejectApprovalMutation()` always returns an error

  - [ ]* 2.4 Write property test: Permanent delete name confirmation
    - **Property 8: Permanent delete name confirmation**
    - **Validates: Requirements 6.3**
    - Create `src/lib/domain/client-lifecycle.confirmation.property.test.ts`
    - Generate random name pairs; assert success iff typed matches client name exactly (case-sensitive)

  - [ ]* 2.5 Write property test: Archived clients block share link creation
    - **Property 4: Archived clients block share link creation**
    - **Validates: Requirements 3.4**
    - Create `src/lib/domain/client-lifecycle.sharelink.property.test.ts`
    - Generate archived clients, assert `canCreateShareLink` returns a forbidden error

- [x] 3. Checkpoint - Domain layer verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Repository layer extensions
  - [x] 4.1 Extend repository interfaces for client lifecycle
    - Update `ClientPatch` in `src/lib/repositories/interfaces.ts` to include `status` and `deletedAt`
    - Add `listByOwner(ownerId, filter?: { status?: ClientStatus })` overload with filter parameter
    - Add `deleteProfile(id: UUID): Promise<Client | null>` method to `ClientRepository`
    - Add `revokeByClient(clientId: UUID): Promise<number>` method to `ShareLinkRepository`
    - _Requirements: 2.2, 2.3, 2.4, 5.1, 5.2_

  - [x] 4.2 Implement Supabase repository methods for client lifecycle
    - Extend `src/lib/repositories/supabase.ts` with status-filtered `listByOwner`
    - Implement `deleteProfile` — nulls name, sets `deleted_at` to current timestamp
    - Implement `revokeByClient` — updates `revoked_at` on all active share links for the client's projects
    - _Requirements: 2.2, 2.3, 5.1, 5.2_

  - [x] 4.3 Implement in-memory repository methods for client lifecycle
    - Extend `src/lib/repositories/in-memory.ts` with matching methods for testing
    - Add status filtering to `listByOwner`
    - Implement `deleteProfile` and `revokeByClient` for in-memory store
    - _Requirements: 2.2, 2.3, 5.1, 5.2_

- [ ] 5. Property tests for repository/filter logic
  - [ ]* 5.1 Write property test: Client filter correctness
    - **Property 2: Client filter correctness**
    - **Validates: Requirements 2.2, 2.3, 2.4**
    - Create `src/lib/domain/client-lifecycle.filter.property.test.ts`
    - Generate lists of clients with mixed statuses, apply each filter, assert exact match

  - [ ]* 5.2 Write property test: Delete profile preserves project history
    - **Property 5: Delete profile preserves project history**
    - **Validates: Requirements 5.1, 5.3, 5.4, 5.5**
    - Create `src/lib/domain/client-lifecycle.preserve.property.test.ts`
    - Generate client with associated records, execute delete-profile, assert record counts unchanged and `deletedAt` set

  - [ ]* 5.3 Write property test: Delete profile revokes all share links
    - **Property 6: Delete profile revokes all share links**
    - **Validates: Requirements 5.2**
    - Create `src/lib/domain/client-lifecycle.revoke.property.test.ts`
    - Generate client with active share links, delete profile, assert all share links have `revokedAt` set

- [x] 6. Checkpoint - Repository layer verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Server actions for client lifecycle
  - [x] 7.1 Implement archiveClient and restoreClient server actions
    - Create `src/lib/actions/client-lifecycle.ts`
    - Implement `archiveClient(id)`: authenticate, load client, validate transition to 'archived', update status
    - Implement `restoreClient(id)`: authenticate, load client, validate transition to 'active', update status
    - Both return `Result<Client, AppError>`
    - _Requirements: 3.1, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 7.2 Implement deleteClientProfile server action
    - Add `deleteClientProfile(id)` to `src/lib/actions/client-lifecycle.ts`
    - Authenticate, load client, run `canDeleteProfile` guard
    - Call `repos.clients.deleteProfile(id)` to null name and set `deletedAt`
    - Call `repos.shareLinks.revokeByClient(id)` to revoke all active share links
    - Return `Result<void, AppError>`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 7.3 Implement permanentDeleteClient server action
    - Add `permanentDeleteClient(id, confirmation)` to `src/lib/actions/client-lifecycle.ts`
    - Authenticate, load client, run `validateDeleteConfirmation(client.name, confirmation)`
    - Call `repos.clients.delete(id)` which cascades to all associated data
    - Return `Result<void, AppError>`
    - _Requirements: 6.2, 6.3, 6.5_

- [ ] 8. Property tests for archive-restore and permanent delete
  - [ ]* 8.1 Write property test: Archive–Restore round trip
    - **Property 3: Archive–Restore round trip**
    - **Validates: Requirements 3.1, 3.5, 4.1, 4.5**
    - Create `src/lib/domain/client-lifecycle.roundtrip.property.test.ts`
    - Generate active client with project history, archive then restore, assert status returns to 'active' and all associated data unchanged

  - [ ]* 8.2 Write property test: Permanent delete cascades completely
    - **Property 9: Permanent delete cascades completely**
    - **Validates: Requirements 6.5**
    - Create `src/lib/domain/client-lifecycle.cascade.property.test.ts`
    - Generate client with full data tree, permanent delete, assert zero remaining records for that client ID

- [x] 9. Checkpoint - Server actions verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. UI: Client list filtering
  - [x] 10.1 Implement client status filter component and update clients list page
    - Create filter tabs/buttons in `src/app/(admin)/clients/page.tsx` for "All Clients", "Active Clients", "Archived Clients"
    - Default to "Active Clients" filter on initial page load
    - Update `getClientsPageData` action in `src/app/(admin)/clients/actions.ts` to accept and pass status filter
    - Display `ClientStatus` badge on each client row
    - Style active filter with primary colour, inactive with subdued styling
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 1.3_

- [x] 11. UI: Client detail lifecycle actions
  - [x] 11.1 Implement archive and restore actions on client detail page
    - Add "Archive Client" primary action button on client detail view
    - Add "Restore Client" button (visible only when client is archived)
    - Create archive confirmation modal with warning banner describing effects
    - Wire archive/restore buttons to `archiveClient`/`restoreClient` server actions
    - Show success toast and refresh client data on completion
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 8.1, 8.4_

  - [x] 11.2 Implement delete profile action with confirmation modal
    - Add "Delete Client Profile" in secondary action menu
    - Create confirmation modal listing preserved data (projects, approvals, comments) and removed data (contact info, share links)
    - Wire to `deleteClientProfile` server action
    - Display "Deleted Client" label on associated projects post-deletion
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 8.2, 8.5_

  - [x] 11.3 Implement permanent delete with multi-step confirmation flow
    - Place "Permanently Delete Client" in a visually distinct Danger Zone section
    - Step 1: Password confirmation input
    - Step 2: Type full client name for confirmation
    - Step 3: Final destructive-action confirmation modal stating irreversible data destruction
    - Style with red colour indicators and warning iconography (Shopify Polaris danger patterns)
    - Wire to `permanentDeleteClient` server action
    - Never display as a primary button or in prominent position
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 8.3, 8.6, 8.7_

- [x] 12. Integration: Wire share link creation guard
  - [x] 12.1 Add share link creation guard to existing share link action
    - Update `src/lib/actions/share-links.ts` to load the client for the project
    - Call `canCreateShareLink(client)` before creating a new share link
    - Return appropriate error if client is archived or profile-deleted
    - _Requirements: 3.4, 4.4_

- [x] 13. Final checkpoint - All features integrated
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The migration adds an immutability trigger at the database level as a defence-in-depth measure alongside the domain guard
- All server actions follow the existing `Result<T, AppError>` pattern from `src/lib/domain/result.ts`
- The in-memory repository implementation enables isolated testing without Supabase

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3"] },
    { "id": 2, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3"] },
    { "id": 4, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 5, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 6, "tasks": ["8.1", "8.2"] },
    { "id": 7, "tasks": ["10.1", "12.1"] },
    { "id": 8, "tasks": ["11.1", "11.2"] },
    { "id": 9, "tasks": ["11.3"] }
  ]
}
```
