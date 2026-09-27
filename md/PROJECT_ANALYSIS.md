# DOTS — Project Analysis

**Document Tracking System**
National Commission on Indigenous Peoples (NCIP)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture](#3-architecture)
4. [Directory Structure](#4-directory-structure)
5. [Modules](#5-modules)
   - 5.1 [Authentication](#51-authentication)
   - 5.2 [Dashboard](#52-dashboard)
   - 5.3 [Documents](#53-documents)
   - 5.4 [Documents All](#54-documents-all)
   - 5.5 [Latest Documents](#55-latest-documents)
   - 5.6 [Archives (Annual)](#56-archives-annual)
   - 5.7 [File Upload](#57-file-upload)
   - 5.8 [Audit Trail](#58-audit-trail)
   - 5.9 [Track Document (Public)](#59-track-document-public)
   - 5.10 [Setup / Configuration Modules](#510-setup--configuration-modules)
   - 5.11 [User Account](#511-user-account)
6. [External Integrations](#6-external-integrations)
   - 6.1 [DRIP](#61-drip)
   - 6.2 [iPLuma](#62-ipluma)
   - 6.3 [PDMIS](#63-pdmis)
7. [Database](#7-database)
8. [Authentication & Session Management](#8-authentication--session-management)
9. [Email System](#9-email-system)
10. [Frontend & UI Libraries](#10-frontend--ui-libraries)
11. [File Management](#11-file-management)
12. [Version History (Backup Snapshots)](#12-version-history-backup-snapshots)
13. [Configuration Files](#13-configuration-files)
14. [Known Issues & Technical Debt](#14-known-issues--technical-debt)
15. [Performance Optimizations](#15-performance-optimizations)

---

## 1. Project Overview

DOTS (Document Tracking System) is an internal web application built for the **National Commission on Indigenous Peoples (NCIP)** of the Philippines. It enables NCIP staff to track the lifecycle of official documents — from creation and routing through offices to final disposition.

Key capabilities:
- Create, route, and track official documents across NCIP offices
- Attach and manage uploaded PDF/file attachments
- View document status histories and timelines
- Archive documents by year
- Public-facing document tracking (no login required, via tracking number)
- Full audit trail of user actions
- Integration with three external government systems: **DRIP**, **iPLuma**, and **PDMIS**
- Dashboard with live counters for Pending, Incoming, Released, and Terminal documents

The production URL is `https://dots.ncip.gov.ph/dots`. The local development URL is `http://localhost/dots`.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Backend Framework | CodeIgniter 3 (PHP) |
| Modular Extensions | WireDesignz HMVC (MX) |
| PHP Version | >= 5.3.7 (composer.json minimum; practically PHP 7.x) |
| Database | MySQL / MariaDB via `mysqli` driver |
| Database Name | `dots` |
| ORM/Query Builder | CodeIgniter Query Builder |
| Email | PHPMailer ^6.0 (Office 365 SMTP) |
| UUID | `ramsey/uuid` ^3.9 |
| Spreadsheet Export | `phpoffice/phpspreadsheet` |
| Frontend Framework | Bootstrap 4 + AdminLTE 3 |
| JavaScript | jQuery 3.x |
| DataTables | jQuery DataTables (server-side processing) |
| Charts | Chart.js, uPlot, Sparklines |
| Rich Text Editor | Summernote |
| Date Pickers | Tempus Dominus Bootstrap 4, DateRangePicker, Year Picker |
| Notifications | Toastr, SweetAlert2 |
| PDF Generation | PDFMake, html2canvas |
| QR Code | jquery-qrcode, qrcode.js |
| Icons | Font Awesome Free, Ionicons |
| Package Manager | Composer (PHP) |
| Dev Server | Laragon (local) |

---

## 3. Architecture

DOTS uses **CodeIgniter 3 with HMVC (Hierarchical Model-View-Controller)** via the WireDesignz MX third-party extension. Each functional area is a self-contained module under `application/modules/`, containing its own `controllers/`, `models/`, and `views/` directories.

### Request Flow

```
Browser Request
    │
    ▼
index.php  (front controller)
    │
    ▼
CodeIgniter Router → MY_Router (core override)
    │
    ▼
HMVC Module Router (MX)
    │
    ▼
Module Controller (extends MY_Controller)
    │
    ├── checkSession()          — auth guard
    ├── Business Logic
    ├── Model Query
    └── layout() / career_layout()
                │
                ▼
        View (layout/index.php)
            ├── layout/css.php
            ├── layout/sideMenuTop.php  (sidebar nav)
            ├── layout/sideMenuBot.php
            ├── {module}_view.php       (content)
            └── layout/javascript.php
```

### Two Layout Types

- **`layout()`** — Standard authenticated admin layout (AdminLTE sidebar + header). Used by all internal modules.
- **`career_layout()`** — Minimal public layout used by the Login page and the public **TrackDocument** module.

### Base Controller (`MY_Controller`)

All module controllers extend `MY_Controller`, which provides:
- Auto-loading of `database`, `session`, `upload`, `user_agent` libraries
- `checkSession()` — session validation with IP + User-Agent binding
- `layout()` / `career_layout()` — view rendering helpers
- `logTrail($event, $module, $queryTrail)` — audit logging
- `sendEmail()` — PHPMailer wrapper (Office 365 SMTP)

---

## 4. Directory Structure

```
DOTS/
├── index.php                     # CodeIgniter front controller
├── .env                          # Environment variables (API keys, secrets)
├── composer.json / composer.lock
├── .htaccess                     # URL rewriting
│
├── application/
│   ├── config/
│   │   ├── config.php            # Base URL, app settings
│   │   ├── database.php          # DB credentials (localhost / dots)
│   │   ├── routes.php            # Default controller = Login
│   │   ├── autoload.php          # Auto-loaded helpers (url)
│   │   ├── constants.php         # App constants
│   │   ├── pdmis_api.php         # PDMIS API config
│   │   └── ipluma_api.php        # iPLuma API config
│   │
│   ├── core/
│   │   ├── MY_Controller.php     # Base controller (auth, layout, mail)
│   │   └── MY_Model.php          # Base model (session/trail helpers)
│   │
│   ├── models/
│   │   ├── Documents_model.php   # Shared global document queries
│   │   └── DocumentLinks_model.php # PDMIS↔DOTS document linking
│   │
│   ├── libraries/
│   │   └── Pdmis_tracking.php    # PDMIS API client library
│   │
│   ├── helpers/
│   │   └── pdmis_tracking_helper.php
│   │
│   ├── views/
│   │   ├── layout/               # Main authenticated layout partials
│   │   │   ├── index.php         # Master layout shell
│   │   │   ├── sideMenuTop.php   # Sidebar navigation (dynamically includes archive years)
│   │   │   ├── css.php           # CSS includes
│   │   │   └── javascript.php    # JS includes
│   │   └── career_layout/        # Public-facing minimal layout
│   │
│   ├── modules/                  # HMVC modules (active)
│   │   ├── Login/
│   │   ├── ForgotPassword/
│   │   ├── ResetPassword/
│   │   ├── Dashboard/
│   │   ├── Documents/
│   │   ├── DocumentsAll/
│   │   ├── LatestDocuments/
│   │   ├── Archives/             # Current-year dynamic archives
│   │   ├── Archives2022/
│   │   ├── Archives2023/
│   │   ├── Archives2024/
│   │   ├── AuditTrail/
│   │   ├── TrackDocument/        # Public tracking (no auth)
│   │   ├── FileUpload/
│   │   ├── UserAccount/
│   │   ├── DocumentType/         # Setup: document types
│   │   ├── ActionType/           # Setup: action types
│   │   ├── PurposeType/          # Setup: purpose types
│   │   ├── Office/               # Setup: offices/bureaus
│   │   ├── Range/                # Setup: routing ranges
│   │   ├── Setup/
│   │   ├── Drip/                 # External: DRIP integration
│   │   ├── Ipluma/               # External: iPLuma integration
│   │   └── Pdmis/                # External: PDMIS integration
│   │
│   ├── modules 031925/           # Snapshot backup (March 19, 2025)
│   ├── modules 042825/           # Snapshot backup (April 28, 2025)
│   ├── modules - 093025/         # Snapshot backup (Sept 30, 2025)
│   └── modules - 093025v2/       # Snapshot backup v2
│
├── assets/
│   ├── uploads/                  # Uploaded document files (by month folder)
│   │   ├── April-2026/
│   │   └── September-2026/
│   ├── img/                      # Application images (logos, backgrounds)
│   ├── templates/                # Excel report templates
│   │   ├── StatusReport.xlsx
│   │   └── DataFileStatusReport.xlsx
│   ├── plugins/                  # Frontend JS/CSS libraries
│   └── pages/                    # AdminLTE demo/reference pages
│
├── database/
│   └── migrations/
│       └── 001_create_document_linking_tables.sql
│
├── public/
│   └── assets/
│       ├── js/pdmis_tracking.js
│       └── css/pdmis_tracking.css
│
├── vendor/                       # Composer packages
├── system/                       # CodeIgniter 3 system core
└── [test_*.php files]            # Development/debug scripts (should be removed in prod)
```

---

## 5. Modules

### 5.1 Authentication

**Modules:** `Login`, `ForgotPassword`, `ResetPassword`

- **Login** (`/Login`) — Default route. Renders using `career_layout()` (minimal public layout). Validates username/password. After 3 failed attempts, requires **Google reCAPTCHA v2** verification (site key: `6LfUhJoeAAAAAIT0BttI4SotYUADRnxJ297JVCvF`). On success, sets session data including userId, IP address, and User-Agent fingerprint (`$ipAddr.$usrAgent`). User ID `1` is a special admin account redirected to `/FileUpload` instead of Dashboard.
- **ForgotPassword** — Email-based password reset flow using PHPMailer.
- **ResetPassword** — Token-based password reset handler.

### 5.2 Dashboard

**Module:** `Dashboard`

- Protected route (`checkSession()`).
- Displays four summary counters: **Pending**, **Incoming**, **Released**, **Terminal** documents.
- Counters are initially rendered as `0` and populated via an AJAX call to `Dashboard/loadNotif` after page load (performance optimization — `session_write_close()` is called immediately to prevent blocking).
- `loadNotif()` returns JSON summary from `Dashboard_model->getSummary()`.
- `searchIncoming()` — AJAX search for incoming documents.
- `logout()` — Destroys session, updates log status, redirects to Login.

### 5.3 Documents

**Module:** `Documents`

The primary document management screen. Shows all documents for the authenticated user's office/role.

- Server-side DataTables (`getDocuments()`) with:
  - Global search
  - Per-column search (Tracking No, Title, Type, Origin Type, Status)
  - Advanced filters: Document Type, Status, Source, Date Range
  - Sorted by `sortDate DESC` by default
- Loads `Documents_model` and `pdmis_tracking` library + helper
- `countAllDocuments()` and `countFilteredDocuments()` for pagination metadata
- Additional controllers in this module:
  - `PdfTracking.php` — PDF generation with tracking information
  - `Pdmis_linking.php` — UI and API for linking DOTS documents to PDMIS tracking records

### 5.4 Documents All

**Module:** `DocumentsAll`

An admin-level view showing documents from **all offices** (not filtered by the current user's office). Otherwise mirrors the Documents module in terms of DataTables server-side processing.

### 5.5 Latest Documents

**Module:** `LatestDocuments`

Displays recently added/updated documents. Likely used as a quick reference widget or dedicated page.

### 5.6 Archives (Annual)

**Modules:** `Archives`, `Archives2022`, `Archives2023`, `Archives2024`

- `Archives` — Dynamic: accepts a `?year=` query parameter to display documents archived in that year.
- `Archives2022`, `Archives2023`, `Archives2024` — Static year-specific archive modules (legacy approach, now superseded by the parameterized `Archives` module).
- Each uses server-side DataTables with columns: Tracking No, Title, Document Type, Origin Type, Last Transaction, Status.
- Archive years are fetched via `Archives_model->getArchivedYears()` and injected into the sidebar navigation dynamically by `MY_Controller->layout()`.

### 5.7 File Upload

**Module:** `FileUpload`

- Handles document file attachments (PDFs and other formats).
- Special case: User ID `1` is redirected here on login, suggesting this is a batch upload / data entry role.
- Files are stored under `assets/uploads/{Month-Year}/{office}/` folder structure.

### 5.8 Audit Trail

**Module:** `AuditTrail`

- Full activity log of all user actions across the system.
- Server-side DataTables (`getTrail()`) with:
  - Columns: Module, Event, Log Date, Full Name
  - Per-column search on all four columns
  - Dynamic column-based sorting (DataTables `order[]` parameter mapped to DB columns)
- Backend: joins `audit_trail` table (alias `a`) with users table (alias `b`) using `CONCAT(firstname, ' ', lastname)` for the name column.
- All major actions are logged via `MY_Controller->logTrail()`.

### 5.9 Track Document (Public)

**Module:** `TrackDocument`

- **No authentication required** — publicly accessible.
- URL pattern: `/TrackDocument/viewTrail/{tracking_number}`
- Retrieves document timeline/trail from `TrackDocument_model->viewTrail($trackingNumber)`.
- Renders using `career_layout()` (minimal public layout without sidebar/admin chrome).
- Displays a timeline of the document's routing history to allow external parties or staff to check status without logging in.
- On failure (invalid tracking number), sets a flash error message.

### 5.10 Setup / Configuration Modules

These modules manage reference/lookup data used throughout the system. All follow the same pattern: `checkSession()`, DataTables listing, CRUD operations via AJAX.

| Module | Manages |
|---|---|
| `DocumentType` | Types of documents (e.g., Memorandum, Letter, Resolution) |
| `ActionType` | Actions that can be taken on a document (e.g., For Signature, For Review) |
| `PurposeType` | Purpose categories for documents |
| `Office` | NCIP offices and bureaus (also loads `Range_model` for routing ranges) |
| `Range` | Routing range/hierarchy definitions |
| `Setup` | General system setup configurations |

### 5.11 User Account

**Module:** `UserAccount`

- Manage system user accounts (CRUD).
- `addUser()` triggers an email notification to the new user via PHPMailer containing their username and temporary password.
- `getUserAccount()` — AJAX endpoint returning all user accounts for DataTables.

---

## 6. External Integrations

DOTS integrates with three external government information systems. All three follow the same pattern: a dedicated HMVC module with a controller that fetches data from an external API, wraps it into a DataTables-compatible JSON response, and displays it in the standard DOTS layout.

### 6.1 DRIP

**Module:** `Drip` | **Route:** `/Drip`

- DRIP (Document Routing and Information Program) is an external document system.
- `getDocuments()` calls `_getAllDRIPRows()` which fetches data from the DRIP API.
- Supports DataTables server-side format: `draw`, `start`, `length`, `search`.
- Local in-memory filtering is applied on `trackingNo` and `title` fields.
- API credentials sourced from `.env` file.

### 6.2 iPLuma

**Module:** `Ipluma` | **Route:** `/Ipluma`

- iPLuma is an external HR/plantilla system.
- `getDocuments()` calls `_getAllIplumaRows()` which hits the iPLuma API endpoint `/dots-summary`.
- Config: `application/config/ipluma_api.php`
  - `IPLUMA_API_URL`, `IPLUMA_API_KEY`, `IPLUMA_APP_NAME` from `.env`
  - Cache enabled (1 hour duration)
- DataTables columns include: `dotsId`, `fileName`, `originatorName`.
- Local in-memory search and pagination applied after API fetch.

### 6.3 PDMIS

**Module:** `Pdmis` | **Route:** `/Pdmis`

- PDMIS (Philippine Document Management Information System) provides external document tracking data.
- Config: `application/config/pdmis_api.php`
  - `PDMIS_API_URL`, `PDMIS_API_TOKEN` from `.env`
  - Endpoints: `/api/dots-tracking/public-trail`, `/status`, `/history`, `/list`
  - Cache enabled (1 hour duration)
- Library: `application/libraries/Pdmis_tracking.php` — HTTP client wrapper for PDMIS API calls.
- Helper: `application/helpers/pdmis_tracking_helper.php`
- PDMIS data can also be **linked to DOTS documents** via the `Pdmis_linking` controller in the Documents module, using the `document_links` and `document_link_suggestions` tables.
- Public-facing assets: `public/assets/js/pdmis_tracking.js` and `public/assets/css/pdmis_tracking.css`.

---

## 7. Database

- **Driver:** `mysqli`
- **Database name:** `dots`
- **Host:** `localhost` (dev) / `192.168.11.116` (commented out, likely production)
- **Character set:** `utf8` / `utf8_general_ci`

### Known Tables (inferred from code)

| Table | Description |
|---|---|
| `documents` | Core document records |
| `audit_trail` | User action log (module, event, logDate, userId) |
| `users` | User accounts (firstname, lastname, userName, password) |
| `document_links` | Links between DOTS documents and PDMIS tracking records |
| `document_link_suggestions` | Auto/manual suggested PDMIS links (pending/accepted/rejected) |
| `document_link_history` | Change history for document links |

### Migration

`database/migrations/001_create_document_linking_tables.sql` — Creates `document_links`, `document_link_suggestions`, and `document_link_history` tables with appropriate foreign keys and indexes.

### Performance Indexes

Several `add_*_indexes.php` and `optimize_database_indexes.sql` scripts exist in the project root, created to address query performance issues on large datasets. Key indexed columns include: `dateCreated`, `sortDate`, document status, and tracking number.

---

## 8. Authentication & Session Management

- Sessions are managed by CodeIgniter's session library.
- On login, the session stores: `userId`, `check` (IP + User-Agent fingerprint).
- `checkSession()` in `MY_Controller`:
  1. Checks `session->userdata('userId')` is set.
  2. Compares current `IP + User-Agent` against stored `check` value.
  3. Verifies session exists in DB via `MY_Model->checkSess()`.
  4. Redirects to `/Login` if any check fails.
- `session_write_close()` is called early in several AJAX endpoints to prevent session lock blocking concurrent requests (DataTables + notification polling).
- After 3 failed login attempts, Google reCAPTCHA v2 is required.

---

## 9. Email System

PHPMailer ^6.0 is used for all outbound email, configured with **Office 365 SMTP**:

| Setting | Value |
|---|---|
| Host | `smtp.office365.com` |
| Port | `587` |
| Auth | TLS |
| From address | `apps.notif@ncip.gov.ph` |

Email is sent for:
- New user account creation (credentials email)
- Password reset flows (ForgotPassword / ResetPassword)

---

## 10. Frontend & UI Libraries

The UI is based on **AdminLTE 3** (Bootstrap 4 admin template).

### Core UI
- Bootstrap 4
- AdminLTE 3
- jQuery 3.x
- Font Awesome Free (icons)
- Ionicons

### Data Display
- **jQuery DataTables** — All listing screens use server-side DataTables with responsive, fixed-header, buttons, and column-search extensions.
- **Chart.js** — Dashboard statistics charts
- **uPlot** — Lightweight high-performance charts
- **Sparklines** — Inline mini charts

### Forms & Input
- **Select2** — Enhanced dropdowns with search
- **Summernote** — WYSIWYG rich text editor
- **Tempus Dominus Bootstrap 4** — Date/time pickers
- **DateRangePicker** — Date range selection
- **Year Picker** — Custom year-only picker (used in Archives filtering)
- **jQuery Validation** — Client-side form validation
- **Inputmask** — Input field masking
- **Dropzone** — Drag-and-drop file uploads

### Notifications & Feedback
- **Toastr** — Non-blocking toast notifications
- **SweetAlert2** — Modal alert dialogs

### Document Generation
- **PDFMake + vfs_fonts** — Client-side PDF generation
- **html2canvas** — Screenshot/canvas capture for PDF export
- **JSZip** — ZIP file creation (DataTables export)
- **jquery-qrcode / qrcode.js** — QR code generation for document tracking

---

## 11. File Management

- Uploaded files are stored under `assets/uploads/` organized by:
  ```
  assets/uploads/{Month-Year}/{OfficeName}/
  ```
  Example: `assets/uploads/September-2026/AS - Cashier/`
- Admin uploads go to: `assets/uploads/admin/{Year-Month}/`
- Excel report templates are at: `assets/templates/StatusReport.xlsx` and `assets/templates/DataFileStatusReport.xlsx`

---

## 12. Version History (Backup Snapshots)

The project contains multiple dated backup snapshots of the `application/modules/` directory, stored alongside the active modules folder. This is a manual backup strategy rather than version control branching.

| Folder | Date | Notes |
|---|---|---|
| `application/modules 031925/` | March 19, 2025 | Earliest snapshot; includes Archives2022/2023/2024 |
| `application/modules 042825/` | April 28, 2025 | Added Range module; no separate year archives |
| `application/modules - 093025/` | Sept 30, 2025 | Added Range; standardized Archives (single parameterized module) |
| `application/modules - 093025v2/` | Sept 30, 2025 v2 | Minor variant of the v1 snapshot |
| `application/modules/` | **Active (current)** | Added Drip, iPLuma, Pdmis integration modules |

The `application/modules.zip` (417 KB) is also present as a compressed backup.

---

## 13. Configuration Files

| File | Purpose |
|---|---|
| `application/config/config.php` | Base URL (`http://localhost/dots`), session settings |
| `application/config/database.php` | DB credentials — `dots` database on localhost |
| `application/config/routes.php` | Default controller = `Login` |
| `application/config/autoload.php` | Auto-loads `url` helper |
| `application/config/constants.php` | File mode constants, exit codes |
| `application/config/pdmis_api.php` | PDMIS API URL, token, endpoints, cache settings |
| `application/config/ipluma_api.php` | iPLuma API URL, key, app name, cache settings |
| `.env` | Environment variables: `PDMIS_API_URL`, `PDMIS_API_TOKEN`, `IPLUMA_API_URL`, `IPLUMA_API_KEY`, `IPLUMA_APP_NAME`, `DRIP_*` |
| `.htaccess` | Apache URL rewriting (removes `index.php` from URLs) |

---

## 14. Known Issues & Technical Debt

1. **Loose test scripts in root** — Numerous `test_*.php`, `debug_*.php`, `check_*.php`, `diag_*.php`, and `setup_*.php` files exist in the project root. These are development/debugging artifacts and should be removed before production deployment. They may expose database credentials or system internals.

2. **`Login - Copy` module** — A duplicate of the Login module exists (`application/modules/Login - Copy/`). This dead code should be cleaned up.

3. **Multiple backup module directories** — Four historical snapshots of the entire modules directory live inside the project. These are ~4 copies of the entire application logic and should be moved out of the web root or managed via git branches instead.

4. **Static year archive modules** — `Archives2022`, `Archives2023`, `Archives2024` are now superseded by the parameterized `Archives?year=X` approach. The static year modules can be deprecated.

5. **Hard-coded credentials** — `MY_Controller.php` contains the PHPMailer password in plaintext (`@lvinP0g1`). This should be moved to `.env` variables.

6. **Google reCAPTCHA secret key** — The reCAPTCHA v2 secret key is hard-coded in `Login.php`. Should be moved to config or `.env`.

7. **`session_write_close()` pattern** — Used inconsistently. While correct for preventing DataTables AJAX lock contention, it is not uniformly applied, which may cause intermittent session blocking issues.

8. **No CSRF protection noted** — CodeIgniter's CSRF protection should be confirmed as enabled in `config.php` for all form submissions.

9. **`modules.zip` in web root** — The 417 KB zip file at `application/modules.zip` should not be in a publicly accessible location.

10. **Image files in root** — `dc1335eed9153abd779ffb85ff851a13.jpg`, `gfg-40.png`, `bureaus.txt`, `bureaus_hex.txt` appear to be leftover development files in the project root.

---

## 15. Performance Optimizations

Several performance improvement efforts are documented:

- **Session release** — `session_write_close()` called before DataTables AJAX queries to prevent serialized request blocking.
- **Dashboard lazy loading** — Dashboard counters render as `0` instantly; a separate `loadNotif()` AJAX call fetches real counts asynchronously (1–2 second delay instead of blocking page render).
- **Database indexes** — Multiple `add_*_indexes.php` scripts and `optimize_database_indexes.sql` were created to add covering indexes on frequently-queried columns (tracking number, date, status, office).
- **Query caching** — PDMIS and iPLuma API responses are cached for 1 hour to reduce external API calls.
- **Server-side DataTables** — All listing views use server-side processing (pagination and filtering done in SQL, not in-memory) to handle large document volumes.

Detailed documentation is available in:
- `PERFORMANCE_OPTIMIZATION_GUIDE.md`
- `OPTIMIZATION_SUMMARY.md`
- `LATEST_DOCUMENTS_OPTIMIZATION.md`
- `FINAL_DEPLOYMENT_GUIDE.md`

---

*Analysis generated: September 22, 2026*
*Analyzed by: Kiro (AI Assistant)*
