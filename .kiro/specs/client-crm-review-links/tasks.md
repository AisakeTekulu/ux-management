# Implementation Plan: Client CRM & Review Links

## Overview

This plan implements the Client CRM profile extension and review link email delivery workflow. Work proceeds in dependency order: database migration first, then domain layer pure functions (validated by property-based tests), repository layer, server actions, and finally UI components. The architecture follows the project's established layered pattern with TypeScript throughout.

Sub-tasks marked with `*` are optional test tasks that can be skipped for a faster MVP; core implementation sub-tasks are never optional.

## Tasks

- [x] 1. Database schema migration
  - [x] 1.1 Create migration to extend clients table with CRM fields
    - Add columns: full_name (text), business_name (text), primary_email (text), secondary_email (text), phone (text), website (text), location (text), preferred_contact_method (text, default 'email', CHECK constraint), notes (text, CHECK char_length <= 5000)
    - All new columns are nullable except preferred_contact_method which defaults to 'email'
    - Place migration file in `supabase/migrations/` with appropriate timestamp
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 11.1_

  - [x] 1.2 Create migration for client_email_history table
    - Create table with columns: id (uuid PK), client_id (uuid FK to clients ON DELETE CASCADE), project_id (uuid FK to projects ON DELETE CASCADE), phase_id (uuid FK to phases ON DELETE SET NULL), recipient_email (text NOT NULL), subject (text NOT NULL), message (text NOT NULL), sent_by (uuid FK to users ON DELETE CASCADE), sent_at (timestamptz NOT NULL DEFAULT now()), delivery_status (text NOT NULL DEFAULT 'sent', CHECK IN ('sent','failed','pending'))
    - Create indexes: idx_email_history_client (client_id), idx_email_history_project (project_id), idx_email_history_sent_at (sent_at DESC)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 11.2, 11.3, 11.4_

  - [x] 1.3 Create migration for RLS policies on client_email_history
    - Enable RLS on client_email_history
    - Create policy "Users can manage email history for their own clients" scoped to sent_by = auth.uid() OR owner_id of related client = auth.uid()
    - _Requirements: 8.5, 11.3_

  - [x] 1.4 Add 'review_link_sent' to activity_logs type CHECK constraint
    - Alter the existing CHECK constraint on activity_logs.type to include 'review_link_sent'
    - _Requirements: 7.1, 7.2_

- [x] 2. Implement domain layer types and pure functions
  - [x] 2.1 Extend domain types with CRM and email history interfaces
    - Add `PreferredContactMethod` type, CRM fields to `Client` interface, `EmailDeliveryStatus` type, `ClientEmailHistory` interface, and `'review_link_sent'` to `ActivityType` union in `src/lib/domain/types.ts`
    - Add `ClientCRMInput`, `EmailTemplateContext`, `EmailTemplate`, `SendReviewLinkInput`, `SendReviewLinkResult`, `ReviewLinkModalContext` types
    - _Requirements: 1.1, 1.2, 1.5, 8.1_

  - [x] 2.2 Implement client CRM validation functions
    - Create `src/lib/domain/client-crm.ts` with: `validateEmailFormat`, `validateClientFields`, `canSendReviewLink`, `generateEmailTemplate`, `generateEmailSubject`
    - `validateEmailFormat`: accepts strings with exactly one `@`, non-empty local part, domain with at least one dot
    - `validateClientFields`: validates all CRM fields including email format, preferred_contact_method enum, notes length
    - `canSendReviewLink`: returns error for archived clients, ok for active clients
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 10.1, 10.5_

  - [x] 2.3 Implement email template generation functions
    - `generateEmailTemplate`: produces email body with personalized greeting (client fullName), project name, phase name (when provided), review URL as link, admin name sign-off, and custom message when provided
    - `generateEmailSubject`: produces subject containing project name and phase name when provided
    - Implement email-differs detection logic (case-insensitive comparison)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 4.6, 13.5_

  - [x] 2.4 Write property test: Client profile data round-trip (Property 1)
    - **Property 1: Client profile data round-trip**
    - For any valid client profile data, persisting via repository and reading back should produce identical record
    - **Validates: Requirements 1.1**

  - [x] 2.5 Write property test: Email validation correctness (Property 2)
    - **Property 2: Email validation correctness**
    - For any string, `validateEmailFormat` should accept iff it contains exactly one `@`, non-empty local part, and domain with at least one dot
    - **Validates: Requirements 1.3, 1.4**

  - [x] 2.6 Write property test: Preferred contact method enum enforcement (Property 3)
    - **Property 3: Preferred contact method enum enforcement**
    - For any string, `validateClientFields` should accept as preferredContactMethod iff it is 'email', 'phone', or 'other'
    - **Validates: Requirements 1.5**

  - [x] 2.7 Write property test: Notes length boundary (Property 4)
    - **Property 4: Notes length boundary**
    - For any string as notes, reject if char_length > 5000, accept otherwise (including null)
    - **Validates: Requirements 1.6**

  - [x] 2.8 Write property test: Email template includes all input data (Property 5)
    - **Property 5: Email template includes all input data**
    - For any valid EmailTemplateInput, output contains clientFullName in greeting, projectName, reviewUrl as link, adminName in sign-off, customMessage when provided, phaseName when provided
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

  - [x] 2.9 Write property test: Default subject generation (Property 6)
    - **Property 6: Default subject generation contains project and phase context**
    - For any projectName and optional phaseName, subject contains projectName; when phaseName provided, subject also contains phaseName
    - **Validates: Requirements 4.6**

  - [x] 2.10 Write property test: Review URL contains token (Property 7)
    - **Property 7: Review URL contains token**
    - For any share link token (≥ 32 URL-safe chars), constructed review URL contains that token and is a valid URL path
    - **Validates: Requirements 4.7**

  - [x] 2.11 Write property test: Archived client lifecycle guard (Property 10)
    - **Property 10: Archived client lifecycle guard round-trip**
    - For any client with status 'archived', `canSendReviewLink` returns error; after restoring to 'active', returns ok
    - **Validates: Requirements 10.1, 10.5**

  - [x] 2.12 Write property test: Email-differs notice detection (Property 13)
    - **Property 13: Email-differs notice detection**
    - For any pair of email strings, difference notice shown iff entered email is not equal (case-insensitive) to client's primary email
    - **Validates: Requirements 13.5**

- [x] 3. Checkpoint - domain layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement repository layer
  - [x] 4.1 Define EmailHistoryRepository interface
    - Add to `src/lib/repositories/interfaces.ts`: `EmailHistoryRepository` with methods `create`, `findById`, `listByClient`, `listByProject`, `countByClient`, `lastSentForClientProject`
    - Add `ClientPatch` type extending with CRM fields
    - Add `NewClientEmailHistory` type (Omit<ClientEmailHistory, 'id'>)
    - _Requirements: 8.1, 8.3, 8.4_

  - [x] 4.2 Extend ClientRepository with CRM update support
    - Update the existing Supabase client repository to handle the new CRM columns
    - Ensure `update` method accepts `ClientPatch` including all CRM fields
    - Map between snake_case DB columns and camelCase domain types for new fields
    - _Requirements: 1.1, 1.2_

  - [x] 4.3 Implement Supabase EmailHistoryRepository
    - Create `src/lib/repositories/email-history-repository.ts`
    - Implement all interface methods with proper column mapping
    - `listByClient` and `listByProject` return results ordered by sent_at DESC
    - _Requirements: 8.1, 8.3, 8.4_

  - [x] 4.4 Write property test: Email history storage round-trip (Property 8)
    - **Property 8: Email history storage round-trip**
    - For any valid NewClientEmailHistory record, creating via repository and reading by ID should produce record with all fields preserved
    - **Validates: Requirements 7.2, 8.1**

  - [x] 4.5 Write property test: Email history query completeness (Property 9)
    - **Property 9: Email history query completeness**
    - For any set of N entries for a clientId/projectId, listByClient/listByProject returns exactly N results containing all inserted records
    - **Validates: Requirements 8.3, 8.4**

- [x] 5. Implement server actions
  - [x] 5.1 Implement updateClientProfile server action
    - Create `src/lib/actions/client-profile.ts`
    - Validate fields using `validateClientFields`, update via ClientRepository
    - Return `Result<Client, AppError | ValidationError>`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 5.2 Implement getClientProfileDetail server action
    - Fetch extended client detail with CRM fields, linked projects, email history, and activity log
    - Return `ClientProfileDetailData | null`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.4_

  - [x] 5.3 Implement getReviewLinkModalContext server action
    - Create `src/lib/actions/review-links.ts`
    - Fetch client, project, phase, email history for the given project/phase
    - Auto-fill recipient email from client.primaryEmail, client name from client.fullName
    - Generate default email subject from project/phase names
    - Include last sent date and total sent count
    - _Requirements: 3.3, 4.4, 4.5, 4.6, 13.1, 13.2, 13.3, 13.4_

  - [x] 5.4 Implement sendReviewLink server action
    - Validate recipient email format, check `canSendReviewLink` guard
    - Generate share link (reuse existing `generateShareLink`)
    - Generate email template
    - Create email history record
    - Create activity log entry with type 'review_link_sent'
    - Conditionally update client primaryEmail if `saveEmailToProfile` is true
    - Return `Result<SendReviewLinkResult, AppError>`
    - _Requirements: 4.1, 5.5, 7.1, 7.2, 7.3, 9.4, 10.1_

  - [x] 5.5 Write property test: Conditional email profile update (Property 11)
    - **Property 11: Conditional email profile update**
    - When saveEmailToProfile is true and email differs, client primaryEmail updates; when false, remains unchanged
    - **Validates: Requirements 5.5, 9.4**

  - [x] 5.6 Write property test: Auto-fill inheritance (Property 12)
    - **Property 12: Auto-fill inheritance from client to project context**
    - For any client with non-null primaryEmail and fullName, auto-filled recipientEmail equals client primaryEmail and clientName equals client fullName
    - **Validates: Requirements 3.3, 4.4, 4.5**

- [x] 6. Checkpoint - server actions and repository layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Build UI components
  - [x] 7.1 Create SendReviewLinkModal component
    - Create `src/components/review-link/SendReviewLinkModal.tsx`
    - Modal with title "Send Review Link"
    - Fields: Client Name (read-only), Recipient Email (editable), CC Email (optional), Email Subject (editable), Custom Message (textarea), Review Link Preview (with copy button)
    - "Save changed email to client profile" checkbox (shown when email differs from client record)
    - Context display: project name, phase name, last sent date, total sent count, email-differs notice
    - Actions: Cancel, Copy Review Link, Send Test Email, Send Review Link
    - Disable "Send Review Link" when no valid email present
    - Show warning banner when client has no primaryEmail
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 9.1, 9.2, 9.3, 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 7.2 Create EmailPreview component
    - Create `src/components/review-link/EmailPreview.tsx`
    - Collapsible panel showing formatted email template as client will receive it
    - Clean, readable format with greeting, project context, review link, and sign-off
    - _Requirements: 5.8, 6.6_

  - [x] 7.3 Integrate SendReviewLinkModal into project detail page
    - Update `src/app/(admin)/projects/[id]/page.tsx` to open SendReviewLinkModal when "Send to Client" is clicked (instead of immediately generating share link)
    - Wire modal to `getReviewLinkModalContext` and `sendReviewLink` actions
    - Show success toast on send, error toast on failure
    - _Requirements: 4.1, 7.3, 12.4, 12.5_

  - [x] 7.4 Write unit tests for SendReviewLinkModal
    - Test auto-fill with known client data
    - Test field editability
    - Test disabled send button when no valid email
    - Test email-differs notice display
    - Test success/error toast display
    - _Requirements: 4.4, 4.5, 5.1, 9.1, 9.2, 13.5_

- [x] 8. Build enhanced client profile page
  - [x] 8.1 Create ContactInfoCard component
    - Create `src/components/client/ContactInfoCard.tsx`
    - Editable card showing: primary email, secondary email, phone, website, location, preferred contact method
    - Inline editing with validation feedback
    - _Requirements: 2.1, 12.1_

  - [x] 8.2 Create EmailHistoryTable component
    - Create `src/components/email-history/EmailHistoryTable.tsx`
    - IndexTable showing: date sent, project name, subject, recipient, delivery status badge
    - Ordered by sent_at DESC
    - Empty state when no emails sent
    - _Requirements: 7.4, 7.5, 8.3, 8.4, 12.2, 12.6_

  - [x] 8.3 Restructure client detail page into card sections
    - Update `src/app/(admin)/clients/[id]/page.tsx` to use card-based layout
    - Sections: Overview Card (name, business, status badge, created date), Contact Information Card (ContactInfoCard component), Projects Card (IndexTable of linked projects), Sign-offs Card (pending count, approval history), Email History Card (EmailHistoryTable component), Notes Card (editable textarea, 5000 char limit), Activity Log Card (chronological feed)
    - Each section shows appropriate empty state when no data
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 8.4 Wire client profile page to server actions
    - Connect ContactInfoCard to `updateClientProfile` action
    - Connect page data loading to `getClientProfileDetail` action
    - Display success/error toasts on profile updates
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 12.4_

  - [x] 8.5 Write unit tests for client profile page sections
    - Test empty state rendering for each section
    - Test edit flow for contact information
    - Test notes character limit enforcement
    - Test email history table rendering
    - _Requirements: 2.6, 1.6, 8.3_

- [x] 9. Implement archived client restrictions
  - [x] 9.1 Add archived client guards to UI and actions
    - In SendReviewLinkModal: check client status before allowing send, show Banner explaining blocked action for archived clients
    - In sendReviewLink action: enforce `canSendReviewLink` guard returning error for archived clients
    - Ensure archived clients still appear in historical records (email history, approval records)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 9.2 Write unit tests for archived client restrictions
    - Test modal shows blocked state for archived client
    - Test server action rejects send for archived client
    - Test historical data remains visible for archived clients
    - _Requirements: 10.1, 10.4, 10.5_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all implementation uses TypeScript
- Email sending is v1 mailto/clipboard-based; actual SMTP delivery is out of scope
- All CRM fields are nullable for backward compatibility with existing client records

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3"] },
    { "id": 4, "tasks": ["2.4", "2.5", "2.6", "2.7", "2.8", "2.9", "2.10", "2.11", "2.12"] },
    { "id": 5, "tasks": ["4.1"] },
    { "id": 6, "tasks": ["4.2", "4.3"] },
    { "id": 7, "tasks": ["4.4", "4.5"] },
    { "id": 8, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 9, "tasks": ["5.4"] },
    { "id": 10, "tasks": ["5.5", "5.6"] },
    { "id": 11, "tasks": ["7.1", "7.2", "8.1", "8.2"] },
    { "id": 12, "tasks": ["7.3", "8.3"] },
    { "id": 13, "tasks": ["8.4", "9.1"] },
    { "id": 14, "tasks": ["7.4", "8.5", "9.2"] }
  ]
}
```
