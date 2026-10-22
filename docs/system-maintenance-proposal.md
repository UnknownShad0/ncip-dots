# System Maintenance - Feature Proposal

## Goal

Give the Super Admin a place to announce planned work or temporarily restrict normal system use while maintenance is in progress.

This is separate from Navigation Access. Navigation Access controls which sections a role can use; System Maintenance controls the availability of the application.

## Where the navigation item goes

Add a Super Admin-only **System Maintenance** link to the existing **Administration** group, beside Navigation Access:

```text
ADMINISTRATION
  User accounts
  Navigation Access
  System Maintenance       -> Super Admin only
  Libraries
  Gmail notifications
  Audit trails
```

## Suggested page

```text
System Maintenance                                      [Save changes]
Set a notice or restrict normal system access during maintenance.

Status
  [ ] Off
  [ ] Notice only
  [ ] Full maintenance

Maintenance message
  [We are performing scheduled maintenance. Please try again later.]

Optional schedule
  Start: [date and time]       End: [date and time]

                                           [Save changes]
```

When full maintenance is enabled, show a confirmation with the selected mode, message, and schedule before applying it.

## Modes

| Mode | What users experience |
| --- | --- |
| **Off** | The application works normally. |
| **Notice only** | A visible banner explains the maintenance window; users can continue working. |
| **Full maintenance** | Executive and Admin Staff are sent to a maintenance page and cannot use protected pages or submit actions until maintenance ends. The response should use HTTP 503. |

The maintenance page should display the configured message and, when present, the expected end time. It should not expose technical error details.

## Access rules

- Only Super Admin can view and change the maintenance settings.
- Super Admin retains access to the application during full maintenance to perform and verify the work.
- Executive and Admin Staff see the notice or maintenance page, according to the selected mode; they cannot change the settings.
- Enforce full maintenance on the server for page requests and actions, including direct URLs. Hiding a link alone is not sufficient.
- Keep login and logout available so users can manage their sessions. After login, users affected by full maintenance should see the maintenance page.
- Public document tracking can remain available during maintenance because it is read-only; confirm this policy before implementation if tracking depends on a service being taken offline.
- Existing route permissions and Navigation Access checks continue to apply when maintenance is off.

## Settings and audit history

Persist the active mode, message, optional start and end times, and the Super Admin who last changed the settings. Store and display schedule times consistently using the application's configured timezone.

Record each change in the existing audit history, including who changed it, when it changed, and the previous and new mode. An optional reason field would make later review easier.

If an end time is set, maintenance should end automatically when that time passes. If no schedule is set, the Super Admin turns the mode off manually.

## Recommended first release

Implement the Administration page, the three modes, a configurable message and optional schedule, server-side enforcement for full maintenance, Super Admin bypass, and audit logging. Keep a read-only mode out of the first release; it adds rules about which actions are safe and which data remains current.
