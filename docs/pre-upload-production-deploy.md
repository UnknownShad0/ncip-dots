# Pre-upload production deployment commands

Quick reference for deploying the temporary document upload feature and operating the system's important production commands. The list is based on the app's registered Artisan commands, scheduler, and queued email jobs. Commands assume a Linux production server and should be run from the Laravel project root unless noted. Adapt the app path, PHP-FPM service name, and web-server settings to the host.

## 1. Deploy code and build assets

Take a database and private-file backup using the host's normal backup procedure before deploying. Then install locked dependencies and build the frontend if the release process builds assets on the server:

```bash
composer install --no-dev --prefer-dist --optimize-autoloader
npm ci
npm run build
```

If CI builds and publishes `public/build` as part of the release, skip the npm commands on production.

## 2. Apply the database migration

This feature adds the `temporary_document_uploads` table. Run migrations after deploying the code:

```bash
php artisan migrate --force
php artisan migrate:status
```

Do not use `migrate:fresh` on production; it drops application tables.

After migrations, cache the production configuration and gracefully restart any running queue workers:

```bash
php artisan optimize
php artisan queue:restart
```

`queue:restart` is safe when no worker is running, but it only signals existing workers to exit after their current job. A process supervisor should start replacement workers.

## 3. Import legacy DOTS data (one-time cutover only)

Use this only when initially importing legacy DOTS data into the production database. It is not part of routine deployments. Configure the `legacy` database connection and production target connection first, take a target database backup, and stop edits in both systems for the import window. See [legacy-import-all.md](legacy-import-all.md) for the full behavior and mapping notes.

Preview the directory, documents/history, and audit import. This command does not write imported records:

```bash
php -d memory_limit=768M artisan legacy:import-all --unassign-mismatched-divisions
```

Review the preview, then apply the import as one transaction:

```bash
php -d memory_limit=768M artisan legacy:import-all --apply --target=YOUR_PRODUCTION_DATABASE_NAME --unassign-mismatched-divisions
```

Replace `YOUR_PRODUCTION_DATABASE_NAME` with the exact target database name configured for this deployment. The `--target` option is an assertion; it does not select or switch databases. Do not run the apply command in routine deployments or in parallel with another import.

## 4. Confirm private storage is writable

Temporary files use the `document_private` disk at `storage/app/private`. Ensure the PHP-FPM/web-server account can write there. Do not expose this directory through a public web path or run `php artisan storage:link` for it.

Optional Linux check from the app root:

```bash
test -w storage/app/private && echo "Private storage is writable"
```

## 5. Allow the configured upload size

The application accepts files up to 102400 KB (100 MB). Configure the **web PHP runtime** and any reverse proxy/web server to accept at least that size. For example:

```ini
upload_max_filesize = 100M
post_max_size = 110M
```

For Nginx, set an appropriate body limit in the site configuration, for example:

```nginx
client_max_body_size 110m;
```

Reload or restart the relevant PHP-FPM and web-server services after changing their configuration. Service names vary by host. Check the PHP-FPM/web runtime settings; CLI PHP can load a different `php.ini`.

## 6. Enable Laravel's scheduler

The app already schedules expired temporary-upload cleanup hourly in `routes/console.php`. Configure the host cron to run Laravel's scheduler every minute (replace the app path):

```cron
* * * * * cd /path/to/your/app && php artisan schedule:run >> /dev/null 2>&1
```

Confirm Laravel sees the scheduled cleanup:

```bash
php artisan schedule:list
```

If the host does not provide cron, run `php artisan schedule:work` under a process supervisor such as systemd or Supervisor. Do not rely on an SSH session staying open.

## 7. Verify the deployed feature

```bash
php artisan route:list --name=document-uploads
php artisan document-uploads:clean-expired
```

The cleanup command deletes only expired temporary uploads and reports how many it removed. In staging, verify a full-size-appropriate upload, successful attachment, user removal, and expiry cleanup before enabling the feature for production users.

## 8. Configure and operate email notifications

Set the production SMTP settings in the protected environment configuration (`MAIL_MAILER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, and `MAIL_FROM_ADDRESS`). Do not put credentials in this guide, Git, or shell history. After changing environment settings, refresh Laravel's config cache and restart workers:

```bash
php artisan optimize
php artisan queue:restart
```

The administrator **Send test** action on the Email notifications page sends immediately and does not need a queue worker. Use an authorized test mailbox. Document workflow notifications are queued; the example environment uses Laravel's database queue. Run a worker as a supervised long-running process (for example, with Supervisor or systemd), not from an SSH session:

```bash
php artisan queue:work --sleep=3 --tries=3
```

Check failed jobs when investigating delivery issues:

```bash
php artisan queue:failed
```

The process supervisor should restart a worker after it exits, including after `php artisan queue:restart` during deployment.

For the manual message-by-message test steps, see [email-notification-testing-guide.md](email-notification-testing-guide.md). Its `php artisan tinker` dispatch example is for controlled testing; use staging and a test inbox, and do not dispatch test messages to production users.

## 9. Other on-demand commands

These commands change application data. Run them only when the corresponding operation is intended; they are not routine release steps.

| Command | Use |
| --- | --- |
| `php artisan hris:sync-employees` | Pull the current HRIS roster into the local employee directory. Confirm the HRIS connection and sync window first. |
| `php artisan documents:import-asset /path/to/image.png --name="NCIP logo" --kind=logo` | Import a document logo asset. Supported kinds are `logo`, `full_header`, and `footer`. |
| `npm run build:document` | Rebuild only the document-renderer bundle. The normal `npm run build` already includes it. |
| `php artisan list` | Show registered Artisan commands available in this release. |

Legacy data import is documented in section 3 and should only run during the planned one-time cutover.

## Notes

- `document-uploads:clean-expired` can also be run manually; the scheduler runs it hourly once the host cron is configured.
- Temporary uploads expire after six hours. Hourly scheduling means an expired file can remain until the next scheduler run.
- The upload endpoint is authenticated and rate-limited in the app. Server upload-size limits still need to match the application limit.
- This guide does not configure malware scanning, backups, or host-specific service management; follow the production environment's established procedures for those.
