# Requirements Document

## Introduction

This feature introduces a tiered client data retention system for the UX Client Sign-off Dashboard. It adds client lifecycle management through three operations — Archive, Delete Profile, and Permanent Delete — each with increasing levels of data removal. The system prioritises preserving project history, approvals, and sign-off records while giving administrators control over client data lifecycle. Approval records are treated as immutable audit artefacts throughout all operations.

## Glossary

- **Dashboard**: The UX Client Sign-off Dashboard application used by designers to manage client projects and approvals.
- **Client**: A record in the `clients` table representing an external stakeholder who reviews and approves design work.
- **Client_Status**: A field on the Client record with allowed values: `Active` or `Archived`.
- **Admin**: The authenticated designer user who owns the Client record (identified by `owner_id`).
- **System_Administrator**: A user with elevated privileges who can perform permanent deletion operations.
- **Approval_Record**: An immutable entry in the `approvals` table containing reviewer name, initials, timestamp, decision, and checklist snapshot.
- **Project_History**: The collection of projects, phases, checklist items, design links, comments, activity logs, and tasks associated with a Client.
- **Share_Link**: A tokenised URL granting external access to review a project or phase.
- **Retention_System**: The subsystem responsible for managing client status transitions, data preservation, and deletion logic.
- **Danger_Zone**: A clearly separated section of the admin UI reserved for irreversible destructive actions.

## Requirements

### Requirement 1: Client Status Field

**User Story:** As an Admin, I want each client to have a visible status (Active or Archived), so that I can distinguish between current and former clients.

#### Acceptance Criteria

1. THE Retention_System SHALL store a Client_Status value of `Active` or `Archived` on every Client record.
2. WHEN a new Client is created, THE Retention_System SHALL set the Client_Status to `Active`.
3. THE Dashboard SHALL display the Client_Status on each Client record in the client detail view.

### Requirement 2: Client List Filtering

**User Story:** As an Admin, I want to filter the clients list by status, so that I can quickly find active or archived clients.

#### Acceptance Criteria

1. THE Dashboard SHALL provide filter options on the clients list: "All Clients", "Active Clients", and "Archived Clients".
2. WHEN the "Active Clients" filter is selected, THE Dashboard SHALL display only Client records with Client_Status equal to `Active`.
3. WHEN the "Archived Clients" filter is selected, THE Dashboard SHALL display only Client records with Client_Status equal to `Archived`.
4. WHEN the "All Clients" filter is selected, THE Dashboard SHALL display all Client records regardless of Client_Status.
5. WHEN the clients list loads without an explicit filter selection, THE Dashboard SHALL default to displaying "Active Clients".

### Requirement 3: Archive Client

**User Story:** As an Admin, I want to archive a client, so that the client is hidden from active workflows while all historical data is preserved.

#### Acceptance Criteria

1. WHEN an Admin initiates the archive action on a Client, THE Retention_System SHALL set the Client_Status to `Archived`.
2. WHILE a Client has Client_Status equal to `Archived`, THE Dashboard SHALL exclude that Client from the active clients list.
3. WHILE a Client has Client_Status equal to `Archived`, THE Dashboard SHALL exclude that Client from active project filter dropdowns.
4. WHILE a Client has Client_Status equal to `Archived`, THE Retention_System SHALL prevent new Share_Link tokens from granting access to that Client's projects.
5. WHILE a Client has Client_Status equal to `Archived`, THE Retention_System SHALL retain all Project_History including projects, phases, checklist items, design links, comments, uploaded files, tasks, activity logs, and Approval_Records.
6. WHILE a Client has Client_Status equal to `Archived`, THE Dashboard SHALL display that Client's data when viewing archived clients, historical project reports, or Approval_Records.

### Requirement 4: Restore Archived Client

**User Story:** As an Admin, I want to restore an archived client, so that the client becomes active again with all historical data intact.

#### Acceptance Criteria

1. WHEN an Admin initiates the restore action on an Archived Client, THE Retention_System SHALL set the Client_Status to `Active`.
2. WHEN a Client is restored, THE Dashboard SHALL display that Client's projects in active project lists.
3. WHEN a Client is restored, THE Dashboard SHALL display that Client's tasks in active task lists.
4. WHEN a Client is restored, THE Retention_System SHALL allow new Share_Link tokens to be generated for that Client's projects.
5. WHEN a Client is restored, THE Retention_System SHALL preserve all existing Approval_Records without modification.

### Requirement 5: Delete Client Profile

**User Story:** As an Admin, I want to delete a client's profile while preserving project history, so that login access is revoked but audit records remain intact.

#### Acceptance Criteria

1. WHEN an Admin initiates the delete profile action on a Client, THE Retention_System SHALL remove the Client's contact profile data.
2. WHEN an Admin initiates the delete profile action on a Client, THE Retention_System SHALL revoke all active Share_Links associated with that Client's projects.
3. WHEN an Admin initiates the delete profile action on a Client, THE Retention_System SHALL retain all projects, phases, checklist items, tasks, comments, uploaded files, activity logs, and Approval_Records associated with that Client.
4. WHEN a Client profile is deleted, THE Retention_System SHALL replace the client relationship on associated projects with a label of "Deleted Client".
5. WHEN a Client profile is deleted, THE Retention_System SHALL preserve Approval_Records showing the original reviewer name, initials, and timestamp without modification.
6. WHEN an Admin initiates the delete profile action, THE Dashboard SHALL display a confirmation modal describing the data that will be removed and the data that will be preserved.

### Requirement 6: Permanent Delete Client

**User Story:** As a System_Administrator, I want to permanently delete a client and all associated data, so that all traces are removed from the system when required.

#### Acceptance Criteria

1. THE Dashboard SHALL restrict the permanent delete action to users with System_Administrator privileges.
2. WHEN a System_Administrator initiates the permanent delete action, THE Dashboard SHALL require password confirmation before proceeding.
3. WHEN a System_Administrator initiates the permanent delete action, THE Dashboard SHALL require the System_Administrator to type the full Client name as confirmation.
4. WHEN a System_Administrator initiates the permanent delete action, THE Dashboard SHALL display a final confirmation modal stating that all data will be irreversibly destroyed.
5. WHEN all confirmation steps are completed, THE Retention_System SHALL delete the Client record and all associated data: projects, phases, checklist items, tasks, comments, uploaded files, design links, activity logs, Share_Links, Approval_Records, and sign-off records.
6. THE Dashboard SHALL never display the permanent delete action as a primary button or in a prominent position.

### Requirement 7: Approval Record Immutability

**User Story:** As an Admin, I want approval records to remain immutable after submission, so that audit integrity is maintained regardless of client lifecycle changes.

#### Acceptance Criteria

1. THE Retention_System SHALL treat each Approval_Record as an immutable audit record after creation.
2. THE Retention_System SHALL store the following fields in each Approval_Record: reviewer name, reviewer initials, timestamp, phase approved, checklist state snapshot, and approval notes.
3. THE Retention_System SHALL permit only the following operations on Approval_Records: view, export, and archive.
4. IF a request is made to modify an existing Approval_Record, THEN THE Retention_System SHALL reject the request and return an error.
5. WHILE a Client is archived or has a deleted profile, THE Dashboard SHALL continue to display Approval_Records with the original reviewer name, initials, and timestamp.

### Requirement 8: Admin UX for Client Actions

**User Story:** As an Admin, I want client lifecycle actions to be clearly differentiated by severity in the UI, so that I can confidently perform the correct action without risk of accidental data loss.

#### Acceptance Criteria

1. THE Dashboard SHALL display "Archive Client" as the primary action button on the Client details page.
2. THE Dashboard SHALL place "Delete Client Profile" in a secondary action menu on the Client details page.
3. THE Dashboard SHALL place "Permanently Delete Client" in a visually distinct Danger_Zone section on the Client details page.
4. WHEN an Admin initiates the archive action, THE Dashboard SHALL display a confirmation modal with a warning banner describing the effects of archiving.
5. WHEN an Admin initiates the delete profile action, THE Dashboard SHALL display a confirmation modal with a warning banner listing preserved and removed data.
6. WHEN a System_Administrator initiates the permanent delete action, THE Dashboard SHALL display a multi-step confirmation flow: password entry, client name entry, and a final destructive-action confirmation modal.
7. THE Dashboard SHALL style destructive actions using red colour indicators and warning iconography consistent with Shopify Polaris danger patterns.
