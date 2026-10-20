# Security Review and Hardening Measures

**Reviewed:** 2026-10-19  
**Review type:** Static application and configuration review

## Status

The application has useful protections for authentication, authorization, validation, and document content. I closed the application-level path that published attachments from anonymous tracking and moved new files to private storage. Existing copies in public storage and the deployed web-server link still need migration and verification before confidential records are safe. This review does not certify the deployed system: the production host, reverse proxy, firewall, database permissions, backups, and live secrets were not available for inspection.

## Highest priority findings

### P1 — Attachments are publicly downloadable

Before this review, uploads and generated PDFs went to Laravel's `public` disk and the anonymous `/track/{trackingNumber}` page returned their direct URLs. New files now go to private storage and are served through an authenticated route scoped with `DocumentAccess`. Anonymous tracking no longer returns file names or links. A compatibility read path remains for older files in `storage/app/public`; files in that directory are only served by the app through the authorized route in this workspace. I removed the workspace's `public/storage` junction without changing its target data. Production must be checked separately for a deployed link or cached URLs.

**Required measures before confidential use:**

1. Migrate existing files out of `storage/app/public` to private storage. Remove any deployed `public/storage` link and block old static URLs at the web server. Changing application code alone does not revoke already public URLs.
2. Keep the authorized route, which checks office/owner access and file-to-document ownership and responds with `private, no-store` and `nosniff`.
3. Treat previously shared direct URLs as exposed; invalidate or remove those files as policy permits.

### P1 — Public tracking data is enumerable

`/track/{trackingNumber}` returns document title, purpose, office, status, and workflow timestamps for finalized documents. Newly generated business tracking numbers include the document's sequential database ID (`app/Http/Controllers/DocumentController.php` and `app/Http/Controllers/DocumentCreationController.php`). The route now requires a signed URL and is limited to 30 requests per minute, so knowing or guessing the business number alone no longer grants access. Signed tracking links are bearer links; share them only with intended recipients. Existing unsigned tracking links will need to be regenerated.

**Remaining measures:** review public tracking fields with the data owner, keep monitoring and the rate limit, and protect `APP_KEY` because it signs tracking links. Business tracking numbers should not act as access tokens.

### P1 — reCAPTCHA secret values were committed

The tracked `.env.example` contained populated reCAPTCHA secret-key values. I replaced those values with empty placeholders. Because Git history still contains the previous values, revoke and rotate the reCAPTCHA secrets in Google, then update deployment secrets. If the repository has been shared externally, consider removing the values from history after rotation.

The local `.env` and root-level `client_secret_*.json` file are ignored by Git and were not found in the tracked file list. Keep them out of commits and restrict their filesystem access; remove the JSON file if it is no longer needed.

## Other findings and actions

### P2 — Public account registration remains enabled

Guest registration is enabled in `routes/auth.php` and is now limited to five requests per minute. New registrations receive the default standard-user role, and application routes require authentication and verified email, so this is not an administrator-role escalation. If DOTS accounts are meant to be provisioned by administrators or HRIS only, disable public registration or add an organization enrollment policy.

### P2 — Production settings must be explicit

The checked-in example previously enabled debug mode; it now sets `APP_DEBUG=false`. The ignored workstation `.env` currently uses local mode, debug enabled, localhost, and reCAPTCHA disabled; those values are local-development settings, not evidence of production configuration.

For production, set `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL` to the HTTPS origin, and `SESSION_SECURE_COOKIE=true`. Keep `SESSION_HTTP_ONLY=true` and `SESSION_SAME_SITE=lax`; consider `SESSION_ENCRYPT=true` where session storage at rest is in scope. Confirm TLS termination and trusted-proxy settings at the host, and enable reCAPTCHA if required by the organization's login policy. Do not deploy by copying the workstation `.env`.

### P2 — Uploaded files need private access and content scanning

Uploads allow PDF, JPEG, PNG, DOC, and DOCX up to 100 MB (`DocumentController`). Type and size validation are present, and new files are stored privately, but there is no malware scanning in the application flow. Consider a smaller operational size limit, antivirus scanning or quarantine, and safe handling of files opened in browsers.

### P2 — Security headers and hosting controls are not defined in this repository

No application security-header middleware or web-server configuration was found. Configure HTTPS and HSTS at the edge, plus `X-Content-Type-Options: nosniff`, a suitable `Referrer-Policy`, and frame restrictions. Introduce Content Security Policy in report-only mode first because the Inertia/Vite page and external font host need compatible policies. Restrict the web document root to `public/`; deny access to `.env`, source, logs, backups, and private storage.

### P3 — Preserve TLS verification for integrations

DRIP, PDMIS, and iPluma requests previously defaulted to `verify=false`, which could disclose API credentials to an intercepting network. The defaults now verify server certificates in `IntegrationController` and `IplumaController`. Keep `*_VERIFY_SSL` enabled in production and install the required CA certificates instead of disabling verification.

## Protections found in the code

- Application routes require authentication and verified email; library administration and Gmail connection routes have an administrator middleware check.
- Login is rate limited to five attempts per username/IP key. Password-reset, email-verification, preview, and HRIS lookup routes also have throttles.
- Login checks account active/locked status and regenerates the session after authentication. Logout invalidates the session and CSRF token.
- Authenticated application and account routes now check active/locked status on each request and invalidate sessions for disabled or locked users.
- Document queries use office/owner scopes, draft updates check ownership, and document workflow actions check the current holder or receiving role.
- User passwords are hashed and hidden from model serialization. Gmail access and refresh tokens use Laravel encrypted casts; the OAuth callback validates a session-bound `state` value.
- Rich document content is normalized against an element/mark allowlist and text is escaped when rendered. Raw HTML is not accepted by that schema.
- Upload validation restricts accepted file types and size. CSRF protection is provided by Laravel's web middleware.

## Dependency review and verification

- `composer audit --locked --no-interaction`: no published advisories found.
- `npm.cmd audit --omit=dev --ignore-scripts`: zero production dependency vulnerabilities. Development dependencies were not included in this npm scan.
- `git diff --check`: passed.
- The application test suite and live security tests were not run. This was a static review; it did not test the running service or deployment environment.

## Release checklist

- [x] Move new document files to private storage, add authorized downloads, remove file links from public tracking, require signed tracking URLs, and add a tracking throttle.
- [x] Enforce active/locked account status on authenticated requests.
- [x] Remove the workspace `public/storage` junction; its target data remains in place.
- [ ] Migrate production legacy files, remove any deployed public storage link, and block old static URLs.
- [ ] Regenerate unsigned tracking links and review public fields with the data owner.
- [ ] Rotate the reCAPTCHA secret values that appeared in Git history.
- [ ] Decide whether public registration is allowed; disable it or add abuse controls.
- [ ] Verify production environment values, HTTPS-only cookies, secure proxy configuration, and least-privilege database credentials.
- [ ] Configure security headers, log retention and access, backup encryption, and alerting at the deployment layer.
- [ ] Run a full dependency audit including npm development dependencies and run the approved application security test plan before release.
