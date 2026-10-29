# DOTS System Architecture Review

## Summary

The project uses a familiar Laravel and React/Inertia structure. The main architecture concern is that a few controllers and page components have grown large and now cover many responsibilities. A full rewrite or broad folder reorganization is not needed; refactor those files gradually as the related features are changed.

This is a source-structure review. It does not confirm production configuration or runtime behavior.

## Current structure

```text
app/
  Http/Controllers/   Request handling and Inertia responses
  Http/Middleware/    Access and request checks
  Jobs/               Queued work, including email notifications
  Models/             Database entities
  Services/           Reusable workflow and integration logic
  Console/Commands/   Import, sync, and maintenance commands

resources/js/
  Pages/              Inertia page components
  Components/         Shared React components
  Layouts/            Application layouts
  types/              Shared TypeScript definitions

routes/               Web and authentication routes
database/migrations/  Database schema changes
tests/                Feature, unit, and JavaScript tests
docs/                 System guides, plans, and project documents
```

## What is working well

- Backend responsibilities have familiar Laravel homes: controllers, models, services, jobs, middleware, and commands.
- React pages and shared components are separated under `resources/js`.
- Routes, migrations, tests, and documentation have their own folders.
- Services already cover concerns such as document access, PDF generation, audit logging, and legacy imports.
- Feature tests are organized around system behaviors.

## Main improvement areas

### 1. Split the document controller by workflow

`app/Http/Controllers/DocumentController.php` is about 2,900 lines. It handles document listing, details, file access, edits, routing, approvals, legacy records, access checks, and notifications. Keeping all of these together makes changes harder to locate and review.

One possible gradual structure is:

```text
app/Http/Controllers/Documents/
  DocumentController.php          # Basic document views and CRUD
  DocumentRoutingController.php
  DocumentApprovalController.php
  DocumentFileController.php

app/Services/Documents/
  DocumentRoutingService.php
  DocumentApprovalService.php
```

The legacy-document reads could also move into a focused service or repository when that code is next changed. Keep the current workflow behavior intact while extracting it.

### 2. Break large React pages into feature components

`resources/js/Pages/Documents/Index.tsx` is about 2,600 lines, and `resources/js/Pages/DocumentCreation/Index.tsx` is about 1,300 lines. Extract substantial sections such as routing dialogs, document details, filters, and editor sections into smaller components. Keep the page responsible for composing the screen and managing page-level state.

For example:

```text
resources/js/Pages/Documents/
  Index.tsx
  components/
    DocumentFilters.tsx
    DocumentDetails.tsx
    RouteEditor.tsx
    ReleaseDocumentDialog.tsx
```

Use feature-specific components for complex page behavior; keep `resources/js/Components` for components shared across multiple pages.

### 3. Move repeated validation into Form Request classes

Form Requests can keep controller methods shorter and make validation rules easier to find. Potential examples:

```text
app/Http/Requests/Documents/
  StoreDocumentRequest.php
  ReleaseDocumentRequest.php
  DecideDocumentRequest.php
```

### 4. Keep authorization rules centralized

The project already has document-access and route-step access services. As controllers are split, keep permissions easy to locate instead of duplicating checks. Laravel policies could handle document-level abilities, while focused workflow services handle route-specific rules.

### 5. Improve documentation navigation

The `docs/` folder contains useful plans and guides. A `docs/README.md` could link to current system documentation, active implementation plans, and older reference material so readers can quickly find the right document.

## Suggested refactoring order

1. Start with `DocumentController`, extracting one workflow area at a time.
2. Keep its existing feature tests close to each extraction and add focused tests when behavior needs protection.
3. Split the large React pages as their features are changed; avoid a broad UI rewrite.
4. Move repeated validation and authorization into focused classes where it improves clarity.
5. Add a documentation index if the number of plans and guides makes navigation difficult.

## Guiding principles

- Prefer small, reviewable refactors over a complete rewrite.
- Keep related files together by feature when the feature becomes complex.
- Keep shared components genuinely reusable; avoid turning every small element into a new file.
- Preserve existing route names and user-facing behavior during structural changes.
- Use tests to check that extracted code keeps the same behavior.
