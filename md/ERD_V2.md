# DOTS — Updated ERD (Laravel Version)

This ERD reflects the active Laravel project structure and model definitions in the workspace, not the legacy CodeIgniter diagram in the older documentation.

---

## 1. High-Level Conceptual ERD

```text
┌──────────────────────┐        ┌──────────────────────┐
│         users        │        │        offices        │
├──────────────────────┤        ├──────────────────────┤
│ id                   │◄─────┐│ id                   │
│ username             │      ││ parent_id            │
│ firstname           │      ││ range_id             │
│ lastname            │      ││ name                 │
│ middlename          │      ││ short_name           │
│ email               │      ││ code                 │
│ password            │      ││ email                │
│ role                │      ││ location             │
│ role_id             │      ││ created_at           │
│ office_id           │──────┘│ updated_at           │
│ division_id         │        └──────────────────────┘
│ legacy_bureau_id    │                 │
│ is_active           │                 │
│ is_locked           │                 │
│ last_login_at       │                 │
│ created_at          │                 │
│ updated_at          │                 │
└──────────────────────┘                 │
        │                                │
        │                                │
        └──────────────┬─────────────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │       divisions      │
            ├──────────────────────┤
            │ id                   │
            │ office_id            │
            │ name                 │
            │ code                 │
            │ created_at           │
            │ updated_at           │
            └──────────────────────┘

┌──────────────────────┐        ┌──────────────────────┐
│  document_types      │        │  action_types        │
├──────────────────────┤        ├──────────────────────┤
│ id                   │        │ id                   │
│ name                 │        │ name                 │
│ description          │        │ description          │
│ created_at           │        │ created_at           │
│ updated_at           │        │ updated_at           │
└──────────────────────┘        └──────────────────────┘

┌──────────────────────┐        ┌──────────────────────┐
│ purpose_types        │        │       ranges         │
├──────────────────────┤        ├──────────────────────┤
│ id                   │        │ id                   │
│ name                 │        │ name                 │
│ description          │        │ description          │
│ created_at           │        │ created_at           │
│ updated_at           │        │ updated_at           │
└──────────────────────┘        └──────────────────────┘

┌──────────────────────┐
│      documents       │
├──────────────────────┤
│ id                   │
│ title                │
│ tracking_number      │
│ document_type_id     │───────────────┐
│ action_type_id       │───────────────┤
│ purpose_type_id      │───────────────┤
│ origin_type          │               │
│ office_id            │───────────────┤
│ division_id          │───────────────┤
│ created_by           │───────────────┤
│ status               │               │
│ urgent               │               │
│ notify_by_email      │               │
│ is_finalized         │               │
│ received_from        │               │
│ received_at          │               │
│ is_archived          │               │
│ remarks              │               │
│ deleted_at           │               │
│ created_at           │               │
│ updated_at           │               │
└──────────────────────┘               │
        │                               │
        │                               │
        │ has many                      │
        ▼                               │
┌──────────────────────┐               │
│ document_trails      │               │
├──────────────────────┤               │
│ id                   │               │
│ document_id          │──────────────┘
│ from_office_id       │───────────────┐
│ to_office_id         │───────────────┤
│ assigned_to_user_id  │───────────────┤
│ created_by           │───────────────┤
│ status               │               │
│ action               │               │
│ remarks              │               │
│ created_at           │               │
│ updated_at           │               │
└──────────────────────┘               │
        │                               │
        │ has many                      │
        ▼                               │
┌──────────────────────┐               │
│   document_files     │               │
├──────────────────────┤               │
│ id                   │               │
│ document_id          │──────────────┘
│ file_name            │
│ original_name        │
│ file_path            │
│ uploaded_by          │───────────────┐
│ created_at           │               │
│ updated_at           │               │
└──────────────────────┘               │
                                     │
                                     │
┌──────────────────────┐               │
│     audit_trails     │               │
├──────────────────────┤               │
│ id                   │               │
│ user_id              │───────────────┘
│ action               │
│ module               │
│ description          │
│ created_at           │
│ updated_at           │
└──────────────────────┘
```

---

## 2. Table Summary

### users

- primary auth and identity table
- linked to `offices` and `divisions`
- can create documents and trail entries

### offices

- hierarchical organizational unit
- can have parent offices and child offices
- linked to ranges and divisions

### divisions

- sub-division detail under an office
- maps users and documents to operational units

### document_types / action_types / purpose_types

- lookup tables for classification and workflow metadata
- used by `documents`

### ranges

- routing or geographic classification table
- mostly used to enrich office metadata

### documents

- core business transaction record
- unique `tracking_number`
- may be archived, finalized, flagged urgent, or email-notified

### document_trails

- operational history of movement and transfer events
- captures routing and action state transitions

### document_files

- attachments associated with a document
- tracks uploaded file metadata

### audit_trails

- user action log used for accountability and traceability

---

## 3. Relationship Notes

### One-to-many

- One `user` can create many `documents`
- One `office` can contain many `users`
- One `office` can contain many `divisions`
- One `document` can have many `document_trails`
- One `document` can have many `document_files`
- One `user` can have many `audit_trails`

### Many-to-one

- Many `documents` belong to one `document_type`
- Many `documents` belong to one `action_type`
- Many `documents` belong to one `purpose_type`
- Many `documents` belong to one `office`
- Many `document_trails` belong to one `document`
- Many `document_trails` belong to one `from_office`
- Many `document_trails` belong to one `to_office`

---

## 4. Legacy Mapping

The old system used names such as:

- `user` instead of `users`
- `document` instead of `documents`
- `bureau` instead of `offices`
- `document_trail` instead of `document_trails`

The repo includes compatibility models to bridge these differences while the Laravel schema is being phased in.

So the current architecture is best seen as:

- modern Laravel model schema in the active app
- legacy data adapters for historical database compatibility

---

## 5. Practical Interpretation

The active current state is not a single giant table design. It is a normalized document workflow model with:

- a central document table
- document movement history in a separate trail table
- classification and routing metadata in lookup tables
- user and office hierarchy in dedicated tables
- file and audit tables to preserve operational traceability

This aligns well with the business needs of a government document tracking system.

---

## 6. Short Summary

The modern DOTS data model is centered on a document lifecycle, where each document is tracked as a business record, each route event is captured as a trail record, and each office/user assignment is normalized into separate relational tables. The legacy system’s naming and structure are still present in compatibility layers, but the active application clearly points toward a cleaner Laravel database design.
