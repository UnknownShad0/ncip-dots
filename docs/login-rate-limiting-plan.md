# Login Rate Limiting and Account Lockout Plan

## Goal

Replace the current fixed login throttle with progressive delays for incorrect passwords, then require an administrator to unlock an account after repeated failures.

## Proposed behavior

Count failed credential checks for an existing account:

| Failed attempt | Result |
| --- | --- |
| 1st and 2nd | Show the normal login error; no cooldown |
| 3rd | Start a 60-second cooldown |
| 4th, after that cooldown | Start a 120-second cooldown |
| 5th, after that cooldown | Set the account status to **Locked** |

Requests made during an active cooldown show the remaining wait and do not count as another failed credential attempt. Each failed credential check increments the account's counter and updates its latest-failure timestamp. A successful login before the account is locked clears the failed-attempt count and cooldown. Once locked, the account stays locked until an administrator changes its status; password reset and elapsed time do not unlock it.

Reset the pre-lock failure count after 24 hours without a failed login. For example, if the user has two failed attempts and then makes no failed attempt for more than 24 hours, the next failed attempt starts again at attempt 1 and does not trigger a cooldown. If the third failed attempt happens within 24 hours of the previous failure, start the 60-second cooldown. A successful login before the account is locked resets the count immediately. This 24-hour reset never unlocks an account that has already reached **Locked**; only an administrator can do that.

## Error messages

Show a generic message for incorrect credentials, and give account-status-specific guidance so the user knows what action to take:

- Incorrect credentials: `The username or password is incorrect.`
- Active cooldown: `Too many failed login attempts. Try again in {seconds} seconds.`
- Locked account: `Your account is locked after repeated failed login attempts. Contact an administrator to unlock it.`
- Inactive account: `Your account is inactive. Contact an administrator to reactivate it.`

Do not show the number of attempts remaining. The locked and inactive messages intentionally reveal the account status to provide useful guidance to the user.

## Account statuses

Present one **Account Status** control with three choices:

- **Active** - can log in.
- **Inactive** - disabled by an administrator.
- **Locked** - locked after repeated failed logins; administrator unlock required.

Represent these with the existing `is_active` and `is_locked` fields, and do not allow the ambiguous `Inactive + Locked` combination:

| Status | `is_active` | `is_locked` |
| --- | --- | --- |
| Active | `1` | `0` |
| Inactive | `0` | `0` |
| Locked | `1` | `1` |

Changing a locked account back to **Active** is the administrator unlock action and clears its failure count and cooldown. The password reset flow must not clear the lock.

## Planned files

- `app/Http/Requests/Auth/LoginRequest.php` - track failures, apply the escalating cooldowns, lock the account on the 5th failed attempt, clear pre-lock failures after a successful login, and record the lockout in the audit trail.
- `database/migrations/<new migration>` - add `failed_login_attempts`, `last_failed_login_at`, and `login_locked_until` fields so the count, last attempt time, and cooldown survive requests and application restarts. No IP column is needed.
- `app/Models/User.php` - add casts/fillable fields for the new tracking fields as needed.
- `app/Http/Controllers/UserAccountController.php` - save the three account statuses, reset tracking fields when an administrator unlocks an account, and keep audit records.
- `resources/js/Pages/UserAccounts/Index.tsx` - replace the separate Account Status and Login Status selectors with one Active / Inactive / Locked selector.
- `resources/js/Pages/AuditTrail/Index.tsx` - show a readable label for automatic account lock events if the existing event labels do not already cover them.

## Existing behavior to preserve

- `app/Http/Middleware/EnsureActiveUser.php` already blocks inactive or locked accounts.
- `app/Http/Controllers/Auth/NewPasswordController.php` changes the password but does not unlock accounts; keep that behavior to preserve administrator-only unlocks.
- Keep login failure and lockout audit logging, including the identifier, reason, and request IP where appropriate.

## Not included

- No automatic unlock for a locked account.
- No unlock through password reset or a successful password check.
- No database status-field replacement; use the existing `is_active` and `is_locked` fields with the three-state mapping above.
