# DOTS — Entity Relationship Diagram (ERD)

**Source:** Reverse-engineered from active model code and SQL queries.
**Scope:** Current legacy database (`dots`) + proposed new schema for Laravel migration.
**Last Updated:** September 22, 2026

---

## Table of Contents

1. [Visual ERD (Text Diagram)](#1-visual-erd-text-diagram)
2. [Table Definitions — Current Schema](#2-table-definitions--current-schema)
3. [Relationships Summary](#3-relationships-summary)
4. [Document Lifecycle Flow](#4-document-lifecycle-flow)
5. [Proposed New Schema (Laravel Migration)](#5-proposed-new-schema-laravel-migration)
6. [Laravel Eloquent Model Relationships](#6-laravel-eloquent-model-relationships)
7. [Migration Files Order](#7-migration-files-order)

---

## 1. Visual ERD (Text Diagram)

```
┌──────────────────────┐         ┌──────────────────────────┐
│         user         │         │          bureau           │
├──────────────────────┤         ├──────────────────────────┤
│ PK  userUuid (UUID)  │──┐      │ PK  bureauId (INT)        │
│     username         │  │      │     longName              │
│     password (bcrypt)│  │      │     shortName             │
│     firstname        │  │      │     officeEmail           │
│     lastname         │  │      │     officeCode            │
│     middlename       │  │      │     range ─────────────────────┐
│     extensionname    │  │      │     parentbureauId ─────────┐  │
│     role (INT 1/2/14)│  │      │     status (active/inactive)│  │
│     emailAddress     │  │      │     dateAdded              │  │
│     status (0/1)     │  │      │     addedBy ──────────────►│  │
│     isVerified (Y/N) │  │  ┌───│►FK  bureauId               │  │
│     isLocked (Y/N)   │  │  │   └──────────────────────────┘  │
│     loggedInStatus   │  │  │                 │ self-ref        │
│     loginTries       │  │  │                 │ (parentbureauId)│
│     lastLoggedInTime │  │  │                 ▼                 │
│     session          │  │  │   ┌──────────────────────────┐  │
│  FK bureauId ─────────────┘  │   │       rangeregion        │  │
│     divisionId ───────────►div│   ├──────────────────────────┤◄─┘
│     dateCreated      │       │   │ PK  id (INT)             │
└──────────────────────┘       │   │     name                 │
         │                     │   │     status               │
         │ createdBy            │   └──────────────────────────┘
         ▼                     │
┌──────────────────────┐       │   ┌──────────────────────────┐
│      audit_trail     │       │   │         division          │
├──────────────────────┤       │   ├──────────────────────────┤
│ PK  trailUuid (UUID) │       └──►│ PK  divisionId (INT)      │
│     event (text)     │           │     longName              │
│     module           │        FK │     bureauId              │
│     logDate          │           └──────────────────────────┘
│     query (text)     │
│  FK userUuid ────────┴──────────────────────────────────────►user
└──────────────────────┘

┌──────────────────────┐         ┌──────────────────────────┐
│       document       │         │       document_type       │
├──────────────────────┤         ├──────────────────────────┤
│ PK  docId (INT)      │         │ PK  dtId (INT)            │
│     trackingNo (UK)  │         │     name                  │
│  FK dtId ────────────────────► │     description           │
│     otherDtype       │         │     status (active/inact) │
│     purpose          │         │     dateCreated           │
│     originType       │         │  FK createdBy ───────────►user
│     title            │         └──────────────────────────┘
│     remarks          │
│     urgent (Y/N)     │         ┌──────────────────────────┐
│     forNotification  │         │       action_type         │
│     isFinalized      │         ├──────────────────────────┤
│     Archived (Y/N)   │         │ PK  id (INT)              │
│  FK createdBy ───────────────►user  name                  │
│     dateCreated      │         │     description           │
└──────────────────────┘         │     status (active/inact) │
         │                       │     dateCreated           │
         │ trackingNo             │  FK createdBy ───────────►user
         ▼                       └──────────────────────────┘
┌──────────────────────┐
│    document_trail    │         ┌──────────────────────────┐
├──────────────────────┤         │       purpose_type        │
│ PK  docTrailId (INT) │         ├──────────────────────────┤
│  FK trackingNo ──────────────►document.trackingNo         │
│  FK originating ─────────────►bureau.bureauId             │
│  FK receiving ───────────────►bureau.bureauId             │
│  FK holder ──────────────────►bureau.bureauId             │
│     status ENUM:     │         │ PK  id (INT)              │
│       PENDING        │         │     name                  │
│       AVAILABLE      │         │     description           │
│       TERMINAL       │         │     status (active/inact) │
│     action (text)    │         │     dateCreated           │
│     remarks (text)   │         │  FK createdBy ───────────►user
│     initialRelease   │         └──────────────────────────┘
│  FK createdBy ───────────────►user.userUuid
│     dateCreated      │
└──────────────────────┘
         │
         │ docTrailId
         ▼
┌──────────────────────┐
│         file         │
├──────────────────────┤
│ PK  fileId (INT)     │
│  FK docId ───────────────────►document.docId
│  FK docTrailId ──────────────►document_trail.docTrailId
│     fileName (stored)│
│     origName (display│
│     filePath         │
│     attachmentOrigName
│     attachmentPath   │
│     type ENUM:       │
│       original       │
│       version        │
│       terminal       │
│  FK uploadedBy ──────────────►user.userUuid
│     dateUploaded     │
└──────────────────────┘

┌──────────────────────┐         ┌──────────────────────────┐
│     file_upload      │         │      document_links       │
├──────────────────────┤         ├──────────────────────────┤
│ PK  fileUuid (UUID)  │         │ PK  id (INT)              │
│  FK officeId ────────────────►bureau.bureauId              │
│     fileType         │         │  FK dots_doc_id ─────────►document.docId  (BIGINT)
│     fileName (stored)│         │     pdmis_tracking_id     │
│     origName         │         │     pdmis_tracking_number │
│     description      │         │     link_type ENUM:       │
│     fileSize         │         │       auto_match          │
│  FK uploadedBy ──────────────►user.userUuid                │
│     dateUploaded     │         │       manual_match        │
│  FK receivedBy ──────────────►user.userUuid                │
│     dateReceived     │         │       reference           │
│     status           │         │     confidence_score      │
└──────────────────────┘         │  FK matched_by ──────────►user.id  (BIGINT — was INT, no FK)
                                 │     notes                 │
                                 │     created_at            │
                                 │     updated_at            │
                                 └──────────────────────────┘

                                 ┌──────────────────────────┐
                                 │  document_link_suggestions│
                                 ├──────────────────────────┤
                                 │ PK  id (INT)              │
                                 │  FK dots_doc_id ─────────►document.docId  (BIGINT)
                                 │     pdmis_tracking_id     │
                                 │     pdmis_tracking_number │
                                 │     confidence_score      │
                                 │     match_reasons (JSON)  │
                                 │     status ENUM:          │
                                 │       pending             │
                                 │       accepted            │
                                 │       rejected            │
                                 │       merged              │
                                 │  FK reviewed_by ─────────►user.id  (BIGINT — was INT, no FK)
                                 │     reviewed_at           │
                                 │     created_at            │
                                 └──────────────────────────┘

                                 ┌──────────────────────────┐
                                 │   document_link_history   │
                                 ├──────────────────────────┤
                                 │ PK  id (INT)              │
                                 │  FK link_id ─────────────►document_links.id
                                 │     action (VARCHAR)      │
                                 │     old_values (JSON)     │
                                 │     new_values (JSON)     │
                                 │  FK changed_by ──────────►user.id  (BIGINT — was INT, no FK)
                                 │     changed_at            │
                                 │     notes                 │
                                 └──────────────────────────┘
```

---

## 2. Table Definitions — Current Schema

### `user`
The system's user accounts table.

| Column | Type | Notes |
|---|---|---|
| `userUuid` | VARCHAR (UUID) | **PK** — v4 UUID |
| `username` | VARCHAR | Unique login name |
| `password` | VARCHAR | bcrypt hash via `crypt($input, '$2y$09$...')` |
| `firstname` | VARCHAR | |
| `lastname` | VARCHAR | |
| `middlename` | VARCHAR | Nullable |
| `extensionname` | VARCHAR | Nullable (Jr., Sr., etc.) |
| `role` | INT | `1`=Super Admin, `2`=Admin/Exec, `14`=Encoder, others=Viewer |
| `emailAddress` | VARCHAR | Unique |
| `status` | CHAR(1) | `1`=Active, `0`=Inactive |
| `isVerified` | CHAR(1) | `Y`/`N` — must change password on first login |
| `isLocked` | CHAR(1) | `Y`/`N` — locked after max login attempts |
| `loggedInStatus` | CHAR(1) | `Y`/`N` — concurrent login check |
| `loginTries` | INT | Failed login counter; ≥3 triggers reCAPTCHA |
| `lastLoggedInTime` | DATETIME | For concurrent login timeout (20 min window) |
| `session` | VARCHAR | PHP session ID for concurrent login check |
| `bureauId` | INT | **FK** → `bureau.bureauId` |
| `divisionId` | INT | **FK** → `division.divisionId`, nullable |
| `officeCode` | VARCHAR | Used as prefix for tracking number generation |
| `dateCreated` | DATETIME | |

---

### `bureau`
NCIP offices and regional offices (called "bureaus" internally).

| Column | Type | Notes |
|---|---|---|
| `bureauId` | INT | **PK** auto-increment |
| `longName` | VARCHAR | Full office name |
| `shortName` | VARCHAR | Abbreviation (e.g., "OSESSC") |
| `officeEmail` | VARCHAR | Official email for notifications |
| `officeCode` | VARCHAR | Used in tracking number prefix |
| `range` | VARCHAR | Routing scope (e.g., "Agency Wide", "Central Office", "Region 1") |
| `parentbureauId` | INT | **FK self-ref** → `bureau.bureauId`, nullable — office hierarchy |
| `status` | VARCHAR | `active` / `inactive` |
| `dateAdded` | DATETIME | |
| `addedBy` | VARCHAR | FK → `user.userUuid` |

---

### `document`
The core document record. One row per document, independent of routing status.

| Column | Type | Notes |
|---|---|---|
| `docId` | INT | **PK** auto-increment |
| `trackingNo` | VARCHAR | **Unique Key** — format: `{officeCode}-{YY-MM-DD}-{seq:0001}` |
| `dtId` | INT | **FK** → `document_type.dtId` |
| `otherDtype` | VARCHAR | Free text when `dtId = 19` (Other type), nullable |
| `purpose` | VARCHAR | From `purpose_type` or free text "Others" |
| `originType` | VARCHAR | Internal / External |
| `title` | VARCHAR | Document title / subject |
| `remarks` | TEXT | Creator's initial remarks |
| `urgent` | VARCHAR | `Y`/`N` or similar flag |
| `forNotification` | VARCHAR | `yes`/`no` — email originator on each action |
| `isFinalized` | VARCHAR | `yes`/`no` — whether tracking number was assigned |
| `Archived` | CHAR(1) | `Y`/`NULL` — set when terminal trail entry is created |
| `createdBy` | VARCHAR | **FK** → `user.userUuid` |
| `dateCreated` | DATETIME | |

---

### `document_trail`
The audit/routing log for each document. One row per routing action. This is the most queried table in the system.

| Column | Type | Notes |
|---|---|---|
| `docTrailId` | INT | **PK** auto-increment |
| `trackingNo` | VARCHAR | **FK** → `document.trackingNo` |
| `originating` | INT | **FK** → `bureau.bureauId` — office that routed FROM |
| `receiving` | INT | **FK** → `bureau.bureauId` — office being routed TO, nullable |
| `holder` | INT | **FK** → `bureau.bureauId` — office currently holding the doc, nullable |
| `status` | ENUM | `PENDING` / `AVAILABLE` / `TERMINAL` |
| `action` | TEXT | Action description (from `action_type` or free text) |
| `remarks` | TEXT | Routing remarks, nullable |
| `initialRelease` | INT | `1` if first release, `0` otherwise |
| `createdBy` | VARCHAR | **FK** → `user.userUuid` |
| `dateCreated` | DATETIME | |

**Status Semantics:**

| Status | Meaning | holder = | receiving = |
|---|---|---|---|
| `PENDING` (originating=holder) | Document finalized by creator, pending first release | originating bureau | destination bureau |
| `PENDING` (holder=receiving) | Document received by destination office | receiving bureau | receiving bureau |
| `AVAILABLE` | Released/forwarded, en route | NULL | next bureau |
| `TERMINAL` | Archived/disposed | archiving bureau | NULL |

---

### `file`
Files (PDFs, attachments) linked to a document and a specific trail step.

| Column | Type | Notes |
|---|---|---|
| `fileId` | INT | **PK** auto-increment |
| `docId` | INT | **FK** → `document.docId` |
| `docTrailId` | INT | **FK** → `document_trail.docTrailId` — which action this file belongs to |
| `fileName` | VARCHAR | Server-side stored filename (hashed) |
| `origName` | VARCHAR | Original filename shown to user |
| `filePath` | VARCHAR | Relative path: `assets/uploads/{Month-Year}/{office}/` |
| `attachmentOrigName` | VARCHAR | Nullable — secondary attachment display name |
| `attachmentPath` | VARCHAR | Nullable — secondary attachment path |
| `type` | ENUM | `original` / `version` / `terminal` |
| `uploadedBy` | VARCHAR | **FK** → `user.userUuid` |
| `dateUploaded` | DATETIME | |

---

### `document_type`
Lookup table for document categories.

| Column | Type | Notes |
|---|---|---|
| `dtId` | INT | **PK** auto-increment |
| `name` | VARCHAR | Unique type name (e.g., Memorandum, Letter, Resolution) |
| `description` | TEXT | Nullable |
| `status` | VARCHAR | `active` / `inactive` |
| `dateCreated` | DATETIME | |
| `createdBy` | VARCHAR | **FK** → `user.userUuid` |

---

### `action_type`
Lookup table for routing actions (what is being done to a document).

| Column | Type | Notes |
|---|---|---|
| `id` | INT | **PK** auto-increment |
| `name` | VARCHAR | Action name (e.g., "For Signature", "For Review", "For Information") |
| `description` | TEXT | Nullable |
| `status` | VARCHAR | `active` / `inactive` |
| `dateCreated` | DATETIME | |
| `createdBy` | VARCHAR | **FK** → `user.userUuid` |

---

### `purpose_type`
Lookup table for document purposes.

| Column | Type | Notes |
|---|---|---|
| `id` | INT | **PK** auto-increment |
| `name` | VARCHAR | Purpose name (e.g., "For Approval", "For Compliance") |
| `description` | TEXT | Nullable |
| `status` | VARCHAR | `active` / `inactive` |
| `dateCreated` | DATETIME | |
| `createdBy` | VARCHAR | **FK** → `user.userUuid` |

---

### `rangeregion`
Defines named routing ranges/scopes (used to restrict which offices a bureau can route to).

| Column | Type | Notes |
|---|---|---|
| `id` | INT | **PK** auto-increment |
| `name` | VARCHAR | Range name (e.g., "Agency Wide", "Central Office", "Region 1") |
| `status` | VARCHAR | `active` / `inactive` |

---

### `division`
Sub-units within a bureau. Referenced on users but not heavily used in routing logic.

| Column | Type | Notes |
|---|---|---|
| `divisionId` | INT | **PK** auto-increment |
| `longName` | VARCHAR | Division full name |
| `bureauId` | INT | **FK** → `bureau.bureauId` |

---

### `audit_trail`
System-wide activity log. One row per user action.

| Column | Type | Notes |
|---|---|---|
| `trailUuid` | VARCHAR (UUID) | **PK** |
| `event` | TEXT | Human-readable description (e.g., "jdoe added new document Report Q3") |
| `module` | VARCHAR | Module name (e.g., "Add Document", "Release Document") |
| `logDate` | DATETIME | Auto-set on insert; also called `logDate` in queries |
| `query` | TEXT | Raw SQL query that was executed (debug/audit use) |
| `userUuid` | VARCHAR | **FK** → `user.userUuid` |

---

### `file_upload`
Separate batch-upload table used by the FileUpload module (different from `file`).

| Column | Type | Notes |
|---|---|---|
| `fileUuid` | VARCHAR (UUID) | **PK** |
| `fileType` | VARCHAR | MIME type |
| `fileName` | VARCHAR | Stored filename |
| `origName` | VARCHAR | Original filename |
| `description` | TEXT | Nullable |
| `fileSize` | BIGINT | In bytes |
| `officeId` | INT | **FK** → `bureau.bureauId` |
| `uploadedBy` | VARCHAR | **FK** → `user.userUuid` |
| `dateUploaded` | DATETIME | |
| `receivedBy` | VARCHAR | **FK** → `user.userUuid`, nullable |
| `dateReceived` | DATETIME | Nullable |
| `status` | VARCHAR | |

---

### `document_links` (from migration)
Links DOTS documents to PDMIS external tracking records.

| Column | Type | Notes |
|---|---|---|
| `id` | INT | **PK** auto-increment |
| `dots_doc_id` | BIGINT | **FK** → `document.docId` ON DELETE CASCADE — changed from INT to match documents PK |
| `pdmis_tracking_id` | VARCHAR | External PDMIS tracking ID |
| `pdmis_tracking_number` | VARCHAR | Human-readable PDMIS tracking number |
| `link_type` | ENUM | `auto_match` / `manual_match` / `reference` |
| `confidence_score` | INT | 0–100 |
| `matched_by` | BIGINT | **FK** → `user.userUuid` (new schema: `users.id`) — was INT with no FK constraint |
| `notes` | TEXT | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

### `document_link_suggestions` (from migration)

| Column | Type | Notes |
|---|---|---|
| `id` | INT | **PK** auto-increment |
| `dots_doc_id` | BIGINT | **FK** → `document.docId` ON DELETE CASCADE — changed from INT |
| `pdmis_tracking_id` | VARCHAR | |
| `pdmis_tracking_number` | VARCHAR | |
| `confidence_score` | INT | 0–100 |
| `match_reasons` | TEXT | JSON array |
| `status` | ENUM | `pending` / `accepted` / `rejected` / `merged` |
| `reviewed_by` | BIGINT | **FK** → `users.id` — was INT with no FK constraint |
| `reviewed_at` | TIMESTAMP | Nullable |
| `created_at` | TIMESTAMP | |

---

### `document_link_history` (from migration)

| Column | Type | Notes |
|---|---|---|
| `id` | INT | **PK** auto-increment |
| `link_id` | INT | **FK** → `document_links.id` |
| `action` | VARCHAR | `created` / `updated` / `deleted` / `merged` |
| `old_values` | JSON | State before change |
| `new_values` | JSON | State after change |
| `changed_by` | BIGINT | **FK** → `users.id` — was INT with no FK constraint |
| `changed_at` | TIMESTAMP | |
| `notes` | TEXT | |

---

## 3. Relationships Summary

| Relationship | Type | Description |
|---|---|---|
| `user` → `bureau` | Many-to-One | Each user belongs to one bureau |
| `user` → `division` | Many-to-One | Each user optionally belongs to one division |
| `user` ← `document_trail` | One-to-Many | User has many trail entries they created |
| `user` ← `file_upload` | One-to-Many | User has many batch file uploads |
| `user` ← `document_link` | One-to-Many | User has many document links they matched |
| `division` → `bureau` | Many-to-One | Each division belongs to one bureau |
| `bureau` → `bureau` (self) | Many-to-One | Bureau hierarchy via `parentbureauId` |
| `bureau` → `user` (addedBy) | Many-to-One | Bureau was created/added by a user |
| `document` → `document_type` | Many-to-One | Each document has one type |
| `document` → `user` | Many-to-One | Each document has one creator |
| `document` ↔ `document_trail` | One-to-Many | One document has many trail entries (routing history) |
| `document_trail` → `bureau` (originating) | Many-to-One | Where the document came from |
| `document_trail` → `bureau` (receiving) | Many-to-One | Where the document is going (nullable) |
| `document_trail` → `bureau` (holder) | Many-to-One | Who currently holds the document (nullable) |
| `document_trail` → `user` | Many-to-One | Who performed the routing action |
| `document_trail` ↔ `file` | One-to-**Many** | A trail step can have multiple attached files |
| `file` → `document` | Many-to-One | Files attached to a document |
| `file` → `user` | Many-to-One | Who uploaded the file |
| `audit_trail` → `user` | Many-to-One | Who performed the logged action (nullable) |
| `document` → `document_links` | One-to-Many | DOTS doc linked to PDMIS record(s) |
| `document` → `document_link_suggestions` | One-to-Many | Suggested PDMIS links for a document |
| `document_links` → `user` (matched_by) | Many-to-One | User who created the link (FK: BIGINT) |
| `document_links` → `document_link_history` | One-to-Many | Audit trail for link changes |
| `document_link_suggestions` → `user` (reviewed_by) | Many-to-One | User who reviewed the suggestion (nullable FK: BIGINT) |
| `document_link_history` → `user` (changed_by) | Many-to-One | User who made the change (FK: BIGINT) |
| `file_upload` → `bureau` | Many-to-One | Batch upload belongs to one office |
| `file_upload` → `user` (uploaded_by) | Many-to-One | Who uploaded the batch file |
| `file_upload` → `user` (received_by) | Many-to-One | Who received the batch file (nullable) |

---

## 4. Document Lifecycle Flow

The `document_trail` table tracks every step. Here is the complete state machine:

```
1. DOCUMENT CREATED
   ─────────────────
   document.isFinalized = 'no'
   No document_trail entry yet.
   No trackingNo assigned yet.

         │  User clicks "Finalize"
         ▼

2. FINALIZED (awaiting first release)
   ────────────────────────────────────
   document.isFinalized = 'yes'
   document.trackingNo  = "{officeCode}-{YY-MM-DD}-{0001}"
   
   document_trail INSERT:
     originating = user's bureauId
     holder      = user's bureauId
     receiving   = (not set yet, or destination chosen at this step)
     status      = PENDING

         │  User clicks "Release"
         ▼

3. AVAILABLE (in transit)
   ─────────────────────────
   document_trail INSERT:
     originating = releasing bureau
     receiving   = destination bureau
     holder      = NULL
     status      = AVAILABLE
     action      = selected action type

         │  Receiving office clicks "Receive"
         ▼

4. RECEIVED (pending at destination)
   ────────────────────────────────────
   document_trail INSERT:
     originating = (same as AVAILABLE entry's originating)
     receiving   = receiving bureau
     holder      = receiving bureau      ← holder == receiving
     status      = PENDING

         │  Can loop back to step 3 (re-release to another office)
         │  OR tag as Terminal
         ▼

5. TERMINAL (archived / disposed)
   ──────────────────────────────────
   document_trail INSERT:
     originating = current bureau
     receiving   = NULL
     holder      = current bureau
     status      = TERMINAL
     action      = "Sent to {office names}"

   document UPDATE:
     Archived = 'Y'   ← document disappears from active views
```

**Key query pattern for "current status" of a document:**

```sql
-- Latest trail entry = current status
SELECT * FROM document_trail
WHERE trackingNo = :trackingNo
ORDER BY dateCreated DESC
LIMIT 1;

-- OR using the optimized batch approach (used in production):
SELECT MAX(docTrailId) as maxId, trackingNo
FROM document_trail
GROUP BY trackingNo;
-- Then join to get full row by docTrailId IN (maxIds)
```

---

## 5. Proposed New Schema (Laravel Migration)

Key changes from legacy schema:

1. **UUID primary keys** → replaced with `BIGINT` auto-increment `id` for simpler Eloquent relations (UUID kept as a separate `uuid` column where needed for public-facing URLs)
2. **`user.role` integer** → replaced with Spatie `roles` / `model_has_roles` tables
3. **`utf8`** → `utf8mb4` on all tables
4. **Soft deletes** → added `deleted_at` to `users` and `documents`
5. **`bureau` renamed** → `offices` for clarity
6. **`audit_trail`** → `audit_trails` (plural convention)
7. **`document_trail`** → `document_trails` (plural convention)
8. **`file`** → `document_files` (avoids MySQL reserved word collision)
9. **`file_upload`** → `file_uploads`
10. **`rangeregion`** → `routing_ranges`

### New Schema ERD

```
┌─────────────────────────────┐        ┌──────────────────────────┐
│           users             │        │          offices          │
├─────────────────────────────┤        ├──────────────────────────┤
│ PK  id          BIGINT UI   │──┐     │ PK  id         BIGINT UI  │
│     uuid        CHAR(36) UK │  │     │     long_name  VARCHAR    │
│     username    VARCHAR UK  │  │     │     short_name VARCHAR    │
│     email       VARCHAR UK  │  │  ┌──│►FK  parent_id  BIGINT NULL│
│     password    VARCHAR     │  │  │  │     email      VARCHAR    │
│     first_name  VARCHAR     │  │  │  │     office_code VARCHAR   │
│     last_name   VARCHAR     │  │  │  │     range      VARCHAR    │
│     middle_name VARCHAR NULL│  │  │  │     status     ENUM       │
│     ext_name    VARCHAR NULL│  │  │  │  FK created_by BIGINT NULL│ ← replaces addedBy
│     is_verified BOOL        │  │  │  │     created_at TIMESTAMP  │
│     is_locked   BOOL        │  │  │  │     updated_at TIMESTAMP  │
│     login_attempts INT      │  │  │  └──────────────────────────┘
│     last_login  TIMESTAMP   │  └──┼──►FK  office_id   BIGINT
│     session_id  VARCHAR NULL│     │
│     email_verified_at TSTP  │     │  ┌──────────────────────────┐
│     remember_token VARCHAR  │     │  │         divisions         │
│  FK office_id   BIGINT NULL ├─────┘  ├──────────────────────────┤
│  FK division_id BIGINT NULL ├───────►│ PK  id         BIGINT UI  │
│     deleted_at  TIMESTAMP   │        │     name       VARCHAR    │
│     created_at  TIMESTAMP   │        │  FK office_id  BIGINT     │
│     updated_at  TIMESTAMP   │        │     created_at TIMESTAMP  │
└─────────────────────────────┘        └──────────────────────────┘

┌─────────────────────────────┐        ┌──────────────────────────┐
│          documents          │        │       document_types      │
├─────────────────────────────┤        ├──────────────────────────┤
│ PK  id            BIGINT UI │        │ PK  id         BIGINT UI  │
│     tracking_no   VARCHAR UK│        │     name       VARCHAR UK │
│  FK document_type_id BIGINT ├───────►│     description TEXT NULL │
│     other_type    VARCHAR   │        │     status     ENUM       │
│     purpose       VARCHAR   │        │  FK created_by BIGINT     │
│     origin_type   VARCHAR   │        │     created_at TIMESTAMP  │
│     title         VARCHAR   │        │     updated_at TIMESTAMP  │
│     remarks       TEXT NULL │        └──────────────────────────┘
│     is_urgent     BOOL      │
│     notify_creator BOOL     │        ┌──────────────────────────┐
│     is_finalized  BOOL      │        │        action_types       │
│     is_archived   BOOL      │        ├──────────────────────────┤
│  FK created_by    BIGINT    │        │ PK  id         BIGINT UI  │
│     deleted_at    TIMESTAMP │        │     name       VARCHAR UK │
│     created_at    TIMESTAMP │        │     description TEXT NULL │
│     updated_at    TIMESTAMP │        │     status     ENUM       │
└─────────────────────────────┘        │  FK created_by BIGINT     │
         │                             │     created_at TIMESTAMP  │
         ▼                             └──────────────────────────┘
┌─────────────────────────────┐
│       document_trails       │        ┌──────────────────────────┐
├─────────────────────────────┤        │       purpose_types       │
│ PK  id            BIGINT UI │        ├──────────────────────────┤
│  FK document_id   BIGINT    │        │ PK  id         BIGINT UI  │
│  FK originating_office_id   │        │     name       VARCHAR UK │
│     (BIGINT NULL)           │        │     description TEXT NULL │
│  FK receiving_office_id     │        │     status     ENUM       │
│     (BIGINT NULL)           │        │  FK created_by BIGINT     │
│  FK holder_office_id        │        │     created_at TIMESTAMP  │
│     (BIGINT NULL)           │        └──────────────────────────┘
│     status        ENUM      │
│       pending               │        ┌──────────────────────────┐
│       available             │        │       routing_ranges      │
│       terminal              │        ├──────────────────────────┤
│     action        TEXT NULL │        │ PK  id         BIGINT UI  │
│     remarks       TEXT NULL │        │     name       VARCHAR UK │
│     is_initial_release BOOL │        │     status     ENUM       │
│  FK created_by    BIGINT    │        │     created_at TIMESTAMP  │
│     created_at    TIMESTAMP │        └──────────────────────────┘
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│       document_files        │
├─────────────────────────────┤
│ PK  id            BIGINT UI │
│  FK document_id   BIGINT    │
│  FK trail_id      BIGINT NUL│
│     stored_name   VARCHAR   │
│     original_name VARCHAR   │
│     file_path     VARCHAR   │
│     attachment_name VARCHAR │
│     attachment_path VARCHAR │
│     file_type     ENUM      │
│       original              │
│       version               │
│       terminal              │
│  FK uploaded_by   BIGINT    │
│     created_at    TIMESTAMP │
└─────────────────────────────┘

┌─────────────────────────────┐
│         audit_trails        │
├─────────────────────────────┤
│ PK  id            BIGINT UI │
│  FK user_id       BIGINT NUL│
│     event         TEXT      │
│     module        VARCHAR   │
│     ip_address    VARCHAR   │
│     user_agent    VARCHAR   │
│     created_at    TIMESTAMP │
└─────────────────────────────┘

┌─────────────────────────────┐   ← Spatie Permission tables (auto-generated)
│           roles             │
│      permissions            │
│    model_has_roles          │
│  model_has_permissions      │
│   role_has_permissions      │
└─────────────────────────────┘
```

---

## 6. Laravel Eloquent Model Relationships

```php
// ─────────────────────────────────────────────────────────────────────────────
// app/Models/User.php
// ─────────────────────────────────────────────────────────────────────────────
class User extends Authenticatable
{
    use HasRoles, SoftDeletes;

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    public function division(): BelongsTo
    {
        return $this->belongsTo(Division::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class, 'created_by');
    }

    public function documentTrails(): HasMany
    {
        return $this->hasMany(DocumentTrail::class, 'created_by');
    }

    public function fileUploads(): HasMany
    {
        return $this->hasMany(FileUpload::class, 'uploaded_by');
    }

    public function documentLinks(): HasMany
    {
        // Links this user matched/created
        return $this->hasMany(DocumentLink::class, 'matched_by');
    }

    public function auditTrails(): HasMany
    {
        return $this->hasMany(AuditTrail::class);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// app/Models/Office.php
// ─────────────────────────────────────────────────────────────────────────────
class Office extends Model
{
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Office::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Office::class, 'parent_id');
    }

    public function creator(): BelongsTo
    {
        // Replaces legacy bureau.addedBy → user.userUuid
        return $this->belongsTo(User::class, 'created_by');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function divisions(): HasMany
    {
        return $this->hasMany(Division::class);
    }

    public function fileUploads(): HasMany
    {
        return $this->hasMany(FileUpload::class);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// app/Models/Division.php
// ─────────────────────────────────────────────────────────────────────────────
class Division extends Model
{
    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// app/Models/Document.php
// ─────────────────────────────────────────────────────────────────────────────
class Document extends Model
{
    use SoftDeletes;

    public function type(): BelongsTo
    {
        return $this->belongsTo(DocumentType::class, 'document_type_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function trails(): HasMany
    {
        return $this->hasMany(DocumentTrail::class);
    }

    public function latestTrail(): HasOne
    {
        return $this->hasOne(DocumentTrail::class)->latestOfMany();
    }

    public function files(): HasMany
    {
        return $this->hasMany(DocumentFile::class);
    }

    public function pdmisLinks(): HasMany
    {
        return $this->hasMany(DocumentLink::class, 'dots_doc_id');
    }

    public function linkSuggestions(): HasMany
    {
        return $this->hasMany(DocumentLinkSuggestion::class, 'dots_doc_id');
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    public function scopeForUser(Builder $query, User $user): Builder
    {
        if ($user->hasRole(['super_admin', 'admin'])) {
            return $query;
        }
        return $query->where(function ($q) use ($user) {
            $q->whereHas('creator', fn ($u) => $u->where('office_id', $user->office_id))
              ->orWhereHas('trails', fn ($t) =>
                  $t->where('holder_office_id', $user->office_id)
                    ->orWhere('receiving_office_id', $user->office_id)
              );
        });
    }

    public function scopeForOffice(Builder $query, int $officeId): Builder
    {
        return $query->where(function ($q) use ($officeId) {
            $q->whereHas('creator', fn ($u) => $u->where('office_id', $officeId))
              ->orWhereHas('trails', fn ($t) =>
                  $t->where('holder_office_id', $officeId)
                    ->orWhere('receiving_office_id', $officeId)
                    ->orWhere('originating_office_id', $officeId)
              );
        });
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_archived', false);
    }

    public function scopeArchived(Builder $query, ?int $year = null): Builder
    {
        $q = $query->where('is_archived', true);
        if ($year) {
            $q->whereYear('created_at', $year);
        }
        return $q;
    }

    public function scopeCreatedBetween(Builder $query, string $from, string $to): Builder
    {
        return $query->whereBetween('created_at', [$from, $to]);
    }

    public function scopeForYear(Builder $query, int $year): Builder
    {
        return $query->whereYear('created_at', $year);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// app/Models/DocumentTrail.php
// ─────────────────────────────────────────────────────────────────────────────
class DocumentTrail extends Model
{
    public $timestamps = false; // created_at only; no updated_at

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function originatingOffice(): BelongsTo
    {
        return $this->belongsTo(Office::class, 'originating_office_id');
    }

    public function receivingOffice(): BelongsTo
    {
        return $this->belongsTo(Office::class, 'receiving_office_id');
    }

    public function holderOffice(): BelongsTo
    {
        return $this->belongsTo(Office::class, 'holder_office_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * A trail step can have multiple attached files.
     * Using HasMany, not HasOne, because multiple versions/attachments
     * can be uploaded at the same routing step.
     */
    public function files(): HasMany
    {
        return $this->hasMany(DocumentFile::class, 'trail_id');
    }

    // ── Scope ─────────────────────────────────────────────────────────────────

    public function scopeLatestPerDocument(Builder $query): Builder
    {
        return $query->whereIn('id', function ($sub) {
            $sub->selectRaw('MAX(id)')
                ->from('document_trails')
                ->groupBy('document_id');
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// app/Models/DocumentFile.php
// ─────────────────────────────────────────────────────────────────────────────
class DocumentFile extends Model
{
    public $timestamps = false; // created_at only

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function trail(): BelongsTo
    {
        return $this->belongsTo(DocumentTrail::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// app/Models/DocumentType.php
// ─────────────────────────────────────────────────────────────────────────────
class DocumentType extends Model
{
    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// app/Models/ActionType.php
// ─────────────────────────────────────────────────────────────────────────────
class ActionType extends Model
{
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// app/Models/PurposeType.php
// ─────────────────────────────────────────────────────────────────────────────
class PurposeType extends Model
{
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// app/Models/RoutingRange.php
// ─────────────────────────────────────────────────────────────────────────────
// Lookup/reference table only. No FK relationships.
class RoutingRange extends Model
{
    // No relationships — standalone lookup table
}

// ─────────────────────────────────────────────────────────────────────────────
// app/Models/AuditTrail.php
// ─────────────────────────────────────────────────────────────────────────────
class AuditTrail extends Model
{
    public $timestamps = false; // created_at only

    public function user(): BelongsTo
    {
        // Nullable — system events may not have a user
        return $this->belongsTo(User::class);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// app/Models/FileUpload.php
// ─────────────────────────────────────────────────────────────────────────────
class FileUpload extends Model
{
    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function receiver(): BelongsTo
    {
        // Nullable — not yet received
        return $this->belongsTo(User::class, 'received_by');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// app/Models/DocumentLink.php
// ─────────────────────────────────────────────────────────────────────────────
class DocumentLink extends Model
{
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'dots_doc_id');
    }

    public function matchedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'matched_by');
    }

    public function history(): HasMany
    {
        return $this->hasMany(DocumentLinkHistory::class, 'link_id');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// app/Models/DocumentLinkSuggestion.php
// ─────────────────────────────────────────────────────────────────────────────
class DocumentLinkSuggestion extends Model
{
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'dots_doc_id');
    }

    public function reviewedBy(): BelongsTo
    {
        // Nullable — not yet reviewed
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// app/Models/DocumentLinkHistory.php
// ─────────────────────────────────────────────────────────────────────────────
class DocumentLinkHistory extends Model
{
    public $timestamps = false; // uses changed_at only

    public function link(): BelongsTo
    {
        return $this->belongsTo(DocumentLink::class);
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// app/Models/AnalyticsSnapshot.php
// ─────────────────────────────────────────────────────────────────────────────
// Key/value cache table. No FK relationships.
class AnalyticsSnapshot extends Model
{
    // No relationships — used as a pre-computed metric store by AnalyticsService
}
```

---

## 7. Migration Files Order

Create these files in this exact order (foreign key dependencies):

```bash
# Run each:  php artisan make:migration create_{table}_table

1.  create_routing_ranges_table         # no FK deps
2.  create_offices_table                # self-ref FK (parent_id) — add after
3.  create_divisions_table              # FK: offices
4.  create_users_table                  # FK: offices, divisions  (Breeze generates base, customize)
5.  create_document_types_table         # FK: users (created_by)
6.  create_action_types_table           # FK: users (created_by)
7.  create_purpose_types_table          # FK: users (created_by)
8.  create_documents_table              # FK: users, document_types
9.  create_document_trails_table        # FK: documents, offices (x3), users
10. create_document_files_table         # FK: documents, document_trails, users
11. create_file_uploads_table           # FK: offices, users (x2)
12. create_audit_trails_table           # FK: users (nullable)
13. create_document_links_table         # FK: documents
14. create_document_link_suggestions_table # FK: documents
15. create_document_link_history_table  # FK: document_links

# Spatie auto-generates:
16. create_permission_tables            # via: php artisan vendor:publish + migrate
```

**Self-referencing `offices` table trick** — add `parent_id` FK after the table exists:

```php
// In create_offices_table migration:
Schema::create('offices', function (Blueprint $table) {
    $table->id();
    $table->unsignedBigInteger('parent_id')->nullable();   // define column first
    $table->string('long_name');
    // ... other columns ...
    $table->timestamps();
    // Add the FK constraint AFTER the column is defined in the same table:
    $table->foreign('parent_id')->references('id')->on('offices')->nullOnDelete();
});
```

---

## 8. Schema Corrections & Known Issues

The following issues were identified during cross-checking and are corrected in the new schema above:

| # | Issue | Location | Fix Applied |
|---|---|---|---|
| 1 | `bureau.addedBy` → `user.userUuid` has no equivalent in new `offices` schema | ERD §2, §5 | Added `created_by BIGINT NULL FK → users.id` column to `offices` table |
| 2 | `document_links.matched_by` typed as `INT` with no FK constraint | ERD §2 table def + migration | Changed to `BIGINT`, added FK constraint → `users.id` |
| 3 | `document_link_suggestions.reviewed_by` typed as `INT` with no FK constraint | ERD §2 table def + migration | Changed to `BIGINT`, added FK constraint → `users.id` (nullable) |
| 4 | `document_link_history.changed_by` typed as `INT` with no FK constraint | ERD §2 table def + migration | Changed to `BIGINT`, added FK constraint → `users.id` |
| 5 | `document_links.dots_doc_id` typed as `INT` but `documents.id` is `BIGINT` | ERD §2 + original migration SQL | Changed `dots_doc_id` to `BIGINT` in table definition |
| 6 | `DocumentTrail.file()` was `HasOne` — a trail step can have multiple file versions | ERD §6 | Changed to `HasMany`; method renamed `files()` |
| 7 | `Document.linkSuggestions()` missing from model despite relationship noted in §3 | ERD §6 | Added `linkSuggestions(): HasMany` |
| 8 | `User` missing `fileUploads()`, `documentTrails()`, `documentLinks()` | ERD §6 | Added all three |
| 9 | `Office` missing `creator()` (for `created_by` FK) and `fileUploads()` | ERD §6 | Added both |
| 10 | 10 models had zero relationship code: `Division`, `DocumentType`, `ActionType`, `PurposeType`, `RoutingRange`, `DocumentLink`, `DocumentLinkSuggestion`, `DocumentLinkHistory`, `FileUpload`, `AuditTrail` | ERD §6 | Full relationship code added for all |

---

*ERD document created: September 22, 2026*
*Updated: September 23, 2026 — fixed FK type mismatches, added missing offices.created_by column, corrected matched_by/reviewed_by/changed_by to BIGINT with FK constraints, completed all model relationships*
*Based on: Direct model code analysis of DOTS legacy codebase*
