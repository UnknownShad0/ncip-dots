# DOTS — Migration Specification

**From:** CodeIgniter 3 + jQuery + Bootstrap 4 + AdminLTE 3
**To:** Laravel 12 + Inertia.js + React + TypeScript + Tailwind CSS

**Status:** Planning
**Last Updated:** September 23, 2026

---

## Table of Contents

1. [Target Tech Stack](#1-target-tech-stack)
2. [Architecture Overview](#2-architecture-overview)
3. [New Project Structure](#3-new-project-structure)
4. [Setup Commands (Run Once)](#4-setup-commands-run-once)
5. [Module Migration Map](#5-module-migration-map)
6. [Database Migration Strategy](#6-database-migration-strategy)
7. [Authentication Migration](#7-authentication-migration)
8. [File Upload Migration](#8-file-upload-migration)
9. [External API Integrations Migration](#9-external-api-integrations-migration)
10. [Analytics Implementation](#10-analytics-implementation)
11. [Frontend Component Map](#11-frontend-component-map)
12. [Security Fixes Built Into New Stack](#12-security-fixes-built-into-new-stack)
13. [Environment Configuration](#13-environment-configuration)
14. [Agent Instructions](#14-agent-instructions)
15. [Module-by-Module Build Order](#15-module-by-module-build-order)
16. [Naming Conventions](#16-naming-conventions)
17. [What NOT to Migrate](#17-what-not-to-migrate)

---

## 1. Target Tech Stack

### Required (Non-Negotiable)

| Layer | Technology | Version |
|---|---|---|
| Runtime | PHP | 8.3+ |
| Database | MySQL | 8.0+ |
| Frontend Protocol | Inertia.js | ^2.x |
| Frontend UI | React | ^18.x |
| Type Safety | TypeScript | ^5.x |
| Styling | Tailwind CSS | ^3.x |

### Recommended (Best Fit for Required Stack)

| Layer | Technology | Version | Reason |
|---|---|---|---|
| Backend Framework | **Laravel** | ^12.x | Industry standard for PHP 8.3+, first-class Inertia support, built-in auth, migrations, queues |
| ORM | **Eloquent** (Laravel built-in) | ^12.x | Replaces CI3 Query Builder; type-safe with PHP 8.3 enums |
| Auth | **Laravel Breeze** (Inertia/React preset) | ^2.x | Scaffolds auth with Inertia + React out of the box |
| Build Tool | **Vite** | ^5.x | Laravel's default bundler; fast HMR for React/TS |
| API HTTP Client | **Guzzle** (Laravel built-in) | ^7.x | Replaces raw cURL for DRIP/iPLuma/PDMIS; proper SSL handling |
| Email | **Laravel Mail** + SMTP | built-in | Replaces fragmented PHPMailer; `.env`-driven, queueable |
| Excel Export | **Laravel Excel (maatwebsite)** | ^3.x | Replaces phpoffice/phpspreadsheet; also generates `StatusReport.xlsx` and `DataFileStatusReport.xlsx` equivalents |
| PDF Generation | **DomPDF (barryvdh)** | latest | Server-side PDF; replaces client-side PDFMake |
| UUID | PHP 8.x `Str::uuid()` (Laravel built-in) | — | Replaces ramsey/uuid |
| Queues | **Laravel Queue** (database driver) | built-in | For async email sending |
| Component Library | **shadcn/ui** | latest | Headless, accessible React components; Tailwind-native |
| Icons | **Lucide React** | ^0.x | Replaces Font Awesome + Ionicons with a single tree-shakeable set |
| Tables | **TanStack Table v8** | ^8.x | Replaces jQuery DataTables; React-native, type-safe, server-side support |
| Charts | **Recharts** | ^2.x | Replaces Chart.js + uPlot + Sparklines with a single React-native library |
| Notifications | **sonner** (toast) | ^1.x | Replaces Toastr |
| Modals/Alerts | **shadcn/ui Dialog** | — | Replaces SweetAlert2 |
| Rich Text Editor | **Tiptap** | ^2.x | Replaces Summernote; React-first |
| Date Picker | **react-day-picker** | ^8.x | Replaces Tempus Dominus + DateRangePicker + Year Picker |
| Form Validation | **React Hook Form** + **Zod** | latest | Client-side + schema validation; replaces jQuery Validate |
| QR Code | **react-qr-code** | ^2.x | Replaces jquery-qrcode / qrcode.js |
| Drag-and-drop Upload | **react-dropzone** | ^14.x | Replaces Dropzone.js |
| Roles & Permissions | **spatie/laravel-permission** | ^6.x | Replaces magic role integers (1, 2, 14) |

---

## 2. Architecture Overview

### Current (CI3 HMVC)

```
Browser → index.php → CI3 Router → HMVC Module Controller → Model → PHP View (HTML)
                                         ↓
                                    jQuery AJAX for DataTables/CRUD
```

### New (Laravel + Inertia)

```
Browser → Laravel Router → Controller → Inertia::render('PageName', $props)
                                              ↓
                                    Inertia client renders React component
                                    (no full page reload; SPA-like navigation)
```

### Key Architecture Concepts for Agents

- **Laravel Controller** is the entry point. It queries the DB via Eloquent and passes data to the frontend using `Inertia::render()`.
- **Inertia.js** is the bridge — it serializes PHP data as JSON props and hydrates the React component. There is no separate REST API needed for page renders.
- **React + TypeScript** handles all UI rendering. Components live in `resources/js/Pages/` (full pages) and `resources/js/Components/` (shared pieces).
- **Tailwind CSS** replaces Bootstrap 4. No jQuery. No AdminLTE.
- **AJAX mutations** (create/update/delete) are handled by Inertia's `useForm()` hook or `router.post()` — they post to Laravel routes and automatically re-render with fresh props.
- **TanStack Table** replaces jQuery DataTables for all listing screens. Server-side pagination is done via Inertia visits with query params.
- **AnalyticsService** centralizes all aggregation queries. Dashboard counters are passed as Inertia props at render time — no separate AJAX call needed (replaces the old `loadNotif()` AJAX hack).
- **Model Observers** handle cache busting automatically when documents are created or updated.

### Request Flow (Inertia)

```
1. User navigates to /documents
2. Laravel route calls DocumentController@index
3. Controller queries Eloquent, paginates results
4. Controller returns Inertia::render('Documents/Index', ['documents' => $paginated])
5. Inertia sends the page as JSON (or full HTML on first load)
6. React renders <DocumentsIndex documents={props.documents} />
7. User clicks "Next Page"
8. Inertia.router.get('/documents', { page: 2 }) — XHR, no reload
9. Laravel returns new props, React re-renders table
```

---

## 3. New Project Structure

```
dots-laravel/                          ← NEW project root (separate from old DOTS/)
│
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Auth/
│   │   │   │   ├── AuthenticatedSessionController.php   (Login/Logout + reCAPTCHA + login attempts)
│   │   │   │   ├── PasswordResetLinkController.php
│   │   │   │   ├── NewPasswordController.php
│   │   │   │   └── RegisteredUserController.php
│   │   │   ├── DashboardController.php                  (injects AnalyticsService for counters)
│   │   │   ├── AnalyticsController.php                  (admin analytics page + counter refresh JSON)
│   │   │   ├── DocumentController.php
│   │   │   ├── ArchiveController.php
│   │   │   ├── AuditTrailController.php
│   │   │   ├── TrackDocumentController.php              (public, no auth)
│   │   │   ├── FileUploadController.php
│   │   │   ├── UserAccountController.php
│   │   │   ├── ReportController.php                     (Excel + PDF export)
│   │   │   ├── Setup/
│   │   │   │   ├── DocumentTypeController.php
│   │   │   │   ├── ActionTypeController.php
│   │   │   │   ├── PurposeTypeController.php
│   │   │   │   ├── OfficeController.php
│   │   │   │   └── RangeController.php
│   │   │   └── Integration/
│   │   │       ├── DripController.php
│   │   │       ├── IplumaController.php
│   │   │       └── PdmisController.php
│   │   ├── Middleware/
│   │   │   └── LogAuditTrail.php                        (replaces logTrail(); POST/PUT/PATCH/DELETE)
│   │   └── Requests/
│   │       ├── StoreDocumentRequest.php
│   │       ├── UpdateDocumentRequest.php
│   │       └── StoreUserRequest.php
│   │
│   ├── Models/
│   │   ├── User.php                                     (HasRoles, SoftDeletes)
│   │   ├── Office.php                                   (replaces bureau; self-ref parent_id)
│   │   ├── Division.php                                 (belongs to Office)
│   │   ├── Document.php                                 (SoftDeletes; forUser/forOffice/archived scopes)
│   │   ├── DocumentTrail.php                            (replaces document_trail; 3× office FKs)
│   │   ├── DocumentFile.php                             (replaces file table; private storage)
│   │   ├── DocumentType.php
│   │   ├── ActionType.php
│   │   ├── PurposeType.php
│   │   ├── RoutingRange.php                             (replaces rangeregion)
│   │   ├── AuditTrail.php
│   │   ├── DocumentLink.php
│   │   ├── DocumentLinkSuggestion.php
│   │   ├── DocumentLinkHistory.php
│   │   ├── FileUpload.php                               (batch upload table)
│   │   └── AnalyticsSnapshot.php                       (pre-computed metric cache table)
│   │
│   ├── Observers/
│   │   └── DocumentObserver.php                         (busts dashboard counter cache on save)
│   │
│   ├── Services/
│   │   ├── AnalyticsService.php                         (all aggregation queries; cache management)
│   │   ├── DripApiService.php                           (replaces _getAllDRIPRows)
│   │   ├── IplumaApiService.php                         (replaces _getAllIplumaRows)
│   │   └── PdmisApiService.php                          (replaces Pdmis_tracking library)
│   │
│   ├── Exports/
│   │   └── DocumentStatusReport.php                     (maatwebsite/excel; replaces StatusReport.xlsx template)
│   │
│   ├── Enums/
│   │   ├── UserRole.php                                  (replaces magic numbers 1, 2, 14)
│   │   ├── DocumentStatus.php                            (pending / available / terminal)
│   │   ├── DocumentFileType.php                          (original / version / terminal)
│   │   └── LinkType.php                                  (auto_match / manual_match / reference)
│   │
│   ├── Console/
│   │   └── Commands/
│   │       ├── RefreshAnalyticsSnapshots.php             (php artisan analytics:refresh)
│   │       └── TransferLegacyData.php                    (one-time data migration from dots DB)
│   │
│   └── Mail/
│       ├── UserCreatedMail.php
│       └── PasswordResetMail.php
│
├── database/
│   ├── migrations/
│   │   ├── 0001_01_01_000000_create_users_table.php      (Breeze base; customized)
│   │   ├── 2026_09_23_000001_create_routing_ranges_table.php
│   │   ├── 2026_09_23_000002_create_offices_table.php    (self-ref parent_id; created_by FK → users)
│   │   ├── 2026_09_23_000003_create_divisions_table.php
│   │   ├── 2026_09_23_000004_customize_users_table.php   (login_attempts, is_locked, office_id, etc.)
│   │   ├── 2026_09_23_000005_create_document_types_table.php
│   │   ├── 2026_09_23_000006_create_action_types_table.php
│   │   ├── 2026_09_23_000007_create_purpose_types_table.php
│   │   ├── 2026_09_23_000008_create_documents_table.php
│   │   ├── 2026_09_23_000009_create_document_trails_table.php
│   │   ├── 2026_09_23_000010_create_document_files_table.php
│   │   ├── 2026_09_23_000011_create_file_uploads_table.php
│   │   ├── 2026_09_23_000012_create_audit_trails_table.php
│   │   ├── 2026_09_23_000013_create_document_links_table.php
│   │   ├── 2026_09_23_000014_create_document_link_suggestions_table.php
│   │   ├── 2026_09_23_000015_create_document_link_history_table.php
│   │   ├── 2026_09_23_000016_create_analytics_snapshots_table.php
│   │   └── 2026_09_23_000017_add_analytics_indexes.php   (covering indexes for aggregation queries)
│   │   # Spatie auto-generates: create_permission_tables (via vendor:publish + migrate)
│   └── seeders/
│       ├── DatabaseSeeder.php
│       └── RolesAndPermissionsSeeder.php
│
├── resources/
│   ├── views/
│   │   └── reports/
│   │       └── document-status-pdf.blade.php             (DomPDF template; Inertia not used for PDFs)
│   └── js/
│       ├── app.tsx                                        (Inertia root)
│       ├── ssr.tsx                                        (SSR entry)
│       ├── types/
│       │   ├── index.d.ts                                 (global shared types)
│       │   ├── document.ts
│       │   ├── user.ts
│       │   ├── analytics.ts                               (DashboardCounters, MonthlyDataPoint, etc.)
│       │   └── inertia.d.ts                               (page props type)
│       ├── Components/
│       │   ├── ui/                                        (shadcn/ui components)
│       │   ├── Layout/
│       │   │   ├── AppLayout.tsx                          (replaces layout/index.php)
│       │   │   ├── Sidebar.tsx                            (replaces sideMenuTop.php; role-aware nav)
│       │   │   └── AuthLayout.tsx                         (replaces career_layout; Login + TrackDocument)
│       │   ├── DataTable/
│       │   │   ├── DataTable.tsx                          (TanStack Table wrapper; server-side pagination)
│       │   │   └── DataTablePagination.tsx
│       │   ├── Analytics/
│       │   │   ├── StatCard.tsx                           (colored metric card)
│       │   │   ├── LineChart.tsx                          (Recharts wrapper)
│       │   │   ├── BarChart.tsx                           (Recharts wrapper; horizontal/vertical)
│       │   │   ├── DonutChart.tsx                         (Recharts wrapper; status distribution)
│       │   │   ├── SparklineChart.tsx                     (mini area chart for dashboard trend)
│       │   │   └── ActiveUsersTable.tsx                   (top users leaderboard)
│       │   └── shared/
│       │       ├── StatusBadge.tsx
│       │       ├── ConfirmDialog.tsx
│       │       └── FileUploadZone.tsx
│       │
│       └── Pages/
│           ├── Auth/
│           │   ├── Login.tsx
│           │   ├── ForgotPassword.tsx
│           │   └── ResetPassword.tsx
│           ├── Dashboard/
│           │   └── Index.tsx                              (stat cards + sparkline trend; no AJAX)
│           ├── Analytics/
│           │   └── Index.tsx                              (admin only; all charts + leaderboard)
│           ├── Documents/
│           │   ├── Index.tsx
│           │   ├── AllDocuments.tsx
│           │   ├── Latest.tsx
│           │   └── columns.tsx                            (TanStack column definitions)
│           ├── Archives/
│           │   └── Index.tsx
│           ├── AuditTrail/
│           │   └── Index.tsx
│           ├── TrackDocument/
│           │   └── View.tsx                               (public, AuthLayout)
│           ├── FileUpload/
│           │   └── Index.tsx
│           ├── UserAccount/
│           │   └── Index.tsx
│           ├── Setup/
│           │   ├── DocumentTypes.tsx
│           │   ├── ActionTypes.tsx
│           │   ├── PurposeTypes.tsx
│           │   ├── Offices.tsx
│           │   └── Ranges.tsx
│           └── Integration/
│               ├── Drip.tsx
│               ├── Ipluma.tsx
│               └── Pdmis.tsx
│
├── routes/
│   ├── web.php                                            (all Inertia page routes)
│   ├── api.php                                            (JSON-only endpoints if needed)
│   └── console.php                                        (scheduled commands)
│
├── .env
├── .env.example
├── composer.json
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.ts
```

---

## 4. Setup Commands (Run Once)

Run these commands **in order** to scaffold the new Laravel + Inertia + React + TS + Tailwind project.

> **Prerequisites:** PHP 8.3+, Composer, Node.js 20+, npm, MySQL 8

```bash
# ── 1. Create new Laravel 12 project ──────────────────────────────────────────
composer create-project laravel/laravel dots-laravel "^12.0"
cd dots-laravel

# ── 2. Install Laravel Breeze with Inertia + React + TypeScript ───────────────
composer require laravel/breeze --dev
php artisan breeze:install react --typescript --ssr
# Answer prompts:
#   Would you like dark mode support? → No
#   Which testing framework do you prefer? → Pest

# ── 3. Install Node dependencies and build ────────────────────────────────────
npm install
npm run build

# ── 4. Install Tailwind CSS (already included by Breeze, verify) ──────────────
# Tailwind is installed by Breeze. Confirm tailwind.config.ts exists.
# If not:
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p --ts

# ── 5. Install shadcn/ui (component library) ──────────────────────────────────
npx shadcn@latest init
# Answer prompts:
#   Which style would you like to use? → Default
#   Which color would you like to use as the base color? → Slate
#   Do you want to use CSS variables for theming? → Yes

# Install commonly needed shadcn components
npx shadcn@latest add button input label card table badge dialog
npx shadcn@latest add dropdown-menu select textarea toast tabs
npx shadcn@latest add form alert separator skeleton

# ── 6. Install remaining frontend dependencies ────────────────────────────────
npm install \
  @tanstack/react-table \
  @tanstack/react-query \
  react-hook-form \
  @hookform/resolvers \
  zod \
  lucide-react \
  recharts \
  sonner \
  react-dropzone \
  react-qr-code \
  react-day-picker \
  date-fns \
  @tiptap/react \
  @tiptap/pm \
  @tiptap/starter-kit \
  clsx \
  tailwind-merge \
  class-variance-authority

npm install -D \
  @types/react \
  @types/node \
  @types/recharts \
  prettier \
  prettier-plugin-tailwindcss \
  eslint-plugin-react-hooks \
  eslint-plugin-react-refresh

# ── 7. Install backend PHP packages ───────────────────────────────────────────
composer require \
  guzzlehttp/guzzle \
  maatwebsite/excel \
  barryvdh/laravel-dompdf \
  spatie/laravel-permission

composer require --dev \
  pestphp/pest \
  pestphp/pest-plugin-laravel \
  laravel/pint \
  barryvdh/laravel-ide-helper

# ── 8. Configure database ─────────────────────────────────────────────────────
# Edit .env:
#   DB_CONNECTION=mysql
#   DB_HOST=127.0.0.1
#   DB_PORT=3306
#   DB_DATABASE=dots_laravel
#   DB_USERNAME=root
#   DB_PASSWORD=
#   DB_CHARSET=utf8mb4
#   DB_COLLATION=utf8mb4_unicode_ci

# Create the database
mysql -u root -e "CREATE DATABASE dots_laravel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Run default Laravel migrations (users, sessions, cache, jobs tables)
php artisan migrate

# ── 9. Set up Spatie Roles & Permissions ──────────────────────────────────────
php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider"
php artisan migrate

# ── 10. Publish DomPDF config ─────────────────────────────────────────────────
php artisan vendor:publish --provider="Barryvdh\DomPDF\ServiceProvider"

# ── 11. Publish Laravel Excel config ──────────────────────────────────────────
php artisan vendor:publish --provider="Maatwebsite\Excel\ExcelServiceProvider" --tag=config

# ── 12. Set application key and verify ────────────────────────────────────────
php artisan key:generate
php artisan about

# ── 13. Start dev servers ─────────────────────────────────────────────────────
# Terminal 1:
php artisan serve --port=8000
# Terminal 2:
npm run dev

# App will be available at: http://localhost:8000
```

---

## 5. Module Migration Map

Maps every old CI3 module to its new Laravel equivalent.

| Old CI3 Module | Old Route | New Laravel Controller | New Inertia Page | Notes |
|---|---|---|---|---|
| `Login` | `/Login` | `Auth\AuthenticatedSessionController` | `Pages/Auth/Login.tsx` | Breeze scaffolds; add login attempts + reCAPTCHA |
| `ForgotPassword` | `/ForgotPassword` | `Auth\PasswordResetLinkController` | `Pages/Auth/ForgotPassword.tsx` | Breeze scaffolds this |
| `ResetPassword` | `/ResetPassword` | `Auth\NewPasswordController` | `Pages/Auth/ResetPassword.tsx` | Breeze scaffolds; uses `random_bytes(40)` |
| `Dashboard` | `/Dashboard` | `DashboardController` | `Pages/Dashboard/Index.tsx` | Counters from `AnalyticsService` via Inertia props — no AJAX |
| *(new)* | — | `AnalyticsController` | `Pages/Analytics/Index.tsx` | Admin-only; all charts + leaderboard |
| `Documents` | `/Documents` | `DocumentController` | `Pages/Documents/Index.tsx` | Per-user/office filter via Eloquent scope |
| `DocumentsAll` | `/DocumentsAll` | `DocumentController@all` | `Pages/Documents/AllDocuments.tsx` | Admin-only, role middleware |
| `LatestDocuments` | `/LatestDocuments` | `DocumentController@latest` | `Pages/Documents/Latest.tsx` | Recent documents scope |
| `Archives` | `/Archives?year=X` | `ArchiveController` | `Pages/Archives/Index.tsx` | Year param via route/query |
| `Archives2022/2023/2024` | `/Archives20XX` | ❌ **Delete** | — | Replaced by `ArchiveController` |
| `AuditTrail` | `/AuditTrail` | `AuditTrailController` | `Pages/AuditTrail/Index.tsx` | Admin-only gate |
| `TrackDocument` | `/TrackDocument/viewTrail/{id}` | `TrackDocumentController` | `Pages/TrackDocument/View.tsx` | No auth; `AuthLayout.tsx` |
| `FileUpload` | `/FileUpload` | `FileUploadController` | `Pages/FileUpload/Index.tsx` | Role-gated; files in private storage |
| `UserAccount` | `/UserAccount` | `UserAccountController` | `Pages/UserAccount/Index.tsx` | Admin-only |
| *(new)* | — | `ReportController` | — | Excel + PDF downloads; no Inertia page |
| `DocumentType` | `/DocumentType` | `Setup\DocumentTypeController` | `Pages/Setup/DocumentTypes.tsx` | CRUD |
| `ActionType` | `/ActionType` | `Setup\ActionTypeController` | `Pages/Setup/ActionTypes.tsx` | CRUD |
| `PurposeType` | `/PurposeType` | `Setup\PurposeTypeController` | `Pages/Setup/PurposeTypes.tsx` | CRUD |
| `Office` | `/Office` | `Setup\OfficeController` | `Pages/Setup/Offices.tsx` | CRUD |
| `Range` | `/Range` | `Setup\RangeController` | `Pages/Setup/Ranges.tsx` | CRUD |
| `Drip` | `/Drip` | `Integration\DripController` | `Pages/Integration/Drip.tsx` | Uses `DripApiService`; proper pagination |
| `Ipluma` | `/Ipluma` | `Integration\IplumaController` | `Pages/Integration/Ipluma.tsx` | Uses `IplumaApiService` |
| `Pdmis` | `/Pdmis` | `Integration\PdmisController` | `Pages/Integration/Pdmis.tsx` | Uses `PdmisApiService` |
| `Login - Copy` | — | ❌ **Delete** | — | Dead code |
| `Setup` (old) | `/Setup` | Merge into Setup controllers | — | Evaluate remaining contents |

---

## 6. Database Migration Strategy

### Approach: Fresh Migrations + Data Transfer

Do **not** try to use the old database schema as-is. Create proper Laravel migrations for the new schema (see `ERD.md §5` for the full proposed schema), then write a one-time Artisan command to transfer data.

### Step 1 — Create Migrations (in dependency order)

Each migration file maps to a table. Key rules for the new schema:

- Use `utf8mb4` charset on all tables (Laravel default on MySQL 8) — fixes the `utf8` collation issue from `ISSUES_AND_IMPROVEMENTS.md §5.1`
- Use `$table->id()` (BIGINT auto-increment) as primary key; keep a separate `uuid` column where needed for public URLs
- Add `$table->timestamps()` (created_at, updated_at) to every table
- Add `$table->softDeletes()` to `documents` and `users` tables
- Replace magic role numbers with Spatie roles/permissions

**Migration file order** (foreign key dependencies):

```
1.  create_routing_ranges_table                  (no FK deps; replaces rangeregion)
2.  create_offices_table                         (self-ref parent_id; replaces bureau)
3.  create_divisions_table                       (FK: offices)
4.  [Breeze] create_users_table                  (base; customize in next step)
5.  customize_users_table                        (add: login_attempts, is_locked, is_verified,
                                                       office_id, division_id, office_code,
                                                       logged_in_status, last_login, session_id)
6.  create_document_types_table                  (FK: users.created_by)
7.  create_action_types_table                    (FK: users.created_by)
8.  create_purpose_types_table                   (FK: users.created_by)
9.  create_documents_table                       (FK: users, document_types; + deleted_at)
10. create_document_trails_table                 (FK: documents, offices ×3, users)
11. create_document_files_table                  (FK: documents, document_trails, users)
12. create_file_uploads_table                    (FK: offices, users ×2)
13. create_audit_trails_table                    (FK: users nullable)
14. create_document_links_table                  (FK: documents)
15. create_document_link_suggestions_table       (FK: documents)
16. create_document_link_history_table           (FK: document_links)
17. create_analytics_snapshots_table             (no FK deps; key/dimension/value/payload)
18. add_analytics_indexes                        (covering indexes for aggregation queries)
    [Spatie auto] create_permission_tables       (via: php artisan vendor:publish + migrate)
```

**Self-referencing `offices` table** — add `parent_id` FK in the same migration:

```php
Schema::create('offices', function (Blueprint $table) {
    $table->id();
    $table->unsignedBigInteger('parent_id')->nullable();
    $table->unsignedBigInteger('created_by')->nullable();   // replaces legacy bureau.addedBy
    $table->string('long_name');
    $table->string('short_name');
    $table->string('email')->nullable();
    $table->string('office_code')->nullable();
    $table->string('range')->nullable();
    $table->enum('status', ['active', 'inactive'])->default('active');
    $table->timestamps();
    // Self-referencing FK defined after column declaration
    $table->foreign('parent_id')->references('id')->on('offices')->nullOnDelete();
    // FK to users — nullOnDelete because offices can outlive the user who created them
    $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
});
```

**`analytics_snapshots` table:**

```php
Schema::create('analytics_snapshots', function (Blueprint $table) {
    $table->id();
    $table->string('metric_key', 100)->index();    // e.g. 'monthly_volume_2026_09'
    $table->string('dimension', 100)->nullable();   // e.g. office short_name, month label
    $table->unsignedBigInteger('value')->default(0);
    $table->json('payload')->nullable();            // raw result for complex metrics
    $table->timestamp('computed_at');
    $table->timestamps();
    $table->unique(['metric_key', 'dimension']);
});
```

**Analytics indexes migration** (addresses performance issues from `ISSUES_AND_IMPROVEMENTS.md §3`):

```php
// Speed up monthly aggregations on documents
Schema::table('documents', function (Blueprint $table) {
    $table->index(['created_at', 'is_archived'],     'idx_docs_created_archived');
    $table->index(['document_type_id', 'is_archived'],'idx_docs_type_archived');
});
// Speed up status/office queries on document_trails
Schema::table('document_trails', function (Blueprint $table) {
    $table->index(['status', 'holder_office_id'],    'idx_trails_status_holder');
    $table->index(['status', 'receiving_office_id'], 'idx_trails_status_receiving');
    $table->index(['document_id', 'created_at'],     'idx_trails_doc_created');
});
// Speed up audit trail date-range queries
Schema::table('audit_trails', function (Blueprint $table) {
    $table->index(['created_at', 'user_id'],         'idx_audit_created_user');
});
```

### Step 2 — Write a Data Transfer Command

```bash
php artisan make:command TransferLegacyData
```

The command connects to the OLD `dots` database and migrates data into `dots_laravel`. Use separate DB connections:

```php
// config/database.php — add legacy connection
'legacy' => [
    'driver'    => 'mysql',
    'host'      => env('LEGACY_DB_HOST', '127.0.0.1'),
    'database'  => env('LEGACY_DB_DATABASE', 'dots'),
    'username'  => env('LEGACY_DB_USERNAME', 'root'),
    'password'  => env('LEGACY_DB_PASSWORD', ''),
    'charset'   => 'utf8',
    'collation' => 'utf8_general_ci',
],
```

### Table Mapping (Old → New)

| Old Table | New Table | Key Changes |
|---|---|---|
| `user` | `users` | Drop `role` integer; assign Spatie role via `UserRole::fromLegacyInt()`; rename columns to `snake_case` |
| `bureau` | `offices` | Rename table + columns to `snake_case`; keep `bureau_id` in transfer for FK mapping |
| `division` | `divisions` | Rename columns |
| `rangeregion` | `routing_ranges` | Rename |
| `document` | `documents` | Rename to plural; add `deleted_at`; rename `Archived` → `is_archived`, `urgent` → `is_urgent` |
| `document_trail` | `document_trails` | Rename; rename `originating` → `originating_office_id`, `receiving` → `receiving_office_id`, `holder` → `holder_office_id` |
| `file` | `document_files` | Rename (avoids MySQL reserved word); update `filePath` to use new `storage/app/documents/` path |
| `file_upload` | `file_uploads` | Rename columns to `snake_case` |
| `audit_trail` | `audit_trails` | Rename; add `ip_address`, `user_agent` columns |
| `document_links` | `document_links` | No change (already in new format from existing migration) |
| `document_link_suggestions` | `document_link_suggestions` | No change |
| `document_link_history` | `document_link_history` | No change |

### Step 3 — Run Transfer and Verify

```bash
# Set legacy DB vars in .env:
LEGACY_DB_HOST=127.0.0.1
LEGACY_DB_DATABASE=dots
LEGACY_DB_USERNAME=root
LEGACY_DB_PASSWORD=

# Run the transfer
php artisan transfer:legacy-data

# Verify counts match between old and new DB
php artisan transfer:verify
```

---

## 7. Authentication Migration

### Old Approach (CI3)
- Custom session-based auth with IP + User-Agent fingerprint stored in `check` session key
- `checkSession()` manually called on every controller method (applied inconsistently — see `ISSUES_AND_IMPROVEMENTS.md §2.6`)
- Login attempts tracked with `loginTries` column (int)
- reCAPTCHA v2 required after 3 failed login attempts
- `session_write_close()` called inconsistently to prevent PHP session lock
- User ID `1` hard-coded to redirect to `/FileUpload` on login

### New Approach (Laravel Breeze + Spatie Permissions)

Laravel Breeze scaffolds the full auth flow. The Laravel `auth` middleware replaces `checkSession()` globally — no more per-method calls.

```bash
# Already done in setup step 2
# Breeze generates:
# - AuthenticatedSessionController (login/logout)
# - PasswordResetLinkController
# - NewPasswordController
# - Middleware: auth, guest, verified
```

**Role System — replace magic numbers with named roles:**

```bash
php artisan make:seeder RolesAndPermissionsSeeder
```

```php
// database/seeders/RolesAndPermissionsSeeder.php
use Spatie\Permission\Models\Role;

Role::create(['name' => 'super_admin']);   // was role = 1
Role::create(['name' => 'admin']);         // was role = 2
Role::create(['name' => 'encoder']);       // was role = 14
Role::create(['name' => 'viewer']);        // all other roles
```

**Route protection:**

```php
// routes/web.php
Route::middleware(['auth', 'verified'])->group(function () {

    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // Counter refresh endpoint (JSON — used by dashboard Refresh button)
    Route::get('/dashboard/counters', [AnalyticsController::class, 'counters'])
        ->name('dashboard.counters');

    Route::get('/documents', [DocumentController::class, 'index'])->name('documents.index');
    Route::post('/documents', [DocumentController::class, 'store'])->name('documents.store');
    Route::put('/documents/{document}', [DocumentController::class, 'update'])->name('documents.update');
    Route::delete('/documents/{document}', [DocumentController::class, 'destroy'])->name('documents.destroy');
    Route::get('/documents/{document}/download', [DocumentController::class, 'download'])->name('documents.download');

    Route::get('/archives', [ArchiveController::class, 'index'])->name('archives.index');
    Route::get('/track-document', [FileUploadController::class, 'index'])->name('file-upload.index');

    // Admin-only routes
    Route::middleware('role:super_admin|admin')->group(function () {
        Route::get('/analytics', [AnalyticsController::class, 'index'])->name('analytics.index');
        Route::get('/documents/all', [DocumentController::class, 'all'])->name('documents.all');
        Route::get('/audit-trail', [AuditTrailController::class, 'index'])->name('audit-trail.index');
        Route::resource('/users', UserAccountController::class);
        Route::resource('/setup/document-types', Setup\DocumentTypeController::class);
        Route::resource('/setup/action-types', Setup\ActionTypeController::class);
        Route::resource('/setup/purpose-types', Setup\PurposeTypeController::class);
        Route::resource('/setup/offices', Setup\OfficeController::class);
        Route::resource('/setup/ranges', Setup\RangeController::class);
        // Report downloads
        Route::get('/reports/document-status', [ReportController::class, 'exportDocumentStatus'])->name('reports.document-status');
        Route::get('/reports/document-status-pdf', [ReportController::class, 'exportDocumentStatusPdf'])->name('reports.document-status-pdf');
    });

    // Integrations
    Route::get('/drip', [Integration\DripController::class, 'index'])->name('drip.index');
    Route::get('/ipluma', [Integration\IplumaController::class, 'index'])->name('ipluma.index');
    Route::get('/pdmis', [Integration\PdmisController::class, 'index'])->name('pdmis.index');
});

// Public route — no auth (replaces TrackDocument module)
Route::get('/track/{trackingNumber}', [TrackDocumentController::class, 'show'])->name('track.show');
```

**Login attempts counter + reCAPTCHA (replaces `loginTries` logic):**

```php
// app/Http/Controllers/Auth/AuthenticatedSessionController.php — store() method additions
$user = User::where('username', $request->username)->first();

// Show reCAPTCHA after 3 failed attempts
if ($user && $user->login_attempts >= 3) {
    $this->validateRecaptcha($request->input('g-recaptcha-response'));
}

// On failed login, increment counter
if (! Auth::attempt($credentials)) {
    $user?->increment('login_attempts');
    throw ValidationException::withMessages(['username' => __('auth.failed')]);
}

// On success, reset counter
$user->update(['login_attempts' => 0]);
```

**Post-login redirect — replace hard-coded user ID 1 with role-based redirect:**

```php
// app/Providers/AppServiceProvider.php or RouteServiceProvider
// Instead of: if ($userId == '1') redirect to FileUpload
// Use role:
public function redirectTo(): string
{
    return auth()->user()->hasRole('encoder')
        ? route('file-upload.index')
        : route('dashboard');
}
```

**Password reset token entropy** — Laravel's `Password::broker()` uses `random_bytes(40)` internally. The old `substr(sha1(rand()), 0, 30)` token is automatically replaced.

---

## 8. File Upload Migration

### Old: Files stored in web root under `assets/uploads/`

Files were publicly accessible by URL — no authentication check. Path format: `assets/uploads/{Month-Year}/{OfficeName}/`.

### New: Files stored outside web root via Laravel Storage

```bash
FILESYSTEM_DISK=local
php artisan storage:link    # only needed for intentionally public files
```

**Storage structure (private — not web-accessible):**

```
storage/app/
└── documents/
    └── {year}/
        └── {month}/
            └── {office_slug}/
                └── {uuid_filename}.pdf
```

**Upload controller pattern:**

```php
// app/Http/Controllers/FileUploadController.php
public function store(Request $request): RedirectResponse
{
    $request->validate([
        'file' => ['required', 'file', 'mimes:pdf,doc,docx,xls,xlsx,jpg,png', 'max:10240'],
    ]);

    $path = $request->file('file')->store(
        'documents/' . date('Y/m') . '/' . Str::slug(auth()->user()->office->short_name),
        'local'   // private disk — not web accessible
    );

    Document::create(['file_path' => $path, ...]);

    return redirect()->back()->with('success', 'File uploaded.');
}

// Authenticated file download — replaces direct URL access
public function download(Document $document): StreamedResponse
{
    $this->authorize('view', $document);
    return Storage::download($document->file_path, $document->original_name);
}
```

---

## 9. External API Integrations Migration

Replace raw cURL (with SSL verification disabled) with Guzzle via dedicated Service classes. This fixes both the SSL vulnerability (`ISSUES_AND_IMPROVEMENTS.md §1.4`) and the in-memory full-dataset fetch anti-pattern (`§3.1`).

### Service Class Pattern

```bash
php artisan make:class Services/DripApiService
php artisan make:class Services/IplumaApiService
php artisan make:class Services/PdmisApiService
```

```php
// app/Services/DripApiService.php
namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class DripApiService
{
    public function __construct(
        private readonly string $baseUrl = '',
        private readonly string $apiKey  = '',
    ) {
        $this->baseUrl = config('services.drip.url');
        $this->apiKey  = config('services.drip.key');
    }

    /**
     * Fetch paginated documents from DRIP API using the API's own pagination.
     * Does NOT fetch everything into memory (fixes ISSUES_AND_IMPROVEMENTS §3.1 + §3.2).
     */
    public function getDocuments(int $page = 1, int $perPage = 15, string $search = ''): array
    {
        $cacheKey = "drip_docs_{$page}_{$perPage}_" . md5($search);

        return Cache::remember($cacheKey, now()->addMinutes(60), function () use ($page, $perPage, $search) {
            $response = Http::withHeader('x-api-key', $this->apiKey)
                ->timeout(15)
                // SSL verification is ON by default — do NOT add ->withoutVerifying()
                ->get($this->baseUrl, [
                    'page'     => $page,
                    'per_page' => $perPage,
                    'search'   => $search,
                ]);

            $response->throw();

            return $response->json();
        });
    }
}
```

**Register in `config/services.php`:**

```php
'drip' => [
    'url' => env('DRIP_API_URL'),
    'key' => env('DRIP_API_KEY'),
],
'ipluma' => [
    'url'      => env('IPLUMA_API_URL'),
    'key'      => env('IPLUMA_API_KEY'),
    'app_name' => env('IPLUMA_APP_NAME'),
],
'pdmis' => [
    'url'   => env('PDMIS_API_URL'),
    'token' => env('PDMIS_API_TOKEN'),
],
```

**Inject into controllers (same pattern for all three):**

```php
// app/Http/Controllers/Integration/DripController.php
public function __construct(private readonly DripApiService $drip) {}

public function index(Request $request): Response
{
    $data = $this->drip->getDocuments(
        page:    $request->integer('page', 1),
        perPage: 15,
        search:  $request->string('search', ''),
    );

    return Inertia::render('Integration/Drip', [
        'documents' => $data['data'] ?? [],
        'meta'      => $data['meta'] ?? [],
        'filters'   => $request->only('search'),
    ]);
}
```

---

## 10. Analytics Implementation

> Full implementation details are in `ANALYTICS_IMPLEMENTATION.md`. This section summarizes the key design decisions and their integration points.

### What Changed from the Old Dashboard

The old CI3 `Dashboard` module rendered four counters as `0` and populated them via a separate `loadNotif()` AJAX call after page load to avoid blocking render. In the new stack:

- `AnalyticsService` computes counters with a 5-minute cache
- `DashboardController` injects `AnalyticsService` and passes counters as Inertia props at render time
- The page loads with real data immediately — no separate AJAX call needed

### AnalyticsService

`app/Services/AnalyticsService.php` centralizes all aggregation queries. It provides:

| Method | TTL | Used By |
|---|---|---|
| `getDashboardCounters(?int $officeId)` | 5 min | `DashboardController`, `AnalyticsController` |
| `getDocumentsThisMonth(?int $officeId)` | 5 min | `DashboardController` |
| `getMonthlyVolume(int $months = 12)` | 1 hour | `DashboardController` (6 months), `AnalyticsController` (12 months) |
| `getDocumentsByStatus()` | 1 hour | `AnalyticsController` |
| `getDocumentsByType()` | 1 hour | `AnalyticsController` |
| `getDocumentsByOffice()` | 1 hour | `AnalyticsController` |
| `getAverageRoutingDays()` | 24 hours | `AnalyticsController` |
| `getDailyAuditActivity(int $days = 30)` | 5 min | `AnalyticsController` |
| `getTopActiveUsers(int $limit = 10)` | 1 hour | `AnalyticsController` |
| `flushCache()` | — | `RefreshAnalyticsSnapshots` command, `DocumentObserver` |

### Cache Invalidation

`DocumentObserver` busts the 5-minute counter cache whenever a document is created or updated — ensuring near-real-time accuracy without hammering the database on every request.

```php
// Register in AppServiceProvider::boot()
Document::observe(DocumentObserver::class);
```

### Scheduled Refresh

A nightly command pre-warms all analytics caches so the first admin load each day is not slow:

```bash
php artisan analytics:refresh   # runs daily at 01:00
```

Register in `routes/console.php`:

```php
Schedule::command('analytics:refresh')->dailyAt('01:00');
```

### Analytics Page Access

The `/analytics` page is restricted to `super_admin` and `admin` roles. The Sidebar component hides the link for other roles.

### Report Generation

`ReportController` replaces the existing Excel templates (`StatusReport.xlsx`, `DataFileStatusReport.xlsx`) with server-generated exports:

| Route | Output | Class |
|---|---|---|
| `GET /reports/document-status` | `.xlsx` | `App\Exports\DocumentStatusReport` (maatwebsite) |
| `GET /reports/document-status-pdf` | `.pdf` | DomPDF + `resources/views/reports/document-status-pdf.blade.php` |

Both are role-scoped: admins can export system-wide; other roles export their office only.

---

## 11. Frontend Component Map

### Layout Components

| Old (PHP View) | New (React TSX) | Notes |
|---|---|---|
| `layout/index.php` | `Components/Layout/AppLayout.tsx` | Wraps all authenticated pages |
| `layout/sideMenuTop.php` | `Components/Layout/Sidebar.tsx` | Dynamic archive years via props; role-aware nav (Analytics link hidden for non-admin) |
| `layout/css.php` | Tailwind + Vite imports | No separate CSS include file |
| `layout/javascript.php` | Vite bundles automatically | No separate JS include file |
| `career_layout/` | `Components/Layout/AuthLayout.tsx` | Login page + public TrackDocument |

### Analytics Components

| Component | Replaces | Library |
|---|---|---|
| `Components/Analytics/StatCard.tsx` | AdminLTE info boxes / small boxes | — (Tailwind) |
| `Components/Analytics/LineChart.tsx` | Chart.js line chart | Recharts |
| `Components/Analytics/BarChart.tsx` | Chart.js bar chart | Recharts |
| `Components/Analytics/DonutChart.tsx` | Chart.js doughnut chart | Recharts |
| `Components/Analytics/SparklineChart.tsx` | Sparklines.js mini charts | Recharts AreaChart |
| `Components/Analytics/ActiveUsersTable.tsx` | Inline HTML table | — (Tailwind) |

### Page Patterns

Every page component receives typed props from the Laravel controller via Inertia.

```tsx
// resources/js/types/document.ts
export interface Document {
  id:           number
  tracking_no:  string
  title:        string
  type:         string
  status:       'pending' | 'available' | 'terminal'
  origin_type:  string
  created_at:   string
  file_path:    string | null
  office:       Office
}

export interface PaginatedDocuments {
  data:         Document[]
  current_page: number
  last_page:    number
  per_page:     number
  total:        number
}
```

```tsx
// resources/js/Pages/Documents/Index.tsx
import { type PaginatedDocuments } from '@/types/document'
import { DataTable } from '@/Components/DataTable/DataTable'
import AppLayout from '@/Components/Layout/AppLayout'
import { columns } from './columns'

interface Props {
  documents: PaginatedDocuments
  filters:   { search?: string; status?: string }
}

export default function DocumentsIndex({ documents, filters }: Props) {
  return (
    <AppLayout title="Documents">
      <DataTable
        data={documents.data}
        columns={columns}
        pagination={documents}
        filters={filters}
        routeName="documents.index"
      />
    </AppLayout>
  )
}
```

### DataTable Component (replaces jQuery DataTables)

All listing screens use a shared `DataTable` component backed by TanStack Table. Server-side pagination is handled via Inertia router visits — no in-memory sort/filter.

```tsx
// resources/js/Components/DataTable/DataTable.tsx
import { useCallback } from 'react'
import { router } from '@inertiajs/react'
import {
  useReactTable, getCoreRowModel, flexRender,
  type ColumnDef,
} from '@tanstack/react-table'

interface DataTableProps<TData> {
  data:       TData[]
  columns:    ColumnDef<TData>[]
  pagination: { current_page: number; last_page: number; per_page: number; total: number }
  filters?:   Record<string, string>
  routeName:  string
}

export function DataTable<TData>({ data, columns, pagination, filters, routeName }: DataTableProps<TData>) {
  const onPageChange = useCallback((page: number) => {
    router.get(route(routeName), { ...filters, page }, { preserveState: true, preserveScroll: true })
  }, [filters, routeName])

  // ... table + pagination implementation
}
```

---

## 12. Security Fixes Built Into New Stack

### Automatically Resolved

The following issues from `ISSUES_AND_IMPROVEMENTS.md` are fixed by the new stack with no extra work:

| Old Issue | How New Stack Fixes It |
|---|---|
| CSRF disabled (`config.php` line 454) | Laravel has CSRF built-in and enabled by default. Inertia sends the CSRF token automatically in every XHR request via the `X-XSRF-TOKEN` header. |
| Hard-coded SMTP passwords in source code | All credentials in `.env`. Laravel Mail reads from config. Never in source code. |
| Hard-coded reCAPTCHA secret key | In `.env` as `RECAPTCHA_SECRET`. Read via `env()`. |
| SSL verification disabled on all cURL calls | Guzzle verifies SSL certificates by default. `->withoutVerifying()` must be explicitly opted into — easy to audit. |
| Weak password reset token (`sha1(rand())`) | Laravel's `Password::broker()` uses `random_bytes(40)` internally — cryptographically secure. |
| `utf8` collation (can't store 4-byte Unicode) | Laravel defaults to `utf8mb4` on MySQL 8. |
| No formal database migration system | Laravel migrations are the standard — every schema change is a numbered versioned file. |
| Error logging disabled (`log_threshold = 0`) | Laravel logging is enabled by default, writing to `storage/logs/laravel.log`. |
| Fragmented email logic (3 places, 2 passwords) | Laravel Mailable classes centralize all email. One place, queued, single SMTP config from `.env`. |
| Magic role numbers (1, 2, 14) | Spatie Permission uses named roles: `super_admin`, `admin`, `encoder`, `viewer`. |
| Uploaded files publicly accessible in web root | `Storage::disk('local')` stores outside web root. Served through authenticated `download()` controller method. |
| `base_url` hard-coded for local dev | `APP_URL` in `.env`; used via `config('app.url')` throughout. |
| `checkSession()` called inconsistently | Laravel `auth` middleware is applied at the route group level — no per-method calls needed. |
| `session_write_close()` inconsistency | Laravel's session handling does not lock for the duration of the request in the same way. Not an issue in the new stack. |
| No JSON response standardization | All AJAX endpoints use a consistent `JsonResponse` pattern; Inertia page renders use `Inertia::render()`. |
| No server-side `form_validation` library usage | Laravel Form Requests (`StoreDocumentRequest`, etc.) enforce validation rules on every mutating endpoint. |

### Still Require Manual Implementation

| Issue | Action Required |
|---|---|
| Login attempt counter + reCAPTCHA | Add `login_attempts` to users migration; add reCAPTCHA validation in `AuthenticatedSessionController::store()` (see §7) |
| Audit trail logging | Register `LogAuditTrail` middleware on all mutating routes (`POST`, `PUT`, `PATCH`, `DELETE`) |
| User account locked state | Add `is_locked`, `locked_at` columns to users migration; check `is_locked` in login handler |
| Role-based post-login redirect | Replace hard-coded user ID 1 check with role-based redirect (see §7) |
| 46 debug/test scripts in root | Must be manually deleted before deploying (see §17) |
| `modules.zip` and backup folders | Must be moved out of web root or deleted (see §17) |

---

## 13. Environment Configuration

### `.env` for New Laravel Project

```dotenv
APP_NAME="NCIP-DOTS"
APP_ENV=local
APP_KEY=                              # generated by php artisan key:generate
APP_DEBUG=true
APP_URL=http://localhost:8000

# Database (new)
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=dots_laravel
DB_USERNAME=root
DB_PASSWORD=
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_unicode_ci

# Legacy database (for data transfer only — remove after migration)
LEGACY_DB_HOST=127.0.0.1
LEGACY_DB_DATABASE=dots
LEGACY_DB_USERNAME=root
LEGACY_DB_PASSWORD=

# Mail (Office 365 SMTP — same server as current system)
MAIL_MAILER=smtp
MAIL_HOST=smtp.office365.com
MAIL_PORT=587
MAIL_USERNAME=apps.notif@ncip.gov.ph
MAIL_PASSWORD=                        # move from MY_Controller.php hardcode
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=apps.notif@ncip.gov.ph
MAIL_FROM_NAME="NCIP-DOTS"

# File Storage
FILESYSTEM_DISK=local

# External APIs (copy values from old .env)
DRIP_API_URL=
DRIP_API_KEY=

IPLUMA_API_URL=
IPLUMA_API_KEY=
IPLUMA_APP_NAME=

PDMIS_API_URL=
PDMIS_API_TOKEN=

# Google reCAPTCHA v2
RECAPTCHA_SITE_KEY=6LfUhJoeAAAAABxxxxxxxxxxxxxxxxx   # public — safe to include in JS
RECAPTCHA_SECRET=                                     # move from Login.php hardcode

# Queue (database driver for simplicity; switch to Redis for production)
QUEUE_CONNECTION=database

# Session
SESSION_DRIVER=database
SESSION_LIFETIME=120

# Logging
LOG_CHANNEL=stack
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=debug                       # change to 'error' on production
```

### Production Overrides

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://dots.ncip.gov.ph

LOG_LEVEL=error

# Remove LEGACY_DB_* after data transfer is complete
```

### `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import laravel from 'laravel-vite-plugin'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/js/app.tsx'],
            ssr:   'resources/js/ssr.tsx',
            refresh: true,
        }),
        react(),
    ],
    resolve: {
        alias: { '@': '/resources/js' },
    },
})
```

### `tsconfig.json`

```json
{
    "compilerOptions": {
        "target": "ES2020",
        "lib": ["ES2020", "DOM", "DOM.Iterable"],
        "module": "ESNext",
        "moduleResolution": "bundler",
        "jsx": "react-jsx",
        "strict": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true,
        "noFallthroughCasesInSwitch": true,
        "baseUrl": ".",
        "paths": { "@/*": ["resources/js/*"] }
    },
    "include": ["resources/js/**/*"],
    "exclude": ["node_modules", "public"]
}
```

---

## 14. Agent Instructions

> This section is written for AI coding agents. Read carefully before writing any code.

### Guiding Principles

1. **Never write jQuery.** All interactivity is in React with hooks. No `$(selector).on(...)`.
2. **Never write raw HTML templates.** All views are `.tsx` React components. Exception: DomPDF templates use Blade (`.blade.php`) in `resources/views/reports/` — that is the only allowed `.php` view.
3. **Never put credentials in source files.** Every secret goes in `.env` and is accessed via `env()` (PHP) or `import.meta.env` (TS — only for public keys like `RECAPTCHA_SITE_KEY`).
4. **Never disable SSL verification.** Guzzle's default is correct. Do not add `->withoutVerifying()`.
5. **Use Inertia for all page renders.** Controllers return `Inertia::render('PageName', $props)` — not `view()`, not `response()->json()` (except for the `AnalyticsController@counters` endpoint and `ReportController` downloads in `routes/api.php`).
6. **Use Laravel Form Requests for all validation.** Do not validate in the controller body. Create a `StoreXxxRequest` or `UpdateXxxRequest` class.
7. **Use Eloquent, not raw SQL.** Raw `DB::` queries are acceptable only for complex aggregation queries in `AnalyticsService` where Eloquent would produce less efficient SQL.
8. **Always type React components.** Every component must have a typed `Props` interface. No `any` types.
9. **Use Zod for frontend schema validation.** Mirror the backend Form Request rules in a Zod schema for client-side validation with React Hook Form.
10. **Log all mutations to audit trail.** Any create/update/delete action must log to `audit_trails`. Use the `LogAuditTrail` middleware or an Eloquent model observer — not inline `AuditTrail::create()` in every controller.
11. **Use AnalyticsService for all aggregation queries.** Do not put `COUNT(*)` queries directly in controllers. Add a method to `AnalyticsService` and inject the service.
12. **Respect the cache TTL hierarchy.** Dashboard counters (5 min) → trend charts (1 hour) → heavy snapshots (24 hours). Do not set TTLs lower than specified without a documented reason.

### Laravel Controller Pattern

```php
namespace App\Http\Controllers;

use App\Http\Requests\StoreDocumentRequest;
use App\Models\Document;
use Inertia\Inertia;
use Inertia\Response;

class DocumentController extends Controller
{
    // Page render — returns Inertia response
    public function index(Request $request): Response
    {
        $documents = Document::query()
            ->with(['type', 'creator.office', 'latestTrail'])
            ->forUser(auth()->user())
            ->when($request->search, fn ($q, $s) => $q->where('title', 'like', "%{$s}%"))
            ->when($request->status, fn ($q, $s) => $q->whereHas('latestTrail', fn ($t) => $t->where('status', $s)))
            ->latest('created_at')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Documents/Index', [
            'documents' => $documents,
            'filters'   => $request->only('search', 'status', 'type'),
        ]);
    }

    // Mutation — returns redirect (Inertia handles re-render)
    public function store(StoreDocumentRequest $request): RedirectResponse
    {
        $document = Document::create($request->validated());

        return redirect()->route('documents.index')
            ->with('success', 'Document created.');
    }
}
```

### React Page Component Pattern

```tsx
import { Head } from '@inertiajs/react'
import AppLayout from '@/Components/Layout/AppLayout'
import { DataTable } from '@/Components/DataTable/DataTable'
import { columns } from './columns'
import { type PaginatedDocuments } from '@/types/document'

interface Props {
  documents: PaginatedDocuments
  filters:   { search?: string; status?: string }
}

export default function DocumentsIndex({ documents, filters }: Props) {
  return (
    <AppLayout>
      <Head title="Documents" />
      <DataTable
        data={documents.data}
        columns={columns}
        pagination={documents}
        filters={filters}
        routeName="documents.index"
      />
    </AppLayout>
  )
}
```

### Inertia Form Pattern (Create/Update)

```tsx
import { useForm } from '@inertiajs/react'
import { Button } from '@/Components/ui/button'
import { Input } from '@/Components/ui/input'

export default function CreateDocumentForm() {
  const { data, setData, post, processing, errors } = useForm({
    title:      '',
    tracking_no:'',
    type_id:    '',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    post(route('documents.store'))
  }

  return (
    <form onSubmit={handleSubmit}>
      <Input value={data.title} onChange={e => setData('title', e.target.value)} />
      {errors.title && <p className="text-red-500 text-sm">{errors.title}</p>}
      <Button type="submit" disabled={processing}>Save</Button>
    </form>
  )
}
```

### Audit Trail Middleware Pattern

```php
// app/Http/Middleware/LogAuditTrail.php
public function handle(Request $request, Closure $next): Response
{
    $response = $next($request);

    if (auth()->check() && in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'])) {
        AuditTrail::create([
            'user_id'    => auth()->id(),
            'module'     => $request->route()->getName() ?? $request->path(),
            'event'      => $request->method() . ' ' . $request->path(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
    }

    return $response;
}
```

### UserRole Enum Pattern (replaces magic numbers)

```php
// app/Enums/UserRole.php
enum UserRole: string
{
    case SuperAdmin = 'super_admin';
    case Admin      = 'admin';
    case Encoder    = 'encoder';
    case Viewer     = 'viewer';

    public function label(): string
    {
        return match($this) {
            self::SuperAdmin => 'Super Administrator',
            self::Admin      => 'Administrator',
            self::Encoder    => 'Encoder',
            self::Viewer     => 'Viewer',
        };
    }

    // Maps old CI3 role integers to new named roles
    public static function fromLegacyInt(int $role): self
    {
        return match($role) {
            1       => self::SuperAdmin,
            2       => self::Admin,
            14      => self::Encoder,
            default => self::Viewer,
        };
    }
}
```

---

## 15. Module-by-Module Build Order

Build in this order. Each phase is independently shippable and testable.

### Phase 0 — Scaffold (Day 1)
- [ ] Run all setup commands from §4
- [ ] Verify Laravel 11 + Inertia + React + TS + Tailwind + shadcn/ui all working
- [ ] Create `AppLayout` and `AuthLayout` components
- [ ] Create `Sidebar` component with static navigation links
- [ ] Configure `.env` with all existing API keys, SMTP credentials, reCAPTCHA keys
- [ ] Set up legacy DB connection for data transfer

### Phase 1 — Authentication (Days 2–3)
- [ ] Customize Breeze `AuthenticatedSessionController` — add login attempts counter, reCAPTCHA validation
- [ ] Create `RolesAndPermissionsSeeder` with `super_admin`, `admin`, `encoder`, `viewer`
- [ ] Create `UserRole` enum with `fromLegacyInt()` for data transfer
- [ ] Create `DocumentStatus`, `DocumentFileType`, `LinkType` enums
- [ ] Run migrations 1–5 (routing_ranges → offices → divisions → users base → users customize)
- [ ] Run Spatie permission migrations
- [ ] Create `TransferLegacyData` Artisan command; transfer users and offices from legacy DB
- [ ] Test login, logout, role redirect, forgot password, reset password

### Phase 2 — Core Data Models (Days 3–4)
- [ ] Run migrations 6–16 (document_types → … → document_link_history)
- [ ] Create all Eloquent models with relationships (see §3 Models list)
- [ ] Add scopes to `Document`: `forUser()`, `forOffice()`, `active()`, `archived()`, `createdBetween()`, `forYear()`
- [ ] Add `latestPerDocument()` scope to `DocumentTrail`
- [ ] Transfer reference data from legacy DB (document_types, action_types, purpose_types, offices, divisions)
- [ ] Transfer documents, document_trails, document_files, audit_trails from legacy DB
- [ ] Run `php artisan transfer:verify` — confirm counts match

### Phase 3 — Dashboard + Analytics (Days 4–6)

#### Phase 3A — Dashboard Counters
- [ ] Run migrations 17–18 (analytics_snapshots, analytics indexes)
- [ ] Create `AnalyticsService` with `getDashboardCounters()`, `getDocumentsThisMonth()`, `getMonthlyVolume()`
- [ ] Create `DocumentObserver` — register in `AppServiceProvider`
- [ ] Update `DashboardController` to inject `AnalyticsService` and pass counters as props
- [ ] Create `StatCard` and `SparklineChart` components
- [ ] Create `Pages/Dashboard/Index.tsx` — 4 counter cards + documents-this-month card + 6-month sparkline
- [ ] Add logout route
- [ ] Verify: page loads with real counters on first render (no separate AJAX call)

#### Phase 3B — Admin Analytics Page
- [ ] Add remaining `AnalyticsService` methods: `getDocumentsByStatus()`, `getDocumentsByType()`, `getDocumentsByOffice()`, `getAverageRoutingDays()`, `getDailyAuditActivity()`, `getTopActiveUsers()`, `flushCache()`
- [ ] Create `AnalyticsController` with `index()` (Inertia render) and `counters()` (JSON refresh)
- [ ] Add analytics routes (admin-only gate + counter refresh endpoint)
- [ ] Create `LineChart`, `BarChart`, `DonutChart`, `ActiveUsersTable` components
- [ ] Create `Pages/Analytics/Index.tsx` with all six chart panels
- [ ] Add `Analytics` link to `Sidebar.tsx` with role guard (hidden for non-admin)
- [ ] Test all panels with real transferred data

#### Phase 3C — Reports
- [ ] Create `DocumentStatusReport` Excel export class (`app/Exports/`)
- [ ] Create `resources/views/reports/document-status-pdf.blade.php` template
- [ ] Create `ReportController` with Excel and PDF download methods
- [ ] Add report routes (admin-only for system-wide; all roles for own-office)
- [ ] Add export buttons to `Pages/Documents/Index.tsx`
- [ ] Test role-scoped downloads

#### Phase 3D — Scheduled Analytics Refresh
- [ ] Create `RefreshAnalyticsSnapshots` Artisan command
- [ ] Register `Schedule::command('analytics:refresh')->dailyAt('01:00')` in `routes/console.php`
- [ ] Test: `php artisan analytics:refresh` — confirm cache warm-up completes

### Phase 4 — Documents (Days 7–9)
- [ ] `DocumentController` — `index`, `store`, `update`, `destroy`, `download`, `all`, `latest`
- [ ] `StoreDocumentRequest` and `UpdateDocumentRequest` with validation rules
- [ ] `Pages/Documents/Index.tsx` — DataTable, search, filters, advanced date range
- [ ] `Pages/Documents/columns.tsx` — TanStack column definitions
- [ ] File upload via `FileUploadController` with `Storage::disk('local')` private storage
- [ ] Authenticated file download route
- [ ] `Pages/Documents/AllDocuments.tsx` — admin scope
- [ ] `Pages/Documents/Latest.tsx` — recent scope

### Phase 5 — Archives (Day 9)
- [ ] `ArchiveController` — accepts `year` query param; uses `Document::archived()` scope
- [ ] `Pages/Archives/Index.tsx` — DataTable, year selector
- [ ] Wire archive year list into `Sidebar.tsx` via shared Inertia props

### Phase 6 — Setup / Configuration (Day 10)
- [ ] Resource controllers for `DocumentType`, `ActionType`, `PurposeType`, `Office`, `Range`
- [ ] Corresponding Pages with DataTable + inline CRUD modals (shadcn Dialog)
- [ ] All 5 setup modules follow the same template — build one, copy pattern

### Phase 7 — User Account Management (Day 10)
- [ ] `UserAccountController` — index, store (with queued email notification), update, destroy
- [ ] `StoreUserRequest` with validation
- [ ] Password generation + `UserCreatedMail` Mailable (queued via `QUEUE_CONNECTION=database`)
- [ ] `Pages/UserAccount/Index.tsx`

### Phase 8 — Audit Trail (Day 11)
- [ ] Register `LogAuditTrail` middleware on all `POST/PUT/PATCH/DELETE` routes
- [ ] `AuditTrailController` + `Pages/AuditTrail/Index.tsx` — server-side paginated DataTable
- [ ] Confirm existing audit trail records were transferred in Phase 2

### Phase 9 — Public Track Document (Day 11)
- [ ] `TrackDocumentController@show` — no `auth` middleware
- [ ] `Pages/TrackDocument/View.tsx` — `AuthLayout` (no sidebar), document timeline component
- [ ] Test with a real tracking number from transferred data

### Phase 10 — External Integrations (Days 12–13)
- [ ] Create `DripApiService`, `IplumaApiService`, `PdmisApiService` (see §9 for pattern)
- [ ] Register in `config/services.php` and `.env`
- [ ] Create controllers for each — use API's own pagination (not in-memory fetch-all)
- [ ] Create Pages for each integration — same DataTable pattern
- [ ] PDMIS document-linking UI (replaces `Pdmis_linking.php` controller in old Documents module)

### Phase 11 — QR Codes (Day 13)
- [ ] `react-qr-code` for QR codes in document detail views
- [ ] QR code should encode the public `/track/{trackingNumber}` URL

### Phase 12 — Cleanup & Production Prep (Day 14)
- [ ] Delete all 46 debug/test PHP files from old `DOTS/` project root
- [ ] Delete `application/modules.zip`
- [ ] Delete backup module snapshot folders (`031925/`, `042825/`, `093025/`, `093025v2/`)
- [ ] Delete dead code: `Login - Copy/`, `Archives2022/`, `Archives2023/`, `Archives2024/`
- [ ] Set `APP_ENV=production`, `APP_DEBUG=false`, `LOG_LEVEL=error` in production `.env`
- [ ] Remove `LEGACY_DB_*` vars from production `.env` (transfer is complete)
- [ ] Run `php artisan optimize` (cache routes, config, views)
- [ ] Run `npm run build` for production assets
- [ ] Update Apache/Nginx config to point to `dots-laravel/public/`
- [ ] Final verification: document counts, user counts, audit trail integrity, all routes accessible

---

## 16. Naming Conventions

Follow these consistently throughout the new codebase.

### PHP (Laravel)

| Thing | Convention | Example |
|---|---|---|
| Controllers | `PascalCase` + `Controller` suffix | `DocumentController`, `AnalyticsController` |
| Models | `PascalCase` singular | `Document`, `DocumentTrail`, `DocumentFile` |
| Migrations | `snake_case` timestamped | `2026_09_23_create_documents_table` |
| Routes (named) | `kebab-case.action` | `documents.index`, `setup.document-types.store` |
| Inertia props keys | `camelCase` | `$documents`, `$filters`, `$counters` |
| Enums | `PascalCase` | `UserRole`, `DocumentStatus`, `DocumentFileType` |
| Services | `PascalCase` + `Service` suffix | `DripApiService`, `AnalyticsService` |
| Observers | `PascalCase` + `Observer` suffix | `DocumentObserver` |
| Exports | `PascalCase` + descriptive noun | `DocumentStatusReport` |
| Form Requests | `Verb` + `Model` + `Request` | `StoreDocumentRequest`, `UpdateDocumentRequest` |
| Mail | `PascalCase` + `Mail` suffix | `UserCreatedMail`, `PasswordResetMail` |
| Commands | `PascalCase` verb phrase | `RefreshAnalyticsSnapshots`, `TransferLegacyData` |

### TypeScript / React

| Thing | Convention | Example |
|---|---|---|
| Components | `PascalCase` | `DocumentsIndex`, `DataTable`, `StatCard` |
| Files | Match component name | `DocumentsIndex.tsx`, `StatCard.tsx` |
| Types/Interfaces | `PascalCase` | `Document`, `PaginatedDocuments`, `DashboardCounters` |
| Props interfaces | `Props` (local to each file) | `interface Props { ... }` |
| Hooks | `use` prefix | `useDocumentFilters` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_FILE_SIZE` |
| CSS classes | Tailwind utility only — no custom class names unless `@apply` is needed |

### Database

| Thing | Convention | Example |
|---|---|---|
| Tables | `snake_case` plural | `documents`, `document_types`, `audit_trails` |
| Columns | `snake_case` | `tracking_no`, `created_at`, `is_archived` |
| Foreign keys | `{table_singular}_id` | `document_type_id`, `office_id`, `holder_office_id` |
| Pivot tables | Both model names alphabetical | `document_tag` |
| Indexes | `idx_{table}_{column(s)}` | `idx_documents_sort_date`, `idx_trails_status_holder` |

---

## 17. What NOT to Migrate

These things from the old system should be **discarded entirely**, not ported:

| Old Thing | Reason |
|---|---|
| `application/modules 031925/`, `042825/`, `093025/`, `093025v2/` | Historical backup folders — use git history instead |
| `application/modules.zip` | Same; also not web-safe to leave in web root |
| `application/modules/Login - Copy/` | Dead duplicate |
| `application/modules/Archives2022/`, `2023/`, `2024/` | Replaced by parameterized `ArchiveController` |
| `application/modules/Documents/controllers/Documents copy.php` | Dead duplicate |
| `application/modules/Documents/models/Documents_model - Copy.php` | Dead duplicate |
| `application/modules/Documents/models/Documents_model latest.php` | Stale |
| All `test_*.php`, `debug_*.php`, `check_*.php`, `diag_*.php`, `setup_*.php` in root | Dev artifacts — expose DB schema and credentials |
| `apply_db_optimization.php`, `add_*.php` index scripts | Replaced by migration `add_analytics_indexes` |
| `dc1335eed9153abd779ffb85ff851a13.jpg`, `gfg-40.png`, `bureaus.txt`, `bureaus_hex.txt` | Leftover dev files |
| `error_404.php`, `print_mysql_ver.php` | Dev artifacts |
| `assets/pages/` (AdminLTE demo pages) | Not part of the application |
| `assets/docs/` (AdminLTE documentation) | Not needed |
| `assets/fullcalendar/examples/` | Not part of the application |
| `assets/jquery-*.js`, `jquery.min.js`, `jquery-3.3.1.js`, `jquery-1.12.4.min.js` | No jQuery in the new stack |
| jQuery DataTables (all plugins and extensions) | Replaced by TanStack Table |
| Bootstrap 4 + AdminLTE 3 | Replaced by Tailwind CSS + shadcn/ui |
| jQuery | Replaced by React |
| Summernote | Replaced by Tiptap |
| SweetAlert2 | Replaced by shadcn/ui Dialog |
| Toastr | Replaced by sonner |
| PDFMake + vfs_fonts (client-side PDF) | Replaced by DomPDF (server-side) |
| html2canvas | No longer needed with server-side PDF |
| uPlot, Sparklines.js | Replaced by Recharts |
| Chart.js | Replaced by Recharts |
| `application/third_party/MX/` | HMVC extension — not needed in Laravel |
| WireDesignz HMVC (`MX`) package | Not needed in Laravel |
| CodeIgniter system core (`system/`) | Not needed in Laravel |
| `add_*_indexes.php` and `optimize_database_indexes.sql` ad hoc scripts | Replaced by `add_analytics_indexes` migration |

---

*Migration spec originally created: September 22, 2026*
*Updated: September 23, 2026 — integrated analytics layer, full ERD table mappings, complete migration file order, security fix inventory, updated build order with Phase 3A–3D, updated target to Laravel 12*
*Based on: PROJECT_ANALYSIS.md + ISSUES_AND_IMPROVEMENTS.md + ERD.md + ANALYTICS_IMPLEMENTATION.md*
