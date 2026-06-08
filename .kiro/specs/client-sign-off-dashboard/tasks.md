# Implementation Plan: Client Sign-Off Dashboard

## Overview

This plan converts the design into incremental, test-driven coding steps for a Next.js (App Router) + TypeScript + Tailwind + Supabase application. Work proceeds in dependency order: scaffolding and configuration first, then the database schema and Row Level Security, then the pure domain/service layer (validated by property-based tests), then the persistence and application layers, authentication, the Polaris-inspired component library, the admin views, the client portal, and finally responsive behavior and end-to-end wiring.

The domain layer is pure and has no Supabase imports, so its 36 correctness properties are implemented as `fast-check` + Vitest property tests against in-memory data. Each property is its own sub-task, runs a minimum of 100 iterations, and carries the required tag comment `// Feature: client-sign-off-dashboard, Property {number}: {property_text}`. Infrastructure concerns (FK/cascade, transactional rollback, Auth, Storage), UI rendering, and responsiveness use unit, component, integration, smoke, and visual tests as specified by the design's Testing Strategy.

Sub-tasks marked with `*` are optional test tasks that can be skipped for a faster MVP; core implementation sub-tasks are never optional.

## Tasks

- [x] 1. Scaffold project and configure tooling
  - [x] 1.1 Initialize Next.js App Router + TypeScript (strict) + Tailwind with design tokens
    - Create the Next.js App Router project structure with TypeScript strict mode
    - Configure Tailwind and a CSS-variable design-token layer for the Polaris-inspired palette, radii, borders, and spacing scale
    - Establish the `app/` route segments for admin and portal surfaces and a shared `lib/`/`components/` structure
    - _Requirements: 14.3, 16.5_

  - [x] 1.2 Configure Supabase clients (browser, SSR server, service-role)
    - Add `@supabase/supabase-js` and `@supabase/ssr`; create a cookie-based SSR server client and a browser client
    - Create a server-only service-role client module that is never imported into client bundles, for the share-link path
    - Add environment variable configuration and typed access helpers
    - _Requirements: 17.1, 8.2_

  - [x] 1.3 Set up Vitest + fast-check testing infrastructure
    - Configure Vitest, add `fast-check`, and create test scripts that run once (no watch mode)
    - Add a shared test setup with helpers for in-memory repository fakes
    - _Requirements: 17.1_

  - [x] 1.4 Define shared domain TypeScript types and the Result type
    - Define `Client`, `Project`, `Phase`, `ChecklistItem`, `DesignLink`, `Comment`, `Approval`, `Task`, `ActivityLog`, `ShareLink`, `Author`, `PhaseStatus`, `ApprovalDecision`
    - Define `Result<T, E>`, `ValidationError`, and `AppError` types used across domain and application layers
    - _Requirements: 17.1, 17.6_

- [x] 2. Create database schema migrations
  - [x] 2.1 Migration for users, clients, and projects
    - Create `users` (1:1 with `auth.users`), `clients`, and `projects` tables with owner/client foreign keys and `on delete cascade`
    - Add name `check` constraints (clients 1–100, projects 1–120 after `btrim`) and the case-insensitive uniqueness index `projects_client_name_ci` on `(client_id, lower(btrim(name)))`
    - Add supporting indexes on `owner_id` and `client_id`
    - _Requirements: 2.1, 3.1, 3.5, 17.1, 17.2_

  - [x] 2.2 Migration for phases and phase-child tables
    - Create `phases` with ordinal uniqueness per project, status `check` (the 6 workflow statuses), 5,000-char description/notes checks, due date, and approval columns
    - Create `checklist_items`, `design_links` (url/file kind check), `comments` (author type check), and `approvals` (decision check, name/initials checks, `checklist_snapshot jsonb`) with `phase_id` FKs and `on delete cascade`
    - Add per-table indexes (e.g., `checklist_items (phase_id, created_at)`, `approvals (phase_id, created_at desc)`)
    - _Requirements: 4.3, 5.1, 6.1, 7.1, 9.4, 9.5, 17.1, 17.3, 17.6_

  - [x] 2.3 Migration for tasks, activity_logs, and share_links
    - Create `tasks` (title check 1–200, state check, optional project/phase FKs, due date) with index `(owner_id, state, due_date)`
    - Create `activity_logs` (type check, actor, `detail jsonb`) with index `(project_id, created_at desc)`
    - Create `share_links` (unique token `>= 32` chars, scope check, project/phase FKs, `revoked_at`, `first_accessed_at`) with the unique token index
    - _Requirements: 8.1, 12.1, 13.1, 13.2, 13.3, 17.1_

  - [x] 2.4 Write integration tests for FK enforcement and cascade delete
    - Verify inserting a child with a missing parent is rejected, and deleting a client cascades to projects/phases/children/tasks/activity/share_links
    - Verify a failed multi-row mutation rolls back with no partial commit
    - _Requirements: 17.2, 17.3, 17.7, 17.9_

  - [x] 2.5 Write smoke test for schema presence
    - Assert all 10 tables, key constraints, and indexes exist after migrations apply
    - _Requirements: 17.1_

- [x] 3. Implement Row Level Security and audit immutability
  - [x] 3.1 Add owner-scoped RLS policies on all tables
    - Enable RLS on every table; add owner policies on `clients`, `projects`, `users`, `tasks`, `share_links` and owner-via-parent policies on `phases`, `checklist_items`, `design_links`, `comments`, `approvals`, `activity_logs`
    - _Requirements: 1.5, 4.8_

  - [x] 3.2 Enforce append-only audit on activity_logs
    - Grant insert/select only on `activity_logs` (no UPDATE/DELETE) to enforce immutability; document the no-purge retention posture
    - _Requirements: 13.6, 13.7_

  - [x] 3.3 Write integration tests for RLS isolation and audit immutability
    - Verify a designer cannot read or mutate another designer's records and cannot edit a non-owned phase's internal notes
    - Verify UPDATE/DELETE on `activity_logs` is rejected
    - _Requirements: 1.5, 4.8, 13.7_

- [x] 4. Checkpoint - schema and security
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement domain validators
  - [x] 5.1 Implement all boundary validators in a pure validators module
    - Implement `validateClientName`, `validateProjectName`, `validateChecklistText`, `validateCommentText`, `validateDescription`, `validateDesignUrl`, `validateSignoff`, `validateTaskTitle`, `isProjectNameDuplicate`, and `isWithinUploadLimit`, each returning a `Result` and never mutating inputs on rejection
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.4, 3.5, 4.5, 5.1, 5.2, 5.7, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4, 9.2, 9.3, 12.1, 12.2, 15.6_

  - [x] 5.2 Write property test for client name validation
    - **Property 1: Client name validation** — accept iff trimmed length 1–100, return trimmed value, no mutation on rejection
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

  - [x] 5.3 Write property test for project name validation
    - **Property 2: Project name validation** — accept iff trimmed length 1–120, return trimmed value
    - **Validates: Requirements 3.1, 3.2, 3.4**

  - [x] 5.4 Write property test for project name duplicate detection
    - **Property 3: Project name duplicate detection** — true iff a sibling matches after trim and case-fold
    - **Validates: Requirements 3.5**

  - [x] 5.5 Write property test for checklist text validation and default state
    - **Property 9: Checklist text validation and default state** — accept iff trimmed length 1–500; accepted new item is incomplete; rejection leaves items unchanged
    - **Validates: Requirements 5.1, 5.2, 5.7**

  - [x] 5.6 Write property test for design URL validation
    - **Property 11: Design URL validation** — accept iff http/https scheme and length ≤ 2048; otherwise no link created
    - **Validates: Requirements 6.1, 6.2**

  - [x] 5.7 Write property test for upload size limit
    - **Property 12: Upload size limit** — `isWithinUploadLimit` true iff size ≤ 50 MB; rejected upload creates no design link
    - **Validates: Requirements 6.3, 6.4**

  - [x] 5.8 Write property test for comment text validation and attribution
    - **Property 13: Comment text validation and attribution** — accept iff trimmed length 1–5000; accepted comment attributed to submitting author with UTC timestamp
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

  - [x] 5.9 Write property test for sign-off validation
    - **Property 20: Sign-off validation** — accept iff name trimmed 1–100 and initials trimmed 1–10; identify each invalid field and retain values on rejection
    - **Validates: Requirements 9.2, 9.3, 15.6**

  - [x] 5.10 Write property test for task title validation and default state
    - **Property 31: Task title validation and default state** — accept iff trimmed length 1–200; accepted new task is `open`; rejection retains entered values
    - **Validates: Requirements 12.1, 12.2**

- [x] 6. Implement phase-status state machine, overdue, and completion
  - [x] 6.1 Implement the phase-status transition functions and derived overdue/completion logic
    - Implement `nextStatusOnShare`, `nextStatusOnFirstAccess`, `nextStatusOnApproval`, `canComplete`/`completePhase`, and `isOverdue` as pure functions; overdue is derived and never mutates stored status
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 11.7_

  - [x] 6.2 Write property test for phase status transitions
    - **Property 23: Phase status transitions** — share → Sent to Client; first access w/o approval → Waiting for Feedback; Approved/Changes Requested decisions map correctly
    - **Validates: Requirements 10.2, 10.3, 10.4, 10.5**

  - [x] 6.3 Write property test for overdue computation
    - **Property 24: Overdue computation** — true iff now strictly past due date and status not Approved/Completed; never mutates status; Approved/Completed never overdue
    - **Validates: Requirements 10.6, 10.7, 11.7**

  - [x] 6.4 Write property test for phase completion guard
    - **Property 25: Phase completion guard** — `completePhase` yields Completed iff current status is Approved; otherwise rejected and status retained
    - **Validates: Requirements 10.8, 10.9**

- [x] 7. Implement phase and project structural logic
  - [x] 7.1 Implement project/phase structural operations
    - Implement default phase initialization (10 defaults, ordinals 1–10, status Draft), append-phase (last ordinal + Draft), project-edit-preserves-phases, phase partial-update, and phase field validation
    - _Requirements: 3.6, 3.7, 4.4, 4.5, 4.6, 10.1_

  - [x] 7.2 Write property test for project edit preserving phases
    - **Property 4: Project edit preserves phases** — editing the name leaves phase identities, ordinals, and contents unchanged
    - **Validates: Requirements 3.6**

  - [x] 7.3 Write property test for default phase initialization
    - **Property 5: Default phase initialization** — exactly the ten named defaults, ordinals 1–10 in order, each Draft
    - **Validates: Requirements 3.7, 10.1**

  - [x] 7.4 Write property test for appended phase ordinal and status
    - **Property 6: Appended phase ordinal and status** — new phase ordinal exceeds all existing, status Draft
    - **Validates: Requirements 4.6, 10.1**

  - [x] 7.5 Write property test for phase partial-update invariant
    - **Property 7: Phase partial-update invariant** — patch changes exactly the patched fields, leaves others unchanged
    - **Validates: Requirements 4.4**

  - [x] 7.6 Write property test for phase field validation
    - **Property 8: Phase field validation** — accept iff both text fields ≤ 5000 and due date valid/absent; retain stored values on rejection
    - **Validates: Requirements 4.5**

- [x] 8. Checkpoint - core domain logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement ordering and dashboard aggregation
  - [x] 9.1 Implement ordering helpers
    - Implement `sortClientsByName`, `sortProjectsByName`, `sortOpenTasks`, checklist ordering, comment ordering, approval-history ordering, and activity-timeline ordering/limit (20 dashboard / 50 per-project)
    - _Requirements: 2.5, 3.8, 5.5, 7.6, 9.8, 11.5, 11.6, 12.3, 12.4, 13.4_

  - [x] 9.2 Implement dashboard aggregation
    - Implement `buildDashboard`: summary counts, project status table (latest comment, next action, client/current phase/status/due date), and waiting-on-client filter
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 9.3 Write property test for checklist display ordering
    - **Property 10: Checklist display ordering** — order non-decreasing by creation timestamp
    - **Validates: Requirements 5.5**

  - [x] 9.4 Write property test for comment display ordering
    - **Property 14: Comment display ordering** — order non-decreasing by creation timestamp (oldest to newest)
    - **Validates: Requirements 7.6**

  - [x] 9.5 Write property test for approval history ordering
    - **Property 22: Approval history ordering** — order non-increasing by approval timestamp (reverse chronological)
    - **Validates: Requirements 9.8**

  - [x] 9.6 Write property test for open-task ordering
    - **Property 29: Open-task ordering** — only open tasks, ascending due date, null-due tasks last
    - **Validates: Requirements 11.5, 12.3, 12.4**

  - [x] 9.7 Write property test for activity timeline ordering and limit
    - **Property 30: Activity timeline ordering and limit** — N most recent reverse-chronological; N=20 dashboard, N=50 per-project
    - **Validates: Requirements 11.6, 13.4**

  - [x] 9.8 Write property test for dashboard summary counts
    - **Property 26: Dashboard summary counts** — counts equal recomputed values from snapshot and are non-negative
    - **Validates: Requirements 11.1**

  - [x] 9.9 Write property test for project status table aggregation
    - **Property 27: Project status table aggregation** — exactly active projects; correct latest comment, next action / "No next action" sentinel, client, current phase, status, due date
    - **Validates: Requirements 11.2, 11.3**

  - [x] 9.10 Write property test for waiting-on-client filter
    - **Property 28: Waiting-on-client filter** — exactly phases with status Sent to Client or Waiting for Feedback
    - **Validates: Requirements 11.4**

- [x] 10. Implement share-link, approval, and audit domain logic
  - [x] 10.1 Implement share-link issuance and resolution
    - Implement `generateToken` (≥ 32 URL-safe chars, unique), the access predicate (valid iff exists and not revoked), phase-scoped isolation, the indistinguishable invalid-link response, and the reviewer view-only authorization predicate
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 7.5, 9.9, 9.10_

  - [x] 10.2 Implement approval construction and change-request task creation
    - Implement `buildApproval` (decision, name, initials, phase id, UTC timestamp, checklist snapshot) and the rule that a Changes Requested approval yields one open task referencing the phase
    - _Requirements: 9.4, 9.5, 12.5, 17.6_

  - [x] 10.3 Implement activity logging, audit immutability, ownership, and status presentation map
    - Implement activity-log entry builders (comment/approval/status-change), the audit-immutability guard, the ownership-authorization predicate, and the status presentation map (label + distinct color token per status incl. derived Overdue)
    - _Requirements: 13.1, 13.2, 13.3, 7.8, 9.7, 13.7, 1.5, 4.8, 14.4_

  - [x] 10.4 Write property test for share-link token generation
    - **Property 15: Share-link token generation** — every token ≥ 32 chars, URL-safe, pairwise distinct
    - **Validates: Requirements 8.1**

  - [x] 10.5 Write property test for share-link access predicate
    - **Property 16: Share-link access predicate** — accessible iff exists and `revokedAt` null; accessible resolves to read-only view model
    - **Validates: Requirements 8.2, 8.5**

  - [x] 10.6 Write property test for phase-scoped link isolation
    - **Property 17: Phase-scoped link isolation** — yields exactly the one in-scope phase; other phase/project requests denied
    - **Validates: Requirements 8.3**

  - [x] 10.7 Write property test for invalid-link response indistinguishability
    - **Property 18: Invalid-link response indistinguishability** — nonexistent and revoked tokens yield identical responses
    - **Validates: Requirements 8.4**

  - [x] 10.8 Write property test for reviewer view-only authorization
    - **Property 19: Reviewer view-only authorization** — only in-scope comment/approval on valid links succeed; all else rejected with no state change
    - **Validates: Requirements 7.5, 8.6, 9.9, 9.10**

  - [x] 10.9 Write property test for approval construction and snapshot
    - **Property 21: Approval construction and snapshot** — stores decision/name/initials/phase id/UTC timestamp and a snapshot equal to checklist completion at sign-off; no approval if a required field is missing
    - **Validates: Requirements 9.4, 9.5, 17.6**

  - [x] 10.10 Write property test for change-request task creation
    - **Property 32: Change-request creates a task** — a Changes Requested approval creates exactly one open task referencing the phase
    - **Validates: Requirements 12.5**

  - [x] 10.11 Write property test for activity logging on events
    - **Property 33: Activity logging on events** — comment/approval/status-change each produce the correct entry type carrying required fields
    - **Validates: Requirements 13.1, 13.2, 13.3**

  - [x] 10.12 Write property test for audit immutability
    - **Property 34: Audit immutability** — modify/delete of activity-log, comment, or approval rejected; original preserved; immutability indication returned
    - **Validates: Requirements 7.8, 9.7, 9.10, 13.7**

  - [x] 10.13 Write property test for ownership authorization
    - **Property 35: Ownership authorization** — access/mutation permitted iff requester is owner; non-owner cannot edit internal notes
    - **Validates: Requirements 1.5, 4.8**

  - [x] 10.14 Write property test for status presentation map totality and distinctness
    - **Property 36: Status presentation map totality and distinctness** — exactly one label/color per status incl. Overdue; deterministic; pairwise-distinct colors
    - **Validates: Requirements 14.4**

- [x] 11. Checkpoint - all domain property tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement Supabase repositories and in-memory fakes
  - [x] 12.1 Define repository interfaces
    - Define typed repository interfaces for clients, projects, phases, checklist items, design links, comments, approvals, tasks, activity logs, and share links that the domain/application layers depend on
    - _Requirements: 17.1_

  - [x] 12.2 Implement Supabase repositories
    - Implement the interfaces against `@supabase/supabase-js`, including the transactional project-creation-with-default-phases and client cascade-delete paths (via RPC where multiple statements are involved)
    - _Requirements: 17.1, 17.2, 17.3, 17.7, 17.9_

  - [x] 12.3 Implement in-memory repository fakes
    - Provide fast in-memory implementations of the repository interfaces for domain/application unit and property tests
    - _Requirements: 17.1_

  - [x] 12.4 Write integration tests for Supabase repositories
    - Verify representative CRUD, transactional rollback on failure, and cascade behavior against a local Supabase instance
    - _Requirements: 17.2, 17.3, 17.9_

- [x] 13. Implement admin Server Actions
  - [x] 13.1 Implement client actions
    - Implement `createClient`, `updateClient`, and `deleteClientCascade` (confirmed) wiring validators, repositories, and post-delete storage cleanup
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 17.4, 17.7_

  - [x] 13.2 Implement project actions
    - Implement `createProject` (with duplicate-name guard and default phase initialization) and `updateProject` preserving phases
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 13.3 Implement phase actions
    - Implement `updatePhase`, `addPhase`, and `completePhase` (Approved-only guard) with status-change activity logging
    - _Requirements: 4.4, 4.5, 4.6, 10.8, 10.9, 13.3_

  - [x] 13.4 Implement checklist actions
    - Implement add/update/delete/toggle for checklist items
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.7_

  - [x] 13.5 Implement design-link URL action and deletion
    - Implement `addDesignLinkUrl` and `deleteDesignLink` (removing the underlying file for file-backed links)
    - _Requirements: 6.1, 6.2, 6.6_

  - [x] 13.6 Implement comment action with activity logging
    - Implement `addComment` for the designer author, recording a `comment_created` activity entry
    - _Requirements: 7.1, 7.3, 7.4, 13.1_

  - [x] 13.7 Implement task actions
    - Implement `createTask` and `completeTask` with ordering preserved by the domain layer
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 13.8 Implement share-link actions
    - Implement `generateShareLink` (sets phase status to Sent to Client + activity log) and `revokeShareLink`
    - _Requirements: 8.1, 8.5, 10.2, 13.3_

  - [x] 13.9 Implement dashboard data action
    - Implement `getDashboard` assembling the workspace snapshot and delegating to `buildDashboard`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 13.10 Write unit tests for Server Actions
    - Verify validation error surfacing with retained values, activity logging, and status transitions using repository fakes
    - _Requirements: 2.2, 3.3, 3.5, 5.3, 5.4, 13.1, 13.3_

- [x] 14. Implement Route Handlers for uploads and the client portal
  - [x] 14.1 Implement the file-upload Route Handler
    - Implement `POST /api/phases/[phaseId]/files` with server-side 50 MB streaming enforcement, storage write, and design-link creation only on storage success
    - _Requirements: 6.3, 6.4, 6.5_

  - [x] 14.2 Implement the portal review GET handler
    - Implement `GET /review/[token]` using the service-role client to resolve and scope the link, set Waiting for Feedback on first access, and return a read-only view model (generic invalid response otherwise)
    - _Requirements: 8.2, 8.3, 8.4, 10.3, 9.1_

  - [x] 14.3 Implement the portal comment POST handler
    - Implement `POST /review/[token]/comments` adding a reviewer comment only on a valid, in-scope link, with activity logging
    - _Requirements: 7.2, 7.5, 13.1_

  - [x] 14.4 Implement the portal sign-off POST handler
    - Implement `POST /review/[token]/signoff` building the approval + snapshot, applying the status transition, creating a change-request task when applicable, and recording activity; reject on invalid/revoked links
    - _Requirements: 9.4, 9.5, 9.9, 10.4, 10.5, 12.5, 13.2, 13.3_

  - [x] 14.5 Write integration tests for upload and portal handlers
    - Verify size-cap rejection, storage-failure handling, scoped read-only access, and reviewer write rejection on revoked links against a local Supabase instance
    - _Requirements: 6.4, 6.5, 8.4, 8.6, 9.9_

- [x] 15. Checkpoint - persistence and application layers
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Implement designer authentication
  - [x] 16.1 Implement sign-in and sign-out
    - Implement email/password sign-in and sign-out via Supabase Auth with a generic invalid-credentials message that does not disclose the failing field
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 16.2 Implement middleware route protection and session refresh
    - Add Next.js middleware that validates the Supabase session, refreshes the cookie, and redirects unauthenticated admin requests to the sign-in page
    - _Requirements: 1.3, 1.5_

  - [x] 16.3 Implement account lockout
    - Track consecutive failures per account in a rolling 15-minute window; after 5 failures lock for 15 minutes and reject attempts with a generic locked message before credential checks
    - _Requirements: 1.6_

  - [x] 16.4 Implement inactivity timeout
    - Record `last_activity_at` and terminate sessions idle for 30 minutes via middleware, forcing re-authentication
    - _Requirements: 1.7_

  - [x] 16.5 Write integration tests for authentication flows
    - Verify successful session establishment, redirect when unauthenticated, lockout after 5 failures, and idle-session termination
    - _Requirements: 1.1, 1.3, 1.6, 1.7_

- [x] 17. Build the Polaris-inspired component library
  - [x] 17.1 Implement AppShell and Sidebar
    - Build the admin frame: persistent left sidebar (Dashboard, Clients, Projects, Tasks, Sign-offs, Activity, Settings) + top header region + main content area, with collapse/expand state persisted to `localStorage`
    - _Requirements: 14.1, 16.1, 16.2_

  - [x] 17.2 Implement PageHeader and Card
    - Build the top header bar (page title + primary action) and the Card surface (white/light-grey, rounded corners, soft borders)
    - _Requirements: 14.2, 14.3_

  - [x] 17.3 Implement IndexTable
    - Build a responsive list table that condenses/stacks columns with no horizontal overflow across viewport widths
    - _Requirements: 2.5, 3.8, 11.2, 16.5_

  - [x] 17.4 Implement StatusBadge
    - Build a badge that renders labels/colors exclusively through the status presentation map, applied consistently wherever a status appears, including the derived Overdue badge
    - _Requirements: 14.4, 11.7_

  - [x] 17.5 Implement EmptyState and Banner
    - Build the empty-state (message + relevant primary action) and the inline Banner for notices/errors (invalid link, storage failure)
    - _Requirements: 14.5, 6.5, 8.4, 8.6_

  - [x] 17.6 Implement Toast and ToastProvider
    - Build confirmation toasts that identify the completed action and remain visible ≥ 4s or until dismissed
    - _Requirements: 14.6_

  - [x] 17.7 Implement Modal
    - Build a confirm/cancel modal used for delete confirmation and the sign-off form, performing the action only on confirm
    - _Requirements: 14.7, 14.8, 15.5, 17.4_

  - [x] 17.8 Implement Timeline
    - Build a vertical chronological activity list component
    - _Requirements: 11.6, 13.4_

  - [x] 17.9 Implement Filters and Tabs
    - Build optional filtering/segmenting controls for list views
    - _Requirements: 14.1_

  - [x] 17.10 Write component tests for the library
    - Verify badge mapping consistency, toast duration, modal confirm/cancel behavior, and empty-state rendering
    - _Requirements: 14.4, 14.6, 14.7, 14.8, 14.5_

- [x] 18. Build admin views
  - [x] 18.1 Build the Dashboard view
    - Render summary cards, project status table, Waiting-on-client section, My-next-tasks section, and recent activity timeline from `getDashboard`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [x] 18.2 Build the Clients view
    - List clients with project counts (case-insensitive ascending), create/edit forms with validation messaging, delete confirmation modal, and empty state
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 17.4_

  - [x] 18.3 Build the Projects view
    - List projects (name, client, current phase, status; case-insensitive ascending) with create/edit forms and duplicate/validation messaging
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8_

  - [x] 18.4 Build the Phase detail view
    - Render ordered phases, editable phase fields, checklist management, design links, comments, approval display, and the complete-phase control with guard messaging
    - _Requirements: 4.1, 4.2, 4.4, 5.5, 5.6, 6.7, 7.6, 7.7, 10.8, 10.9_

  - [x] 18.5 Build the Tasks view
    - Render the open-task list ordered by due date (null-due last), with create and complete controls
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 18.6 Build the Sign-offs view
    - Provide generate/revoke share-link controls and the approval audit-trail listing
    - _Requirements: 8.1, 8.5, 9.7_

  - [x] 18.7 Build the Activity view
    - Render the per-project activity timeline (reverse chronological, max 50) with an empty state
    - _Requirements: 13.4, 13.5_

  - [x] 18.8 Build the Settings view
    - Provide account/session settings including sign-out
    - _Requirements: 1.4_

  - [x] 18.9 Write component tests for admin views
    - Verify empty states, delete confirmation modal flow, and toast confirmations on create/edit/delete
    - _Requirements: 2.6, 4.2, 5.6, 13.5, 14.6, 14.7, 14.8_

- [x] 19. Build the client portal
  - [x] 19.1 Build the ReviewLayout and header block
    - Build the centered single-column layout (no admin sidebar) with the project title and current phase title positioned above all content
    - _Requirements: 15.1, 15.2_

  - [x] 19.2 Build the deliverable section, review checklist, and design-link list
    - Build the labeled deliverable statement, the read-only checklist with completion states, and selectable design links/files that open the referenced URL or file
    - _Requirements: 15.3, 9.1, 6.7_

  - [x] 19.3 Build the comment input and approve/request-changes controls
    - Build the reviewer comment input and two separate controls: approve (primary) and request changes (secondary)
    - _Requirements: 7.2, 9.1, 15.4_

  - [x] 19.4 Build the SignoffModal
    - Build the modal with name (1–100) and initials (1–10) inputs, the official-record statement, and per-field validation messaging that retains entered values
    - _Requirements: 9.2, 9.3, 15.5, 15.6_

  - [x] 19.5 Build the approval history and confirmation banner
    - Render approval history (reverse chronological: decision, name, timestamp) and a confirmation banner stating the recorded decision, name, and timestamp after sign-off
    - _Requirements: 9.6, 9.8, 9.10_

  - [x] 19.6 Write component tests for the portal
    - Verify layout composition, sign-off validation messaging, read-only behavior, and confirmation display
    - _Requirements: 15.1, 15.6, 8.6, 9.6_

- [x] 20. Responsive behavior and end-to-end wiring
  - [x] 20.1 Implement responsive sidebar behavior
    - Expand the sidebar by default at ≥ 1024px with persisted collapse/expand; collapse to a hidden toggle below 1024px that reveals navigation when activated
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [x] 20.2 Ensure no horizontal overflow across surfaces
    - Verify and adjust tables, cards, and forms so admin and portal render with no horizontal overflow from 320px to 1920px
    - _Requirements: 16.5, 16.6_

  - [x] 20.3 Wire navigation, routes, and providers end-to-end
    - Connect all routes, the ToastProvider, auth middleware, and data actions so admin and portal flows are fully integrated with no orphaned components
    - _Requirements: 14.1, 14.2, 1.3_

  - [x] 20.4 Write visual/responsive tests
    - Verify no horizontal scrolling at representative widths (320, 768, 1024, 1920) for admin and portal
    - _Requirements: 16.5, 16.6_

- [x] 21. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for a faster MVP.
- Each task references the specific requirement sub-clauses it implements for traceability.
- Property tests target the pure domain layer (Properties 1–36), each as a single test running ≥ 100 iterations and tagged `// Feature: client-sign-off-dashboard, Property {number}: {property_text}`.
- Unit, component, integration, smoke, and visual tests cover the non-property criteria (UI, Auth, Storage, FK/cascade, transactional rollback, responsiveness) per the design's Testing Strategy.
- Checkpoints provide incremental validation points; the domain layer is built and fully property-tested before persistence and UI are wired on top of it.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1", "5.1", "6.1", "7.1", "9.1", "10.1", "12.1", "17.1"] },
    { "id": 3, "tasks": ["2.2", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "5.9", "5.10", "6.2", "6.3", "6.4", "7.2", "7.3", "7.4", "7.5", "7.6", "9.2", "10.2", "10.3", "12.3", "16.1", "17.2", "17.3", "17.5", "17.6", "17.7", "17.8", "17.9"] },
    { "id": 4, "tasks": ["2.3", "9.3", "9.4", "9.5", "9.6", "9.7", "9.8", "9.9", "9.10", "10.4", "10.5", "10.6", "10.7", "10.8", "10.9", "10.10", "10.11", "10.12", "10.13", "10.14", "16.2", "16.3", "17.4"] },
    { "id": 5, "tasks": ["3.1", "3.2", "2.5", "12.2", "16.4"] },
    { "id": 6, "tasks": ["2.4", "3.3", "12.4", "13.1", "13.2", "13.3", "13.4", "13.5", "13.6", "13.7", "13.8", "13.9", "16.5", "17.10"] },
    { "id": 7, "tasks": ["13.10", "14.1", "14.2", "14.3", "14.4", "18.1", "18.2", "18.3", "18.4", "18.5", "18.6", "18.7", "18.8"] },
    { "id": 8, "tasks": ["14.5", "18.9", "19.1", "19.4", "20.1"] },
    { "id": 9, "tasks": ["19.2", "19.3", "19.5"] },
    { "id": 10, "tasks": ["19.6", "20.2", "20.3"] },
    { "id": 11, "tasks": ["20.4"] }
  ]
}
```
