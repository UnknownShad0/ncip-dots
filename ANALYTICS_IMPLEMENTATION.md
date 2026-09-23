# DOTS — Analytics Implementation Guide

**System:** Document Tracking System (DOTS)
**Migration Target:** Laravel 12 + Inertia.js + React + TypeScript + Tailwind CSS
**Created:** September 23, 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Analytics Scope & Metrics](#2-analytics-scope--metrics)
3. [Database Schema Changes](#3-database-schema-changes)
4. [Backend Implementation](#4-backend-implementation)
   - 4.1 [Eloquent Models & Scopes](#41-eloquent-models--scopes)
   - 4.2 [Analytics Service Class](#42-analytics-service-class)
   - 4.3 [Analytics Controller](#43-analytics-controller)
   - 4.4 [Routes](#44-routes)
5. [Frontend Implementation](#5-frontend-implementation)
   - 5.1 [TypeScript Types](#51-typescript-types)
   - 5.2 [Dashboard Page](#52-dashboard-page)
   - 5.3 [Analytics Page](#53-analytics-page)
   - 5.4 [Reusable Chart Components](#54-reusable-chart-components)
   - 5.5 [Stat Card Component](#55-stat-card-component)
6. [Real-Time Dashboard Counters](#6-real-time-dashboard-counters)
7. [Report Generation](#7-report-generation)
   - 7.1 [Excel Export](#71-excel-export)
   - 7.2 [PDF Export](#72-pdf-export)
8. [Caching Strategy](#8-caching-strategy)
9. [Role-Based Access](#9-role-based-access)
10. [Build Order](#10-build-order)

---

## 1. Overview

The current DOTS dashboard (`Dashboard` module in CI3) only shows four static counters — **Pending**, **Incoming**, **Released**, and **Terminal** — loaded via an AJAX call after page render.

This guide implements a full analytics layer on top of the new Laravel + Inertia + React stack defined in `MIGRATION_SPEC.md`, addressing:

- The dashboard's shallow metrics (documented in `PROJECT_ANALYSIS.md §5.2`)
- The lack of historical trend data (identified in `ISSUES_AND_IMPROVEMENTS.md`)
- Reporting requirements already implied by the Excel templates (`StatusReport.xlsx`, `DataFileStatusReport.xlsx`) in `assets/templates/`
- Cross-module visibility for admins vs. per-office visibility for regular users

All analytics are driven from existing tables (`documents`, `document_trail`, `audit_trail`, `bureau/offices`) — no new tracking infrastructure is required beyond an optional `analytics_snapshots` caching table.

---

## 2. Analytics Scope & Metrics

### 2.1 Dashboard Metrics (Available to All Roles)

These are the metrics every logged-in user sees on their Dashboard, scoped to their own office unless they are `super_admin` or `admin`.

| Metric | Description | Source Table |
|---|---|---|
| **Pending** | Documents where the latest trail status = `PENDING` and the user's office is the holder | `document_trail` |
| **Incoming** | Documents released to the user's office (`receiving_office_id = user_office`) with `AVAILABLE` status | `document_trail` |
| **Released** | Documents the user's office routed out (latest trail `AVAILABLE`, originating = user_office) | `document_trail` |
| **Terminal** | Documents marked `TERMINAL` held by the user's office | `document_trail` |
| **Total Documents** | All non-archived documents created by the user's office | `documents` |
| **Documents This Month** | Created in the current calendar month | `documents` |

### 2.2 Admin Analytics Metrics (Roles: `super_admin`, `admin`)

A dedicated `/analytics` page visible only to admins, covering the entire system.

| Metric | Chart Type | Description |
|---|---|---|
| **Documents by Status** | Donut / Pie | System-wide breakdown: Pending / Available / Terminal / Unfinalized |
| **Documents Created Over Time** | Line Chart (monthly) | Monthly volume for the past 12 months |
| **Documents by Office** | Horizontal Bar | Top 10–15 offices by total document count |
| **Documents by Type** | Bar Chart | Breakdown by `document_type` |
| **Average Routing Time** | Stat Card | Avg days from creation to terminal status |
| **Routing Activity by Office** | Heatmap / Bar | How many routing actions each office performs |
| **Audit Trail Activity** | Line Chart | User login/action counts per day (last 30 days) |
| **Top Active Users** | Leaderboard Table | Users with most document transactions this month |

### 2.3 Public Analytics (None)

No analytics are exposed on the public `TrackDocument` page — only the document's own routing timeline is shown.

---

## 3. Database Schema Changes

Two additions are needed. Everything else queries existing tables.

### 3.1 `analytics_snapshots` Table (Optional — For Performance)

For heavy aggregation queries (monthly trends, per-office breakdowns), pre-compute and cache results in this table. A scheduled Laravel command refreshes it nightly.

```php
// database/migrations/2026_09_23_000001_create_analytics_snapshots_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('analytics_snapshots', function (Blueprint $table) {
            $table->id();
            $table->string('metric_key', 100)->index();   // e.g. 'monthly_volume_2026_09'
            $table->string('dimension', 100)->nullable();  // e.g. office short_name, month label
            $table->unsignedBigInteger('value')->default(0);
            $table->json('payload')->nullable();           // raw result for complex metrics
            $table->timestamp('computed_at');
            $table->timestamps();

            $table->unique(['metric_key', 'dimension']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('analytics_snapshots');
    }
};
```

### 3.2 Index Additions (Performance)

Add these indexes if not already present. Based on `ISSUES_AND_IMPROVEMENTS.md §3` and `PROJECT_ANALYSIS.md §15`.

```php
// database/migrations/2026_09_23_000002_add_analytics_indexes.php

return new class extends Migration
{
    public function up(): void
    {
        // Speed up monthly aggregations on documents
        Schema::table('documents', function (Blueprint $table) {
            $table->index(['created_at', 'is_archived'], 'idx_docs_created_archived');
            $table->index(['document_type_id', 'is_archived'], 'idx_docs_type_archived');
        });

        // Speed up status queries on document_trails
        Schema::table('document_trails', function (Blueprint $table) {
            $table->index(['status', 'holder_office_id'], 'idx_trails_status_holder');
            $table->index(['status', 'receiving_office_id'], 'idx_trails_status_receiving');
            $table->index(['document_id', 'created_at'], 'idx_trails_doc_created');
        });

        // Speed up audit trail date-range queries
        Schema::table('audit_trails', function (Blueprint $table) {
            $table->index(['created_at', 'user_id'], 'idx_audit_created_user');
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropIndex('idx_docs_created_archived');
            $table->dropIndex('idx_docs_type_archived');
        });
        Schema::table('document_trails', function (Blueprint $table) {
            $table->dropIndex('idx_trails_status_holder');
            $table->dropIndex('idx_trails_status_receiving');
            $table->dropIndex('idx_trails_doc_created');
        });
        Schema::table('audit_trails', function (Blueprint $table) {
            $table->dropIndex('idx_audit_created_user');
        });
    }
};
```

---

## 4. Backend Implementation

### 4.1 Eloquent Models & Scopes

Add these scopes to the `Document` model (building on `ERD.md §6`).

```php
// app/Models/Document.php — add to existing model

use Illuminate\Database\Eloquent\Builder;

// --- Scopes for Analytics ---

/**
 * Scope: Documents created within a date range.
 */
public function scopeCreatedBetween(Builder $query, string $from, string $to): Builder
{
    return $query->whereBetween('created_at', [$from, $to]);
}

/**
 * Scope: Documents created in a specific year.
 */
public function scopeForYear(Builder $query, int $year): Builder
{
    return $query->whereYear('created_at', $year);
}

/**
 * Scope: Documents created in a specific month of a year.
 */
public function scopeForMonth(Builder $query, int $year, int $month): Builder
{
    return $query->whereYear('created_at', $year)->whereMonth('created_at', $month);
}

/**
 * Scope: Restrict to documents visible to a specific office.
 * Used on non-admin dashboards.
 */
public function scopeForOffice(Builder $query, int $officeId): Builder
{
    return $query->whereHas('trails', function ($q) use ($officeId) {
        $q->where('holder_office_id', $officeId)
          ->orWhere('receiving_office_id', $officeId)
          ->orWhere('originating_office_id', $officeId);
    })->orWhere(function ($q) use ($officeId) {
        $q->whereHas('creator', fn ($u) => $u->where('office_id', $officeId));
    });
}
```

Add this scope to `DocumentTrail`:

```php
// app/Models/DocumentTrail.php — add to existing model

/**
 * Scope: Latest trail entry per document.
 * Used to determine the current status of each document.
 */
public function scopeLatestPerDocument(Builder $query): Builder
{
    return $query->whereIn('id', function ($sub) {
        $sub->selectRaw('MAX(id)')
            ->from('document_trails')
            ->groupBy('document_id');
    });
}
```

### 4.2 Analytics Service Class

Create `app/Services/AnalyticsService.php`. This class centralizes all aggregation queries, making them easy to cache and test independently.

```php
<?php

namespace App\Services;

use App\Models\AuditTrail;
use App\Models\Document;
use App\Models\DocumentTrail;
use App\Models\Office;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class AnalyticsService
{
    // Cache TTL constants
    private const DASHBOARD_TTL  = 300;   // 5 minutes — fast-changing counters
    private const TRENDS_TTL     = 3600;  // 1 hour   — monthly trends
    private const SNAPSHOTS_TTL  = 86400; // 24 hours — heavy aggregations

    // ──────────────────────────────────────────────────────────────────────────
    // DASHBOARD COUNTERS — per office (or system-wide for admins)
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Get the four dashboard counters for a specific office.
     * Mirrors the old Dashboard_model->getSummary() but with proper scoping.
     *
     * @param  int|null  $officeId  null = system-wide (admin view)
     * @return array{pending: int, incoming: int, released: int, terminal: int}
     */
    public function getDashboardCounters(?int $officeId = null): array
    {
        $cacheKey = 'dashboard_counters_' . ($officeId ?? 'all');

        return Cache::remember($cacheKey, self::DASHBOARD_TTL, function () use ($officeId) {
            // Sub-query: get the latest trail ID for each document
            $latestTrailIds = DB::table('document_trails')
                ->selectRaw('MAX(id) as id')
                ->groupBy('document_id');

            $base = DB::table('document_trails as dt')
                ->joinSub($latestTrailIds, 'latest', fn ($j) => $j->on('dt.id', '=', 'latest.id'));

            if ($officeId) {
                // PENDING: user's office is holding the document
                $pending = (clone $base)
                    ->where('dt.status', 'pending')
                    ->where('dt.holder_office_id', $officeId)
                    ->count();

                // INCOMING: document is en route TO this office (AVAILABLE + receiving = this office)
                $incoming = (clone $base)
                    ->where('dt.status', 'available')
                    ->where('dt.receiving_office_id', $officeId)
                    ->count();

                // RELEASED: document was sent FROM this office (AVAILABLE + originating = this office)
                $released = (clone $base)
                    ->where('dt.status', 'available')
                    ->where('dt.originating_office_id', $officeId)
                    ->count();

                // TERMINAL: terminated at this office
                $terminal = (clone $base)
                    ->where('dt.status', 'terminal')
                    ->where('dt.holder_office_id', $officeId)
                    ->count();
            } else {
                // System-wide counts
                $pending  = (clone $base)->where('dt.status', 'pending')->count();
                $incoming = (clone $base)->where('dt.status', 'available')->count();
                $released = 0; // Not meaningful system-wide
                $terminal = (clone $base)->where('dt.status', 'terminal')->count();
            }

            return compact('pending', 'incoming', 'released', 'terminal');
        });
    }

    /**
     * Count documents created this month by a specific office.
     */
    public function getDocumentsThisMonth(?int $officeId = null): int
    {
        $cacheKey = 'docs_this_month_' . ($officeId ?? 'all');

        return Cache::remember($cacheKey, self::DASHBOARD_TTL, function () use ($officeId) {
            $query = Document::query()
                ->whereYear('created_at', now()->year)
                ->whereMonth('created_at', now()->month);

            if ($officeId) {
                $query->whereHas('creator', fn ($q) => $q->where('office_id', $officeId));
            }

            return $query->count();
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TREND ANALYTICS — admin-level, system-wide
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Monthly document creation counts for the past N months.
     * Returns array of { month: 'Sep 2026', count: 142 }
     *
     * @param  int  $months  Number of months to go back (default 12)
     */
    public function getMonthlyVolume(int $months = 12): array
    {
        $cacheKey = "monthly_volume_{$months}";

        return Cache::remember($cacheKey, self::TRENDS_TTL, function () use ($months) {
            $from = now()->subMonths($months - 1)->startOfMonth();

            $rows = DB::table('documents')
                ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as month_key, COUNT(*) as count")
                ->where('created_at', '>=', $from)
                ->where('is_archived', false)
                ->groupBy('month_key')
                ->orderBy('month_key')
                ->get();

            // Fill in missing months with 0 so the chart has a complete x-axis
            $result = [];
            for ($i = $months - 1; $i >= 0; $i--) {
                $key   = now()->subMonths($i)->format('Y-m');
                $label = now()->subMonths($i)->format('M Y');
                $found = $rows->firstWhere('month_key', $key);
                $result[] = ['month' => $label, 'count' => $found ? (int) $found->count : 0];
            }

            return $result;
        });
    }

    /**
     * Document counts grouped by current status (from latest trail entry).
     * Returns array of { status: 'pending', count: 56 }
     */
    public function getDocumentsByStatus(): array
    {
        return Cache::remember('docs_by_status', self::TRENDS_TTL, function () {
            $latestTrailIds = DB::table('document_trails')
                ->selectRaw('MAX(id) as id')
                ->groupBy('document_id');

            return DB::table('document_trails as dt')
                ->joinSub($latestTrailIds, 'latest', fn ($j) => $j->on('dt.id', '=', 'latest.id'))
                ->selectRaw('dt.status, COUNT(*) as count')
                ->groupBy('dt.status')
                ->orderByDesc('count')
                ->get()
                ->map(fn ($row) => ['status' => $row->status, 'count' => (int) $row->count])
                ->toArray();
        });
    }

    /**
     * Document counts grouped by document type.
     * Returns array of { type: 'Memorandum', count: 312 }
     */
    public function getDocumentsByType(): array
    {
        return Cache::remember('docs_by_type', self::TRENDS_TTL, function () {
            return DB::table('documents as d')
                ->join('document_types as dt', 'd.document_type_id', '=', 'dt.id')
                ->selectRaw('dt.name as type, COUNT(d.id) as count')
                ->where('d.is_archived', false)
                ->groupBy('dt.name')
                ->orderByDesc('count')
                ->limit(10)
                ->get()
                ->map(fn ($row) => ['type' => $row->type, 'count' => (int) $row->count])
                ->toArray();
        });
    }

    /**
     * Document counts grouped by originating office (top 15).
     * Returns array of { office: 'OSESSC', count: 87 }
     */
    public function getDocumentsByOffice(): array
    {
        return Cache::remember('docs_by_office', self::TRENDS_TTL, function () {
            return DB::table('documents as d')
                ->join('users as u', 'd.created_by', '=', 'u.id')
                ->join('offices as o', 'u.office_id', '=', 'o.id')
                ->selectRaw('o.short_name as office, COUNT(d.id) as count')
                ->where('d.is_archived', false)
                ->groupBy('o.short_name')
                ->orderByDesc('count')
                ->limit(15)
                ->get()
                ->map(fn ($row) => ['office' => $row->office, 'count' => (int) $row->count])
                ->toArray();
        });
    }

    /**
     * Average days from document creation to terminal status.
     * Only counts documents that have reached TERMINAL.
     */
    public function getAverageRoutingDays(): float
    {
        return Cache::remember('avg_routing_days', self::SNAPSHOTS_TTL, function () {
            $result = DB::table('documents as d')
                ->join('document_trails as dt', function ($join) {
                    $join->on('d.id', '=', 'dt.document_id')
                         ->where('dt.status', '=', 'terminal');
                })
                ->selectRaw('AVG(DATEDIFF(dt.created_at, d.created_at)) as avg_days')
                ->whereNotNull('dt.id')
                ->value('avg_days');

            return round((float) ($result ?? 0), 1);
        });
    }

    /**
     * Daily audit trail action counts for the last N days.
     * Returns array of { date: '2026-09-15', count: 43 }
     *
     * @param  int  $days  Number of days (default 30)
     */
    public function getDailyAuditActivity(int $days = 30): array
    {
        $cacheKey = "daily_audit_{$days}";

        return Cache::remember($cacheKey, self::DASHBOARD_TTL, function () use ($days) {
            $from = now()->subDays($days - 1)->startOfDay();

            $rows = DB::table('audit_trails')
                ->selectRaw("DATE(created_at) as day, COUNT(*) as count")
                ->where('created_at', '>=', $from)
                ->groupBy('day')
                ->orderBy('day')
                ->get()
                ->keyBy('day');

            $result = [];
            for ($i = $days - 1; $i >= 0; $i--) {
                $date   = now()->subDays($i)->format('Y-m-d');
                $label  = now()->subDays($i)->format('M d');
                $found  = $rows->get($date);
                $result[] = ['date' => $label, 'count' => $found ? (int) $found->count : 0];
            }

            return $result;
        });
    }

    /**
     * Top N most active users this month (by document actions in audit_trails).
     * Returns array of { name: 'Juan Dela Cruz', office: 'OSESSC', count: 28 }
     */
    public function getTopActiveUsers(int $limit = 10): array
    {
        $cacheKey = "top_users_{$limit}_" . now()->format('Y_m');

        return Cache::remember($cacheKey, self::TRENDS_TTL, function () use ($limit) {
            return DB::table('audit_trails as a')
                ->join('users as u', 'a.user_id', '=', 'u.id')
                ->join('offices as o', 'u.office_id', '=', 'o.id')
                ->selectRaw("
                    CONCAT(u.first_name, ' ', u.last_name) as name,
                    o.short_name as office,
                    COUNT(a.id) as count
                ")
                ->whereYear('a.created_at', now()->year)
                ->whereMonth('a.created_at', now()->month)
                ->groupBy('u.id', 'u.first_name', 'u.last_name', 'o.short_name')
                ->orderByDesc('count')
                ->limit($limit)
                ->get()
                ->map(fn ($row) => [
                    'name'   => $row->name,
                    'office' => $row->office,
                    'count'  => (int) $row->count,
                ])
                ->toArray();
        });
    }

    /**
     * Invalidate all analytics caches. Called after bulk imports or nightly refresh.
     */
    public function flushCache(): void
    {
        $keys = [
            'docs_by_status', 'docs_by_type', 'docs_by_office',
            'avg_routing_days', 'monthly_volume_12',
        ];

        foreach ($keys as $key) {
            Cache::forget($key);
        }

        // Pattern-based flush for keyed caches (requires cache tags or manual iteration)
        Cache::forget('daily_audit_30');
        Cache::forget('top_users_10_' . now()->format('Y_m'));

        // Flush office-specific counters — iterate all offices
        Office::query()->pluck('id')->each(function (int $id) {
            Cache::forget("dashboard_counters_{$id}");
            Cache::forget("docs_this_month_{$id}");
        });
        Cache::forget('dashboard_counters_all');
        Cache::forget('docs_this_month_all');
    }
}
```

### 4.3 Analytics Controller

```php
<?php

// app/Http/Controllers/AnalyticsController.php

namespace App\Http\Controllers;

use App\Services\AnalyticsService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AnalyticsController extends Controller
{
    public function __construct(private readonly AnalyticsService $analytics) {}

    /**
     * Full analytics page — admin only.
     * All heavy data is passed as Inertia props (SSR-friendly, no extra AJAX).
     */
    public function index(): Response
    {
        return Inertia::render('Analytics/Index', [
            // Status distribution donut
            'documentsByStatus' => $this->analytics->getDocumentsByStatus(),

            // Monthly line chart (last 12 months)
            'monthlyVolume'     => $this->analytics->getMonthlyVolume(12),

            // Bar charts
            'documentsByType'   => $this->analytics->getDocumentsByType(),
            'documentsByOffice' => $this->analytics->getDocumentsByOffice(),

            // Stat cards
            'avgRoutingDays'    => $this->analytics->getAverageRoutingDays(),

            // Audit activity line chart (last 30 days)
            'auditActivity'     => $this->analytics->getDailyAuditActivity(30),

            // Leaderboard table
            'topActiveUsers'    => $this->analytics->getTopActiveUsers(10),
        ]);
    }

    /**
     * Dashboard counters endpoint — called by both the Dashboard page (via props)
     * and optionally as a JSON refresh endpoint for live counters.
     */
    public function counters(Request $request): \Illuminate\Http\JsonResponse
    {
        $user     = auth()->user();
        $officeId = $user->hasRole(['super_admin', 'admin']) ? null : $user->office_id;

        return response()->json([
            'counters'        => $this->analytics->getDashboardCounters($officeId),
            'documentsMonth'  => $this->analytics->getDocumentsThisMonth($officeId),
        ]);
    }
}
```

Update `DashboardController` to include counters in props (no extra AJAX call needed — replaces the old `loadNotif()` AJAX pattern):

```php
<?php

// app/Http/Controllers/DashboardController.php

namespace App\Http\Controllers;

use App\Services\AnalyticsService;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __construct(private readonly AnalyticsService $analytics) {}

    public function index(): Response
    {
        $user     = auth()->user();
        $officeId = $user->hasRole(['super_admin', 'admin']) ? null : $user->office_id;

        return Inertia::render('Dashboard/Index', [
            // Counters are resolved at render time — no AJAX needed
            'counters'       => $this->analytics->getDashboardCounters($officeId),
            'documentsMonth' => $this->analytics->getDocumentsThisMonth($officeId),

            // Mini trend sparkline (last 6 months) on dashboard
            'monthlyTrend'   => $this->analytics->getMonthlyVolume(6),
        ]);
    }
}
```

### 4.4 Routes

```php
// routes/web.php — add inside the auth middleware group

use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\DashboardController;

Route::middleware(['auth', 'verified'])->group(function () {

    // Dashboard — all authenticated users
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // Live counter refresh (JSON) — all authenticated users
    Route::get('/dashboard/counters', [AnalyticsController::class, 'counters'])
        ->name('dashboard.counters');

    // Full analytics page — admins only
    Route::middleware('role:super_admin|admin')->group(function () {
        Route::get('/analytics', [AnalyticsController::class, 'index'])->name('analytics.index');
    });

    // ... existing routes
});
```

### 4.5 Scheduled Snapshot Refresh

Add a scheduled command to pre-compute heavy metrics nightly and store them in `analytics_snapshots`. This prevents the first admin load each day from being slow.

```bash
php artisan make:command RefreshAnalyticsSnapshots
```

```php
<?php

// app/Console/Commands/RefreshAnalyticsSnapshots.php

namespace App\Console\Commands;

use App\Services\AnalyticsService;
use Illuminate\Console\Command;

class RefreshAnalyticsSnapshots extends Command
{
    protected $signature   = 'analytics:refresh';
    protected $description = 'Pre-compute and cache analytics snapshots for the admin dashboard';

    public function handle(AnalyticsService $analytics): int
    {
        $this->info('Flushing analytics cache...');
        $analytics->flushCache();

        $this->info('Re-computing analytics...');

        // Warm the caches by calling each method once
        $analytics->getDocumentsByStatus();
        $analytics->getDocumentsByType();
        $analytics->getDocumentsByOffice();
        $analytics->getAverageRoutingDays();
        $analytics->getMonthlyVolume(12);
        $analytics->getDailyAuditActivity(30);
        $analytics->getTopActiveUsers(10);

        $this->info('Analytics snapshots refreshed.');
        return Command::SUCCESS;
    }
}
```

Register in `routes/console.php`:

```php
// routes/console.php

use Illuminate\Support\Facades\Schedule;

Schedule::command('analytics:refresh')->dailyAt('01:00');
```

---

## 5. Frontend Implementation

### 5.1 TypeScript Types

```typescript
// resources/js/types/analytics.ts

export interface DashboardCounters {
  pending:  number
  incoming: number
  released: number
  terminal: number
}

export interface DashboardProps {
  counters:       DashboardCounters
  documentsMonth: number
  monthlyTrend:   MonthlyDataPoint[]
}

export interface MonthlyDataPoint {
  month: string   // e.g. 'Sep 2026'
  count: number
}

export interface StatusDataPoint {
  status: 'pending' | 'available' | 'terminal'
  count:  number
}

export interface NamedDataPoint {
  name:  string   // office name, type name, etc.
  count: number
}

export interface TypeDataPoint {
  type:  string
  count: number
}

export interface OfficeDataPoint {
  office: string
  count:  number
}

export interface AuditDataPoint {
  date:  string   // e.g. 'Sep 15'
  count: number
}

export interface ActiveUser {
  name:   string
  office: string
  count:  number
}

export interface AnalyticsProps {
  documentsByStatus: StatusDataPoint[]
  monthlyVolume:     MonthlyDataPoint[]
  documentsByType:   TypeDataPoint[]
  documentsByOffice: OfficeDataPoint[]
  avgRoutingDays:    number
  auditActivity:     AuditDataPoint[]
  topActiveUsers:    ActiveUser[]
}
```

### 5.2 Dashboard Page

```tsx
// resources/js/Pages/Dashboard/Index.tsx

import { Head } from '@inertiajs/react'
import AppLayout from '@/Components/Layout/AppLayout'
import { StatCard } from '@/Components/Analytics/StatCard'
import { SparklineChart } from '@/Components/Analytics/SparklineChart'
import {
  FileText, Clock, ArrowDownToLine, CheckCircle2, TrendingUp
} from 'lucide-react'
import type { DashboardProps } from '@/types/analytics'

export default function DashboardIndex({ counters, documentsMonth, monthlyTrend }: DashboardProps) {
  return (
    <AppLayout>
      <Head title="Dashboard" />

      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>

        {/* Counter Cards — matches old 4 counters */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Pending"
            value={counters.pending}
            icon={<Clock className="h-5 w-5" />}
            color="yellow"
            description="Waiting for action"
          />
          <StatCard
            title="Incoming"
            value={counters.incoming}
            icon={<ArrowDownToLine className="h-5 w-5" />}
            color="blue"
            description="En route to your office"
          />
          <StatCard
            title="Released"
            value={counters.released}
            icon={<TrendingUp className="h-5 w-5" />}
            color="indigo"
            description="Sent from your office"
          />
          <StatCard
            title="Terminal"
            value={counters.terminal}
            icon={<CheckCircle2 className="h-5 w-5" />}
            color="green"
            description="Archived / disposed"
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            title="Documents This Month"
            value={documentsMonth}
            icon={<FileText className="h-5 w-5" />}
            color="slate"
            description={new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
          />
        </div>

        {/* Mini Trend Sparkline */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-medium text-gray-700">
            Document Volume — Last 6 Months
          </h2>
          <SparklineChart data={monthlyTrend} dataKey="count" xKey="month" color="#6366f1" />
        </div>
      </div>
    </AppLayout>
  )
}
```

### 5.3 Analytics Page

```tsx
// resources/js/Pages/Analytics/Index.tsx

import { Head } from '@inertiajs/react'
import AppLayout from '@/Components/Layout/AppLayout'
import { StatCard } from '@/Components/Analytics/StatCard'
import { LineChart }  from '@/Components/Analytics/LineChart'
import { BarChart }   from '@/Components/Analytics/BarChart'
import { DonutChart } from '@/Components/Analytics/DonutChart'
import { ActiveUsersTable } from '@/Components/Analytics/ActiveUsersTable'
import { Timer } from 'lucide-react'
import type { AnalyticsProps } from '@/types/analytics'

export default function AnalyticsIndex({
  documentsByStatus,
  monthlyVolume,
  documentsByType,
  documentsByOffice,
  avgRoutingDays,
  auditActivity,
  topActiveUsers,
}: AnalyticsProps) {
  return (
    <AppLayout>
      <Head title="Analytics" />

      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>

        {/* Avg Routing Time */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title="Avg. Routing Time"
            value={`${avgRoutingDays} days`}
            icon={<Timer className="h-5 w-5" />}
            color="orange"
            description="From creation to terminal"
          />
        </div>

        {/* Row 1: Status Donut + Monthly Line */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-medium text-gray-700">Documents by Status</h2>
            <DonutChart
              data={documentsByStatus.map(d => ({ name: d.status, value: d.count }))}
            />
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-medium text-gray-700">
              Monthly Volume (Last 12 Months)
            </h2>
            <LineChart data={monthlyVolume} dataKey="count" xKey="month" color="#6366f1" />
          </div>
        </div>

        {/* Row 2: By Type + By Office */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-medium text-gray-700">Documents by Type</h2>
            <BarChart
              data={documentsByType.map(d => ({ name: d.type, value: d.count }))}
              color="#0ea5e9"
              layout="horizontal"
            />
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-medium text-gray-700">
              Documents by Office (Top 15)
            </h2>
            <BarChart
              data={documentsByOffice.map(d => ({ name: d.office, value: d.count }))}
              color="#10b981"
              layout="horizontal"
            />
          </div>
        </div>

        {/* Row 3: Audit Activity Line + Top Users Table */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-medium text-gray-700">
              Audit Activity (Last 30 Days)
            </h2>
            <LineChart data={auditActivity} dataKey="count" xKey="date" color="#f59e0b" />
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-medium text-gray-700">
              Top Active Users This Month
            </h2>
            <ActiveUsersTable users={topActiveUsers} />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
```

### 5.4 Reusable Chart Components

All charts use **Recharts** (as specified in `MIGRATION_SPEC.md §1`). Each component is a thin, typed wrapper.

```tsx
// resources/js/Components/Analytics/LineChart.tsx

import {
  ResponsiveContainer, LineChart as ReLineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts'

interface Props {
  data:    { [key: string]: string | number }[]
  dataKey: string
  xKey:    string
  color?:  string
  height?: number
}

export function LineChart({ data, dataKey, xKey, color = '#6366f1', height = 220 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReLineChart data={data} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
      </ReLineChart>
    </ResponsiveContainer>
  )
}
```

```tsx
// resources/js/Components/Analytics/BarChart.tsx

import {
  ResponsiveContainer,
  BarChart as ReBarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Cell
} from 'recharts'

interface DataPoint {
  name:  string
  value: number
}

interface Props {
  data:    DataPoint[]
  color?:  string
  layout?: 'vertical' | 'horizontal'
  height?: number
}

export function BarChart({ data, color = '#6366f1', layout = 'vertical', height = 260 }: Props) {
  const isHorizontal = layout === 'horizontal'

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart
        data={data}
        layout={isHorizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 4, right: 12, left: isHorizontal ? 60 : -20, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        {isHorizontal ? (
          <>
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={56} />
            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          </>
        )}
        <Tooltip />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((_, index) => (
            <Cell key={index} fill={color} fillOpacity={0.85} />
          ))}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  )
}
```

```tsx
// resources/js/Components/Analytics/DonutChart.tsx

import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from 'recharts'

const STATUS_COLORS: Record<string, string> = {
  pending:   '#f59e0b',
  available: '#3b82f6',
  terminal:  '#10b981',
}

interface DataPoint {
  name:  string
  value: number
}

interface Props {
  data:   DataPoint[]
  height?: number
}

export function DonutChart({ data, height = 240 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={STATUS_COLORS[entry.name] ?? `hsl(${index * 60}, 65%, 55%)`}
            />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
```

```tsx
// resources/js/Components/Analytics/SparklineChart.tsx
// Minimal sparkline for the Dashboard mini trend card

import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts'

interface Props {
  data:    { [key: string]: string | number }[]
  dataKey: string
  xKey:    string
  color?:  string
  height?: number
}

export function SparklineChart({ data, dataKey, color = '#6366f1', height = 80 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0}   />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={color} fill="url(#sparkGrad)" strokeWidth={2} dot={false} />
        <Tooltip
          formatter={(value: number) => [value, 'Documents']}
          labelFormatter={(label: string) => label}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
```

### 5.5 Stat Card Component

```tsx
// resources/js/Components/Analytics/StatCard.tsx

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type Color = 'yellow' | 'blue' | 'indigo' | 'green' | 'orange' | 'slate' | 'red'

const colorMap: Record<Color, { bg: string; icon: string; text: string }> = {
  yellow: { bg: 'bg-yellow-50',  icon: 'text-yellow-500', text: 'text-yellow-700' },
  blue:   { bg: 'bg-blue-50',   icon: 'text-blue-500',   text: 'text-blue-700'  },
  indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-500', text: 'text-indigo-700'},
  green:  { bg: 'bg-green-50',  icon: 'text-green-500',  text: 'text-green-700' },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-500', text: 'text-orange-700'},
  slate:  { bg: 'bg-slate-50',  icon: 'text-slate-500',  text: 'text-slate-700' },
  red:    { bg: 'bg-red-50',    icon: 'text-red-500',    text: 'text-red-700'   },
}

interface Props {
  title:       string
  value:       string | number
  icon:        ReactNode
  color:       Color
  description?: string
}

export function StatCard({ title, value, icon, color, description }: Props) {
  const c = colorMap[color]

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <span className={cn('rounded-lg p-2', c.bg, c.icon)}>{icon}</span>
      </div>
      <p className={cn('mt-3 text-3xl font-bold', c.text)}>{value}</p>
      {description && (
        <p className="mt-1 text-xs text-gray-400">{description}</p>
      )}
    </div>
  )
}
```

```tsx
// resources/js/Components/Analytics/ActiveUsersTable.tsx

import type { ActiveUser } from '@/types/analytics'

interface Props {
  users: ActiveUser[]
}

export function ActiveUsersTable({ users }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="pb-2 font-medium">#</th>
            <th className="pb-2 font-medium">Name</th>
            <th className="pb-2 font-medium">Office</th>
            <th className="pb-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="py-2 text-gray-400">{i + 1}</td>
              <td className="py-2 font-medium text-gray-900">{user.name}</td>
              <td className="py-2 text-gray-500">{user.office}</td>
              <td className="py-2 text-right font-semibold text-indigo-600">{user.count}</td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-gray-400">
                No activity this month.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
```

---

## 6. Real-Time Dashboard Counters

The old CI3 dashboard loaded counters with a separate AJAX call (`loadNotif()`) to work around slow page render. In the new stack, counters are passed directly as Inertia props (resolved server-side with a 5-minute cache), so the page loads with real data immediately — no AJAX hack required.

For use cases where a user wants to refresh counters without a full page reload, use an Inertia partial reload:

```tsx
// In Dashboard/Index.tsx — optional manual refresh

import { router } from '@inertiajs/react'
import { RefreshCw } from 'lucide-react'

function RefreshButton() {
  function handleRefresh() {
    // Only re-fetches the 'counters' and 'documentsMonth' props, not the whole page
    router.reload({ only: ['counters', 'documentsMonth'] })
  }

  return (
    <button
      onClick={handleRefresh}
      className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
    >
      <RefreshCw className="h-4 w-4" />
      Refresh
    </button>
  )
}
```

---

## 7. Report Generation

These replace the existing Excel templates (`StatusReport.xlsx`, `DataFileStatusReport.xlsx`).

### 7.1 Excel Export

```bash
php artisan make:export DocumentStatusReport --model=Document
```

```php
<?php

// app/Exports/DocumentStatusReport.php

namespace App\Exports;

use App\Models\Document;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;

class DocumentStatusReport implements
    FromCollection, WithHeadings, WithMapping, WithTitle, ShouldAutoSize
{
    public function __construct(
        private readonly ?int $officeId = null,
        private readonly ?int $year = null,
    ) {}

    public function collection(): Collection
    {
        return Document::with(['type', 'creator.office', 'latestTrail.holderOffice'])
            ->when($this->officeId, fn ($q) => $q->forOffice($this->officeId))
            ->when($this->year,     fn ($q) => $q->forYear($this->year))
            ->orderByDesc('created_at')
            ->get();
    }

    public function headings(): array
    {
        return [
            'Tracking No.', 'Title', 'Document Type', 'Origin Type',
            'Created By', 'Office', 'Current Status', 'Current Holder',
            'Date Created',
        ];
    }

    public function map($document): array
    {
        return [
            $document->tracking_no,
            $document->title,
            $document->type?->name ?? $document->other_type ?? '—',
            $document->origin_type,
            $document->creator?->first_name . ' ' . $document->creator?->last_name,
            $document->creator?->office?->short_name,
            strtoupper($document->latestTrail?->status ?? 'unfinalized'),
            $document->latestTrail?->holderOffice?->short_name ?? '—',
            $document->created_at->format('Y-m-d'),
        ];
    }

    public function title(): string
    {
        return 'Document Status Report';
    }
}
```

Add an export route and controller method:

```php
// app/Http/Controllers/ReportController.php

namespace App\Http\Controllers;

use App\Exports\DocumentStatusReport;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ReportController extends Controller
{
    public function exportDocumentStatus(Request $request): BinaryFileResponse
    {
        $this->authorize('viewAny', \App\Models\Document::class);

        $user     = auth()->user();
        $officeId = $user->hasRole(['super_admin', 'admin'])
            ? $request->integer('office_id') ?: null
            : $user->office_id;

        $year     = $request->integer('year') ?: now()->year;
        $filename = "StatusReport_{$year}_" . now()->format('Ymd_His') . '.xlsx';

        return Excel::download(new DocumentStatusReport($officeId, $year), $filename);
    }
}
```

```php
// routes/web.php — inside auth middleware group
Route::get('/reports/document-status', [ReportController::class, 'exportDocumentStatus'])
    ->name('reports.document-status');
```

### 7.2 PDF Export

Use DomPDF via a dedicated Blade view (Inertia pages can't be used for PDF rendering):

```bash
php artisan make:view reports/document-status-pdf
```

```php
// app/Http/Controllers/ReportController.php — add method

use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;

public function exportDocumentStatusPdf(Request $request): Response
{
    $this->authorize('viewAny', \App\Models\Document::class);

    $documents = \App\Models\Document::with(['type', 'creator.office', 'latestTrail'])
        ->when(!auth()->user()->hasRole(['super_admin', 'admin']),
            fn ($q) => $q->forOffice(auth()->user()->office_id)
        )
        ->orderByDesc('created_at')
        ->limit(500) // PDF page limit
        ->get();

    $pdf = Pdf::loadView('reports.document-status-pdf', compact('documents'))
        ->setPaper('legal', 'landscape');

    return $pdf->download('StatusReport_' . now()->format('Y-m-d') . '.pdf');
}
```

```html
{{-- resources/views/reports/document-status-pdf.blade.php --}}
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; font-size: 9pt; }
    h1   { font-size: 13pt; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th   { background: #1e3a5f; color: #fff; padding: 5px 8px; font-size: 8pt; text-align: left; }
    td   { padding: 4px 8px; border-bottom: 1px solid #e5e5e5; font-size: 8pt; }
    tr:nth-child(even) td { background: #f9fafb; }
  </style>
</head>
<body>
  <h1>NCIP — Document Status Report</h1>
  <p style="text-align:center; font-size:8pt; color:#666;">
    Generated: {{ now()->format('F d, Y h:i A') }}
  </p>

  <table>
    <thead>
      <tr>
        <th>Tracking No.</th><th>Title</th><th>Type</th><th>Origin</th>
        <th>Created By</th><th>Office</th><th>Status</th><th>Date Created</th>
      </tr>
    </thead>
    <tbody>
      @foreach ($documents as $doc)
      <tr>
        <td>{{ $doc->tracking_no }}</td>
        <td>{{ $doc->title }}</td>
        <td>{{ $doc->type?->name ?? $doc->other_type ?? '—' }}</td>
        <td>{{ $doc->origin_type }}</td>
        <td>{{ $doc->creator?->first_name }} {{ $doc->creator?->last_name }}</td>
        <td>{{ $doc->creator?->office?->short_name }}</td>
        <td>{{ strtoupper($doc->latestTrail?->status ?? 'UNFINALIZED') }}</td>
        <td>{{ $doc->created_at->format('Y-m-d') }}</td>
      </tr>
      @endforeach
    </tbody>
  </table>
</body>
</html>
```

---

## 8. Caching Strategy

| Data | TTL | Cache Key Pattern | Invalidated By |
|---|---|---|---|
| Dashboard counters (per office) | 5 min | `dashboard_counters_{officeId}` | Any document status change |
| Documents this month | 5 min | `docs_this_month_{officeId}` | New document created |
| Monthly volume trend | 1 hour | `monthly_volume_{months}` | Nightly `analytics:refresh` |
| Documents by status | 1 hour | `docs_by_status` | Nightly |
| Documents by type | 1 hour | `docs_by_type` | Nightly |
| Documents by office | 1 hour | `docs_by_office` | Nightly |
| Average routing days | 24 hours | `avg_routing_days` | Nightly |
| Daily audit activity | 5 min | `daily_audit_{days}` | Always fresh enough |
| Top active users | 1 hour | `top_users_{limit}_{Y_m}` | End of month |

Cache invalidation for real-time accuracy — add this to the `Document` model observer:

```php
// app/Observers/DocumentObserver.php

namespace App\Observers;

use App\Models\Document;
use Illuminate\Support\Facades\Cache;

class DocumentObserver
{
    public function created(Document $document): void
    {
        $this->bustCounterCache($document);
    }

    public function updated(Document $document): void
    {
        $this->bustCounterCache($document);
    }

    private function bustCounterCache(Document $document): void
    {
        $officeId = $document->creator?->office_id;

        Cache::forget("dashboard_counters_{$officeId}");
        Cache::forget("docs_this_month_{$officeId}");
        Cache::forget('dashboard_counters_all');
        Cache::forget('docs_this_month_all');
    }
}
```

Register in `AppServiceProvider`:

```php
// app/Providers/AppServiceProvider.php

use App\Models\Document;
use App\Observers\DocumentObserver;

public function boot(): void
{
    Document::observe(DocumentObserver::class);
}
```

---

## 9. Role-Based Access

| Feature | super_admin | admin | encoder | viewer |
|---|---|---|---|---|
| Dashboard counters | All offices (system-wide) | All offices | Own office only | Own office only |
| Analytics page `/analytics` | ✅ Full access | ✅ Full access | ❌ Hidden | ❌ Hidden |
| Monthly trend sparkline (dashboard) | ✅ | ✅ | ✅ | ✅ |
| Excel status report (own office) | ✅ | ✅ | ✅ | ✅ |
| Excel status report (all offices) | ✅ | ✅ | ❌ | ❌ |
| PDF report | ✅ | ✅ | ✅ | ✅ |
| Counter live refresh | ✅ | ✅ | ✅ | ✅ |

Enforce in routes with Spatie's `role` middleware as shown in `§4.4`. The sidebar link to `/analytics` should also be conditionally rendered in `Sidebar.tsx`:

```tsx
// resources/js/Components/Layout/Sidebar.tsx — conditional analytics link

import { usePage } from '@inertiajs/react'

// In the sidebar nav items:
{(auth.user.roles.includes('super_admin') || auth.user.roles.includes('admin')) && (
  <NavLink href={route('analytics.index')} icon={<BarChart2 />}>
    Analytics
  </NavLink>
)}
```

---

## 10. Build Order

Follow this sequence within the overall migration phases from `MIGRATION_SPEC.md §14`:

### Phase 3A — Dashboard Analytics (after Phase 3)
- [ ] Run migrations: `analytics_snapshots`, analytics indexes
- [ ] Create `AnalyticsService` class
- [ ] Update `DashboardController` to inject `AnalyticsService` and pass counter props
- [ ] Create `StatCard`, `SparklineChart` components
- [ ] Update `Pages/Dashboard/Index.tsx` to use new counter props and sparkline
- [ ] Register `DocumentObserver` for cache busting
- [ ] Verify dashboard loads with real counters (no AJAX needed)

### Phase 3B — Full Analytics Page (after Phase 3A)
- [ ] Create `AnalyticsController`
- [ ] Add analytics routes
- [ ] Create `LineChart`, `BarChart`, `DonutChart` components
- [ ] Create `ActiveUsersTable` component
- [ ] Create `Pages/Analytics/Index.tsx`
- [ ] Add sidebar link with role guard
- [ ] Test all six chart panels with real data

### Phase 3C — Reports (can run parallel to Phase 3B)
- [ ] Create `DocumentStatusReport` Excel export class
- [ ] Create `ReportController` with Excel + PDF routes
- [ ] Create `reports/document-status-pdf.blade.php` template
- [ ] Add export buttons to Documents page
- [ ] Test downloads with role-scoped data

### Phase 3D — Scheduled Refresh (after Phase 3B)
- [ ] Create `RefreshAnalyticsSnapshots` command
- [ ] Register schedule in `routes/console.php`
- [ ] Test: `php artisan analytics:refresh`
- [ ] Confirm cache warm-up completes without errors

---

*Analytics implementation guide created: September 23, 2026*
*Based on: PROJECT_ANALYSIS.md, ISSUES_AND_IMPROVEMENTS.md, MIGRATION_SPEC.md, ERD.md*
