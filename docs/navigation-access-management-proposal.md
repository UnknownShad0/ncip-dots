# Navigation Access Management — UI and Access Rules

## Goal

Give the Super Admin a page to choose which sidebar navigation items are visible and accessible to the **Executive** and **Admin Staff** roles.

The role names come from the current user account form. `System Admin` is a seeded name for role ID 1, which is also used for Super Admin.

## Where the new navigation item goes

The Super Admin-only item is in the existing **Administration** group, directly below **User accounts**:

```text
ADMINISTRATION
  User accounts
  Navigation Access       ← Super Admin only
  Libraries
  Gmail notifications
  Audit trails
```

The sidebar entry can use a list/check icon. Its label would be **Navigation Access**; the destination page title would be **Navigation Access Management**.

## Page layout

The page would use the current DOTS page style: a page heading and short description, followed by a bordered panel with the editable settings.

```text
Navigation Access Management                         [Save changes]
Choose which sidebar items each role can see.

┌───────────────────────────────────────────────────────────────────┐
│ Navigation item                    Executive       Admin Staff   │
├───────────────────────────────────────────────────────────────────┤
│ Dashboard                              [✓]              [✓]       │
│ DOCUMENTS                                                        │
│   Latest documents                     [✓]              [✓]       │
│   All documents                        [✓]              [✓]       │
│   Document creation                    [✓]              [✓]       │
│   Document Workflow                    [✓]              [✓]       │
│   Drafts                               [✓]              [✓]       │
│ CONNECTED SYSTEMS                                                 │
│   Connected systems                    [✓]              [✓]       │
│ ARCHIVES                                                         │
│   Archived documents                   [✓]              [✓]       │
│ ADMINISTRATION                                                    │
│   User accounts                        [✓]              [ ]       │
│   Libraries                            [✓]              [ ]       │
│   Gmail notifications                  [✓]              [ ]       │
│   Audit trails                         [✓]              [✓]       │
└───────────────────────────────────────────────────────────────────┘

                                      [Reset changes] [Save changes]
```

The checked states above reflect the current sidebar filter in `AuthenticatedLayout.tsx`: Executive sees User accounts, Libraries, and Gmail notifications; Admin Staff does not. Both currently see the other listed links. The initial saved settings should preserve that behavior so the feature does not unexpectedly change anyone’s menu.

## Behavior

- Super Admin can show or hide each listed item independently for Executive and Admin Staff.
- Super Admin always sees the full navigation and cannot hide the Navigation Access page from themselves.
- Saving updates the relevant users’ sidebar on their next page load.
- The same visibility settings apply to the desktop sidebar and mobile navigation drawer.
- If a role has no saved settings yet, the app uses the initial defaults matching its current menu.
- A hidden sidebar item blocks its related routes and actions with a 403 response.
- Routes shared by multiple sections remain available when at least one associated section is visible. Existing server-side permissions still apply and can deny access even when a link is visible.

## Navigation items covered

These are the current main sidebar links from `AuthenticatedLayout.tsx`, grouped as they appear today:

- Dashboard
- Documents: Latest documents, All documents, Document creation, Document Workflow, Drafts
- Connected systems: Connected systems
- Archives: Archived documents
- Administration: User accounts, Libraries, Gmail notifications, Audit trails

## Access control scope

The settings control sidebar visibility and the route access checks for those navigation sections. They do not replace finer-grained checks such as document ownership, office scope, or action permissions. The Navigation Access page and all of its routes are available only to Super Admin.
