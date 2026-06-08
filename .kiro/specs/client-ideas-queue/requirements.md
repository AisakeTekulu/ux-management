# Requirements Document

## Introduction

The Client Ideas Queue is a feature that extends the existing Client Sign-Off Dashboard. It gives clients a fast, low-friction way to send ideas, feedback, inspiration, website links, documents, screenshots, images, and change requests at any time, without signing in. Clients reach a simple, guided submission form through a private project share link. Every submission lands in a single admin "Ideas Queue" where the Designer can triage it, attach internal notes, change its status, assign it to a project phase, convert it into a Task, and flag it for discussion at the next client meeting.

The feature reuses the existing platform's concepts and infrastructure: the Designer (admin) and the unauthenticated Client_Reviewer, the Project, Phase, Task, and Activity_Log records, the Share_Link token mechanism, the Status_Badge visual language, the Supabase backend (PostgreSQL, Auth, Storage), the Polaris-inspired component library, and the existing admin sidebar. The client-facing surface stays intentionally simple and mobile-friendly, like a guided request form rather than a ticketing system. The admin surface follows the same Polaris-inspired admin style used throughout the dashboard.

This document defines the requirements for the Client Ideas Queue feature, covering the client submission form, validation, file uploads and limits, spam protection, the admin Ideas Queue list and detail, the idea status lifecycle, the project Ideas & Requests tab, the Next Meeting view, email notification, activity logging, and the data model for four new tables.

## Glossary

This feature extends the glossary of the Client Sign-Off Dashboard. The following base terms are reused with their existing definitions: **System**, **Admin_Dashboard**, **Client_Portal**, **Designer**, **Client_Reviewer**, **Client**, **Project**, **Phase**, **Task**, **Activity_Log**, **Share_Link**, **Status_Badge**, and **Supabase**.

New terms introduced by this feature:

- **Idea_Submission**: A record representing a single idea, request, piece of feedback, or change request submitted by a client through the Idea_Form, associated with one Project and one Client.
- **Client_Submitter**: An unauthenticated external person who submits an Idea_Submission through an Idea_Share_Link. The Client_Submitter is a Client_Reviewer acting in the idea-submission context and is not an authenticated user.
- **Idea_Form**: The unauthenticated, client-facing submission form, presented within the Client_Portal, used by a Client_Submitter to create an Idea_Submission.
- **Idea_Share_Link**: A Share_Link scoped to a single Project whose purpose is access to the Idea_Form and submission of Idea_Submissions for that Project. It follows the existing Share_Link token mechanism (unique, randomly generated token of at least 32 characters, revocable).
- **Idea_Type**: The category of an Idea_Submission, one of: New idea, Change request, Website inspiration, Content update, Design feedback, Question, For next meeting.
- **Idea_Priority**: The urgency level of an Idea_Submission, one of: Low, Medium, High, Not sure.
- **Idea_Status**: The workflow state of an Idea_Submission, one of: New, Reviewing, Needs discussion, Approved, Not possible, Added to scope, Completed.
- **Idea_Attachment**: An uploaded file (image, screenshot, or document) stored in Supabase Storage and associated with one Idea_Submission.
- **Idea_Comment**: An internal note or comment authored by the Designer on an Idea_Submission, not visible to the Client_Submitter.
- **Idea_Status_History**: The chronological record of Idea_Status changes for an Idea_Submission, retained as part of the Audit_Trail.
- **Ideas_Queue**: The authenticated, admin-facing view within the Admin_Dashboard that lists all Idea_Submissions across Projects.
- **Inspiration_Link**: A URL pointing to an external website provided by a Client_Submitter as inspiration for an Idea_Submission.
- **Discuss_Next_Meeting_Flag**: A boolean flag on an Idea_Submission indicating the item should be reviewed at the next client meeting.
- **Next_Meeting_View**: The authenticated, admin-facing view that lists Idea_Submissions whose Discuss_Next_Meeting_Flag is set, grouped by Project and Client.
- **Meeting_Outcome**: The result recorded by the Designer for an Idea_Submission during meeting preparation, one of: Discussed, Approved, Rejected, Needs follow-up, Added to task list.

## Requirements

### Requirement 1: Idea Form Access Through a Project Share Link

**User Story:** As a Client_Submitter, I want to open a simple submission form through a private project link without signing in, so that I can share an idea quickly.

#### Acceptance Criteria

1. WHEN a Client_Submitter opens a valid Idea_Share_Link, THE Idea_Form SHALL display within the Client_Portal within 3 seconds without requiring authentication, where a valid Idea_Share_Link is one that exists and has not been revoked.
2. WHEN the Idea_Form is displayed, THE Idea_Form SHALL display the heading "Share an idea or request".
3. WHEN the Idea_Form is displayed, THE Idea_Form SHALL display the Project name derived from the Idea_Share_Link as a read-only value.
4. IF a Client_Submitter attempts to edit, clear, overwrite, or otherwise change the displayed Project name through any input control, THEN THE Idea_Form SHALL retain the original Project name derived from the Idea_Share_Link unchanged.
5. WHEN a Client_Submitter submits the Idea_Form, THE System SHALL associate the submission with the Project derived from the Idea_Share_Link.
6. IF a Client_Submitter opens an Idea_Share_Link that does not exist or has been revoked, THEN THE System SHALL display within 3 seconds a message indicating that the link is invalid or no longer available, without disclosing whether the associated Project exists.
7. THE Idea_Form SHALL exclude the Admin_Dashboard sidebar and SHALL provide no navigation to any Admin_Dashboard view.
8. THE Idea_Form SHALL present the following input controls: a Name field, an Email field, an idea title field, a details field, an Idea_Type selector, an Idea_Priority selector, a related-page URL field, an Inspiration_Link entry control, an image upload control, a document upload control, and a Discuss_Next_Meeting_Flag control labeled "Should we discuss this in the next meeting?".
9. THE Idea_Form SHALL present a submit control labeled "Send to review".
10. THE Idea_Form SHALL render the submission layout as a single vertical column with no horizontal overflow and no horizontal scrolling at every viewport width from 320 pixels to 1920 pixels inclusive.

### Requirement 2: Idea Submission Field Validation

**User Story:** As a Client_Submitter, I want clear feedback when a required field is missing or invalid, so that I can correct it and submit successfully.

#### Acceptance Criteria

1. WHEN a Client_Submitter submits the Idea_Form with a Name of 1 to 100 characters after trimming, an Email that is non-empty after trimming, does not exceed 254 characters, and contains a single @ character separating a non-empty local part from a non-empty domain part, an idea title of 1 to 200 characters after trimming, details of 1 to 5000 characters after trimming, an Idea_Type equal to one of the defined Idea_Type values, and an Idea_Priority equal to one of the defined Idea_Priority values, THE System SHALL accept the submission for persistence.
2. IF a Client_Submitter submits the Idea_Form with a Name that is empty after trimming or exceeds 100 characters after trimming, THEN THE System SHALL reject the submission, retain the entered values, and display a validation message identifying the Name violation.
3. IF a Client_Submitter submits the Idea_Form with an Email that is empty after trimming, exceeds 254 characters, or does not contain a single @ character separating a non-empty local part from a non-empty domain part, THEN THE System SHALL reject the submission, retain the entered values, and display a validation message identifying the Email violation.
4. IF a Client_Submitter submits the Idea_Form with an idea title that is empty after trimming or exceeds 200 characters after trimming, THEN THE System SHALL reject the submission, retain the entered values, and display a validation message identifying the title violation.
5. IF a Client_Submitter submits the Idea_Form with details that are empty after trimming or exceed 5000 characters after trimming, THEN THE System SHALL reject the submission, retain the entered values, and display a validation message identifying the details violation.
6. IF a Client_Submitter submits the Idea_Form with an Idea_Type that is not one of the defined Idea_Type values or an Idea_Priority that is not one of the defined Idea_Priority values, THEN THE System SHALL reject the submission, retain the entered values, and display a validation message identifying the invalid selection.
7. WHERE a Client_Submitter provides a related-page URL that is non-empty after trimming, THE System SHALL accept the submission only if the related-page URL uses the http or https scheme and does not exceed 2048 characters, and SHALL otherwise reject the submission, retain the entered values, and display a validation message identifying the invalid related-page URL.
8. WHERE a Client_Submitter provides one or more Inspiration_Links, THE System SHALL accept the submission only if each Inspiration_Link uses the http or https scheme and does not exceed 2048 characters, and SHALL otherwise reject the submission, retain the entered values, and display a validation message identifying each invalid Inspiration_Link.
9. IF a Client_Submitter submits the Idea_Form with more than 10 Inspiration_Links, THEN THE System SHALL reject the submission, retain the entered values, and display a validation message indicating that a maximum of 10 Inspiration_Links is allowed.
10. IF a Client_Submitter submits the Idea_Form with more than one field that violates its validation rules, THEN THE System SHALL reject the submission, retain the entered values, and display a validation message identifying every violating field.

### Requirement 3: Idea Attachment Uploads and Limits

**User Story:** As a Client_Submitter, I want to attach screenshots, images, and documents to my idea, so that the Designer can see exactly what I mean.

#### Acceptance Criteria

1. WHEN a Client_Submitter uploads a file whose type is one of the allowed types, whose size is at least 1 byte and does not exceed 25 megabytes (26,214,400 bytes), and whose original file name does not exceed 255 characters, THE System SHALL store the file in Supabase Storage and create an Idea_Attachment referencing the stored file, where the allowed types are PNG, JPEG, GIF, WEBP, PDF, Microsoft Word DOC, Microsoft Word DOCX, plain text, CSV, and Microsoft Excel XLS and XLSX.
2. IF a Client_Submitter uploads a file whose type is not one of the allowed types, THEN THE System SHALL reject that file, create no Idea_Attachment for it, and display an error message identifying the unsupported file type.
3. IF a Client_Submitter uploads a file whose size exceeds 25 megabytes (26,214,400 bytes), THEN THE System SHALL reject that file, create no Idea_Attachment for it, and display an error message indicating the 25 megabyte (26,214,400-byte) per-file size limit.
4. IF the total number of files attached to a single Idea_Submission exceeds 10, THEN THE System SHALL reject the submission, retain the entered values, and display an error message indicating the 10-file maximum per Idea_Submission.
5. IF the System cannot store an uploaded file in Supabase Storage, THEN THE System SHALL create no Idea_Attachment for that file, reject the submission, and display an error message indicating the storage failure.
6. WHEN the System stores an Idea_Attachment, THE System SHALL record the original file name, the file type, and the file size in bytes for that Idea_Attachment.
7. IF a Client_Submitter uploads a file whose size is 0 bytes, THEN THE System SHALL reject that file, create no Idea_Attachment for it, and display an error message indicating that the file is empty.
8. IF a Client_Submitter uploads a file whose original file name exceeds 255 characters, THEN THE System SHALL reject that file, create no Idea_Attachment for it, and display an error message indicating the 255-character file name limit.

### Requirement 4: Spam Protection

**User Story:** As a Designer, I want the public submission form protected against automated abuse, so that the Ideas Queue stays free of spam.

#### Acceptance Criteria

1. THE Idea_Form SHALL include a honeypot field that is rendered so that it is neither visible to nor focusable by a Client_Submitter using a standard web browser, and that contains no pre-filled value.
2. IF a submission of the Idea_Form contains a honeypot field value that is non-empty after leading and trailing whitespace is trimmed, THEN THE System SHALL reject the submission, create no Idea_Submission, and display the same submission confirmation message shown for a successful submission, without persisting any record.
3. IF more than 5 submission attempts are received through a single Idea_Share_Link within any 10-minute rolling window, THEN THE System SHALL reject each further submission attempt through that Idea_Share_Link for the remainder of that window and display a message indicating that the submission rate limit has been reached.
4. WHEN the System rejects an Idea_Form submission because its honeypot field is non-empty after trimming or because the Idea_Share_Link's 5-submission limit within a 10-minute rolling window has been reached, THE System SHALL create no Idea_Submission, no Idea_Attachment, and no Activity_Log entry.

### Requirement 5: Idea Submission and Confirmation

**User Story:** As a Client_Submitter, I want confirmation that my idea was received, so that I know it reached the Designer.

#### Acceptance Criteria

1. WHEN the System accepts a valid Idea_Form submission, THE System SHALL, within 2 seconds, create an Idea_Submission associated with the Project and Client derived from the Idea_Share_Link, store the submitted Name, Email, title, details, Idea_Type, Idea_Priority, related-page URL, Inspiration_Links, and Discuss_Next_Meeting_Flag, and set the Idea_Status to New.
2. WHEN the System creates an Idea_Submission, THE System SHALL record a creation timestamp and an updated timestamp for that Idea_Submission, each expressed in UTC to second-level precision, with the updated timestamp equal to the creation timestamp at the time of creation.
3. WHEN the System creates an Idea_Submission, THE System SHALL create an initial Idea_Status_History entry recording the Idea_Status value New and a timestamp expressed in UTC to second-level precision.
4. WHEN the System has successfully persisted the Idea_Submission, THE Idea_Form SHALL display, within 2 seconds, the confirmation message "Thanks — your idea has been added to the review queue. Isaac will review it and discuss it with you if needed."
5. IF a Client_Submitter submits the Idea_Form through an Idea_Share_Link that does not exist or has been revoked, THEN THE System SHALL reject the submission, create no Idea_Submission, and display a message indicating that the link is invalid or no longer available.
6. IF the System cannot create or persist the Idea_Submission due to a system, database, or storage error after accepting a valid Idea_Form submission, THEN THE System SHALL persist no partial Idea_Submission, retain the values the Client_Submitter entered, display no confirmation message, and display an error message indicating that the idea was not saved and should be resubmitted.
7. WHEN the System creates an Idea_Submission, THE System SHALL persist the Idea_Submission and its initial Idea_Status_History entry as a single atomic operation such that either both are persisted or neither is persisted.

### Requirement 6: Admin Email Notification on New Submission

**User Story:** As a Designer, I want an email when a client submits a new idea, so that I notice incoming requests without watching the dashboard.

#### Acceptance Criteria

1. WHEN the System creates a new Idea_Submission, THE System SHALL send exactly one email notification to the email address of record for the Designer who owns the associated Project within 60 seconds of the Idea_Submission creation.
2. WHEN the System sends the new-submission email notification, THE System SHALL include the Project name, the Client_Submitter Name, the idea title, the Idea_Type, and the Idea_Priority in the email content, and SHALL display an explicit not-provided indicator for any of these values that is empty.
3. IF an attempt to send the new-submission email notification fails, THEN THE System SHALL retry the send up to 3 additional times, with all retry attempts completed within 5 minutes of the Idea_Submission creation.
4. IF the new-submission email notification has not been sent successfully after the initial attempt and 3 retries, THEN THE System SHALL retain the created Idea_Submission unchanged and record the notification failure, including the Idea_Submission identifier and the failure reason, in the System log.
5. IF the Designer who owns the associated Project has no valid email address of record, THEN THE System SHALL not attempt to send the new-submission email notification, retain the created Idea_Submission unchanged, and record the notification failure, including the Idea_Submission identifier, in the System log.

### Requirement 7: Ideas Queue Navigation and List

**User Story:** As a Designer, I want a single Ideas Queue view of all client submissions, so that I can triage every incoming idea in one place.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL present a sidebar navigation entry labeled "Ideas Queue" that opens the Ideas_Queue view.
2. WHEN a Designer opens the Ideas_Queue view, THE System SHALL display all Idea_Submissions for Projects owned by the Designer in a table, each row showing the Client_Submitter Name, the Project name, the idea title, the Idea_Type, the Idea_Priority, the Idea_Status, the submitted date, and the count of Idea_Attachments associated with that Idea_Submission.
3. WHEN a Designer opens the Ideas_Queue view, THE System SHALL order the Idea_Submissions in reverse chronological order by creation timestamp with the most recently submitted Idea_Submission first, and for Idea_Submissions with equal creation timestamps THE System SHALL order them by descending Idea_Submission identifier.
4. WHERE no Idea_Submissions exist for Projects owned by the Designer, THE System SHALL display an empty-state message indicating that no ideas have been submitted.
5. WHEN a Designer selects an Idea_Submission row in the Ideas_Queue view, THE System SHALL open the detail view for that Idea_Submission.
6. WHEN the requesting user is an authenticated Designer, THE System SHALL grant access to the Ideas_Queue view.
7. IF the requesting user is not authenticated or is not a Designer, THEN THE System SHALL deny access to the Ideas_Queue view, display no Idea_Submissions, and display a message indicating that Designer authentication is required.
8. IF retrieval or loading of the Idea_Submissions fails, THEN THE System SHALL display neither a partial nor a stale list of Idea_Submissions and SHALL display an error message indicating that the Ideas_Queue could not be loaded.

### Requirement 8: Idea Detail View

**User Story:** As a Designer, I want to open an idea and see all of its content and attachments, so that I can understand and act on the request.

#### Acceptance Criteria

1. WHEN a Designer opens the detail view for an Idea_Submission, THE System SHALL display the Client_Submitter Name, the Client_Submitter Email, the Project name, the Client name, the idea title, the details, the Idea_Type, the Idea_Priority, the Idea_Status, an indication of whether the Discuss_Next_Meeting_Flag is set or cleared, and the submitted date.
2. WHEN a Designer opens the detail view for an Idea_Submission that has one or more Idea_Attachments, THE System SHALL display each Idea_Attachment as a selectable reference that, when selected, opens the stored file.
3. WHEN a Designer opens the detail view for an Idea_Submission that has one or more Inspiration_Links, THE System SHALL display each Inspiration_Link as a selectable reference that, when selected, opens the referenced URL.
4. WHEN a Designer submits an Idea_Comment containing 1 to 5000 characters of text after trimming on an Idea_Submission, THE System SHALL create the Idea_Comment associated with that Idea_Submission, attributed to the Designer, with a creation timestamp in UTC.
5. IF a Designer submits an Idea_Comment with text that is empty after trimming or exceeds 5000 characters after trimming, THEN THE System SHALL reject the submission, create no Idea_Comment, retain the comment text the Designer entered, and display a validation message indicating the text is invalid.
6. IF the System fails to persist an Idea_Comment after validation passes, THEN THE System SHALL reject the submission, create no Idea_Comment, and display an error message describing the failed operation.
7. WHEN a Designer opens the detail view for an Idea_Submission that has one or more Idea_Comments, THE System SHALL display all Idea_Comments for that Idea_Submission ordered from oldest to newest by creation timestamp, each with author attribution and creation timestamp.
8. IF a request to open the detail view of an Idea_Submission does not originate from the authenticated Designer who owns the Project associated with that Idea_Submission, THEN THE System SHALL deny access to the detail view and SHALL NOT display any Idea_Submission field, Idea_Attachment, Inspiration_Link, or Idea_Comment.
9. WHEN a Designer opens the detail view for an Idea_Submission that has a non-empty related-page URL, THE System SHALL display the related-page URL.
10. IF a Designer selects an Idea_Attachment reference and the System cannot retrieve or open the stored file, THEN THE System SHALL display an error message indicating that the attachment could not be opened and SHALL keep the detail view displayed.
11. WHEN a Designer opens the detail view for an Idea_Submission, THE System SHALL display an empty-state indicator in place of the related-page URL when the Idea_Submission has no related-page URL, in place of the Idea_Attachments list when the Idea_Submission has no Idea_Attachments, in place of the Inspiration_Links list when the Idea_Submission has no Inspiration_Links, and in place of the Idea_Comments list when the Idea_Submission has no Idea_Comments.

### Requirement 9: Idea Status Lifecycle

**User Story:** As a Designer, I want each idea to move through clear status values, so that I can track where every request stands.

#### Acceptance Criteria

1. WHEN an Idea_Submission is created, THE System SHALL set its Idea_Status to New.
2. WHEN a Designer changes the Idea_Status of an Idea_Submission to one of the defined Idea_Status values that differs from its current Idea_Status, THE System SHALL persist the new Idea_Status and set the Idea_Submission updated timestamp to the time of the change in UTC.
3. WHEN the System changes the Idea_Status of an Idea_Submission, THE System SHALL create an Idea_Status_History entry recording the previous Idea_Status, the new Idea_Status, the Designer identity, and a timestamp in UTC.
4. IF a Designer attempts to change the Idea_Status of an Idea_Submission to a value that is not one of the defined Idea_Status values, THEN THE System SHALL reject the change, retain the current Idea_Status, create no Idea_Status_History entry, leave the Idea_Submission updated timestamp unchanged, and display an error message indicating the invalid status value.
5. WHEN a Designer opens the detail view for an Idea_Submission, THE System SHALL display the Idea_Status_History entries for that Idea_Submission in reverse chronological order by timestamp with the most recent entry first, each entry showing the previous Idea_Status, the new Idea_Status, the Designer identity, and the UTC timestamp.
6. THE System SHALL represent each Idea_Status using a Status_Badge that maps each of the seven Idea_Status values — New, Reviewing, Needs discussion, Approved, Not possible, Added to scope, and Completed — to exactly one fixed label and one fixed, visually distinct color, applied consistently across every view in which the Idea_Status appears.
7. WHEN a Designer attempts to change the Idea_Status of an Idea_Submission to a value equal to its current Idea_Status, THE System SHALL make no change, create no Idea_Status_History entry, and leave the Idea_Submission updated timestamp unchanged.
8. IF the System fails to persist an Idea_Status change after validation passes, THEN THE System SHALL retain the current Idea_Status, create no Idea_Status_History entry, leave the Idea_Submission updated timestamp unchanged, and display an error message describing the failed operation.

### Requirement 10: Convert Idea to Task

**User Story:** As a Designer, I want to convert an idea into a task, so that actionable requests flow into my existing task list.

#### Acceptance Criteria

1. WHEN a Designer converts an Idea_Submission into a Task, THE System SHALL create a Task in an open state whose title is set to the Idea_Submission's idea title and that references the Idea_Submission's associated Project.
2. WHERE a Designer has assigned the Idea_Submission to a Phase, WHEN the Designer converts that Idea_Submission into a Task, THE System SHALL set the created Task's referenced Phase to the assigned Phase.
3. WHEN the System creates a Task from an Idea_Submission, THE System SHALL record an association between the created Task and the source Idea_Submission.
4. IF the Idea_Submission's idea title exceeds 200 characters, THEN THE System SHALL set the created Task's title to the first 200 characters of the Idea_Submission's idea title when creating the Task.
5. IF the System cannot persist the Task while converting an Idea_Submission into a Task, THEN THE System SHALL create no Task, record no association between a Task and the Idea_Submission, retain the Idea_Submission unchanged, and display an error indication describing the failed operation.

### Requirement 11: Assign Idea to a Project Phase

**User Story:** As a Designer, I want to assign an idea to a project phase, so that the request is organized within the work it affects.

#### Acceptance Criteria

1. WHEN a Designer assigns an Idea_Submission to a Phase that exists and belongs to the Idea_Submission's associated Project, THE System SHALL persist the assignment of that Phase to the Idea_Submission, replace any previously assigned Phase on that Idea_Submission, and set the Idea_Submission's updated timestamp to the current UTC date and time.
2. IF a Designer attempts to assign an Idea_Submission to a Phase that does not exist or does not belong to the Idea_Submission's associated Project, THEN THE System SHALL reject the assignment, retain the current Phase assignment unchanged, and return an error indication that the specified Phase is invalid for the Idea_Submission.
3. WHILE an Idea_Submission has an assigned Phase, WHEN a Designer removes the Phase assignment from the Idea_Submission, THE System SHALL persist the Idea_Submission with no assigned Phase and set the Idea_Submission's updated timestamp to the current UTC date and time.
4. IF persistence of a Phase assignment or removal fails, THEN THE System SHALL not commit any partial change, retain the Idea_Submission's prior Phase assignment, and return an error indication that the operation did not complete.

### Requirement 12: Mark Idea for Next Meeting

**User Story:** As a Designer, I want to flag ideas for the next meeting, so that I can prepare a focused discussion list.

#### Acceptance Criteria

1. WHEN an authenticated Designer who owns the Idea_Submission's associated Project sets the Discuss_Next_Meeting_Flag on that Idea_Submission, THE System SHALL persist the Discuss_Next_Meeting_Flag as set for that Idea_Submission and update the Idea_Submission updated timestamp in UTC.
2. WHEN an authenticated Designer who owns the Idea_Submission's associated Project clears the Discuss_Next_Meeting_Flag on that Idea_Submission, THE System SHALL persist the Discuss_Next_Meeting_Flag as cleared for that Idea_Submission and update the Idea_Submission updated timestamp in UTC.
3. WHEN a Client_Submitter submits an Idea_Form with the Discuss_Next_Meeting_Flag control selected, THE System SHALL create the Idea_Submission with the Discuss_Next_Meeting_Flag set.
4. WHEN a Client_Submitter submits an Idea_Form with the Discuss_Next_Meeting_Flag control unselected, THE System SHALL create the Idea_Submission with the Discuss_Next_Meeting_Flag cleared.
5. IF the System fails to persist a change to the Discuss_Next_Meeting_Flag on an Idea_Submission after the change is initiated, THEN THE System SHALL retain the prior Discuss_Next_Meeting_Flag value, leave the Idea_Submission updated timestamp unchanged, and display an error message describing the failed operation.

### Requirement 13: Project Ideas & Requests Tab

**User Story:** As a Designer, I want an Ideas & Requests tab on each project, so that I can see and filter every idea connected to that project.

#### Acceptance Criteria

1. WHEN a Designer opens a Project, THE System SHALL present an "Ideas & Requests" tab that lists all Idea_Submissions associated with that Project in reverse chronological order by creation timestamp, with the most recently created Idea_Submission first.
2. WHEN a Designer opens the Ideas & Requests tab, THE System SHALL render each Idea_Submission whose Idea_Status is New as visually distinct from every Idea_Submission whose Idea_Status is not New, applying the same visual distinction consistently to every New Idea_Submission in the list.
3. WHEN a Designer applies an Idea_Type filter whose value is one of the defined Idea_Type values in the Ideas & Requests tab, THE System SHALL display all and only the Idea_Submissions whose Idea_Type equals the selected Idea_Type.
4. WHEN a Designer applies an Idea_Status filter whose value is one of the defined Idea_Status values in the Ideas & Requests tab, THE System SHALL display all and only the Idea_Submissions whose Idea_Status equals the selected Idea_Status.
5. WHEN a Designer applies an Idea_Priority filter whose value is one of the defined Idea_Priority values in the Ideas & Requests tab, THE System SHALL display all and only the Idea_Submissions whose Idea_Priority equals the selected Idea_Priority.
6. WHEN a Designer applies the Discuss_Next_Meeting_Flag filter in the Ideas & Requests tab, THE System SHALL display all and only the Idea_Submissions whose Discuss_Next_Meeting_Flag is set.
7. WHERE a Designer applies more than one filter in the Ideas & Requests tab, THE System SHALL display all and only the Idea_Submissions that satisfy every applied filter.
8. WHERE the Ideas & Requests tab contains no Idea_Submissions that satisfy the applied filters, THE System SHALL display an empty-state message indicating that no ideas match the current filters.
9. WHEN a Designer clears all applied filters in the Ideas & Requests tab, THE System SHALL display all Idea_Submissions associated with that Project in reverse chronological order by creation timestamp, with the most recently created Idea_Submission first.

### Requirement 14: Next Meeting View and Meeting Outcomes

**User Story:** As a Designer, I want a Next Meeting view that gathers flagged ideas, so that I can prepare for and run client meetings efficiently.

#### Acceptance Criteria

1. WHEN a Designer opens the Next_Meeting_View, THE System SHALL display all Idea_Submissions whose Discuss_Next_Meeting_Flag is set for Projects owned by the Designer, grouped by Project and Client, and SHALL order the Idea_Submissions within each Project and Client group in reverse chronological order by creation timestamp with the most recently created Idea_Submission first.
2. WHEN the Next_Meeting_View displays an Idea_Submission, THE System SHALL display the idea title, the Idea_Status, all Idea_Comments for that Idea_Submission, and either the current Meeting_Outcome value if a Meeting_Outcome is recorded or an explicit indication that no Meeting_Outcome has been recorded.
3. WHEN a Designer records a Meeting_Outcome for an Idea_Submission as one of the defined Meeting_Outcome values — Discussed, Approved, Rejected, Needs follow-up, or Added to task list — THE System SHALL persist the Meeting_Outcome, record a Meeting_Outcome timestamp in UTC, and update the Idea_Submission updated timestamp in UTC for that Idea_Submission.
4. IF a Designer attempts to record a Meeting_Outcome that is not one of the defined Meeting_Outcome values, THEN THE System SHALL reject the change, retain the current Meeting_Outcome unchanged, and display an error indication identifying the invalid Meeting_Outcome value.
5. WHEN a Designer records a Meeting_Outcome of Added to task list for an Idea_Submission for which no Task already exists, THE System SHALL create exactly one Task with an open state that references the Idea_Submission's associated Project, consistent with Requirement 10.
6. IF a Designer records a Meeting_Outcome of Added to task list for an Idea_Submission for which a Task already exists, THEN THE System SHALL create no additional Task and retain the existing Task unchanged.
7. WHERE the Next_Meeting_View contains no Idea_Submissions whose Discuss_Next_Meeting_Flag is set, THE System SHALL display an empty-state message indicating that no ideas are marked for the next meeting.

### Requirement 15: Activity Logging for Ideas

**User Story:** As a Designer, I want idea submissions and status changes recorded in the activity timeline, so that the project history stays complete.

#### Acceptance Criteria

1. WHEN an Idea_Submission is created, THE System SHALL record an Activity_Log entry within 2 seconds for the associated Project containing an event type identifying the entry as an idea submission, the Client_Submitter Name, the idea title, and a timestamp in UTC with second-level precision.
2. WHEN the Idea_Status of an Idea_Submission changes, THE System SHALL record an Activity_Log entry within 2 seconds for the associated Project containing an event type identifying the entry as an idea status change, the idea title, the Designer identity making the change, the previous Idea_Status, the new Idea_Status, and a timestamp in UTC with second-level precision.
3. THE System SHALL retain Idea_Submission and Idea_Status change Activity_Log entries as part of the Audit_Trail.
4. IF a request attempts to modify or delete an Idea-related Audit_Trail Activity_Log entry, THEN THE System SHALL reject the request, preserve the original entry unchanged, and return an indication that audit entries are immutable.
5. IF the System fails to record an Idea_Submission or Idea_Status change Activity_Log entry, THEN THE System SHALL retain the Idea_Submission and its Idea_Status unchanged and record the logging failure in the System log.

### Requirement 16: Security and Access Control

**User Story:** As a Designer, I want the public idea surface tightly scoped, so that clients can submit ideas without ever reaching the admin dashboard or other clients' data.

#### Acceptance Criteria

1. THE System SHALL grant a Client_Submitter access to the Idea_Form and idea submission solely through a valid Idea_Share_Link, where a valid Idea_Share_Link is one that exists and has not been revoked.
2. WHEN a Designer generates an Idea_Share_Link for a Project, THE System SHALL generate a token that is unique across all existing Share_Links and that contains a randomly generated value of at least 32 characters, and SHALL associate the Idea_Share_Link with that Project.
3. WHEN a Designer revokes an Idea_Share_Link, THE System SHALL deny all subsequent Idea_Form access and idea submission through that Idea_Share_Link within 5 seconds of the revocation.
4. IF a Client_Submitter attempts any operation through an Idea_Share_Link other than viewing the Idea_Form or creating an Idea_Submission for the in-scope Project, THEN THE System SHALL reject the operation, produce no state change, and return an indication that the operation is not permitted without disclosing whether any other Project or its data exists.
5. THE System SHALL restrict viewing, commenting on, status changes to, Phase assignment of, Task conversion of, and Meeting_Outcome recording for Idea_Submissions to authenticated Designers who own the associated Project.
6. IF a user who is not an authenticated Designer owning the associated Project attempts to view, comment on, change the Idea_Status of, assign a Phase to, convert to a Task, or record a Meeting_Outcome for an Idea_Submission, THEN THE System SHALL deny the operation, produce no state change, and return an indication that the user is not authorized without disclosing the Idea_Submission content.
7. THE System SHALL store every Idea_Attachment in Supabase Storage under a path scoped to the owning Designer.
8. THE System SHALL grant retrieval of an Idea_Attachment's stored file solely to the authenticated Designer who owns the Project associated with that Idea_Attachment's Idea_Submission, and SHALL deny retrieval to any other requester producing no state change.

### Requirement 17: Idea Data Model and Persistence

**User Story:** As a Designer, I want idea data reliably structured and stored, so that submissions, attachments, comments, and status history stay connected and durable.

#### Acceptance Criteria

1. THE System SHALL persist Idea_Submissions, Idea_Attachments, Idea_Comments, and Idea_Status_History records in the Supabase database in the tables idea_submissions, idea_attachments, idea_comments, and idea_status_history respectively.
2. THE System SHALL store, for each idea_submissions record, the fields id, project_id, client_id, share_token_id, submitted_by_name, submitted_by_email, title, details, type, priority, related_page_url, inspiration_links, discuss_next_meeting, status, meeting_outcome, meeting_outcome_at, created_at, and updated_at, and SHALL record the created_at and updated_at fields as date and time values in UTC.
3. THE System SHALL associate each Idea_Submission with exactly one Project through a foreign key reference and with exactly one Client through a foreign key reference, and SHALL reject persistence of any Idea_Submission whose referenced Project or Client does not exist, returning an error indication identifying the missing parent reference.
4. THE System SHALL associate each Idea_Attachment, each Idea_Comment, and each Idea_Status_History record with exactly one Idea_Submission through a foreign key reference, and SHALL reject persistence of any of these records whose referenced Idea_Submission does not exist, returning an error indication identifying the missing parent reference.
5. THE System SHALL constrain the type field of each idea_submissions record to one of the defined Idea_Type values, the priority field to one of the defined Idea_Priority values, the status field to one of the defined Idea_Status values, and the meeting_outcome field to one of the defined Meeting_Outcome values or empty.
6. WHEN a Designer deletes an Idea_Submission, THE System SHALL remove the Idea_Submission together with all associated Idea_Attachments, Idea_Comments, and Idea_Status_History records, and SHALL remove the underlying stored files of those Idea_Attachments from Supabase Storage.
7. IF a database write operation fails during persistence or deletion of an Idea_Submission or its associated records, THEN THE System SHALL not commit any partial changes, SHALL leave the affected records in their prior state, and SHALL display an error indication describing the failed operation.
8. WHEN the System modifies an existing idea_submissions record, THE System SHALL set that record's updated_at field to the current date and time in UTC.
9. IF an attempt is made to persist an idea_submissions record whose type, priority, status, or meeting_outcome field value is not within the set defined for that field by Acceptance Criterion 5, THEN THE System SHALL reject the write, persist no part of the record, and return an error indication identifying the field holding the invalid value.
10. IF the System fails to remove one or more underlying stored files of an Idea_Submission's Idea_Attachments from Supabase Storage during deletion, THEN THE System SHALL return an error indication identifying that one or more stored files could not be removed.
