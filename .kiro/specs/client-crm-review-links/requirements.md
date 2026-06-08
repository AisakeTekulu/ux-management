# Requirements Document

## Introduction

This feature extends the existing Client model in the UX Client Sign-off Dashboard into a full CRM profile with rich contact information, activity tracking, and a professional email-based review link delivery workflow. Instead of immediately generating and copying share links, the admin will confirm and send review links via a branded email with full control over recipient, subject, and message content. All email activity is logged and viewable under both client and project histories.

## Glossary

- **Dashboard**: The admin-facing Next.js application for managing UX projects and client sign-offs
- **Client_Record**: The extended client entity containing full contact details, status, and relationship data
- **Review_Link**: A tokenized URL granting a client access to review project phases
- **Send_Review_Link_Modal**: The confirmation dialog presented when an admin initiates the "Send to Client" action
- **Email_Template**: The auto-generated professional email body containing greeting, project context, review link, and sign-off
- **Email_History_Log**: The append-only record of all review link emails sent, stored per client and project
- **Client_Profile_Page**: The dedicated detail page at `/clients/[id]` displaying all client sections
- **Admin**: An authenticated user who owns and manages clients and projects
- **Active_Client**: A client with status `active` who can receive review emails and submit ideas
- **Archived_Client**: A client with status `archived` who cannot receive new communications but remains in historical records

## Requirements

### Requirement 1: Extended Client Data Model

**User Story:** As an admin, I want to store comprehensive contact and business information for each client, so that I can manage client relationships effectively and auto-fill communication details.

#### Acceptance Criteria

1. THE Client_Record SHALL store the following fields: full_name, business_name, primary_email, secondary_email (optional), phone, website, location, preferred_contact_method, and notes
2. WHEN an existing client record is loaded, THE Dashboard SHALL preserve the existing id, owner_id, name, status, deleted_at, and created_at fields and extend them with the new contact fields
3. THE Client_Record SHALL enforce that primary_email contains a valid email format when provided
4. THE Client_Record SHALL enforce that secondary_email contains a valid email format when provided
5. THE Client_Record SHALL restrict preferred_contact_method to one of: email, phone, or other
6. THE Client_Record SHALL enforce that notes does not exceed 5000 characters

### Requirement 2: Client Profile Page Sections

**User Story:** As an admin, I want a comprehensive client detail page with organized sections, so that I can quickly find client information, review history, and manage the relationship from a single view.

#### Acceptance Criteria

1. THE Client_Profile_Page SHALL display the following sections: Overview, Contact Information, Projects, Sign-offs, Ideas and Requests, Activity Log, and Notes
2. THE Client_Profile_Page SHALL display all linked projects for the client in the Projects section
3. THE Client_Profile_Page SHALL display pending review counts and approval history in the Sign-offs section
4. THE Client_Profile_Page SHALL display a chronological activity log of all client interactions in the Activity Log section
5. THE Client_Profile_Page SHALL use a Shopify Polaris-inspired card layout for each section
6. WHEN a client has no data in a section, THE Client_Profile_Page SHALL display an appropriate empty state message

### Requirement 3: Project-Client Relationship

**User Story:** As an admin, I want projects linked to clients so that project communications auto-fill with client details and I can view all projects under a client.

#### Acceptance Criteria

1. THE Dashboard SHALL maintain a one-to-many relationship between a Client_Record and projects
2. WHEN creating a new project, THE Dashboard SHALL allow the admin to select an existing client or create a new client
3. WHEN a project is linked to a client, THE Dashboard SHALL inherit the client primary_email and full_name for auto-filling communication fields
4. THE Client_Profile_Page SHALL display all projects linked to the client with their current status

### Requirement 4: Send to Client Confirmation Flow

**User Story:** As an admin, I want a confirmation step before sending a review link to a client, so that I can verify the recipient, customize the message, and avoid accidental sends.

#### Acceptance Criteria

1. WHEN the admin clicks "Send to Client" on the project detail page, THE Dashboard SHALL open the Send_Review_Link_Modal instead of immediately generating a share link
2. THE Send_Review_Link_Modal SHALL display with the title "Send Review Link"
3. THE Send_Review_Link_Modal SHALL contain fields for: Client Name, Recipient Email, CC Email (optional), Email Subject, Custom Message, and Review Link Preview
4. THE Send_Review_Link_Modal SHALL auto-fill the Client Name from the linked client full_name
5. THE Send_Review_Link_Modal SHALL auto-fill the Recipient Email from the linked client primary_email
6. THE Send_Review_Link_Modal SHALL auto-fill the Email Subject with the project name and phase context
7. THE Send_Review_Link_Modal SHALL auto-generate the Review Link Preview showing the tokenized review URL
8. THE Send_Review_Link_Modal SHALL provide Cancel and "Send Review Link" action buttons

### Requirement 5: Review Link Modal Editing Capabilities

**User Story:** As an admin, I want to edit the email details before sending, so that I can customize communications for specific situations and keep client records up to date.

#### Acceptance Criteria

1. THE Send_Review_Link_Modal SHALL allow the admin to edit the Recipient Email field before sending
2. THE Send_Review_Link_Modal SHALL allow the admin to edit the Email Subject field before sending
3. THE Send_Review_Link_Modal SHALL allow the admin to edit the Custom Message field before sending
4. THE Send_Review_Link_Modal SHALL display a checkbox labeled "Save changed email to client profile"
5. WHEN the "Save changed email to client profile" checkbox is checked and the email is sent, THE Dashboard SHALL update the client primary_email with the new recipient email
6. THE Send_Review_Link_Modal SHALL provide a "Copy review link" action to copy the review URL to clipboard
7. THE Send_Review_Link_Modal SHALL provide a "Send test email to self" action to send a preview to the admin email
8. THE Send_Review_Link_Modal SHALL provide an email preview showing the formatted message as the client will receive it

### Requirement 6: Email Template Generation

**User Story:** As an admin, I want a professional email template auto-generated for review link delivery, so that client communications are consistent and branded.

#### Acceptance Criteria

1. THE Email_Template SHALL include a personalized greeting using the client full_name
2. THE Email_Template SHALL include the project name and current phase information
3. THE Email_Template SHALL include the review link as a prominent clickable element
4. THE Email_Template SHALL include a professional sign-off with the admin name
5. THE Email_Template SHALL allow the admin to override the generated content via the Custom Message field
6. THE Email_Template SHALL render in a clean, readable format suitable for email delivery

### Requirement 7: Post-Send Activity Logging

**User Story:** As an admin, I want all review link sends logged automatically, so that I can track communication history and know when clients were last contacted.

#### Acceptance Criteria

1. WHEN a review link email is sent successfully, THE Dashboard SHALL log an activity entry with the text "Review link sent to [recipient_email]"
2. WHEN a review link email is sent successfully, THE Dashboard SHALL store: recipient email, project reference, phase reference, email subject, date sent, sent by (admin), and delivery status
3. WHEN a review link email is sent successfully, THE Dashboard SHALL display a success toast notification
4. THE Email_History_Log SHALL be visible under the Client_Profile_Page Activity Log section
5. THE Email_History_Log SHALL be visible under the project detail page

### Requirement 8: Email History Storage

**User Story:** As an admin, I want a complete history of all emails sent to clients, so that I can review past communications and track delivery status.

#### Acceptance Criteria

1. THE Email_History_Log SHALL store: id, client_id, project_id, phase_id, recipient_email, subject, message, sent_by, sent_at, and delivery_status
2. THE Email_History_Log SHALL enforce referential integrity with the clients, projects, and phases tables
3. THE Email_History_Log SHALL be queryable by client_id to display under client details
4. THE Email_History_Log SHALL be queryable by project_id to display under project details
5. THE Email_History_Log SHALL enforce Row Level Security scoped to the owner_id of the related client

### Requirement 9: Missing Email Validation

**User Story:** As an admin, I want clear guidance when a client has no email address, so that I can resolve the issue before attempting to send a review link.

#### Acceptance Criteria

1. IF a client has no primary_email stored, THEN THE Send_Review_Link_Modal SHALL display a warning message indicating no email is on file
2. IF a client has no primary_email stored, THEN THE Send_Review_Link_Modal SHALL allow manual entry of an email address
3. IF no valid email address is present in the Recipient Email field, THEN THE Send_Review_Link_Modal SHALL disable the "Send Review Link" button
4. WHEN the admin enters an email manually and the "Save changed email to client profile" checkbox is checked, THE Dashboard SHALL save the entered email to the client record

### Requirement 10: Archived Client Restrictions

**User Story:** As an admin, I want archived clients to be restricted from receiving new communications, so that I avoid accidentally contacting inactive clients while preserving their history.

#### Acceptance Criteria

1. WHILE a client has status archived, THE Dashboard SHALL prevent sending new review link emails to that client
2. WHILE a client has status archived, THE Dashboard SHALL prevent generating new share links for that client
3. WHILE a client has status archived, THE Dashboard SHALL prevent the client from submitting new ideas
4. THE Dashboard SHALL display archived clients in historical records including past email history and approval records
5. WHEN an admin restores an archived client, THE Dashboard SHALL re-enable all communication capabilities for that client

### Requirement 11: Client Database Schema Extension

**User Story:** As an admin, I want the database schema to support comprehensive client data and email history, so that all CRM and communication features have reliable persistence.

#### Acceptance Criteria

1. THE Dashboard SHALL extend the existing clients table with columns: full_name (text), business_name (text), primary_email (text), secondary_email (text, nullable), phone (text, nullable), website (text, nullable), location (text, nullable), preferred_contact_method (text, default 'email'), and notes (text, nullable)
2. THE Dashboard SHALL create a client_email_history table with columns: id (uuid, primary key), client_id (uuid, foreign key to clients), project_id (uuid, foreign key to projects), phase_id (uuid, nullable, foreign key to phases), recipient_email (text, not null), subject (text, not null), message (text, not null), sent_by (uuid, foreign key to auth.users), sent_at (timestamptz, not null), and delivery_status (text, not null, default 'sent')
3. THE Dashboard SHALL apply Row Level Security policies on client_email_history scoped to the owner_id of the related client
4. THE Dashboard SHALL create database indexes on client_email_history for client_id and project_id columns

### Requirement 12: UI Component Standards

**User Story:** As an admin, I want a consistent, professional interface for client management and email workflows, so that the experience feels polished and trustworthy.

#### Acceptance Criteria

1. THE Dashboard SHALL use Shopify Polaris-inspired Card components for client profile sections
2. THE Dashboard SHALL use Index Table components for email history listings
3. THE Dashboard SHALL use Badge components to indicate client status and email delivery status
4. THE Dashboard SHALL use Toast notifications for success and error feedback after send actions
5. THE Dashboard SHALL use confirmation modals for all send actions to prevent accidental emails
6. WHEN a section has no data, THE Dashboard SHALL display an empty state with descriptive guidance

### Requirement 13: Contextual Awareness in Send Flow

**User Story:** As an admin, I want to clearly see which email, project, phase, and history context applies before sending, so that I never accidentally send a review link to the wrong recipient or for the wrong project.

#### Acceptance Criteria

1. THE Send_Review_Link_Modal SHALL display the project name being reviewed
2. THE Send_Review_Link_Modal SHALL display the phase name being reviewed when applicable
3. THE Send_Review_Link_Modal SHALL display when the last review link was sent to this client for this project
4. THE Send_Review_Link_Modal SHALL display the total number of previous review links sent to this client
5. IF the admin changes the Recipient Email to a different address than the client primary_email, THEN THE Send_Review_Link_Modal SHALL display a notice that the email differs from the client record
