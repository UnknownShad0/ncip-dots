# One command for all legacy imports

`legacy:import-all` runs **directory → documents/history/file metadata → audit history**. Existing individual commands still work.

## Database names

The source does **not** have to be named `legacy_db`. `legacy` is the Laravel connection name in code; `LEGACY_DB_DATABASE` is the actual database name. For this local setup:

```dotenv
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=new_dots

LEGACY_DB_HOST=127.0.0.1
LEGACY_DB_PORT=3306
LEGACY_DB_DATABASE=legacy_dots
```

Keep your existing DB_USERNAME/DB_PASSWORD and LEGACY_DB_USERNAME/LEGACY_DB_PASSWORD settings. If DB_URL or LEGACY_DB_URL is configured, its database/connection values may override the individual settings. Run `php artisan config:clear` after editing cached configuration. No database rename is required.

## Usage

Back up the target and complete normal schema migrations first:

```bash
php artisan migrate
```

Review pending migrations as usual before running them on a deployed application. The combined importer does not run migrations, reset tables, or create a backup automatically. It uses the live legacy database, not the SQL export files. Stop edits to both systems during the import; do not run parallel import processes.

Read-only preview of all stages:

```bash
php -d memory_limit=768M artisan legacy:import-all --unassign-mismatched-divisions
```

Apply all stages with one command:

```bash
php -d memory_limit=768M artisan legacy:import-all --apply --target=new_dots --unassign-mismatched-divisions
```

The division flag uses the previously selected rule: keep a user's bureau and leave a division belonging to a different bureau unassigned. Without this explicit flag such mismatches stop the import.

The command prints the resolved source and target names. `--target` must exactly match the configured target database; it is an assertion, not a way to select a different connection.

## Behavior

- The default is preview only. Planned directory identities are passed to the document and audit previews in memory, so all stages can be previewed before the first directory import. No temporary inserts are performed in the target during preview.
- Apply uses one outer target transaction. If documents or audit fail, all directory/document/audit writes from that run roll back. Pre-existing records remain intact. Underlying importer transactions become nested savepoints.
- Aggregate reports are saved under `storage/app/private/legacy-import-reports/all-*.json`. Passwords, historical SQL and raw payloads are not included in this combined report.
- Reruns skip existing legacy identities; they do not reset later local edits. Existing exception payloads may be refreshed without creating duplicate exceptions.
- Attachment import remains metadata-only. Physical legacy files are still required before downloads can be enabled.
- Missing references, document review flags and audit unknown actors follow the existing importer policies. A transaction spanning all stages may be large; allow sufficient execution time and disk space.
- A successful import is not a guarantee every document is actionable: review flagged documents and preserved exceptions before workflow cutover.

After an intentional LOCAL `migrate:fresh`, run this combined command to restore the available legacy data. `migrate:fresh` deletes native data; do not use it for an existing production database.

Detailed mappings and SQL verification:

- [Directory import](legacy-directory-import.md)
- [Document import](legacy-document-import.md)
- [Audit import](legacy-audit-import.md)
