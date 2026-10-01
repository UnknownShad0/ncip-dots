# DOTS — Current Project Context

This file is the short, practical reference for the project as it exists in the workspace today. It is meant to be the one document to read before asking implementation questions.

---

## 1. Project Purpose

DOTS is a document tracking and routing system for NCIP operations. The system supports:

- document creation and status tracking
- office-based routing and assignment
- user access control and role-based workflows
- document archives and retrieval
- audit trail visibility
- integration with external systems such as DRIP, iPLuma, and PDMIS

---

## 2. Current Architecture

The active codebase is not the old CodeIgniter HMVC application described in the legacy docs. It is a Laravel 12 application with modern frontend tooling.

### Architecture summary

- Backend: Laravel 12
- ORM: Eloquent
- Frontend: Inertia + React + TypeScript
- Styling: Tailwind CSS + Vite
- Auth: Laravel authentication flow with Breeze-style conventions
- Data access: migrations + models + legacy compatibility adapters

### Request flow

Browser -> Laravel route -> Controller -> Eloquent model -> Inertia render -> React component

This is the active modern architecture used in the current workspace.

---

## 3. Core Domain Objects

### User

File: `app/Models/User.php`

Core responsibilities:
- authentication and profile data
- role-based access checks
- assignment to an office/division
- document creation history
- audit trail ownership

Important methods:
- `isAdministrator()`
- `canManageLibraries()`
- `canReceiveDocuments()`

### Office

File: `app/Models/Office.php`

Represents the modern replacement for the legacy `bureau` concept.

Important features:
- parent/child hierarchy via `parent_id`
- belongs to a `Range`
- contains `Division` records
- links to users and organization structure

### Division

File: `app/Models/Division.php`

- belongs to an office
- used to structure operational subunits

### Document

File: `app/Models/Document.php`

This is the primary transactional entity.

Key fields include:
- `title`
- `tracking_number`
- `document_type_id`
- `action_type_id`
- `purpose_type_id`
- `origin_type`
- `office_id`
- `division_id`
- `created_by`
- `status`
- `urgent`
- `notify_by_email`
- `is_finalized`
- `received_at`
- `is_archived`
- `remarks`

Key relationships:
- `documentType()`
- `actionType()`
- `purposeType()`
- `office()`
- `division()`
- `creator()`
- `trails()`
- `files()`

### DocumentTrail

File: `app/Models/DocumentTrail.php`

Used to log the movement and status history of a document.

Key relationship fields:
- `document_id`
- `from_office_id`
- `to_office_id`
- `assigned_to_user_id`
- `created_by`
- `status`
- `action`
- `remarks`

This is the modern operational equivalent of the legacy `document_trail` table.

### DocumentFile

File: `app/Models/DocumentFile.php`

Stores uploaded files associated with documents.

---

## 4. Active Database Structure

The current migration files show a modernized schema with pluralized tables.

### Main tables in active Laravel schema

- `users`
- `offices`
- `divisions`
- `document_types`
- `action_types`
- `purpose_types`
- `documents`
- `document_trails`
- `document_files`
- `audit_trails`
- `bureaus`
- `ranges`

### Example key relationships

- `documents.document_type_id` -> `document_types.id`
- `documents.action_type_id` -> `action_types.id`
- `documents.purpose_type_id` -> `purpose_types.id`
- `documents.office_id` -> `offices.id`
- `documents.division_id` -> `divisions.id`
- `documents.created_by` -> `users.id`
- `document_trails.document_id` -> `documents.id`
- `document_trails.from_office_id` -> `offices.id`
- `document_trails.to_office_id` -> `offices.id`
- `document_trails.assigned_to_user_id` -> `users.id`

---

## 5. Legacy Compatibility Layer

This project is intentionally in a migration state.

The docs under `md/` describe the older codebase and the old naming conventions. The actual project includes compatibility models and adapters for the legacy database with singular table names.

Examples of legacy naming patterns:
- `user` instead of `users`
- `document` instead of `documents`
- `bureau` instead of `offices`
- `document_trail` instead of `document_trails`

Relevant compatibility files include:
- `app/Models/UserLegacy.php`
- `app/Models/DocumentLegacy.php`
- `app/Models/DocumentTrailLegacy.php`
- `app/Models/BureauLegacy.php`
- `app/Models/ActionTypeLegacy.php`
- `app/Models/PurposeTypeLegacy.php`
- `app/Models/DivisionLegacy.php`

This means the project is in a hybrid state: modern Laravel app + read compatibility with the historical database.

---

## 6. Routes and Module Structure

The main app routes are declared in `routes/web.php`.

### Authenticated routes

- `/dashboard`
- `/documents`
- `/documents/latest`
- `/archives`
- `/audit-trail`
- `/offices`
- `/ranges`
- `/document-types`
- `/action-types`
- `/purpose-types`
- `/user-accounts`
- `/drip`
- `/ipluma`
- `/pdmis`
- `/profile`

### Admin-only route group

The route file uses an `administrator` middleware group to protect setup and library management screens.

---

## 7. Important Files to Reference

### Project entry points
- `routes/web.php`
- `app/Models/User.php`
- `app/Models/Document.php`
- `app/Models/DocumentTrail.php`
- `app/Models/Office.php`
- `app/Models/Division.php`

### Migrations that shape the current model
- `database/migrations/2026_09_23_000001_create_offices_table.php`
- `database/migrations/2026_09_23_000006_create_documents_table.php`
- `database/migrations/2026_09_23_000007_create_document_trails_table.php`
- `database/migrations/2026_09_25_000002_create_bureau_table.php`

### Reference documentation
- `md/PROJECT_ANALYSIS_V2.md`
- `md/ERD_V2.md`
- `md/LEGACY_DB_COMPATIBILITY.md`
- `md/MIGRATION_SPEC.md`

---

## 8. Working Assumption for Future Questions

When asking for design or implementation guidance, assume the project is:

- currently a Laravel application
- still in transition from legacy DB naming and workflow conventions
- using modern Eloquent relationships for document routing, office hierarchy, and user assignments
- expected to evolve toward a normalized, future-state Laravel schema without the legacy singular naming layer

---

## 9. Short Summary

DOTS is a government document tracking system being modernized from a legacy CodeIgniter system into a Laravel 12 application. The active app centers on users, offices, divisions, documents, and document trails, with a migration layer that still supports legacy database structures. The project is operationally document-driven and workflow-heavy, but the codebase is actively moving toward a cleaner, normalized Laravel architecture.
