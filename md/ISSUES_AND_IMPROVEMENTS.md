# DOTS — Issues & Improvement Recommendations

Based on analysis of `PROJECT_ANALYSIS.md` and direct code inspection.

**Generated:** September 22, 2026

---

## Table of Contents

1. [Security Issues](#1-security-issues) ⚠️ Critical
2. [Code Quality & Technical Debt](#2-code-quality--technical-debt)
3. [Performance Issues](#3-performance-issues)
4. [Architecture Improvements](#4-architecture-improvements)
5. [Database Improvements](#5-database-improvements)
6. [File & Upload Management](#6-file--upload-management)
7. [Frontend Improvements](#7-frontend-improvements)
8. [DevOps & Deployment](#8-devops--deployment)
9. [Quick Wins Summary](#9-quick-wins-summary)

---

## 1. Security Issues

These are the most urgent items. Several represent active vulnerabilities.

---

### 1.1 CSRF Protection is Disabled ⚠️ CRITICAL

**File:** `application/config/config.php`, line 454
```php
$config['csrf_protection'] = FALSE;  // ← disabled!
```
CSRF (Cross-Site Request Forgery) protection is explicitly turned off. Every AJAX POST endpoint (add document, update status, add user, etc.) is vulnerable — an attacker can forge requests on behalf of a logged-in user.

**Fix:** Enable it and add the token to all AJAX calls.
```php
// config.php
$config['csrf_protection'] = TRUE;
$config['csrf_token_name'] = 'csrf_token';
$config['csrf_cookie_name'] = 'csrf_cookie';
$config['csrf_expire'] = 7200;
$config['csrf_regenerate'] = TRUE;
```
Then include the token in every AJAX POST:
```javascript
// In JavaScript
$.ajaxSetup({
    data: { csrf_token: Cookies.get('csrf_cookie') }
});
```

---

### 1.2 Hard-coded SMTP Passwords ⚠️ CRITICAL

**Files with live passwords in source code:**

| File | Line | Password |
|---|---|---|
| `application/core/MY_Controller.php` | 127 | `@lvinP0g1` (Office 365 SMTP) |
| `application/modules/FileUpload/controllers/FileUpload.php` | 123, 271 | `ps@-Hr!5` |
| `application/modules/ResetPassword/controllers/Login.php` | 86 | `ps@-Hr!5` |

There are **two different SMTP passwords** in use across the codebase, which also indicates fragmented email sending logic that should be centralized.

**Fix:** Move all email credentials to `.env` and read them via `getenv()`:
```php
// .env
SMTP_PASSWORD=your_password_here
SMTP_USERNAME=apps.notif@ncip.gov.ph

// MY_Controller.php
$mail->Password = getenv('SMTP_PASSWORD');
$mail->Username = getenv('SMTP_USERNAME');
```
Then remove all hardcoded passwords from every controller and module.

---

### 1.3 Hard-coded Google reCAPTCHA Secret Key

**File:** `application/modules/Login/controllers/Login.php`
```php
$secret_key = "6LfUhJoeAAAAAIT0BttI4SotYUADRnxJ297JVCvF";
```
This secret key is committed to the codebase and is meant to be kept server-side only.

**Fix:**
```php
// .env
RECAPTCHA_SECRET=6LfUhJoeAAAAAIT0BttI4SotYUADRnxJ297JVCvF

// Login.php
$secret_key = getenv('RECAPTCHA_SECRET');
```

---

### 1.4 SSL Certificate Verification Disabled on All External API Calls

**Files affected:**
- `application/libraries/Pdmis_tracking.php` — `CURLOPT_SSL_VERIFYPEER => false`
- `application/modules/Drip/controllers/Drip.php` — `SSL_VERIFYPEER = false`
- `application/modules/Ipluma/controllers/Ipluma.php` — `SSL_VERIFYPEER => false`
- `application/modules/Documents/controllers/Documents.php` — `SSL_VERIFYPEER = false`
- `application/modules/Setup/controllers/Setup.php` — `SSL_VERIFYPEER = false`

Disabling SSL verification on all external HTTP calls opens the system to **man-in-the-middle attacks**. This was likely done to work around a local dev SSL issue and was never re-enabled for production.

**Fix:** Remove these lines (or set to `true`) in production. If the external API's certificate is self-signed, add it as a trusted CA instead:
```php
// Remove these two lines, or set to true:
// curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
// curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
```

---

### 1.5 Uploaded Files Are Publicly Accessible

**Path:** `assets/uploads/` is inside the web root with no `.htaccess` protection.

Any document file uploaded by users can be directly accessed via URL (e.g., `https://dots.ncip.gov.ph/dots/assets/uploads/September-2026/AS - Cashier/filename.pdf`) by anyone who guesses or discovers the path. There is no authentication check on file access.

**Fix:** Add an `.htaccess` to `assets/uploads/` to deny direct access, then serve files through a PHP controller that checks the session first:
```apache
# assets/uploads/.htaccess
Deny from all
```
```php
// New controller method: Documents/downloadFile($filename)
public function downloadFile($encryptedPath) {
    $this->checkSession();
    // decode, validate, then force-download
    $this->load->helper('download');
    force_download($path, file_get_contents($path));
}
```

---

### 1.6 Weak Password Reset Token Generation

**Files:**
- `application/modules/ForgotPassword/models/ForgotPassword_model.php`
- `application/modules/ResetPassword/models/Login_model.php`

```php
$token = substr(sha1(rand()), 0, 30);  // ← NOT cryptographically secure
```
`rand()` is not cryptographically secure. The token is also truncated to 30 characters of a SHA1 hash, further reducing entropy.

**Fix:** Use `random_bytes()` (PHP 7+) or `openssl_random_pseudo_bytes()`:
```php
$token = bin2hex(random_bytes(32)); // 64 hex chars, cryptographically secure
```

---

### 1.7 46 Debug/Test Scripts Exposed in Web Root ⚠️ HIGH

**Count:** 47 PHP files in the project root (excluding `index.php`), including:
- 24 `test_*.php` files — test DRIP, iPLuma, PDMIS, DB connections, queries
- `debug_schema.php`, `debug_schema_2.php` — exposes DB schema
- `diagnostics.php` — exposes system information
- `check_archives.php`, `diag_archives.php` — exposes internal state
- `apply_db_optimization.php`, `auto_setup.php` — can modify the database when accessed via browser

These are **directly accessible via browser** and can leak database structure, credentials, and allow unauthorized DB modifications.

**Fix:** Delete all these files before any production deployment. They serve no runtime purpose.

---

## 2. Code Quality & Technical Debt

---

### 2.1 Duplicate and Dead Code Modules

The following folders are dead code that bloat the codebase and create confusion:

| Folder | Issue |
|---|---|
| `application/modules/Login - Copy/` | Exact duplicate of the Login module |
| `application/modules/Archives2022/` | Superseded by `Archives?year=2022` |
| `application/modules/Archives2023/` | Superseded by `Archives?year=2023` |
| `application/modules/Archives2024/` | Superseded by `Archives?year=2024` |
| `application/modules/Documents/controllers/Documents copy.php` | Duplicate of the active Documents controller |
| `application/modules/Documents/models/Documents_model - Copy.php` | Duplicate model file |
| `application/modules/Documents/models/Documents_model latest.php` | Stale model file |
| `application/modules/Documents/models/Documents_model_copy.php` | Another duplicate |
| `application/modules/LatestDocuments/models/LatestDocuments_model - Copy.php` | Duplicate |

**Fix:** Delete all the above. Ensure `Archives` module handles all years via the `?year=` parameter. Use git branches instead of file copies for backups.

---

### 2.2 Four Full Module Directory Backups Inside the Web Root

```
application/modules 031925/      ← ~March 2025 snapshot
application/modules 042825/      ← ~April 2025 snapshot
application/modules - 093025/    ← ~Sept 2025 snapshot
application/modules - 093025v2/  ← ~Sept 2025 v2 snapshot
application/modules.zip          ← Compressed archive
```

These are ~4× the active module code sitting inside the web root. The `.zip` is directly downloadable. This is a manual substitute for proper version control.

**Fix:**
1. Move all backup folders and the `.zip` outside the web root (or delete them entirely if the code is in git).
2. Use `git branch` or `git tag` for versioning instead.

---

### 2.3 Fragmented Email Sending Logic

Email is sent from at least three different places with duplicated PHPMailer setup code:
- `application/core/MY_Controller.php` (`sendEmail()` method)
- `application/modules/FileUpload/controllers/FileUpload.php` (inline PHPMailer)
- `application/modules/ResetPassword/controllers/Login.php` (inline PHPMailer)
- `application/modules/UserAccount/controllers/UserAccount.php`

Each has slightly different credentials (`@lvinP0g1` vs `ps@-Hr!5`) indicating inconsistency.

**Fix:** Centralize all email sending through `MY_Controller->sendEmail()` (which already exists). Remove inline PHPMailer code from individual controllers and have them call the base method. All SMTP credentials should come from a single `.env` source.

---

### 2.4 Role-Based Access Control is Magic Numbers

Role checks are scattered across 20+ model files using integer comparisons:
```php
if ($role == 1 || $role == 2) { /* admin/super-admin */ }
if ($role != 1) { /* not super-admin only */ }
if ($this->session->userdata('role') != 1) { redirect(...) }
if ($this->session->userdata('role') === '14') { /* special role */ }
```

There are no named constants or a centralized authorization layer. The meaning of roles `1`, `2`, `14` must be inferred from context. Adding a new role or changing role behavior requires editing many files.

**Fix:** Define role constants (ideally in `application/config/constants.php`):
```php
define('ROLE_SUPER_ADMIN', 1);
define('ROLE_ADMIN', 2);
define('ROLE_ENCODER', 14);
```
And optionally create an authorization helper/library that centralizes permission checks.

---

### 2.5 Error Logging is Disabled

**File:** `application/config/config.php`, line 229
```php
$config['log_threshold'] = 0;  // ← logging OFF
```
With logging set to `0`, no errors, warnings, or debug messages are written to logs. Silent failures become very hard to diagnose in production.

**Fix:**
- **Production:** Set to `1` (errors only) so genuine PHP errors are captured.
- **Development:** Set to `4` (all messages) or use an environment-based value.
```php
$config['log_threshold'] = (ENVIRONMENT === 'production') ? 1 : 4;
```

---

### 2.6 `checkSession()` is Not Called in Some Controllers

`TrackDocument` intentionally skips auth (public). However, there are methods in some controllers (like `Drip`, `Ipluma`, `Pdmis`) that do their own `userId` check inline rather than calling the standard `checkSession()`. This creates inconsistency — the centralized IP/User-Agent fingerprint check is bypassed for those routes.

**Fix:** All protected endpoints should call `$this->checkSession()` at the top of the method. The inline `if (!$this->session->userdata('userId'))` check is a weaker substitute.

---

## 3. Performance Issues

---

### 3.1 External Integrations Fetch All Records Into Memory

**Files:** `Drip.php`, `Ipluma.php`, `Pdmis.php`

All three external integration modules fetch **the entire dataset** from the API into a PHP array, then do pagination and filtering in PHP memory:
```php
$all_drip = $this->_getAllDRIPRows();   // Fetch ALL records
// ... then filter/paginate in PHP
$filtered_drip = array_filter($all_drip, function($row) use ($search_lower) { ... });
$paged = array_slice($filtered_drip, $start, $length);
```

This means:
- Every DataTables page refresh makes a full API call (or reads a full cached payload)
- The cache stores the entire response
- Memory usage scales with the number of documents
- If the API supports 1,000+ records, this will be slow and memory-intensive

**Fix:** Use the API's own pagination and filtering parameters (if available) so only the requested page of data is fetched. If the external API doesn't support server-side paging, at minimum increase the cache duration and avoid re-fetching on every interaction.

---

### 3.2 `DRIP_API_URL` Only Fetches 100 Records

```php
$url = getenv('DRIP_API_URL') . '?per_page=100';
```
The DRIP integration is hard-limited to 100 records per fetch. If there are more, data will be silently truncated.

**Fix:** Implement pagination loop to fetch all pages, or use a larger `per_page` value if the API supports it, or implement proper server-side filtering at the API level.

---

### 3.3 `session_write_close()` Applied Inconsistently

`session_write_close()` is correctly called in `Dashboard/index()`, `Documents/getDocuments()`, and `Archives/getDocuments()` to prevent PHP session locking from serializing concurrent AJAX requests. However it is missing in many other AJAX endpoints (`getTrail()`, `getUserAccount()`, various CRUD endpoints), which means those calls will still block each other if fired concurrently.

**Fix:** Add `session_write_close()` at the start of every read-only AJAX method. A good pattern is to call it right after `checkSession()`.

---

## 4. Architecture Improvements

---

### 4.1 No API Response Standardization

Each AJAX endpoint returns JSON in a slightly different shape:
- `{ 'data': [...] }` — getUserAccount
- `{ 'draw': x, 'recordsTotal': x, 'data': [...] }` — DataTables
- `{ 'result': 'success' }` — CRUD operations
- `{ 'error': true, 'message': '...' }` — error states
- Raw JSON arrays — some endpoints

**Fix:** Standardize all JSON responses through a helper method on `MY_Controller`:
```php
protected function jsonResponse($data = [], $error = false, $message = '') {
    header('Content-Type: application/json');
    echo json_encode([
        'success' => !$error,
        'message' => $message,
        'data'    => $data,
    ]);
}
```

---

### 4.2 Special-Case User ID `1` is Hard-Coded

```php
// Login.php
if ($this->session->userdata('userId') == '1') {
    redirect(base_url().'FileUpload');
} else {
    redirect(base_url().'dashboard');
}

// FileUpload.php
if($this->session->userdata('role') != 1) { redirect(...) }
```

The special behavior for user ID 1 and role 1 is hard-coded. This is fragile — if the super-admin account ever changes or the role numbering changes, this silently breaks.

**Fix:** Drive this through the role system. Define a post-login redirect based on the user's role, not their specific user ID.

---

### 4.3 No Centralized Input Validation Library Usage

While `$this->security->xss_clean()` is used for XSS sanitation, CodeIgniter's built-in `Form_validation` library (which provides field-level rules, required checks, min/max length, regex, etc.) is not used anywhere. Validation logic is ad hoc.

**Fix:** Add server-side validation rules using CI's `form_validation` library on all data-mutating endpoints (add/edit document, add user, etc.).

---

## 5. Database Improvements

---

### 5.1 `utf8` Collation Should Be `utf8mb4`

**File:** `application/config/database.php`
```php
'char_set' => 'utf8',
'dbcollat' => 'utf8_general_ci',
```
MySQL's `utf8` only supports 3-byte characters. It cannot store 4-byte Unicode characters (emoji, some CJK characters, rare symbols). The modern standard is `utf8mb4`.

**Fix:**
```php
'char_set' => 'utf8mb4',
'dbcollat' => 'utf8mb4_unicode_ci',
```
Also update the database and all table collations to match.

---

### 5.2 No Formal Database Migration System

Only one migration file exists (`001_create_document_linking_tables.sql`), and CodeIgniter's built-in migration runner does not appear to be in active use. Schema changes are being applied via ad hoc `add_*.php` scripts in the root.

**Fix:** Enable CodeIgniter migrations (`$config['migration_enabled'] = TRUE` in `migration.php`) and track all future schema changes as numbered migration files in `database/migrations/`. This ensures consistent schema across dev, staging, and production environments.

---

### 5.3 `document_link_history` Uses JSON Columns Requiring MySQL 5.7.8+

```sql
old_values JSON COMMENT 'Previous values before change',
new_values JSON COMMENT 'New values after change',
```
The migration uses native `JSON` column type. The `database.php` config shows no explicit minimum MySQL version requirement. If any deployment is on MySQL 5.6 or older, this will fail silently or throw errors.

**Fix:** Document the minimum required MySQL version (5.7.8+ for JSON type) in deployment guides. Alternatively use `TEXT` columns with application-level JSON serialization for broader compatibility.

---

## 6. File & Upload Management

---

### 6.1 No File Type Validation Enforcement Confirmed

The file upload path is `assets/uploads/{Month-Year}/{office}/`. While CodeIgniter's `Upload` library is loaded in `MY_Controller`, there is no confirmed enforcement of file type restrictions visible in the analysis. If PHP files can be uploaded, they become executable via direct URL access.

**Fix:** Explicitly configure the Upload library to whitelist safe types only:
```php
$config = [
    'allowed_types' => 'pdf|doc|docx|xls|xlsx|jpg|png',
    'max_size'      => 10240, // 10 MB
];
$this->upload->initialize($config);
```
And add the `.htaccess` fix from issue 1.5 to prevent any uploaded file from being executed.

---

### 6.2 Upload Directory Has No Size or Count Limits Tracked

The `assets/uploads/` folder grows indefinitely. There is no reported cleanup or archival mechanism for old uploaded files.

**Recommendation:** Implement a periodic review/cleanup process for uploaded files associated with archived documents. Consider moving uploads to a dedicated storage location outside the web root, or to object storage (e.g., a local file server or cloud bucket) for long-term retention.

---

## 7. Frontend Improvements

---

### 7.1 Mix of Inline and Plugin JavaScript

The codebase mixes locally-stored plugin files (`assets/plugins/`) with inline scripts in view files. There are also multiple versions of jQuery present (`jquery.min.js`, `jquery-3.3.1.js`, `jquery-1.12.4.min.js`).

**Fix:** Standardize on a single jQuery version. Audit for duplicate library loads across views.

---

### 7.2 AdminLTE Demo Pages Shipped in Production

`assets/pages/` contains AdminLTE demo HTML pages (`widgets.html`, `kanban.html`, `calendar.html`, etc.) and `assets/docs/` contains AdminLTE documentation. These are not part of the application.

**Fix:** Delete `assets/pages/`, `assets/docs/`, and `assets/fullcalendar/examples/` before production deployment.

---

### 7.3 No Client-Side Session Expiry Handling

The AJAX endpoints return `{ 'error': true, 'message': 'session_expired' }` when the session is missing, but there is no confirmed global JavaScript handler that intercepts this and redirects the user to the login page. This can result in DataTables silently showing no data without explaining why.

**Fix:** Add a global AJAX error handler:
```javascript
$.ajaxSetup({
    complete: function(xhr) {
        try {
            const res = JSON.parse(xhr.responseText);
            if (res.message === 'session_expired') {
                window.location.href = baseUrl + 'Login';
            }
        } catch(e) {}
    }
});
```

---

## 8. DevOps & Deployment

---

### 8.1 `base_url` is Hard-Coded for Local Development

**File:** `application/config/config.php`
```php
$config['base_url'] = 'http://localhost/dots';  // ← local only
// $config['base_url'] = 'https://dots.ncip.gov.ph/dots';  // ← commented out
```
Switching between dev and production requires manually editing this file. If a developer forgets, the production URL will point back to localhost.

**Fix:** Use an environment variable:
```php
$config['base_url'] = getenv('APP_URL') ?: 'http://localhost/dots';
```
Then set `APP_URL=https://dots.ncip.gov.ph/dots` in the production `.env`.

---

### 8.2 No Git-Based Version Control Strategy

The project uses folder-copy backups (`modules 031925/`, `modules 042825/`, etc.) instead of git commits, branches, or tags. This means:
- No diff history between versions
- No ability to bisect bugs to a specific change
- Full code duplication instead of incremental deltas
- Risk of accidentally editing a backup folder instead of the active one

**Fix:** Initialize a proper git workflow. Use feature branches, commit frequently, and tag releases. The backup module folders can then be deleted.

---

### 8.3 Production Environment Not Clearly Defined

The `ENVIRONMENT` constant (set in `index.php`) controls whether database errors are displayed (`db_debug`) but there is no environment-specific config loading for `base_url`, `log_threshold`, or any other setting that should differ between development and production.

**Fix:** Review `index.php` `ENVIRONMENT` setting is correctly set to `'production'` on the live server. Add environment-aware config for base_url, logging, and error display.

---

### 8.4 `.htaccess` is the Only Security Layer for Application Folders

`application/`, `system/`, and `vendor/` are protected by `.htaccess` files that `deny from all`. This works only on Apache with `mod_rewrite`. On Nginx or misconfigured Apache, these files could be exposed.

**Fix:** Move `application/`, `system/`, and `vendor/` directories **above the web root** (outside `public_html` / `www`). This is the most robust protection and is standard practice for CodeIgniter deployments. Only `index.php`, `.htaccess`, and `assets/` should be inside the web root.

---

## 9. Quick Wins Summary

Items that can be fixed quickly with low risk, ordered by impact:

| Priority | Issue | Effort |
|---|---|---|
| 🔴 1 | Enable CSRF protection (§1.1) | Low — 2 config lines + JS token |
| 🔴 2 | Move SMTP passwords to `.env` (§1.2) | Low — find/replace + .env update |
| 🔴 3 | Move reCAPTCHA key to `.env` (§1.3) | Low — 1 line change |
| 🔴 4 | Delete 46 debug/test scripts from root (§1.7) | Trivial — delete files |
| 🔴 5 | Delete `application/modules.zip` (§2.2) | Trivial — delete file |
| 🔴 6 | Protect uploads folder with `.htaccess` (§1.5) | Low — create one file |
| 🟡 7 | Enable error logging (§2.5) | Trivial — 1 config line |
| 🟡 8 | Fix `base_url` to use env variable (§8.1) | Low — 1 config line |
| 🟡 9 | Define role constants (§2.4) | Low — constants.php + find/replace |
| 🟡 10 | Remove AdminLTE demo/docs from assets (§7.2) | Trivial — delete folders |
| 🟡 11 | Fix SSL verify disabled on cURL calls (§1.4) | Low — remove 2 lines per file |
| 🟡 12 | Fix password reset token entropy (§1.6) | Low — 1 line per file |
| 🟢 13 | Move backup module folders out of web root (§2.2) | Medium |
| 🟢 14 | Centralize email sending logic (§2.3) | Medium |
| 🟢 15 | Standardize JSON response format (§4.1) | Medium |

---

*Analysis based on `PROJECT_ANALYSIS.md` and direct code inspection.*
*Reviewed: September 22, 2026*
