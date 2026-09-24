# iPLuma Table Fetching Strategy

This document explains the recommended approach for large table data in Laravel + React when the source is an external API.

## Recommendation

For large datasets, do not fetch everything into the browser and filter it client-side.

Use:
- server-side pagination
- server-side sorting
- server-side search/filter
- client-side debounce for search input
- cached query requests

This keeps the UI fast and reduces payload size.

## Why this is better

When the table has a lot of rows:
- large JSON payloads slow down rendering
- browser memory usage increases
- search/filter becomes expensive
- pagination becomes unreliable
- initial page load gets worse

For large external API data, the best pattern is:

1. User types in search
2. Debounce 300–500ms
3. Send request with `search`, `status`, `page`, `perPage`, `sortBy`, `sortDir`
4. Backend sorts/filter results
5. Return paginated JSON
6. Render only current page

---

## Recommended API contract

Use query params like this:

```http
GET /api/ipluma-documents?page=2&perPage=10&search=abc&status=SIGNED&sortBy=sharedAt&sortDir=desc
```

Response:

```json
{
  "data": [
    {
      "dotsId": "DOTS-1001",
      "fileName": "report.pdf",
      "originatorName": "Marvin",
      "originatorEmail": "marvin@example.com",
      "uploadedAt": "2026-09-20T10:00:00Z",
      "sharedAt": "2026-09-21T09:30:00Z",
      "signers": "5",
      "status": "SIGNED",
      "signingTrails": []
    }
  ],
  "current_page": 2,
  "per_page": 10,
  "total": 1240,
  "last_page": 124,
  "sortBy": "sharedAt",
  "sortDir": "desc"
}
```

---

## Backend optimization

### Laravel recommendation

Use server-side query building. Keep indexes and filter early in the query.

Example:

```php
public function index(Request $request)
{
    $query = Document::query();

    if ($request->filled('search')) {
        $search = $request->search;

        $query->where(function ($q) use ($search) {
            $q->where('dots_id', 'like', "%{$search}%")
              ->orWhere('file_name', 'like', "%{$search}%")
              ->orWhere('originator_name', 'like', "%{$search}%");
        });
    }

    if ($request->filled('status') && $request->status !== 'ALL') {
        $query->where('status', $request->status);
    }

    $sortBy = $request->get('sortBy', 'shared_at');
    $sortDir = $request->get('sortDir', 'desc');

    $allowedSorts = ['shared_at', 'uploaded_at', 'dots_id', 'file_name', 'status'];

    if (! in_array($sortBy, $allowedSorts, true)) {
        $sortBy = 'shared_at';
    }

    $query->orderBy($sortBy, $sortDir);

    $perPage = min((int) $request->get('perPage', 10), 100);

    $documents = $query->paginate($perPage);

    return response()->json([
        'data' => $documents->items(),
        'current_page' => $documents->currentPage(),
        'per_page' => $documents->perPage(),
        'total' => $documents->total(),
        'last_page' => $documents->lastPage(),
    ]);
}
```

### Database optimization

For large tables:
- add index on `status`
- add index on `shared_at`
- add index on `uploaded_at`
- add index on `dots_id`
- add composite index on `(status, shared_at)`
- add database index for search columns if heavy searching is needed

Example:

```sql
CREATE INDEX idx_documents_status_shared_at ON documents (status, shared_at);
CREATE INDEX idx_documents_uploaded_at ON documents (uploaded_at);
CREATE INDEX idx_documents_dots_id ON documents (dots_id);
```

---

## Frontend optimization

### Best React pattern

Use a debounced `search` state and fetch data from the server.

Example:

```tsx
import { useEffect, useState } from 'react';

type QueryParams = {
    page: number;
    perPage: number;
    search: string;
    status: string;
    sortBy: string;
    sortDir: 'asc' | 'desc';
};

export default function IplumaTable() {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [status, setStatus] = useState('ALL');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [sortBy, setSortBy] = useState('shared_at');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 400);

        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        const params: Record<string, string | number> = {
            page,
            perPage,
            status,
            sortBy,
            sortDir,
        };

        if (debouncedSearch) {
            params.search = debouncedSearch;
        }

        fetch(`/api/ipluma-documents?${new URLSearchParams(
            Object.entries(params).reduce((acc, [key, value]) => {
                acc[key] = String(value);
                return acc;
            }, {} as Record<string, string>)
        )}`)
            .then((res) => res.json())
            .then((data) => {
                // set rows / meta
            });
    }, [debouncedSearch, status, page, perPage, sortBy, sortDir]);

    return (
        <div>
            <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
            />
        </div>
    );
}
```

### Use React Query / TanStack Query

If this table is used heavily, use `@tanstack/react-query`:

```tsx
import { useQuery } from '@tanstack/react-query';

const query = useQuery({
    queryKey: ['ipluma-documents', page, perPage, status, debouncedSearch, sortBy, sortDir],
    queryFn: () =>
        fetch(`/api/ipluma-documents?${new URLSearchParams({
            page: String(page),
            perPage: String(perPage),
            status,
            search: debouncedSearch,
            sortBy,
            sortDir,
        })}`).then((res) => res.json()),
    staleTime: 30000,
    keepPreviousData: true,
});
```

Benefits:
- request caching
- background refetch
- less duplicated network calls
- better UX when filters change

---

## Frontend table UX tips

- keep table rows fixed height
- use virtualization for very large pages only if needed
- do not render all rows in the DOM
- keep pagination controls visible
- keep search input debounced
- sort on server, not in browser
- use stable keys for rows
- avoid heavy nested components in table rows

---

## Final recommendation for your project

Because your data is large and external, the best production-ready setup is:

- backend: sort + filter + pagination in Laravel
- frontend: debounced search
- frontend: page / perPage controls
- frontend: use React Query for caching
- optional: use virtualization only if row count exceeds 10k

If you want the cleanest Laravel + React implementation for your current table, use:
- Laravel `paginate()`
- query params for `search`, `status`, `page`, `perPage`
- `useQuery` or `router.get` with debounce
- server-side sorting newest first

This is the proper approach for large data.

---

## Shortcut for your current page

If you want a quick version without full React Query setup, keep this pattern:

```tsx
const [search, setSearch] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');

useEffect(() => {
    const timer = setTimeout(() => {
        setDebouncedSearch(search);
    }, 400);

    return () => clearTimeout(timer);
}, [search]);
```

Then fetch using `debouncedSearch` and use `page` + `perPage` from the backend response.

This is the safest approach for large external tables.