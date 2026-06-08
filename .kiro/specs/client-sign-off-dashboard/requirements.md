# Requirements Document

## Introduction

The Client Sign-Off Dashboard is a web application that helps a UX designer manage client project sign-offs from kickoff to launch. The designer (admin) creates clients and projects, organizes each project into phases (such as Discovery, Wireframes, UI design, Launch), and attaches checklist items, design links, internal notes, and comments to each phase. The designer collects formal approvals from clients through private share links, where a client reviewer can review the shared phase, leave comments, and approve or request changes after entering their name and initials.

The application provides the designer a single place to see what stage each project is in, what is waiting on the client, and what task needs to be done next. It maintains an audit trail of every approval and comment. The interface follows a Shopify Polaris-inspired admin style: white and light-grey surfaces, a left sidebar, card-based content, simple tables, status badges, and timeline components. The client-facing portal is intentionally simpler, presenting a clean centered review page without the admin sidebar.

The technology stack is Next.js with TypeScript, Tailwind CSS, and Supabase (PostgreSQL, authentication, and storage). This document defines the requirements for the MVP.

## Glossary

- **System**: The Client Sign-Off Dashboard web application as a whole.
- **Admin_Dashboard**: The authenticated, admin-facing portion of the System used by the Designer.
- **Client_Portal**: The unauthenticated, public-facing review page accessed by a Client_Reviewer through a Share_Link.
- **Designer**: An authenticated user with the admin role who manages clients, projects, phases, and sign-offs. Also referred to as the admin.
- **Client_Reviewer**: An external person who reviews a shared project or phase and submits an approval or change request through a Share_Link. The Client_Reviewer is not an authenticated user.
- **Client**: A record representing a customer organization or contact for whom the Designer delivers projects.
- **Project**: A record representing a body of work for a Client, composed of an ordered set of Phases.
- **Phase**: A stage of a Project. The default Phase set is: Discovery, Brief sign-off, Sitemap, Wireframes, UI design, Content, Development, Testing, Launch, Handover.
- **Checklist_Item**: A single reviewable line item belonging to a Phase, with a completion state.
- **Design_Link**: A URL or uploaded file reference attached to a Phase that points to design work.
- **Comment**: A text note left on a Phase by either the Designer or a Client_Reviewer.
- **Approval**: A record capturing a Client_Reviewer's sign-off decision for a Phase, including decision, name, initials, and timestamp.
- **Approval_Decision**: The outcome chosen by a Client_Reviewer, one of: Approved or Changes Requested.
- **Task**: An action item the Designer needs to complete, associated with a Project or Phase.
- **Activity_Log**: A chronological record of events for a Project, used to build the activity timeline.
- **Share_Link**: A unique, private URL granting a Client_Reviewer access to a specific Project or Phase in the Client_Portal.
- **Status_Badge**: A visual label indicating the state of a Phase or Project, one of: Draft, Sent to Client, Waiting for Feedback, Changes Requested, Approved, Overdue, Completed.
- **Phase_Status**: The workflow state of a Phase, represented by a Status_Badge value.
- **Due_Date**: The calendar date by which a Phase is expected to be completed or approved.
- **Audit_Trail**: The immutable history of Approvals and Comments retained by the System.
- **Supabase**: The backend platform providing the PostgreSQL database, authentication, and file storage.

## Requirements

### Requirement 1: Designer Authentication

**User Story:** As a Designer, I want to sign in securely, so that only I can manage clients, projects, and sign-offs.

#### Acceptance Criteria

1. WHEN a Designer submits valid credentials, THE System SHALL establish an authenticated session and grant access to the Admin_Dashboard within 3 seconds.
2. IF a Designer submits invalid credentials, THEN THE System SHALL deny access and display an authentication error message that indicates the credentials are invalid without identifying which field was incorrect.
3. WHILE a Designer has no authenticated session, THE System SHALL redirect requests for Admin_Dashboard pages to the sign-in page.
4. WHEN a Designer signs out, THE System SHALL terminate the authenticated session within 2 seconds and require re-authentication for subsequent Admin_Dashboard access.
5. THE System SHALL restrict access to all Client, Project, Phase, Checklist_Item, Comment, Approval, Task, and Activity_Log management functions to authenticated Designers.
6. IF a Designer submits invalid credentials 5 consecutive times within a 15-minute window, THEN THE System SHALL lock the account for 15 minutes and deny all sign-in attempts during the lockout period with an error message indicating the account is temporarily locked.
7. WHEN an authenticated session has no Designer activity for 30 minutes, THE System SHALL terminate the session and require re-authentication for subsequent Admin_Dashboard access.

### Requirement 2: Client Management

**User Story:** As a Designer, I want to create and edit clients, so that I can organize projects by the customer they belong to.

#### Acceptance Criteria

1. WHEN a Designer submits a new Client with a name containing 1 to 100 characters after leading and trailing whitespace is trimmed, THE System SHALL create the Client record and associate it with the Designer.
2. IF a Designer submits a new Client with a name that is empty after trimming whitespace or that exceeds 100 characters after trimming whitespace, THEN THE System SHALL reject the submission, retain the values the Designer entered, and display a validation message identifying the name violation.
3. WHEN a Designer edits an existing Client and submits a name containing 1 to 100 characters after leading and trailing whitespace is trimmed, THE System SHALL persist the updated Client fields.
4. IF a Designer submits an edit to an existing Client with a name that is empty after trimming whitespace or that exceeds 100 characters after trimming whitespace, THEN THE System SHALL reject the edit, preserve the stored Client fields unchanged, and display a validation message identifying the name violation.
5. WHEN a Designer opens the Clients view, THE System SHALL display all Clients owned by the Designer in a table showing each Client name and project count, ordered in ascending sequence by Client name using case-insensitive comparison.
6. WHERE a Client has no associated Projects, THE System SHALL display a project count of 0 for that Client and display an empty-state message inviting the Designer to create a Project.

### Requirement 3: Project Management

**User Story:** As a Designer, I want to create and edit projects under a client, so that I can track each engagement separately.

#### Acceptance Criteria

1. WHEN a Designer submits a new Project with a name of 1 to 120 characters after leading and trailing whitespace is removed and an associated Client, THE System SHALL create the Project record linked to that Client.
2. IF a Designer submits a new Project with no name or with a name that is empty or contains only whitespace after leading and trailing whitespace is removed, THEN THE System SHALL reject the submission, retain the entered values, and display a validation message identifying the missing name.
3. IF a Designer submits a new Project without an associated Client, THEN THE System SHALL reject the submission, retain the entered values, and display a validation message identifying the missing Client.
4. IF a Designer submits a new Project with a name longer than 120 characters after leading and trailing whitespace is removed, THEN THE System SHALL reject the submission, retain the entered values, and display a validation message identifying the 120-character name length limit.
5. IF a Designer submits a new Project with a name that, compared case-insensitively after leading and trailing whitespace is removed, matches the name of an existing Project under the same Client, THEN THE System SHALL reject the submission, retain the entered values, and display a validation message identifying the duplicate name.
6. WHEN a Designer edits an existing Project and submits a name of 1 to 120 characters (after leading and trailing whitespace is removed) that does not, compared case-insensitively, match the name of another Project under the same Client, THE System SHALL persist the updated Project fields and retain the Project's existing Phases.
7. WHEN a Designer creates a Project, THE System SHALL initialize the Project with the default Phase set in the defined order: Discovery, Brief sign-off, Sitemap, Wireframes, UI design, Content, Development, Testing, Launch, Handover.
8. WHEN a Designer opens the Projects view, THE System SHALL display all Projects owned by the Designer in a table ordered case-insensitively by Project name, showing each Project name, associated Client name, current Phase, and Phase_Status.

### Requirement 4: Phase Management

**User Story:** As a Designer, I want each project to be organized into phases with details, so that I can manage and present work stage by stage.

#### Acceptance Criteria

1. WHEN a Designer opens a Project, THE System SHALL display the Project's Phases in ascending order by their assigned ordinal position.
2. WHILE a Project has no Phases, WHEN a Designer opens the Project, THE System SHALL display an empty Phase list indicator.
3. THE System SHALL store, for each Phase, a description of up to 5,000 characters, internal notes of up to 5,000 characters, a Phase_Status equal to one of the defined status values, a Due_Date expressed as a calendar date, and a set of associated Checklist_Items, Design_Links, Comments, and Approvals.
4. WHEN a Designer edits a Phase description, internal notes, or Due_Date with values that satisfy all field constraints and submits the change, THE System SHALL persist the updated Phase fields and retain all unedited fields unchanged.
5. IF a Designer submits a Phase edit in which the Due_Date is not a valid calendar date or the description or internal notes exceed 5,000 characters, THEN THE System SHALL reject the change, retain the previously stored Phase field values, and display an error indication identifying the invalid field.
6. WHEN a Designer adds a Phase to a Project, THE System SHALL append the new Phase as the last ordinal position in the Project and assign it a Phase_Status of Draft.
7. WHERE a Phase has been approved, THE System SHALL store the approving Client_Reviewer's name, signed initials, and approved date on the Phase.
8. IF a user other than the Designer assigned to the Project attempts to edit a Phase's internal notes, THEN THE System SHALL reject the edit and retain the existing internal notes unchanged.

### Requirement 5: Checklist Item Management

**User Story:** As a Designer, I want to add checklist items to a phase, so that the client knows exactly what they are approving.

#### Acceptance Criteria

1. WHEN a Designer adds a Checklist_Item with non-empty text of 1 to 500 characters to a Phase, THE System SHALL create the Checklist_Item associated with that Phase with a completion state of incomplete and persist it within 2 seconds.
2. WHEN a Designer edits the text of a Checklist_Item to non-empty text of 1 to 500 characters and submits the change, THE System SHALL persist the updated text within 2 seconds.
3. WHEN a Designer marks a Checklist_Item as complete or incomplete, THE System SHALL persist the updated completion state within 2 seconds.
4. WHEN a Designer deletes a Checklist_Item, THE System SHALL remove the Checklist_Item from the Phase and persist the removal within 2 seconds.
5. WHEN a Designer opens a Phase that contains one or more Checklist_Items, THE System SHALL display all Checklist_Items for that Phase in ascending order of creation time, each showing its text and completion state.
6. WHEN a Designer opens a Phase that contains no Checklist_Items, THE System SHALL display an empty-checklist indicator.
7. IF a Designer attempts to add or save a Checklist_Item with text that is empty, contains only whitespace, or exceeds 500 characters, THEN THE System SHALL reject the change, display an error message indicating the text is invalid, and leave the existing Checklist_Items unchanged.

### Requirement 6: Design Links and File Attachments

**User Story:** As a Designer, I want to attach design links and files to a phase, so that the client can review the actual work.

#### Acceptance Criteria

1. WHEN a Designer submits a Design_Link with a valid URL that uses the http or https scheme and does not exceed 2048 characters to a Phase, THE System SHALL create the Design_Link associated with that Phase.
2. IF a Designer submits a Design_Link with a value that does not use the http or https scheme or exceeds 2048 characters, THEN THE System SHALL reject the submission, not create the Design_Link, and display a validation message identifying the invalid URL.
3. WHEN a Designer uploads a file that does not exceed 50 MB to a Phase, THE System SHALL store the file in Supabase storage and create a Design_Link referencing the stored file.
4. IF a Designer uploads a file that exceeds 50 MB, THEN THE System SHALL reject the upload, not create the Design_Link, and display an error message indicating that the file exceeds the 50 MB limit.
5. IF the file cannot be stored in Supabase storage, THEN THE System SHALL not create the Design_Link and display an error message indicating the storage failure.
6. WHEN a Designer deletes a Design_Link, THE System SHALL remove the Design_Link from the Phase and, WHERE the Design_Link references a stored file, remove the underlying file from Supabase storage.
7. WHEN a Designer or Client_Reviewer opens a Phase, THE System SHALL display all Design_Links for that Phase as selectable references that, when selected, open the referenced URL or stored file.

### Requirement 7: Comments

**User Story:** As a Designer and as a Client_Reviewer, I want to leave comments on a phase, so that feedback and discussion are captured in one place.

#### Acceptance Criteria

1. WHEN a Designer submits a Comment containing 1 to 5,000 characters of text (after leading and trailing whitespace is trimmed) on a Phase, THE System SHALL create the Comment associated with that Phase, attributed to the Designer, with a creation timestamp recorded in UTC.
2. WHEN a Client_Reviewer submits a Comment containing 1 to 5,000 characters of text (after leading and trailing whitespace is trimmed) through a valid Share_Link, THE System SHALL create the Comment associated with the shared Phase, attributed to the Client_Reviewer, with a creation timestamp recorded in UTC.
3. IF a Comment is submitted with text that is empty or contains only whitespace after trimming, THEN THE System SHALL reject the submission, retain no Comment, and display a validation message indicating that comment text is required.
4. IF a Comment is submitted with more than 5,000 characters of text after trimming, THEN THE System SHALL reject the submission, retain no Comment, and display a validation message indicating the maximum allowed comment length.
5. IF a Client_Reviewer submits a Comment through a Share_Link that is expired or revoked, THEN THE System SHALL reject the submission, retain no Comment, and display a message indicating that the Share_Link is no longer valid.
6. WHEN a Designer or Client_Reviewer opens a Phase that has one or more Comments, THE System SHALL display all Comments for that Phase ordered from oldest to newest by creation timestamp, each with author attribution and creation timestamp.
7. WHEN a Designer or Client_Reviewer opens a Phase that has no Comments, THE System SHALL display an indication that no Comments exist for that Phase.
8. THE System SHALL retain all Comments as part of the Audit_Trail.

### Requirement 8: Share Link Generation

**User Story:** As a Designer, I want to generate a private share link for a project or phase, so that a client can review only what I share with them.

#### Acceptance Criteria

1. WHEN a Designer requests a Share_Link for a Project or a Phase, THE System SHALL generate, within 3 seconds, a Share_Link that is unique across all existing Share_Links and that contains a randomly generated token of at least 32 characters, and SHALL associate it with that Project or Phase.
2. WHEN a Client_Reviewer opens a valid Share_Link, THE System SHALL display the associated Project or Phase in the Client_Portal in read-only mode without requiring authentication, where a valid Share_Link is one that exists and has not been revoked.
3. WHEN a Client_Reviewer opens a Share_Link scoped to a single Phase, THE System SHALL display only that Phase and SHALL deny access to all other Phases and Projects.
4. IF a Client_Reviewer opens a Share_Link that does not exist or has been revoked, THEN THE System SHALL display a message indicating that the link is invalid or no longer available, without disclosing whether the associated Project or Phase exists.
5. WHEN a Designer revokes a Share_Link, THE System SHALL deny all subsequent access through that Share_Link within 5 seconds of the revocation.
6. IF a Client_Reviewer attempts to modify, delete, or create content through a Share_Link, THEN THE System SHALL reject the action and display a message indicating that the Share_Link provides view-only access.

### Requirement 9: Client Review and Sign-Off

**User Story:** As a Client_Reviewer, I want to review the shared work and approve or request changes after entering my name and initials, so that my sign-off is clearly and officially recorded.

#### Acceptance Criteria

1. WHEN a Client_Reviewer opens a valid Share_Link, THE Client_Portal SHALL display the Project title, the current Phase title, the Phase Checklist_Items, the Design_Links, and a comment input.
2. WHEN a Client_Reviewer chooses to approve or request changes, THE System SHALL present a sign-off form requiring a name of 1 to 100 characters and initials of 1 to 10 characters before submission.
3. IF a Client_Reviewer submits a sign-off in which the name or initials is empty, contains only whitespace, or exceeds its maximum length, THEN THE System SHALL reject the submission, retain the entered values, and display a validation message identifying each invalid field.
4. WHEN a Client_Reviewer submits an Approval through a valid Share_Link with an Approval_Decision of Approved, a name of 1 to 100 characters, and initials of 1 to 10 characters, THE System SHALL create an Approval record storing the Approval_Decision, name, initials, associated Phase identifier, the Checklist_Item completion states at the time of sign-off, and the approval timestamp.
5. WHEN a Client_Reviewer submits an Approval through a valid Share_Link with an Approval_Decision of Changes Requested, a name of 1 to 100 characters, and initials of 1 to 10 characters, THE System SHALL create an Approval record storing the Approval_Decision, name, initials, associated Phase identifier, the Checklist_Item completion states at the time of sign-off, and the timestamp.
6. WHEN a Client_Reviewer completes a sign-off, THE Client_Portal SHALL display a confirmation message stating the recorded decision, name, and timestamp.
7. THE System SHALL retain all Approval records as part of the Audit_Trail.
8. WHEN a Client_Reviewer opens a valid Share_Link, THE Client_Portal SHALL display the Approval history for the shared Phase in reverse chronological order by approval timestamp, showing for each entry the Approval_Decision, name, and timestamp.
9. IF a Client_Reviewer submits a sign-off through a Share_Link that does not exist or has been revoked, THEN THE System SHALL reject the submission, create no Approval record, and display a message indicating that the link is invalid or no longer available.
10. THE Client_Portal SHALL provide no means to modify or delete an existing Approval record.

### Requirement 10: Phase Status Lifecycle

**User Story:** As a Designer, I want phase statuses to reflect where each phase is in the workflow, so that I can see at a glance what is waiting on the client.

#### Acceptance Criteria

1. WHEN a Phase is created, THE System SHALL set its Phase_Status to Draft.
2. WHEN a Designer generates or activates a Share_Link for a Phase, THE System SHALL set that Phase's Phase_Status to Sent to Client.
3. WHEN a Client_Reviewer first accesses a Phase through its Share_Link and no Approval has been submitted for that Phase, THE System SHALL set the Phase_Status to Waiting for Feedback.
4. WHEN a Client_Reviewer submits an Approval with an Approval_Decision of Changes Requested, THE System SHALL set the Phase_Status to Changes Requested.
5. WHEN a Client_Reviewer submits an Approval with an Approval_Decision of Approved, THE System SHALL set the Phase_Status to Approved.
6. WHEN the current date becomes strictly later than a Phase's Due_Date and the Phase_Status is neither Approved nor Completed, THE System SHALL flag the Phase as Overdue within 24 hours without changing its Phase_Status.
7. WHEN a Phase that is flagged as Overdue transitions to a Phase_Status of Approved or Completed, THE System SHALL clear the Overdue flag.
8. WHEN a Designer marks a Phase whose Phase_Status is Approved as finished, THE System SHALL set the Phase_Status to Completed.
9. IF a Designer attempts to mark a Phase as finished while the Phase's Phase_Status is not Approved, THEN THE System SHALL reject the action, retain the current Phase_Status, and present an error indication that only approved Phases can be completed.

### Requirement 11: Admin Dashboard Overview

**User Story:** As a Designer, I want a dashboard that summarizes all my work, so that I always know each project's stage, what is waiting on the client, and what I need to do next.

#### Acceptance Criteria

1. WHEN a Designer opens the Admin_Dashboard, THE System SHALL display summary cards reporting the non-negative count of active Projects (Projects with at least one Phase whose Phase_Status is not Completed), the count of Phases that are Waiting for Feedback, the count of Phases that are Overdue, and the count of open Tasks.
2. WHEN a Designer opens the Admin_Dashboard, THE System SHALL display a project status table listing each active Project (a Project with at least one Phase whose Phase_Status is not Completed) with its associated Client name, current Phase, Phase_Status, latest Comment (the most recent Comment on the Project's Phases by creation timestamp), next action (the title of the Project's open Task with the earliest Due_Date), and Due_Date.
3. IF an active Project in the project status table has no open Tasks, THEN THE System SHALL display a "No next action" empty-state indicator in place of the next action for that Project.
4. WHEN a Designer opens the Admin_Dashboard, THE System SHALL display a "Waiting on client" section listing each Phase whose Phase_Status is Sent to Client or Waiting for Feedback.
5. WHEN a Designer opens the Admin_Dashboard, THE System SHALL display a "My next tasks" section listing open Tasks ordered by ascending Due_Date, with Tasks that have no Due_Date listed last.
6. WHEN a Designer opens the Admin_Dashboard, THE System SHALL display a recent activity timeline built from the 20 most recent Activity_Log entries in reverse chronological order.
7. WHILE a Project Phase is Overdue, THE System SHALL display an Overdue Status_Badge for that Phase in the project status table.

### Requirement 12: Task Management

**User Story:** As a Designer, I want a task list of what to do next, so that I do not lose track of follow-ups across projects.

#### Acceptance Criteria

1. WHEN a Designer creates a Task with a title of 1 to 200 characters, THE System SHALL create the Task with an open state and an optional associated Project or Phase.
2. IF a Designer attempts to create a Task with an empty title or a title exceeding 200 characters, THEN THE System SHALL reject the creation, display an error message indicating the title is invalid, and retain the Designer's entered values.
3. WHEN a Designer marks a Task as complete, THE System SHALL set the Task state to complete and exclude it from the open Tasks list.
4. WHEN a Designer opens the Tasks view, THE System SHALL display all open Tasks ordered by Due_Date in ascending order, with Tasks having no Due_Date displayed after all Tasks that have a Due_Date.
5. WHEN a Client_Reviewer submits an Approval with an Approval_Decision of Changes Requested, THE System SHALL create a Task with an open state for the Designer referencing the affected Phase.

### Requirement 13: Activity Timeline and Audit Trail

**User Story:** As a Designer, I want a chronological activity timeline per project, so that I can review the full history of changes, comments, and approvals.

#### Acceptance Criteria

1. WHEN a Comment is created, THE System SHALL record an Activity_Log entry within 2 seconds for the associated Project containing the event type, the actor identity, and a timestamp with second-level precision.
2. WHEN an Approval is created, THE System SHALL record an Activity_Log entry within 2 seconds for the associated Project containing the Approval_Decision, the Client_Reviewer name, and a timestamp with second-level precision.
3. WHEN a Phase_Status changes, THE System SHALL record an Activity_Log entry within 2 seconds for the associated Project containing the previous status, the new status, and a timestamp with second-level precision.
4. WHEN a Designer opens a Project's activity timeline, THE System SHALL display the Activity_Log entries for that Project in reverse chronological order with the most recent entry first, showing a maximum of 50 entries per view.
5. IF a Designer opens a Project's activity timeline that has no Activity_Log entries, THEN THE System SHALL display an empty-state indication that no activity has been recorded for that Project.
6. THE System SHALL retain Approval and Comment Activity_Log entries as part of the Audit_Trail for a minimum of 7 years from the entry timestamp.
7. IF a request attempts to modify or delete an Audit_Trail Activity_Log entry, THEN THE System SHALL reject the request, preserve the original entry unchanged, and return an indication that audit entries are immutable.

### Requirement 14: Admin Interface Design

**User Story:** As a Designer, I want a clean Polaris-inspired admin interface, so that the tool feels like a professional, practical admin product.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL present a persistent left sidebar with navigation entries for Dashboard, Clients, Projects, Tasks, Sign-offs, Activity, and Settings.
2. THE Admin_Dashboard SHALL present a top header bar containing the page title and the primary action for the current page.
3. THE Admin_Dashboard SHALL present content within card-based sections using white and light-grey surfaces, subtle rounded corners, and soft borders.
4. THE Admin_Dashboard SHALL represent each Phase_Status using a Status_Badge that maps each of the seven status values—Draft, Sent to Client, Waiting for Feedback, Changes Requested, Approved, Overdue, and Completed—to exactly one fixed label and one fixed, visually distinct color, applied consistently across every view in which the status appears.
5. WHERE a list view has no records, THE Admin_Dashboard SHALL display an empty-state message with the relevant primary action.
6. WHEN a Designer completes a create, edit, or delete action, THE Admin_Dashboard SHALL display a toast confirmation that identifies the completed action, remaining visible for at least 4 seconds or until the Designer dismisses it.
7. WHEN a Designer initiates a delete action, THE Admin_Dashboard SHALL display a modal confirmation containing a confirm action and a cancel action, and SHALL perform the deletion only after the Designer selects the confirm action.
8. IF a Designer selects the cancel action or dismisses the delete confirmation modal without selecting the confirm action, THEN THE Admin_Dashboard SHALL close the modal and retain the target record and its data unchanged.
9. THE System SHALL treat record retention and record deletion as mutually exclusive outcomes, such that a target record is never both retained and deleted as a result of the same delete action.
10. IF a Designer selects the confirm action but the deletion fails due to a system or network error, THEN THE Admin_Dashboard SHALL retain the target record and its data unchanged and close the modal.

### Requirement 15: Client Portal Design

**User Story:** As a Client_Reviewer, I want a simple, friendly review page, so that approving work feels clear and official without being intimidating or complex.

#### Acceptance Criteria

1. THE Client_Portal SHALL present a centered, single-column review layout that excludes the admin sidebar.
2. THE Client_Portal SHALL display the Project title and current Phase title at the top of the review page, positioned above all other review content.
3. THE Client_Portal SHALL display a labeled section that states the specific deliverable the Client_Reviewer is being asked to approve.
4. THE Client_Portal SHALL present the approve action as the primary action and the request-changes action as the secondary action, rendered as two separate selectable controls.
5. WHEN a Client_Reviewer opens the sign-off form, THE Client_Portal SHALL display a modal containing a name input that accepts 1 to 100 characters, an initials input that accepts 1 to 10 characters, and a statement that the sign-off is an official record.
6. IF a Client_Reviewer submits the sign-off form with the name input empty, the initials input empty, or either input exceeding its maximum length, THEN THE Client_Portal SHALL reject the submission, retain the entered values, and display an error indication identifying each invalid field.

### Requirement 16: Responsive Layout

**User Story:** As a Designer and as a Client_Reviewer, I want the application to work on desktop, tablet, and mobile, so that I can manage and review work from any device.

#### Acceptance Criteria

1. WHILE the viewport width is 1024 pixels or greater, THE System SHALL display the Admin_Dashboard with the persistent left sidebar expanded by default.
2. WHILE the viewport width is 1024 pixels or greater, THE System SHALL allow the Designer to manually collapse and expand the left sidebar, and SHALL retain the selected collapsed or expanded state until the Designer changes it, including across viewport-width changes so that the desktop preference is preserved when the viewport returns to 1024 pixels or greater.
3. WHILE the viewport width is less than 1024 pixels, THE System SHALL collapse the Admin_Dashboard left sidebar into a toggleable navigation control that is hidden by default.
4. WHEN the Designer activates the toggleable navigation control while the viewport width is less than 1024 pixels, THE System SHALL display the sidebar navigation entries.
5. THE System SHALL render all tables, cards, and forms with no horizontal overflow and no horizontal scrolling at every viewport width from 320 pixels to 1920 pixels inclusive.
6. THE Client_Portal SHALL render the review layout as a single vertical column with no horizontal overflow and no horizontal scrolling at every viewport width from 320 pixels to 1920 pixels inclusive.

### Requirement 17: Data Model and Persistence

**User Story:** As a Designer, I want my data reliably stored with a strong structure, so that relationships between clients, projects, phases, and approvals are preserved.

#### Acceptance Criteria

1. THE System SHALL persist users, clients, projects, phases, checklist_items, comments, approvals, tasks, activity_logs, and share_links in the Supabase database.
2. THE System SHALL associate each Project with exactly one Client through a foreign key reference, and SHALL reject persistence of any Project whose referenced Client does not exist, returning an error indication identifying the missing Client reference.
3. THE System SHALL associate each Phase with exactly one Project, and each Checklist_Item, Comment, Approval, and Design_Link with exactly one Phase, through foreign key references, and SHALL reject persistence of any of these records whose referenced parent does not exist, returning an error indication identifying the missing parent reference.
4. WHEN a Designer initiates deletion of a Client, THE System SHALL display a modal confirmation within 2 seconds stating that the Client and all associated Projects, Phases, Checklist_Items, Comments, Approvals, Design_Links, and Tasks will be permanently removed.
5. IF the deletion confirmation modal cannot be displayed, THEN THE System SHALL block the deletion and retain the Client and all associated records.
6. THE System SHALL store, for each Approval record, the approval timestamp in UTC, the Client_Reviewer name (1 to 100 characters), the signed initials (1 to 10 characters), the associated Phase identifier, and the completion state (complete or incomplete) of each associated Checklist_Item, and SHALL reject any Approval record in which any of these fields is absent or empty.
7. WHEN a Designer confirms the deletion in the confirmation modal, THE System SHALL delete the Client together with all associated Projects, Phases, Checklist_Items, Comments, Approvals, Design_Links, and Tasks within 5 seconds.
8. IF a Designer cancels or dismisses the deletion confirmation modal, or IF the confirmation process fails such that neither a confirmation nor a cancellation is registered, THEN THE System SHALL retain the Client and all associated records without modification.
9. IF a database write operation fails during persistence or deletion, THEN THE System SHALL not commit any partial changes, SHALL leave the affected records in their prior state, and SHALL display an error indication describing the failed operation.
