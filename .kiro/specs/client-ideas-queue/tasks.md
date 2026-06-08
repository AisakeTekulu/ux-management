# Implementation Plan: Client Ideas Queue

## Overview

This plan converts the design into incremental, test-driven coding steps that **extend the existing Client Sign-Off Dashboard** rather than build a new system. The feature reuses the base product verbatim wherever possible: the same Next.js (App Router) + TypeScript (strict) + Tailwind + Supabase project, the pure domain/service layer, the Supabase persistence + RLS "owner-via-parent" pattern, the server-only service-role client for the public portal path, the `Result<T, E>` discipline, Server Actions for admin mutations and Route Handlers for the public path/uploads, the append-only `activity_logs` table, the existing `users`/`clients`/`projects`/`phases`/`tasks`/`share_links` entities, and the Polaris-inspired component library (`AppShell`/`Sidebar`, `PageHeader`, `Card`, `IndexTable`, `StatusBadge`, `EmptyState`, `Toast`, `Modal`, `Banner`, `Timeline`, `Filters`/`Tabs`, and the `ReviewLayout` portal shell).

Work proceeds in dependency order: extend the shared types, then the database migration (extend `share_links` and `activity_logs`, then add the four new tables plus the `idea_task_links` join table), then RLS + Storage + the atomic submission RPC, then the pure idea domain layer validated by property-based tests, then the Supabase repositories/fakes and the email/storage adapters, then the public Route Handlers, then the admin Server Actions, and finally the UI composed from the existing component library plus end-to-end wiring.

The idea domain layer is pure and has **no Supabase imports**, so its 37 correctness properties are implemented as `fast-check` + Vitest property tests against in-memory data. Each property is its own sub-task, runs a minimum of 100 iterations, and carries the required tag comment `// Feature: client-ideas-queue, Property {number}: {property_text}`. Infrastructure concerns (FK/cascade, transactional rollback, RLS, Storage, email retry), UI rendering, and responsiveness use unit, component, integration, smoke, and visual tests as specified by the design's Testing Strategy.

Sub-tasks marked with `*` are optional test tasks that can be skipped for a faster MVP; core implementation sub-tasks are never optional.

## Tasks

- [ ] 1. Extend shared domain types for ideas
  - [ ] 1.1 Add idea domain TypeScript types and enums
    - Add `IdeaType`, `IdeaPriority`, `IdeaStatus`, and `MeetingOutcome` union types and the `IdeaSubmission`, `IdeaAttachment`, `IdeaComment`, `IdeaStatusHistory`, `IdeaTaskLink`, `IdeaFilter`, and `IdeaRow` interfaces alongside the existing base domain types
    - Reuse the base `Result<T, E>`, `ValidationError`, `AppError`, `ShareLink`, `Task`, `Project`, and `Phase` types without redefining them; extend the base `ShareLink` scope to include `'idea'`
    - _Requirements: 17.1, 17.2_

- [ ] 2. Create the database migration (extend base tables, add idea tables)
  - [ ] 2.1 Migration: extend `share_links` scope and `activity_logs` event types
    - Replace the `share_links` scope check to add `'idea'` and add a scope-shape check so idea links are project-scoped (`project_id` set, `phase_id` null), reusing the existing token/uniqueness/revocation mechanism
    - Replace the `activity_logs` type check to add `'idea_submitted'` and `'idea_status_changed'`, keeping the table append-only
    - _Requirements: 15.1, 15.2, 16.1, 16.2_

  - [ ] 2.2 Migration: create `idea_submissions` table
    - Create `idea_submissions` with FKs to `projects` (cascade), `clients` (cascade), `share_links` (set null), and `phases` (set null); `check` constraints for trimmed name (1–100), email (1–254), title (1–200), details (1–5000), `related_page_url` (≤2048), `inspiration_links` jsonb array (≤10), `type`/`priority`/`status`/`meeting_outcome` enum membership; `created_at`/`updated_at` UTC defaults
    - Add the indexes `(project_id, created_at desc, id desc)`, `(client_id)`, `(status)`, and the partial index on `discuss_next_meeting`
    - _Requirements: 5.1, 5.2, 9.1, 17.1, 17.2, 17.3, 17.5_

  - [ ] 2.3 Migration: create idea child tables and the `idea_task_links` join table
    - Create `idea_attachments` (FK cascade to `idea_submissions`, allow-listed `mime_type` check, `file_size_bytes` 1–26214400 check, `file_name` 1–255 check), `idea_comments` (FK cascade, FK to `users`, trimmed `text` 1–5000 check), and `idea_status_history` (FK cascade, nullable `previous_status`, `new_status`, nullable `changed_by_user_id`)
    - Create `idea_task_links` joining an idea to a base `tasks` row with a **unique** constraint on `idea_submission_id` (idempotent one-task-per-idea) and cascade deletes on both FKs; add per-table indexes
    - _Requirements: 10.3, 14.5, 14.6, 17.1, 17.4, 17.6_

  - [ ]* 2.4 Write integration tests for FK enforcement, constraints, and cascade delete
    - Verify inserting any idea child with a missing parent is rejected, enum/length/size `check` violations are rejected, and the `idea_task_links` unique constraint blocks a second task for the same idea
    - Verify deleting an `idea_submissions` row (and a parent `projects`/`clients` row) cascades to attachments, comments, status history, and task links
    - _Requirements: 17.3, 17.4, 17.5, 17.6, 17.9, 10.5, 14.6_

  - [ ]* 2.5 Write smoke test for idea schema presence
    - Assert the four new tables, the `idea_task_links` join table, the extended `share_links`/`activity_logs` checks, and the new indexes exist after the migration applies
    - _Requirements: 17.1_

- [ ] 3. Implement RLS, Storage isolation, and the atomic submission RPC
  - [ ] 3.1 Add owner-via-parent RLS policies on the four new tables
    - Enable RLS and add an owner policy on `idea_submissions` (project owner via `auth.uid()`) and owner-via-parent policies on `idea_attachments`, `idea_comments`, and `idea_status_history`, mirroring the base product's RLS pattern; `activity_logs` stays append-only (no UPDATE/DELETE), so idea audit entries are immutable
    - _Requirements: 8.8, 15.4, 16.5, 16.6_

  - [ ] 3.2 Configure the private owner-scoped attachment Storage bucket and path
    - Create/configure a private Supabase Storage bucket for idea attachments, written under the owner-scoped prefix `ideas/{ownerId}/{ideaId}/{fileName}`, retrievable only via short-lived signed URLs minted server-side after the ownership check
    - _Requirements: 16.7, 16.8_

  - [ ] 3.3 Implement the `create_idea_submission` Postgres RPC
    - Implement an RPC that inserts the `idea_submissions` row, its initial `idea_status_history` row (`previous_status` null, `new_status` 'New', `changed_by_user_id` null), and the confirmed attachment rows inside a single transaction so the submission and history are all-or-nothing
    - _Requirements: 5.1, 5.3, 5.7, 17.7_

  - [ ]* 3.4 Write integration tests for RLS isolation and RPC atomicity
    - Verify a Designer cannot read or mutate another Designer's idea rows, that attachment retrieval is denied to non-owners, and that a forced failure inside `create_idea_submission` rolls back leaving no submission, history, or attachment rows
    - _Requirements: 5.7, 8.8, 16.6, 16.8, 17.7_

- [ ] 4. Checkpoint - schema, security, and storage
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement idea field validators (pure domain)
  - [ ] 5.1 Implement the idea field validators module
    - Implement `validateSubmitterName`, `validateSubmitterEmail`, `validateIdeaTitle`, `validateIdeaDetails`, `isIdeaType`, `isIdeaPriority`, `validateOptionalUrl`, `validateInspirationLinks`, and the aggregate `validateIdeaSubmission`, each returning a `Result` and never mutating inputs on rejection; aggregate reports every violating field
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [ ]* 5.2 Write property test for submitter name validation
    - **Property 1: Submitter name validation** — accept iff trimmed length 1–100, return trimmed value, no submission constructed and values retained on rejection
    - **Validates: Requirements 2.2**

  - [ ]* 5.3 Write property test for submitter email validation
    - **Property 2: Submitter email validation** — accept iff trimmed, non-empty, ≤254, exactly one `@` separating non-empty local and domain parts
    - **Validates: Requirements 2.3**

  - [ ]* 5.4 Write property test for idea title validation
    - **Property 3: Idea title validation** — accept iff trimmed length 1–200, return trimmed value
    - **Validates: Requirements 2.4**

  - [ ]* 5.5 Write property test for idea details validation
    - **Property 4: Idea details validation** — accept iff trimmed length 1–5000, return trimmed value
    - **Validates: Requirements 2.5**

  - [ ]* 5.6 Write property test for type and priority membership
    - **Property 5: Type and priority membership** — `isIdeaType` true iff one of the seven Idea_Type values; `isIdeaPriority` true iff one of the four Idea_Priority values
    - **Validates: Requirements 2.6**

  - [ ]* 5.7 Write property test for optional related-page URL validation
    - **Property 6: Optional related-page URL validation** — empty-after-trim → null; otherwise accept iff http/https scheme and ≤2048
    - **Validates: Requirements 2.7**

  - [ ]* 5.8 Write property test for inspiration links validation
    - **Property 7: Inspiration links validation** — accept iff ≤10 elements and each is http/https and ≤2048; identify each invalid element and the count violation
    - **Validates: Requirements 2.8, 2.9**

  - [ ]* 5.9 Write property test for aggregate validation reporting every violation
    - **Property 8: Aggregate validation reports every violation** — accept iff every field passes; reported violations equal exactly the failing fields; rejection mutates no state
    - **Validates: Requirements 2.1, 2.10**

- [ ] 6. Implement attachment validation (pure domain)
  - [ ] 6.1 Implement attachment metadata validation and file-count guard
    - Implement `validateAttachment` (allow-listed MIME, size 1–26214400 bytes, name 1–255, preserving name/MIME/size on accept) and `isWithinFileCount` (n ≤ 10); reuse the base allow-listed MIME constant pattern
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.8_

  - [ ]* 6.2 Write property test for attachment validation and metadata preservation
    - **Property 9: Attachment validation and metadata preservation** — accept iff MIME allowed, size 1–26214400, name 1–255; accepted preserves name/MIME/size; rejected file produces no attachment
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.6, 3.7, 3.8**

  - [ ]* 6.3 Write property test for the file-count limit
    - **Property 10: File-count limit** — `isWithinFileCount` true iff count ≤ 10; exceeding rejects the submission and retains values
    - **Validates: Requirements 3.4**

- [ ] 7. Implement spam-protection decisions (pure domain)
  - [ ] 7.1 Implement honeypot and rate-limit decisions and the rejection effect-set
    - Implement `isHoneypotTriggered` (non-empty after trim) and `isRateLimited` (≥5 attempts within a trailing 10-minute rolling window over supplied timestamps); model the rejection outcome so honeypot/rate-limit paths produce no submission, attachment, attempt record, or activity entry, and honeypot yields the decoy success outcome
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 7.2 Write property test for the honeypot decision
    - **Property 11: Honeypot decision** — true iff value is non-empty after trimming whitespace
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 7.3 Write property test for the rate-limit decision over a rolling window
    - **Property 12: Rate-limit decision over a rolling window** — true iff attempts within the trailing 10-minute window ending at now are at least 5
    - **Validates: Requirements 4.3**

  - [ ]* 7.4 Write property test for rejection paths producing no side effects
    - **Property 13: Rejection paths produce no side effects** — honeypot/rate-limit inputs yield an empty effect set; honeypot additionally yields the standard success confirmation outcome
    - **Validates: Requirements 4.2, 4.4**

- [ ] 8. Implement submission construction (pure domain)
  - [ ] 8.1 Implement `buildIdeaSubmission`
    - Construct the `IdeaSubmission` (project/client from the resolved link, validated fields, discuss-next-meeting flag from the form control, status `New`, created == updated) plus the initial `IdeaStatusHistory` (null previous, `New`, matching timestamp); takes an already-resolved link so it stays pure
    - _Requirements: 1.5, 5.1, 5.2, 5.3, 9.1, 12.3, 12.4_

  - [ ]* 8.2 Write property test for submission construction invariants
    - **Property 14: Submission construction invariants** — project/client equal the link's, stored fields equal validated input, status `New`, created == updated, initial history entry has null previous/`New`/matching timestamp
    - **Validates: Requirements 1.5, 5.1, 5.2, 5.3, 9.1, 12.3, 12.4**

- [ ] 9. Checkpoint - intake domain logic (validation, spam, construction)
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement idea share-link resolution and scoping (reuses base token mechanism)
  - [ ] 10.1 Implement token generation reuse, link resolution, and operation scoping
    - Reuse the base `generateToken` (≥32 URL-safe chars, unique); implement `resolveIdeaLink` (accessible iff exists and not revoked, byte-identical generic rejection for nonexistent/revoked) and `isIdeaLinkOperationAllowed` (only view-form or create-in-scope), enforcing no existence disclosure
    - _Requirements: 1.1, 1.6, 5.5, 16.1, 16.2, 16.3, 16.4_

  - [ ]* 10.2 Write property test for token generation
    - **Property 34: Token generation** — every token ≥32 chars, URL-safe, pairwise distinct across a sequence
    - **Validates: Requirements 16.2**

  - [ ]* 10.3 Write property test for link resolution and indistinguishability
    - **Property 15: Idea share-link resolution and indistinguishability** — accessible iff exists and `revokedAt` null; nonexistent and revoked links yield identical rejections; submission through such a link creates nothing
    - **Validates: Requirements 1.6, 5.5, 16.1, 16.3**

  - [ ]* 10.4 Write property test for view-or-create-only portal operations
    - **Property 16: Portal operation is view-or-create-only** — true iff viewing the form or creating an in-scope submission through a valid link; every other operation rejected with no state change or disclosure
    - **Validates: Requirements 16.4**

- [ ] 11. Implement the status lifecycle and presentation map (pure domain)
  - [ ] 11.1 Implement `IDEA_STATUS_PRESENTATION` and `applyStatusChange`
    - Implement the single status-presentation map (one fixed label and one distinct color token per the seven statuses) reused by every view through the base `StatusBadge`; implement `applyStatusChange` (different valid → new status + updated ts + history; same → no-op; invalid → reject)
    - _Requirements: 9.2, 9.3, 9.4, 9.6, 9.7, 13.2_

  - [ ]* 11.2 Write property test for status presentation map totality and distinctness
    - **Property 17: Status presentation map totality and distinctness** — exactly one label/color per status, deterministic, pairwise-distinct colors
    - **Validates: Requirements 9.6, 13.2**

  - [ ]* 11.3 Write property test for status change transition, no-op, and rejection
    - **Property 18: Status change transition, no-op, and rejection** — different valid sets status + updated ts + history; equal is no-op; invalid rejected with current status, no history, unchanged ts
    - **Validates: Requirements 9.2, 9.3, 9.4, 9.7, 17.9**

- [ ] 12. Implement idea comment validation (pure domain)
  - [ ] 12.1 Implement `validateIdeaComment`
    - Implement comment validation (trimmed length 1–5000) returning a `Result`; accepted comment is attributed to the submitting Designer with a UTC timestamp, rejection retains entered text
    - _Requirements: 8.4, 8.5_

  - [ ]* 12.2 Write property test for comment validation and attribution
    - **Property 19: Idea comment validation and attribution** — accept iff trimmed length 1–5000; accepted attributed to the Designer with UTC timestamp; rejected creates nothing and retains text
    - **Validates: Requirements 8.4, 8.5**

- [ ] 13. Implement task conversion and outcome idempotency (pure domain, reuses base `tasks`)
  - [ ] 13.1 Implement `buildTaskFromIdea` and `shouldCreateTaskForOutcome`
    - Implement task construction from an idea (open state, title = idea title truncated to 200, project = idea project, phase = assigned phase) producing the base `Task` plus the `IdeaTaskLink` association; implement the idempotent decision `shouldCreateTaskForOutcome` (true iff `Added to task list` and no existing task)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 14.5, 14.6_

  - [ ]* 13.2 Write property test for task construction from an idea
    - **Property 20: Task construction from an idea** — open state, title = first 200 chars (full when ≤200), project = idea project, phase = assigned phase or none, plus the task↔idea association
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**

  - [ ]* 13.3 Write property test for idempotent task creation on "Added to task list"
    - **Property 24: Idempotent task creation for "Added to task list"** — true iff outcome is `Added to task list` and no task exists; creates exactly one task when none exists and none when one already exists
    - **Validates: Requirements 14.5, 14.6**

- [ ] 14. Implement phase assignment (pure domain, reuses base `phases`)
  - [ ] 14.1 Implement `assignPhase`
    - Implement phase assignment that sets/replaces the assigned phase and bumps `updated_at` when the candidate belongs to the idea's project, clears and bumps when the candidate is none, and rejects (retaining the prior assignment) when the candidate does not belong to the project
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ]* 14.2 Write property test for phase assignment validity
    - **Property 21: Phase assignment validity** — set/replace and bump ts on in-project phase, clear and bump on none, reject and retain on out-of-project phase
    - **Validates: Requirements 11.1, 11.2, 11.3**

- [ ] 15. Implement meeting flag and meeting outcome (pure domain)
  - [ ] 15.1 Implement `setMeetingFlag`, `isMeetingOutcome`, and `recordOutcome`
    - Implement the meeting-flag setter (persist target, bump `updated_at`), the outcome membership guard `isMeetingOutcome`, and `recordOutcome` (persist outcome + outcome timestamp + bump `updated_at` iff valid; reject and retain otherwise)
    - _Requirements: 12.1, 12.2, 14.3, 14.4_

  - [ ]* 15.2 Write property test for meeting-flag set and clear
    - **Property 22: Meeting-flag set and clear** — persists discuss-next-meeting equal to the target and sets the updated timestamp to the change time
    - **Validates: Requirements 12.1, 12.2**

  - [ ]* 15.3 Write property test for meeting-outcome recording and validity
    - **Property 23: Meeting-outcome recording and validity** — persists outcome + outcome ts + bumps updated ts iff valid; invalid rejected and current outcome retained
    - **Validates: Requirements 14.3, 14.4**

  - [ ]* 15.4 Write property test for accepted mutations bumping the updated timestamp
    - **Property 37: Accepted mutations bump the updated timestamp** — for `applyStatusChange` (to a different valid status), `assignPhase`, `setMeetingFlag`, and `recordOutcome`, the returned updated timestamp equals the supplied current time and is ≥ the prior updated timestamp
    - **Validates: Requirements 17.8**

- [ ] 16. Implement ordering, filtering, grouping, and row projection (pure domain)
  - [ ] 16.1 Implement the ordering, filtering, grouping, and row-projection helpers
    - Implement `sortIdeasReverseChron` (created_at desc, tie-break id desc), `sortIdeaComments` (asc), `sortStatusHistory` (desc), `filterIdeas` (AND of applied filters), `groupForNextMeeting` (flagged only, grouped by project+client, reverse-chron within group), and `buildIdeaRow` (row fields including attachment count)
    - _Requirements: 7.2, 7.3, 8.7, 9.5, 13.1, 13.3, 13.4, 13.5, 13.6, 13.7, 13.9, 14.1_

  - [ ]* 16.2 Write property test for reverse-chronological ordering with tie-break
    - **Property 25: Reverse-chronological idea ordering with deterministic tie-break** — created_at desc, ties by id desc, result is a permutation of the input
    - **Validates: Requirements 7.3, 13.1**

  - [ ]* 16.3 Write property test for idea row projection completeness
    - **Property 26: Idea row projection completeness** — row carries submitter name, project name, title, type, priority, status, submitted date, and attachment count equal to the supplied count
    - **Validates: Requirements 7.2**

  - [ ]* 16.4 Write property test for comment display ordering
    - **Property 27: Comment display ordering** — non-decreasing by creation timestamp (oldest to newest)
    - **Validates: Requirements 8.7**

  - [ ]* 16.5 Write property test for status-history display ordering
    - **Property 28: Status-history display ordering** — non-increasing by timestamp (most recent first)
    - **Validates: Requirements 9.5**

  - [ ]* 16.6 Write property test for filter conjunction exactness
    - **Property 29: Filter conjunction exactness** — returns all and only submissions satisfying every applied filter; returns all when no filters applied
    - **Validates: Requirements 13.3, 13.4, 13.5, 13.6, 13.7, 13.9**

  - [ ]* 16.7 Write property test for next-meeting grouping
    - **Property 30: Next-meeting grouping** — includes exactly the flagged submissions, partitions by project+client, orders reverse-chron within each group
    - **Validates: Requirements 14.1**

- [ ] 17. Implement activity-entry construction and audit immutability (reuses base `activity_logs`)
  - [ ] 17.1 Implement idea activity-entry builders and the audit-immutability guard
    - Implement `buildActivityEntry` for `idea_submitted` (submitter name, idea title, UTC timestamp) and `idea_status_changed` (idea title, Designer, previous/new status, UTC timestamp), reusing the base activity-entry builder pattern; reuse the base audit-immutability guard so modify/delete is rejected
    - _Requirements: 15.1, 15.2, 15.4_

  - [ ]* 17.2 Write property test for activity-entry construction
    - **Property 31: Activity-entry construction** — idea creation → `idea_submitted` with submitter name/title/UTC ts; status change → `idea_status_changed` with title/Designer/previous/new/UTC ts
    - **Validates: Requirements 15.1, 15.2**

  - [ ]* 17.3 Write property test for idea audit immutability
    - **Property 32: Idea audit immutability** — modify/delete of an idea activity entry is rejected, the original is preserved, and an immutability indication is returned
    - **Validates: Requirements 15.4**

- [ ] 18. Implement ownership authorization, attachment path, and notification content (pure domain)
  - [ ] 18.1 Implement `canDesignerAccessIdea`, `attachmentStoragePath`, and `buildNotificationEmail`
    - Implement the ownership predicate (true iff the idea's project is in the Designer's owned set), the owner-scoped storage path builder, and the notification email content builder (project name, submitter name, title, type, priority, with explicit not-provided indicators)
    - _Requirements: 6.2, 8.8, 16.5, 16.7_

  - [ ]* 18.2 Write property test for ownership authorization
    - **Property 33: Ownership authorization** — true iff the idea's project belongs to the owned set; non-owner denied view/comment/status/phase/convert/outcome/attachment retrieval
    - **Validates: Requirements 8.8, 16.5**

  - [ ]* 18.3 Write property test for the owner-scoped attachment path
    - **Property 35: Owner-scoped attachment path** — path is prefixed by the owner's scope segment so every attachment is bound to the owning Designer
    - **Validates: Requirements 16.7**

  - [ ]* 18.4 Write property test for notification email content
    - **Property 36: Notification email content** — content includes project name, submitter name, title, type, priority, substituting an explicit not-provided indicator for any empty value
    - **Validates: Requirements 6.2**

- [ ] 19. Checkpoint - all idea domain property tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Implement idea repositories, fakes, and adapters
  - [ ] 20.1 Define idea repository interfaces
    - Define typed repository interfaces for idea submissions, attachments, comments, status history, task links, and submission-attempt timestamps (for the rate-limit window) that the domain/application layers depend on; reuse the base `share_links` and `tasks` repositories
    - _Requirements: 17.1_

  - [ ] 20.2 Implement the Supabase idea repositories
    - Implement the interfaces against `@supabase/supabase-js`, wiring the `create_idea_submission` RPC, the cascade-delete path with post-transaction Storage cleanup, attempt-timestamp reads for rate limiting, and reusing the base service-role client for the public path and the session client for admin reads
    - _Requirements: 5.7, 17.1, 17.6, 17.7, 17.10_

  - [ ] 20.3 Implement in-memory idea repository fakes
    - Provide fast in-memory implementations of the idea repository interfaces for domain/application unit and property tests, reusing the base fake conventions
    - _Requirements: 17.1_

  - [ ] 20.4 Implement the `EmailNotifier` adapter with bounded retries
    - Implement the adapter that sends exactly one new-submission notification via the platform sender, retrying up to 3 additional times within 5 minutes, logging the idea id + reason on final failure, and skipping (and logging) when the owner has no email of record; uses `buildNotificationEmail` for content
    - _Requirements: 6.1, 6.3, 6.4, 6.5_

  - [ ] 20.5 Implement the Storage adapter for attachments
    - Implement the adapter that writes attachments to the private bucket under the owner-scoped path (only after server-side size enforcement), mints short-lived signed URLs after the ownership check, and removes objects on idea deletion, returning an error if one or more files cannot be removed
    - _Requirements: 3.5, 16.7, 16.8, 17.10_

  - [ ]* 20.6 Write integration tests for idea repositories and adapters
    - Verify representative CRUD, RPC atomicity/rollback, cascade with Storage cleanup, signed-URL access control, and email send + retry against a local Supabase instance
    - _Requirements: 5.7, 6.1, 6.3, 16.8, 17.7, 17.10_

- [ ] 21. Implement the public idea Route Handlers
  - [ ] 21.1 Implement `GET /ideas/[token]` (resolve + read-only form view model)
    - Implement the GET handler using the service-role client to resolve and scope the idea link and return a read-only form view model exposing only the project name; return the generic invalid response for nonexistent/revoked links, mirroring the base `/review/[token]` path
    - _Requirements: 1.1, 1.3, 1.6, 16.1, 16.4_

  - [ ] 21.2 Implement `POST /ideas/[token]` (honeypot → rate-limit → validate → upload → atomic create)
    - Implement the POST handler in the same `route.ts`: honeypot short-circuit (decoy success, persist nothing) → rate-limit check → field + attachment validation (retain values on failure) → server-side-enforced multipart upload via the Storage adapter → `create_idea_submission` RPC → fire the new-submission email notification; surface the confirmation message on success and the storage/persistence/invalid-link errors otherwise
    - _Requirements: 3.1, 3.5, 4.2, 4.3, 4.4, 5.1, 5.4, 5.5, 5.6, 5.7, 6.1, 12.3, 12.4_

  - [ ]* 21.3 Write integration tests for the public idea handlers
    - Verify scoped read-only resolution, honeypot decoy success with nothing persisted, rate-limit rejection, size-cap and storage-failure handling with rollback, and the generic invalid/revoked-link response against a local Supabase instance
    - _Requirements: 1.6, 3.5, 4.2, 4.4, 5.5, 5.6, 5.7_

- [ ] 22. Checkpoint - persistence, adapters, and the public path
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 23. Implement admin idea Server Actions (reuses base session/ownership re-checks)
  - [ ] 23.1 Implement generate/revoke idea share-link actions
    - Implement `generateIdeaShareLink` and `revokeIdeaShareLink` by reusing the base `generateShareLink`/`revokeShareLink` with `scope_type = 'idea'`, re-checking session and project ownership
    - _Requirements: 16.1, 16.2, 16.3_

  - [ ] 23.2 Implement `changeIdeaStatus`
    - Load the idea (RLS owner-scoped), call `applyStatusChange`, and persist the new status + status-history entry + `idea_status_changed` activity log in one transaction; surface the invalid-status and persistence-failure errors
    - _Requirements: 9.2, 9.3, 9.4, 9.7, 9.8, 15.2_

  - [ ] 23.3 Implement `addIdeaComment`
    - Validate via `validateIdeaComment`, persist the comment attributed to the Designer with a UTC timestamp, and surface validation/persistence failures with retained text
    - _Requirements: 8.4, 8.5, 8.6_

  - [ ] 23.4 Implement `assignIdeaPhase`
    - Call `assignPhase` against the project's phase set and persist the assignment/removal atomically; surface the invalid-phase and persistence-failure errors
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ] 23.5 Implement `convertIdeaToTask`
    - Call `buildTaskFromIdea`, create the base `Task` and the `idea_task_links` association in one transaction (unique constraint guarantees one task per idea), and surface the persistence-failure error leaving the idea unchanged
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ] 23.6 Implement `setIdeaMeetingFlag`
    - Call `setMeetingFlag`, persist the flag + bumped `updated_at`, and surface the persistence-failure error retaining the prior flag and timestamp
    - _Requirements: 12.1, 12.2, 12.5_

  - [ ] 23.7 Implement `recordMeetingOutcome`
    - Call `recordOutcome`; when the outcome is `Added to task list` and `shouldCreateTaskForOutcome` is true, create exactly one task (reusing the conversion path) in the same transaction; surface the invalid-outcome and persistence-failure errors
    - _Requirements: 14.3, 14.4, 14.5, 14.6_

  - [ ] 23.8 Implement the read-model actions
    - Implement `getIdeasQueue` (owner-scoped, `sortIdeasReverseChron`, `buildIdeaRow`), `getIdeaDetail`, `getProjectIdeas` (with `filterIdeas`), `getNextMeeting` (with `groupForNextMeeting`), and `getIdeaAttachmentUrl` (ownership check + signed URL); each fails closed on load errors with no partial/stale data
    - _Requirements: 7.2, 7.3, 7.6, 7.7, 7.8, 8.1, 8.2, 8.3, 8.7, 8.9, 8.10, 9.5, 13.1, 13.3, 14.1, 14.2, 16.8_

  - [ ]* 23.9 Write unit tests for the idea Server Actions
    - Verify validation-error surfacing with retained values, ownership denial, status/phase/outcome transitions, idempotent task creation, and activity logging using the repository fakes
    - _Requirements: 8.6, 9.4, 9.8, 11.2, 11.4, 14.4, 14.6, 16.6_

- [ ] 24. Build the idea UI by composing the existing component library
  - [ ] 24.1 Add the "Ideas Queue" sidebar navigation entry
    - Extend the existing `Sidebar` with an "Ideas Queue" entry that opens `/ideas`; reuse the base `AppShell`/`Sidebar` without introducing new primitives
    - _Requirements: 7.1_

  - [ ] 24.2 Build the Idea_Form within `ReviewLayout`
    - Compose the single-column Idea_Form inside the reused `ReviewLayout` (no admin sidebar/navigation): heading "Share an idea or request", read-only project name, the R1.8 controls, the hidden non-focusable honeypot, and the "Send to review" submit; render validation messages inline retaining entered values and the confirmation/invalid-link messages via `Banner`
    - _Requirements: 1.2, 1.3, 1.4, 1.7, 1.8, 1.9, 4.1, 5.4_

  - [ ] 24.3 Build the Ideas Queue list view
    - Compose `/ideas` from the reused `PageHeader`, `IndexTable`, `StatusBadge` (via the idea status map), and `EmptyState`, rendering the R7.2 columns reverse-chron with row selection into the detail view
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

  - [ ] 24.4 Build the Idea detail view
    - Compose `/ideas/[id]` from reused `Card`, `StatusBadge`, `Timeline` (status history + comments), `Modal` (convert/revoke confirmations), `Banner`, and `Toast`: all fields, selectable attachments/inspiration links, related-page URL, comment entry, status/phase/convert/flag controls, and per-section empty-state indicators
    - _Requirements: 8.1, 8.2, 8.3, 8.9, 8.10, 8.11, 9.5, 9.6, 10.1, 11.1, 12.1, 12.2_

  - [ ] 24.5 Build the project Ideas & Requests tab
    - Compose the `Ideas & Requests` tab on the project view from reused `Tabs`, `Filters`, `IndexTable`, and `StatusBadge`: reverse-chron list, the "New" visual distinction from the status map, type/status/priority/meeting-flag filters (AND), and the no-match empty state
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9_

  - [ ] 24.6 Build the Next Meeting view
    - Compose `/ideas/next-meeting` from reused `PageHeader`, `Card`, `StatusBadge`, and `EmptyState`: flagged ideas grouped by project and client, showing title/status/comments and the Meeting_Outcome value or a not-recorded indicator with the outcome-recording control
    - _Requirements: 14.1, 14.2, 14.7_

  - [ ]* 24.7 Write component tests for the idea views
    - Verify the honeypot is hidden/non-focusable, the form's exact strings and read-only project name, status-badge mapping consistency, empty states, and the convert/revoke modal flow
    - _Requirements: 1.2, 1.3, 1.4, 1.7, 4.1, 7.4, 8.11, 13.2, 13.8, 14.7_

- [ ] 25. Wire activity logging, routes, and responsive behavior end-to-end
  - [ ] 25.1 Wire idea activity into the existing activity timeline
    - Ensure `idea_submitted` and `idea_status_changed` entries are written for the associated project and rendered by the existing `Timeline`/activity views alongside base entries, with logging failures recorded without altering the idea
    - _Requirements: 15.1, 15.2, 15.3, 15.5_

  - [ ] 25.2 Wire routes, navigation, and providers end-to-end
    - Connect the public `/ideas/[token]` route, the admin `/ideas`, `/ideas/[id]`, project `?tab=ideas`, and `/ideas/next-meeting` routes, the reused `ToastProvider`, and the existing auth middleware so all idea flows are integrated with no orphaned components
    - _Requirements: 7.1, 7.6, 16.5_

  - [ ]* 25.3 Write visual/responsive tests for the Idea_Form
    - Verify the Idea_Form renders as a single vertical column with no horizontal overflow at 320, 768, 1024, and 1920 pixels
    - _Requirements: 1.10_

- [ ] 26. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- This feature **extends** the Client Sign-Off Dashboard; tasks reuse the base stack, domain/service layer, Supabase persistence + RLS pattern, service-role portal path, `Result<T, E>` discipline, Server Actions + Route Handlers, the append-only `activity_logs` table, the existing `users`/`clients`/`projects`/`phases`/`tasks`/`share_links` entities, and the Polaris-inspired component library rather than rebuilding them.
- Tasks marked with `*` are optional test tasks and can be skipped for a faster MVP; core implementation sub-tasks are never optional.
- Each task references the specific requirement sub-clauses it implements for traceability.
- Property tests target the pure idea domain layer (Properties 1–37), each as a single test running ≥ 100 iterations and tagged `// Feature: client-ideas-queue, Property {number}: {property_text}`, with generators exercising the boundary inputs called out in the design's Testing Strategy.
- Unit, component, integration, smoke, and visual tests cover the non-property criteria (UI strings, honeypot hidden/non-focusable state, FK/cascade, RLS, RPC atomicity, Storage signed URLs, email retry, responsiveness) per the design's Testing Strategy.
- Checkpoints provide incremental validation points; the idea domain layer is built and fully property-tested before persistence, the public path, and UI are wired on top of it.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "5.1", "6.1", "7.1", "8.1", "10.1", "11.1", "12.1", "13.1", "14.1", "15.1", "16.1", "17.1", "18.1", "20.1"] },
    { "id": 2, "tasks": ["2.3", "20.3", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "5.9", "6.2", "6.3", "7.2", "7.3", "7.4", "8.2", "10.2", "10.3", "10.4", "11.2", "11.3", "12.2", "13.2", "13.3", "14.2", "15.2", "15.3", "15.4", "16.2", "16.3", "16.4", "16.5", "16.6", "16.7", "17.2", "17.3", "18.2", "18.3", "18.4"] },
    { "id": 3, "tasks": ["3.1", "3.2", "3.3", "2.4", "2.5", "20.4"] },
    { "id": 4, "tasks": ["3.4", "20.2", "20.5"] },
    { "id": 5, "tasks": ["20.6", "21.1"] },
    { "id": 6, "tasks": ["21.2"] },
    { "id": 7, "tasks": ["21.3", "23.1", "23.2", "23.3", "23.4", "23.5", "23.6", "23.7", "23.8"] },
    { "id": 8, "tasks": ["23.9", "24.1", "24.2", "24.3", "24.4", "24.5", "24.6"] },
    { "id": 9, "tasks": ["24.7", "25.1", "25.2"] },
    { "id": 10, "tasks": ["25.3"] }
  ]
}
```
