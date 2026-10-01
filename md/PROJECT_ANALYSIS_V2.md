# DOTS — Updated Project Analysis (Laravel Version)

This document is a refreshed analysis of the current project state in the workspace. It reflects the actual Laravel codebase now present in the repository, rather than the older CodeIgniter-era documentation stored elsewhere in this folder.

> Note: the earlier files under `md/` describe the legacy system and migration plan. This version summarizes the code that is actually in the active app: Laravel 12, Inertia, React, and Eloquent-backed document management.

---

## 1. Project Summary

DOTS is a document tracking and routing system for NCIP operations. The domain is built around motion of records between offices, ownership assignment, document metadata, and audit visibility.

The current application goal is to modernize the earlier legacy workflow while keeping compatibility with historical database structures. The repo now contains:

- Laravel 12 backend
- Inertia + React frontend
- Tailwind + Vite pipeline
- Eloquent models for the domain entities
- Legacy model adapters for older singular-table database structures
- Active migration work for the new normalized schema

The system manages:

- documents and tracking numbers
- office hierarchy and divisions
- user assignments and access roles
- action and purpose libraries
- routing history via `document_trails`
- document attachment files
- audit log entries
- archive and reporting workflows
- external integration surfaces for DRIP / iPLuma / PDMIS

---

## 2. Current Technical Stack

### Backend

- PHP 8.2+
- Laravel 12
- Eloquent ORM
- Blade + Inertia server-rendered views
- Laravel Auth and Breeze-style scaffolding
- Maatwebsite Excel
- barryvdh/laravel-dompdf
- spatie/laravel-permission

### Frontend

- Inertia.js
- React
- TypeScript
- Vite
- Tailwind CSS
- Ziggy for route helpers

### Data and Migration Layer

- MySQL-ready schema migrations
- Legacy compatibility models to read old database tables
- New pluralized tables such as `documents`, `document_trails`, `offices`, `users`
- Clear migration path away from the legacy singular names (`document`, `bureau`, `user`)

---

## 3. Runtime Architecture

The project now follows a Laravel architecture instead of the old HMVC CodeIgniter structure described in earlier docs.

### Current request flow

```text
Browser
  -> Laravel route
  -> Controller
  -> Eloquent model / query
  -> Inertia render
  -> React page component
```

### Core route grouping

The active web routes in `routes/web.php` define authenticated areas for:

- Dashboard
- Documents
- Latest documents
- Archives
- Audit trail
- Setup / libraries
- Offices / ranges / document types / action types / purpose types
- User accounts
- Integration screens for DRIP, iPLuma, and PDMIS

This indicates that the app is intentionally structured around the same operational modules as the legacy system but reimplemented in the Laravel stack.

---

## 4. Domain Model

The active domain model is centered on these entities:

### Users

`app/Models/User.php`

- authenticatable Laravel user
- fields include `username`, `firstname`, `lastname`, `middlename`, `extensionname`, `email`, `password`, `role`, `role_id`
- relationships to `office()`, `division()`, `documents()`, `auditTrails()`
- access logic via methods like `isAdministrator()`, `canManageLibraries()`, and `canReceiveDocuments()`

### Offices

`app/Models/Office.php`

- replacement for legacy `bureau`
- hierarchical organization via `parent_id`
- belongs to a `Range`
- may contain many divisions and users

### Divisions

`app/Models/Division.php`

- belongs to an office
- often used to segment subunits and assignments

### Documents

`app/Models/Document.php`

- primary transactional record of the workflow
- fields include `title`, `tracking_number`, `document_type_id`, `action_type_id`, `purpose_type_id`, `origin_type`, `office_id`, `division_id`, `created_by`, `status`, `received_from`, `received_at`, `is_archived`, `remarks`
- has many trails and files
- supports soft deletes
- latest status is exposed through `latestTrail()`

### Document trails

`app/Models/DocumentTrail.php`

- represents the movement history of the document
- stores `document_id`, `from_office_id`, `to_office_id`, `assigned_to_user_id`, `status`, `action`, `created_by`, `remarks`
- this is the operational history equivalent of the older `document_trail` system

### Supporting libraries

- `DocumentType`
- `ActionType`
- `PurposeType`
- `Range`
- `DocumentFile`
- `AuditTrail`

These are classic administrative reference tables for document management.

---

## 5. Actual Database Shape

The active migration files show the current model schema is being normalized into Laravel conventions.

### Example table set

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

### Key relationships

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
- `document_trails.created_by` -> `users.id`

### Status semantics

The app appears to use a lighter, more normalized lifecycle than the older system:

- `documents.status` = `pending` by default
- `document_trails.status` = `pending` by default
- document lifecycle transitions are tracked through trail entries rather than a single monolithic state field
- `is_finalized`, `is_archived`, and `received_at` capture official completion and archival conditions

---

## 6. Legacy Compatibility Layer

This is one of the most important features in the current project.

There are both legacy and modern model classes:

- `DocumentLegacy`
- `DocumentTrailLegacy`
- `UserLegacy`
- `Office` / `Bureau` coexistence
- `ActionTypeLegacy`
- `PurposeTypeLegacy`
- `DocumentTypeLegacy`
- `RangeLegacy`
- `DivisionLegacy`

The repo includes an explicit compatibility strategy described in `md/LEGACY_DB_COMPATIBILITY.md`:

- the old DB uses singular table names like `user` and `document`
- the new app uses new pluralized Laravel tables like `users` and `documents`
- compatibility models allow read access while migration is phased in

This suggests the project is intentionally in a migration window rather than fully completed. The main app is Laravel, but key historical data access still relies on legacy adapters.

---

## 7. Business Logic and Workflow

The operational workflow still matches the legacy document tracking system, but with modernized data access.

### General flow

1. A user creates a `Document` record.
2. A unique `tracking_number` is assigned.
3. The document is associated with an office / division and a classification.
4. A `DocumentTrail` row records the event, office transfer, and actor.
5. The document can move through pending, released, available, or terminal states depending on workflow logic.
6. Attachments are stored as `DocumentFile` records.
7. A document can be archived and later retrieved through archive query logic.
8. Audit events around user actions are stored in `audit_trails`.

### Operational decisions likely still encoded in controllers

The route set shows controllers for:

- `DocumentController`
- `DashboardController`
- `ArchiveController`
- `AuditTrailController`
- `SetupController`
- `OfficeController`
- `RangeController`
- `DocumentTypeController`
- `ActionTypeController`
- `PurposeTypeController`
- `UserAccountController`

This indicates the app is not just a CRUD shell; it is a full operational workflow for document lifecycle management.

---

## 8. Strengths of the Current State

- Clean move from legacy PHP monolith to Laravel framework
- Modern object model with Eloquent relationships
- Strong domain mapping around documents, users, offices, and trails
- Dual compatibility with old and new schema improves migration safety
- Active migration structure indicates intentional, staged upgrades
- Inertia + React gives a better modern frontend foundation

---

## 9. Risks and Gaps

### 1) The project is in transition

The codebase contains both:

- modern Laravel models and migrations
- legacy compatibility models and old documentation

This is healthy for migration, but it creates ambiguity if team members rely on the wrong architecture guide.

### 2) Legacy docs still describe an older system

The older markdown under `md/` is useful historically, but it should not be treated as the current runtime architecture.

### 3) Schema naming is not fully normalized yet

The old table names and new table names exist side by side, so future code must be disciplined when choosing schema targets.

### 4) Integration surfaces are still broad

The project includes several external systems and several setup libraries, which means the project is likely still functionally deep and operationally complex.

---

## 10. Recommended Current Interpretation

The most accurate way to understand the project today is:

- the legacy CodeIgniter DOTS system is still relevant as a business reference and historical data source
- the active codebase is a Laravel modernization effort
- the true application architecture is now a Laravel/Eloquent + Inertia + React system with compatibility adapters for legacy data access

The long-term target state is likely:

- a fully normalized Laravel schema
- no reliance on legacy database names
- modern React UI with documented domain modules
- explicit service layer for analytics and external integrations

---

## 11. Updated Executive Summary

DOTS is evolving from a classic legacy PHP document tracking system into a modern Laravel application with a cleaner domain model, safer migration path, and a more maintainable UI framework. The code now reflects a transitional but purposeful modernization effort: the business logic remains document-centric, while the technical foundation shifts toward Laravel, Eloquent, React, and Inertia.

The project is no longer best described as a pure CodeIgniter HMVC system; it is a hybrid system in migration, with the real future architecture clearly aligned to Laravel norms.

---

## 12. Key Files to Reference

- `routes/web.php`
- `app/Models/Document.php`
- `app/Models/DocumentTrail.php`
- `app/Models/User.php`
- `app/Models/Office.php`
- `app/Models/Division.php`
- `database/migrations/2026_09_23_000006_create_documents_table.php`
- `database/migrations/2026_09_23_000007_create_document_trails_table.php`
- `database/migrations/2026_09_23_000001_create_offices_table.php`
- `md/LEGACY_DB_COMPATIBILITY.md`
- `md/MIGRATION_SPEC.md`
