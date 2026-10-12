# Performance review and proposed fix plan

## Purpose

This review identifies code paths that are likely to make pages slow as document and audit history grows. It is based on reading the current controllers, services, models, and migrations. It is **not a measured benchmark**: no production-like timing, query plan, or browser profile has been captured yet. The ranking below is therefore a prioritized investigation list, not a guarantee about which page is slowest on every machine.

The initial review and baseline collection were read-only. The implementation updates made after the review are listed below; no application data was changed.

## Current local baseline (before optimization)

I ran a read-only, single-pass controller/serialization measurement against the configured local database. It called the page controllers with an admin account (role 1) and an office account (role 3) and measured time through Inertia response serialization. It did not include web-server middleware, browser transfer/rendering, or the user's network. These are one-pass observations, not medians; use them as an initial reference and rerun the same method after implementation.

At measurement time, the configured database contained 62,214 documents, 267,240 document trails, 398,250 audit entries, and 0 document-creation drafts.

| Page | Scope | Server/controller time | Database query time (sum) | Queries | Inertia response |
| --- | --- | ---: | ---: | ---: | ---: |
| `/dashboard` | Admin, role 1 | 15.77 s | 15.60 s | 27 | 371 KB |
| `/dashboard` | Office, role 3 | 18.06 s | 18.02 s | 25 | 71 KB |
| `/documents` | Admin, role 1 | 0.67 s | 0.36 s | 67 | 513 KB |
| `/documents` | Office, role 3 | 1.99 s | 1.67 s | 67 | 621 KB |
| `/documents/latest` | Admin, role 1 | 0.15 s | 0.12 s | 65 | 20 KB |
| `/documents/latest` | Office, role 3 | 1.54 s | 1.53 s | 50 | 7 KB |
| `/archives` | Admin, role 1 | 0.11 s | 0.09 s | 4 | 30 KB |
| `/archives` | Office, role 3 | 3.37 s | 3.36 s | 3 | 9 KB |
| `/audit-trail` | Admin, role 1 | 0.21 s | 0.19 s | 4 | 46 KB |


Response sizes are uncompressed serialized response sizes. The office-scoped audit view was not captured in this clean pass. Server timings can vary with database/cache state; the large difference between office and admin archive timings is a reason to inspect that scope's query plan before changing the archive code.

## Follow-up timing check (single pass)

After the index migration and dashboard changes, I ran a direct controller/Inertia serialization check. It is not a browser/network measurement and each route has only one sample. The office `/audit-trail` request initially stalled; after splitting its two filter branches and removing the expensive exact count for office users, it returned in 7.84 seconds.

| Page | Scope | Controller/serialization | SQL time | Queries |
| --- | --- | ---: | ---: | ---: |
| `/dashboard` initial response | Admin | 6.27 s | 4.02 s | 18 |
| `/dashboard` deferred analytics request | Admin | 6.38 s | 4.19 s | 18 |
| `/dashboard` initial response | Office | 7.66 s | 5.59 s | 16 |
| `/dashboard` deferred analytics request | Office | 6.89 s | 4.79 s | 16 |
| `/documents` after removing unused file/history eager loads | Admin | 2.41 s | 0.18 s | 21 |
| `/documents` after removing unused file/history eager loads | Office | 4.39 s | 2.18 s | 21 |
| `/archives` | Admin | 2.16 s | 0.06 s | 4 |
| `/archives` | Office | 4.45 s | 2.40 s | 3 |
| `/audit-trail` | Admin | 2.35 s | 0.29 s | 4 |
| `/audit-trail` after office-query changes | Office | 7.84 s | 5.74 s | 2 |

The dashboard's first response is faster than the earlier one-pass baseline in this run, but its deferred analytics request still takes several seconds. Office audit now returns instead of stalling, but 7.84 seconds is still slow. Treat all these results as diagnostic observations, not a conclusive before/after benchmark: they are single samples from a direct controller harness, and several quick admin routes show unexplained PHP/serialization overhead compared with the earlier harness. Browser Network timings under the same login, data, and filters are needed for a reliable user-visible comparison.

These measurements make the dashboard the clearest current delay: database work accounts for nearly all measured controller time in both scopes. The document page is also sending roughly half a megabyte or more. The regular archives and admin audit views were quick in this pass, while the office archive query was unexpectedly slow despite returning a small response.

### Latest recheck (2026-10-12)

I repeated the same local direct-controller check against the currently configured database. These are single samples through Inertia serialization, not browser load times. The dashboard numbers below separately measure its initial page response and the deferred analytics request. Response size is included to show how much JSON the page serializes.

| Page | Scope | Controller/serialization | SQL time | Queries | Response |
| --- | --- | ---: | ---: | ---: | ---: |
| `/dashboard` initial | Admin | 6.03 s | 3.78 s | 18 | 459 KB |
| `/dashboard` deferred analytics | Admin | 6.30 s | 6.20 s | 23 | 55 KB |
| `/dashboard` initial | Office | 7.26 s | 5.16 s | 16 | 102 KB |
| `/dashboard` deferred analytics | Office | 16.50 s | 16.48 s | 21 | 1.4 KB* |
| `/documents` | Admin | 2.38 s | 0.19 s | 21 | 454 KB |
| `/documents/latest` | Admin | 2.16 s | 0.10 s | 19 | 33 KB |
| `/archives` | Admin | 2.16 s | 0.09 s | 4 | 50 KB |
| `/audit-trail` | Admin | 2.27 s | 0.20 s | 4 | 75 KB |
| `/documents` | Office | 4.12 s | 1.92 s | 21 | 456 KB |
| `/documents/latest` | Office | 4.11 s | 2.07 s | 10 | 19 KB |
| `/archives` | Office | 3.88 s | 1.83 s | 3 | 20 KB |
| `/audit-trail` | Office | 12.34 s | 10.27 s | 2 | 45 KB |

\* The office deferred request returned analytics successfully but serialized a much smaller partial response than expected; confirm the chart content in the browser. The main findings are that office dashboard analytics and office audit remain database-bound and slow, and the documents list still serializes about 450 KB despite the 10-row visible page size. The admin dashboard's deferred analytics is also about as expensive as its initial response. These measurements are not directly comparable with real browser load time and should be treated as one-run diagnostic data.

## Pages and modules most likely to cause delays

| Priority | Page/module | Why it is a likely bottleneck | Expected effect |
| --- | --- | --- | --- |
| 1 | `/documents` and `/documents/latest` | The list still returns up to 200 documents for client-side search/sorting. Full files and transaction histories are now fetched only when a document is opened, but the 200-row summary payload remains large. | Transfer and browser rendering still grow with list fields and row count. |
| 2 | `/dashboard` | It runs several similar counts, fetches every incoming document for the user's office without a limit, and runs analytics during the initial request. Processing performance walks historical trails and separately queries events for each selected draft. Admin chart scope can involve all offices. | Slow dashboard even when the visible cards and recent items are small; most sensitive to imported history and admin scope. |
| 3 | Document creation / approval queues | It loads every matching draft and its events, then queries the current version separately for each draft. Large approval queues can therefore produce large payloads and repeated database queries. | Slower page as drafts and events grow; potentially many queries per request. |
| 4 | `/audit-trail` | It returns 50 rows at a time. Office users now use count-free pagination, and the saved-office and legacy-assignment filters use separate indexable branches. The office view still took 7.84 seconds in the latest one-pass check. | Further query-plan work is needed for office history; exact totals are omitted for office users so the initial request avoids counting every match. |
| 5 | `/archives` (archived documents) | It returns 25 rows and a narrow set of fields, which is a good starting point. Pagination still counts matches; bureau sorting uses a correlated office-name subquery. There is no visible composite index for archive state plus date ordering. | Usually lower risk than the document list; may slow for a large archive or bureau-name sort. |
| 6 | User accounts and offices administration | Both pages load complete user/office lists and related option lists rather than paginating. This is likely manageable at current directory size, but becomes costly as these tables grow. | Large response and browser rendering on administration pages. |
| Variable | HRIS employee lookup and external integrations | These pages make network requests. HRIS uses a 15-second timeout. A slow/unreachable remote service can dominate the request regardless of local database performance. | Long wait only when the external service/network is slow. |

## Findings in plain language

### 1. Documents list sends history for every row

The local document list in `app/Http/Controllers/DocumentController.php` fetches up to 200 rows, then eager-loads files, the latest trail, the full trail collection, and related users/offices. The page maps those relations into each document sent to the browser. Pagination alone would reduce the number of documents, but a 10-row page could still be heavy if those 10 documents have many trails or files.

**Likely fix:** use server-side pagination, initially 10 rows as discussed, and send only list fields plus the latest status needed for row actions. Fetch a document's complete trail and file details when the user opens its detail view. Keep action authorization and current status checks on the server.

### 2. Dashboard combines summary work with historical analytics

`app/Http/Controllers/DashboardController.php` computes cards, recent documents, an unbounded incoming list, chart data, office choices, and processing performance in one request. Some incoming/pending/released counts are calculated again in `app/Services/DashboardCharts.php` for the chart props.

`app/Services/ProcessingPerformance.php` reads matching document trails in pages and walks them in PHP. It then loads draft events from inside the per-draft loop. This preserves history-sensitive metrics, but makes a full dashboard request do work proportional to historical data, not just the few items shown on screen.

**Likely fix:** return the primary counts and a bounded recent incoming list promptly; load charts and processing performance in a separate request or deferred Inertia props. Consolidate duplicate count queries where the scopes and definitions are exactly the same. Optimize or cache historical metrics only after confirming invalidation rules and preserving the current all-time definitions.

### 3. Draft list has a per-draft version lookup

`app/Http/Controllers/DocumentCreationController.php` loads all matching drafts and their events. While mapping each draft, it issues another query to fetch that draft's current version. That repeated lookup count grows with the number of drafts.

**Likely fix:** paginate the queues, eager-load or batch-fetch current versions, and include only event/history detail needed for the current view. Add indexes for the queue ownership/status filters and event-to-draft lookups if query plans show they are needed.

### 4. Audit and archive already limit rows, but count and sort work remain

Audit trail pagination displays 50 rows and has a chronology index on `(created_at, id)`. Laravel's `paginate()` also computes the total number of matching rows. Bureau filtering adds an `OR` condition and a related-user lookup for imported entries with no saved office snapshot.

Archives displays 25 rows and selects only a few document columns. It also uses normal pagination totals. Sorting by bureau name uses a correlated subquery; this deserves a query-plan check before changing it.

**Likely fix:** inspect `EXPLAIN` for both pages at realistic row counts. Preserve total/page counts if they are important; if the exact total count is a major cost, consider simple or cursor pagination only after reviewing the UI and user needs. Add a matching composite index only when the query plan supports it.

### 5. Some administration lists are unbounded

The user-account page loads every user. The office page loads all offices, office-list options, parent offices, and ranges. These are probably lower priority than documents and dashboard today, but should be paginated or made searchable if they become large.

### 6. External services can feel like an app slowdown

HRIS lookup has a 15-second HTTP timeout, and connected-system pages also call external services. This is separate from local page-render performance. The HRIS timeout was observed earlier for the configured API host, so employee lookup can be slow when that service is unreachable even if the database is fast.

## Proposed implementation order

1. **Capture a baseline.** For the four requested pages, record server duration, query count, slowest SQL statements, response/serialized payload size, and browser network/render time. Use representative accounts (office-scoped and admin/all-office) and realistic data volume. Do not log SQL bindings or secrets.
2. **Fix `/documents` first.** Paginate at 10 rows initially; remove full history/files from the list response; fetch those details on demand. Verify sorting, filters, visible row status, and document actions still work.
3. **Lighten `/dashboard`.** Bound the incoming-document list. Separate slow analytics from the initial dashboard response. Remove duplicated counts only where current definitions are identical. Keep permissions and card meanings unchanged.
4. **Fix draft queue query growth.** Paginate draft lists and batch-load current versions. Avoid loading event details that are not needed for the initial list.
5. **Tune archive/audit queries.** Check query plans and counts, then add narrowly targeted indexes or adjust pagination where justified.
6. **Review other growing lists and API requests.** Add pagination/search to user and office administration as needed; distinguish external API wait time from local rendering.
7. **Verify behavior and compare against baseline.** Compare same routes, filters, users, and data before/after. Confirm count definitions, authorization scopes, and actions remain unchanged.

## Measurement and safety notes

- The expected best first win is `/documents`, because both row count and nested history/file data are sent together.
- The expected next win is `/dashboard`, especially for admin/all-office views, because historical analytics run as part of the first page request.
- Reducing page size helps transfer and rendering. It does not automatically make a database count or expensive filter proportionally faster; query plans and indexes still matter.
- Avoid caching counts or analytics until updates that affect them are accounted for. Stale counts or cross-office cache leakage would be a correctness and access-control problem.
- Keep the existing permission scopes in `DocumentAccess` and audit bureau filters intact through any optimization.

## Implementation updates

The first implementation pass makes these changes:

- `/documents` sends one server-paginated summary page (10 rows by default). Search, status filters, and sorting run on the full authorized query; full file and trail details remain behind the access-scoped on-demand endpoint.
- `/dashboard` keeps summary counts in the first response and defers chart totals, document-type counts, and historical processing metrics to Inertia's deferred analytics request. Chart totals reuse the first-response summary counts when the scopes match. If an administrator selects an office for charts, card counts remain all-office counts. Current persisted trail statuses were checked and are lowercase, so status predicates use direct equality rather than `LOWER(status)`, allowing the database to use status indexes.
- The tracking-time metric now filters trail rows in SQL to only the receipt, release, and terminal events that its pairing logic consumes, rather than paging every trail attached to a matching document.
- A migration adds composite indexes for latest-trail lookup, office/status trail filters, archive ordering, approval counts, and draft events. These indexes take effect only after the migration is applied.
- The office audit filter separates snapshot and legacy-assignment branches, uses a composite audit index, and avoids the full count query for office-scoped staff pagination. This keeps Previous/Next links but omits the total number of pages/entries for that view. The new audit index migration was applied locally during the follow-up fix.

The user confirmed the index migrations are applied. The latest direct-controller timings are recorded above; they exclude middleware, network transfer, and browser rendering. Compare browser Network timings under the same account and page state to measure the actual user-visible loading time.

### Focused optimization comparison (2026-10-12)

The local database was rechecked before changing the query: 62,214 documents, 267,240 document trails, 398,250 audit entries, and 293 offices. A same-process comparison for office 8 measured the office document-type aggregation used by deferred dashboard analytics. Both variants returned 26 categories with identical category/count pairs and a 965-byte serialized result. The old aggregation used the shared office access scope; the optimized aggregation joins a union of document IDs so MySQL can materialize the matching set and use the individual office indexes. The response shape and access scope are unchanged.

| Measurement | Controller/service wall time | SQL time | Queries | Serialized result |
| --- | ---: | ---: | ---: | ---: |
| Before: OR-based access scope | 9.92 s | 9.91 s | 2 | 965 bytes |
| After: joined office-ID union | 0.038 s | 0.036 s | 2 | 965 bytes |

This is a 99.6% reduction (about 260× faster) for this specific office chart query in a single local run. The two-query count includes loading document-type labels and the grouped aggregation. This is not a full page or browser benchmark, and does not show the same gain for the all-office dashboard. The earlier full-page timings remain the broader reference; compare browser Network timings under the same account and page state for user-visible load time.

### Whole-system route recheck (2026-10-12)

I ran a fresh direct-controller/Inertia JSON pass before and after the follow-up fixes below. Both passes used the configured MySQL database (62,214 documents, 267,240 trails, 398,250 audit entries, 0 drafts, 427 users, and 293 offices), the first role-1 account, and the first role-3 account (user 1, office 8). Each route has one sample. Wall time includes controller work and Inertia serialization; SQL time is the sum of Laravel query timings. These figures exclude middleware, browser/network time, and rendering. The same-harness before/after comparison is the controlled comparison; the older documented pass used a separate ad hoc harness and may differ in cache state/account selection.

| Route | Scope | Before wall / SQL | After wall / SQL | Queries before → after | Response before → after |
| --- | --- | ---: | ---: | ---: | ---: |
| `/dashboard` initial | Admin | 5.15 / 4.99 s | 2.13 / 1.98 s | 18 → 17 | 309 → 309 KB |
| `/dashboard` analytics | Admin | 7.75 / 7.62 s | 3.42 / 3.29 s | 23 → 22 | 54 → 54 KB |
| `/dashboard` initial | Office 8 | 5.15 / 5.12 s | 0.74 / 0.72 s | 16 → 15 | 68 → 68 KB |
| `/dashboard` analytics | Office 8 | 5.28 / 5.26 s | 0.74 / 0.72 s | 21 → 20 | 1.4 → 1.4 KB |
| `/documents` | Admin | 0.29 / 0.15 s | 0.19 / 0.16 s | 21 → 22 | 300 → 20 KB |
| `/documents` | Office 8 | 2.32 / 2.20 s | 0.04 / 0.02 s | 21 → 22 | 302 → 22 KB |
| `/documents/latest` | Admin | 0.12 / 0.10 s | 0.16 / 0.14 s | 19 → 20 | 16 → 16 KB |
| `/documents/latest` | Office 8 | 2.23 / 2.22 s | 0.02 / 0.01 s | 10 → 10 | 6.7 → 6.8 KB |
| `/archives` | Admin | 0.10 / 0.08 s | 0.08 / 0.07 s | 4 → 4 | 30 → 30 KB |
| `/archives` | Office 8 | 1.75 / 1.75 s | 0.01 / 0.01 s | 3 → 3 | 9.2 → 9.2 KB |
| `/audit-trail` | Admin | 0.25 / 0.23 s | 0.21 / 0.18 s | 4 → 4 | 45 → 45 KB |
| `/audit-trail` | Office 8 | 9.52 / 9.50 s | 0.53 / 0.51 s | 2 → 2 | 24.5 → 24.5 KB |
| `/document-creation` | Admin | 0.03 / 0.01 s | 0.02 / 0.01 s | 5 → 5 | 20 → 20 KB |
| `/document-creation` | Office 8 | 0.03 / 0.01 s | 0.04 / 0.01 s | 5 → 5 | 20 → 20 KB |
| `/user-accounts` | Admin | 0.11 / 0.01 s | 0.12 / 0.01 s | 7 → 7 | 245 → 245 KB |
| `/offices` | Admin | 0.06 / 0.01 s | 0.06 / 0.01 s | 6 → 6 | 150 → 150 KB |

Times are seconds; response sizes are uncompressed serialized JSON. Office dashboard summary and chart counts were unchanged. The office document-access rewrite returned the exact same 1,116 visible document IDs as the previous predicate. The office audit response retained the same 50-row payload and pagination links. The draft queue currently has no rows, so its per-draft version/event growth path was not exercised; the current user and office administration lists are modest in server time despite their larger payloads.

Compared with the preceding “Latest recheck” table, the office dashboard initial response moved from 7.26 s / 5.16 s SQL to 0.74 s / 0.72 s, office dashboard analytics from 16.50 s / 16.48 s SQL to 0.74 s / 0.72 s, office documents from 4.12 s / 1.92 s to 0.04 s / 0.02 s, office latest documents from 4.11 s / 2.07 s to 0.02 s / 0.01 s, office archives from 3.88 s / 1.83 s to 0.01 s / 0.01 s, and office audit from 12.34 s / 10.27 s to 0.53 s / 0.51 s. The server-paginated office documents response is 22 KB, down from 456 KB in that historical pass. Treat this historical comparison as indicative because the older harness/account context is not fully recorded; use the before/after table above for same-harness comparisons.

The follow-up implementation materializes office document IDs through separate indexed branches for document lists, archives, and office dashboard counts. It combines dashboard latest-trail status counts into one grouped query and counts released documents from a status-indexed distinct-document set. Office audit joins its saved-office and legacy-assignment ID union rather than evaluating it as a correlated `WHERE IN`. Current draft versions are looked up in batches grouped by version number instead of one query per draft. A third additive migration adds `(status, document_id)` for the released-document aggregate; it was applied locally. No application rows were changed.

The document list now sends one server-paginated page (10 rows by default) rather than 200 summaries, while search, status filtering, sorting, and page size are applied across the complete authorized list. The server performs an exact count for page totals. User accounts (427 rows) and offices (293 rows) rendered in about 0.12 s and 0.06 s respectively in this data set. External integration latency and browser rendering were not measured by this local harness.

## Next performance checks

Use this checklist for the next optimization pass. A faster server query does not automatically mean the whole page feels faster, so measure the browser and server separately and compare the same users, filters, and data.

1. **Measure real browser loads.** For the slowest important pages, use the browser Network and Performance panels while logged in as both an administrator and an office user. Record request duration, transferred response size, and rendering time. Repeat each route several times under the same conditions and compare medians rather than relying on one sample.
2. **Recheck the remaining expensive dashboard work.** Admin dashboard analytics still measured 3.42 seconds in the latest single pass. Capture its slow SQL statements and query plans, then identify whether all-office processing history or chart aggregation dominates. Preserve current metric definitions and permission scope when optimizing.
3. **Test office and admin query plans with realistic data.** For documents, latest documents, archives, and audit, inspect `EXPLAIN` output for the slowest filters and sorts. Check whether indexes are used and how many rows are examined compared with rows returned. Include offices with large histories, not only office 8.
4. **Exercise document-creation queues at scale.** The local database had zero drafts, so the batch version lookup improvement was not measured under load. Recheck with realistic numbers of drafts and events; verify query count does not grow once per draft, and consider pagination if queues can become large.
5. **Review large administration responses.** The user-account and office pages were quick on the server in this sample, but returned about 245 KB and 150 KB. If browser rendering or transfer becomes slow, consider searchable or paginated lists while keeping option data and authorization behavior intact.
6. **Measure integrations separately.** Record remote request time and timeout behavior for HRIS and other connected systems. Separate external waiting time from local application and database time before changing local queries.
7. **Verify correctness and access after each optimization.** Compare result counts and representative records before and after; check search, filters, sorting, pagination, document actions, and role/office visibility. Add or update focused automated tests for behavior changes, then rerun the same performance measurements.
8. **Keep a repeatable comparison record.** Record database row counts, account roles and office, route and filters, request and SQL time, query count, response size, and sample count. Avoid logging secrets or private SQL bindings. Use the same benchmark method before and after each change so that cache or account differences do not look like performance gains.

Prioritize work from measured user impact: start with slow browser requests, then find whether the delay comes from SQL, response size, rendering, or an external service. Change one bottleneck at a time and repeat the correctness and timing checks before moving to the next one.
