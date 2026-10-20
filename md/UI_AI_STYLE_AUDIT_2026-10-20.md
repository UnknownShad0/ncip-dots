# DOTS UI appearance audit

Reviewed October 20, 2026 · Asia/Manila

**Yes: several parts of the interface have a recognizable generated-dashboard appearance. The dashboard is the strongest example, followed by the library navigation and landing pages. The profile screen has a separate, recognizable starter-template appearance.**

This is a design judgment, not proof of who or what wrote the code. Rounded corners, Lucide icons, Tailwind, cards, and status badges are ordinary design tools. The concern is their repeated combination, the amount of decoration relative to useful information, and inconsistent treatment of similar tasks.

**Review coverage**

- Scanned all 28 TSX files under `resources/js/Pages` (25 page files and three profile partials), all four layouts, and shared UI components and styles.
- Checked route wiring and relevant controllers to distinguish visible features from unused components and to understand UI states.
- Visually inspected the running local app: Dashboard, Libraries, Offices, All Documents, the document-details dialog, Profile, and Document creation.
- Other screens and error/success states were assessed from source. This was a desktop spot-check, not a complete mobile, accessibility, interaction, security, or backend audit.
- Existing handoff documents were background context; findings below use current source. Test fixtures, including HRIS employee data, are not evidence of UI authorship.
- This report changes no application behavior.

**Ranked visual findings**

“Strong” means a conspicuous generic/template impression. It is not a probability that AI made the UI. Line references describe the source at review time.

| Rank | Area | Impression | Main reason | Evidence |
|---|---|---|---|---|
| 1 | Dashboard summary and panels | Strong | Colored top borders + tinted pill headings + icons + help buttons + repeated rounded cards | Source and live |
| 2 | Library navigation | Strong | Five large feature-style cards remain above every management table | Source and live |
| 3 | Libraries / Connected systems landing pages | Strong | Navigation cards followed by a large instructional empty-state box | Libraries live; both source |
| 4 | Dashboard copy and help-icon repetition | Strong | Generic introduction, repeated “Open…” links and diagonal arrows, help controls beside nearly every section | Source and live |
| 5 | Profile and older authentication forms | Strong starter-template impression | Default-looking profile blocks, broad empty space, uppercase buttons, generic account copy | Profile live; auth source |
| 6 | Document register | Moderate–strong | Multiple competing colored labels and icon-only row actions, plus another saturated blue heading bar | Source and live |
| 7 | Document detail/history layouts | Moderate | Cards inside a dialog, additional framing around each event, repetitive descriptions | Document details live; related screens source |
| 8 | Mixed styling across modules | Moderate | Different heading scales, casing, buttons, palettes, and modal patterns | Source and live samples |
| 9 | Shared spacing and text scale | Moderate | Presentation-sized spacing competes with working data on desktop | Source and live |
| 10 | Document editor framing | Moderate | Multiple introductory/control bands and extra space before the writing surface | Source and live |
| 11 | Privacy notice presentation | Moderate | Blur, shadow, icon tile, colored header, bordered introduction, nested accordion boxes | Source only |

**1. Dashboard: too many treatments for the same information**

Sources: [Dashboard.tsx:129](../resources/js/Pages/Dashboard.tsx#L129), [summary markup:154](../resources/js/Pages/Dashboard.tsx#L154), [task panels:174](../resources/js/Pages/Dashboard.tsx#L174), [DashboardCharts.tsx:33](../resources/js/Components/DashboardCharts.tsx#L33).

Each summary card combines a four-pixel colored top border, a tinted pill-shaped title, a matching icon, an information button, a large number, rounded corners, and a shadow. The same border treatment returns on Receive a document, Approval tasks, Recent documents, and two analytics panels.

The repeated combination is the strongest “AI-made” visual signal in the system. It gives many surfaces similar emphasis even though receiving documents is a task and an archived total is background information.

**Suggested change:** Keep modern typography and restrained rounded surfaces. Use plain metric labels, remove most decorative top borders, and give the receiving queue the clearest visual priority. Keep colors where they communicate an actual state. The four metrics can remain separate if their presentation becomes quieter.

**Preserve:** The counts have different meanings and can overlap. Do not turn them into a percentage distribution, stacked total, or pie chart.

**2. Library navigation: feature cards used as persistent tabs**

Sources: [LibraryNavigation.tsx:13](../resources/js/Components/LibraryNavigation.tsx#L13), [LibraryLayout.tsx:6](../resources/js/Layouts/LibraryLayout.tsx#L6), [ConnectedSystemNavigation.tsx:11](../resources/js/Components/ConnectedSystemNavigation.tsx#L11), [ConnectedSystemsLayout.tsx:6](../resources/js/Layouts/ConnectedSystemsLayout.tsx#L6).

Offices, Ranges, Document types, Purpose types, and Action types each receive an icon, arrow or “Viewing” label, title, description, border, and substantial padding. These cards stay on the screen after choosing a library.

On the inspected Offices page, the global header, explanatory sentence, five navigation cards, section heading, description, toolbar, and count strip consume most of the initial viewport before the records. The page reads like a product-feature overview even during routine administration.

Connected systems uses the same structure with three cards.

**Suggested change:** Keep descriptive cards on a directory page if useful for discovery. On an individual list, use compact links, tabs, or a section switcher. Give the selected list and its controls more of the available space.

**3. Landing pages: a permanent empty-state appearance**

Sources: [Setup/Index.tsx:5](../resources/js/Pages/Setup/Index.tsx#L5), [ConnectedSystems/Index.tsx:3](../resources/js/Pages/ConnectedSystems/Index.tsx#L3).

After the navigation cards, both landing pages display a large dashed-border box:

- “Choose a library to manage” / “Open a list above…”
- “Choose a connected system” / “Open a system above…”

These are normal navigation pages, but their main content resembles a placeholder or an unfinished empty state. The second instruction repeats what the cards already communicate.

**Suggested change:** Make the directory itself the page content. Remove the extra instruction box or use one short introduction above the links. Do not fill the space with invented statistics or connection badges.

**4. Generic copy, repeated information buttons, and diagonal arrows**

Sources: [Dashboard.tsx:150](../resources/js/Pages/Dashboard.tsx#L150), [receiving controls:176](../resources/js/Pages/Dashboard.tsx#L176), [approval/recent sections:198](../resources/js/Pages/Dashboard.tsx#L198), [InfoTip.tsx:5](../resources/js/Components/InfoTip.tsx#L5).

Examples:

- “Your document workspace” adds little context under “Dashboard.”
- “Open documents” and “Open document creation” repeat destinations already available in navigation.
- `ArrowUpRight` appears on those internal links and even on “Review receipt,” which opens a confirmation flow.
- Every summary card and most dashboard sections have an information button.

The information controls are accessible popovers with real content; they are not all useless. The issue is the repeated visual formula and the need to open help for context that sometimes belongs on the page.

**Suggested change:** Replace the generic introduction with the current office/access scope or a useful task count. Keep shortcuts that demonstrably help the workflow. Remove the diagonal arrow from “Review receipt.” Consolidate simple explanations; retain help for genuinely complex definitions.

**Preserve:** Explain the difference between dashboard totals and the office receiving queue. Keep the analytics filter scope and processing-time methodology available.

**5. Profile: visibly different starter-template styling**

Sources: [Profile/Edit.tsx:22](../resources/js/Pages/Profile/Edit.tsx#L22), [profile information form:37](../resources/js/Pages/Profile/Partials/UpdateProfileInformationForm.tsx#L37), [DeleteUserForm.tsx:58](../resources/js/Pages/Profile/Partials/DeleteUserForm.tsx#L58), [PrimaryButton.tsx:13](../resources/js/Components/PrimaryButton.tsx#L13), [SecondaryButton.tsx:14](../resources/js/Components/SecondaryButton.tsx#L14).

The profile page has three wide white shadowed blocks with narrow forms inside them. It adds `py-12` and additional horizontal padding within a shell that already provides page padding. Buttons use uppercase, widely spaced labels such as “SAVE,” unlike the sentence-case controls elsewhere.

The structure and account copy have a recognizable Laravel/Breeze starter-style appearance. This is stronger evidence of incomplete customization than of AI authorship.

[Register](../resources/js/Pages/Auth/Register.tsx), [ConfirmPassword](../resources/js/Pages/Auth/ConfirmPassword.tsx), and [VerifyEmail](../resources/js/Pages/Auth/VerifyEmail.tsx) also retain older form conventions. Login, ForgotPassword, and ResetPassword have received more custom treatment.

**Suggested change:** Apply the same page spacing, form widths, heading hierarchy, and button language as the workspace. Review generic account-deletion copy against actual account/data behavior before rewriting it; the visual audit does not establish its accuracy.

**6. Documents: repeated pills and an icon-button palette**

Sources: [Documents/Index.tsx:645](../resources/js/Pages/Documents/Index.tsx#L645), [row labels:708](../resources/js/Pages/Documents/Index.tsx#L708), [status/transaction labels:723](../resources/js/Pages/Documents/Index.tsx#L723), [actions:739](../resources/js/Pages/Documents/Index.tsx#L739).

A row can contain a Needs review badge, Urgent badge, Legacy badge, status pill, and a separate last-transaction pill. Available actions appear as a cluster of individually tinted icon buttons. Receive and Forward have accessible labels/tooltips but no visible text in this table.

The saturated blue “Documents” bar also repeats the page’s already prominent blue header. The combined result is visually busy even though the underlying record information is useful.

**Suggested change:** Keep a clear current-status indicator and an unmistakable urgent marker. Present provenance and the latest transaction more quietly. Give the frequent Receive/Forward action a visible label, and place secondary actions consistently. Use a lighter table heading treatment.

**Preserve:** Urgency, legacy restrictions, and review requirements must remain identifiable. Simplify their presentation without hiding their meaning.

**7. Details and history: repeated framing around short content**

Sources: [document details:802](../resources/js/Pages/Documents/Index.tsx#L802), [transaction history:820](../resources/js/Pages/Documents/Index.tsx#L820), [archive details:275](../resources/js/Pages/Archives/Index.tsx#L275), [connected signing details:294](../resources/js/Components/ConnectedDocuments.tsx#L294), [audit entries:188](../resources/js/Pages/AuditTrail/Index.tsx#L188).

The inspected document dialog has a generic title and description, a separately bordered details disclosure, another heading and description for history, a count pill, a timeline rail, and a bordered card with a status pill for each event.

“Review document information and transaction history” and “Document activity in workflow order” repeat the adjacent headings. This layering makes a short history look like a component showcase.

Audit Trail similarly places each event in its own bordered card. That may be useful for long change details, but it makes short events expensive in vertical space.

**Suggested change:** Identify the document prominently in the dialog header. Use a lighter list or timeline for events, with dividers and consistently aligned metadata. Reserve nested panels for meaningful groups or exceptional states.

**8. Several visual systems coexist**

Sources: [AuditTrail/Index.tsx:160](../resources/js/Pages/AuditTrail/Index.tsx#L160), [UserAccounts/Index.tsx:251](../resources/js/Pages/UserAccounts/Index.tsx#L251), [WorkspaceDialog.tsx:5](../resources/js/Components/WorkspaceDialog.tsx#L5), [GuestLayout.tsx:7](../resources/js/Layouts/GuestLayout.tsx#L7), [app.css:54](../resources/css/app.css#L54).

Examples:

- Audit Trail adds an uppercase “System activity” eyebrow, then “Audit Trail,” then “System activity history.” Its content uses literal gray/slate values alongside the shared semantic palette.
- Profile uses the older button and spacing conventions.
- User-account forms use a custom overlay while other management forms use `WorkspaceDialog`.
- Guest pages use a translucent, blurred, heavily shadowed card; the workspace mostly uses solid surfaces.
- Navigation mixes “Generate Document” and “Approved Documents” with sentence-case labels. The linked page calls the first workflow “Document creation.”

Individual differences can be intentional. Together they give the impression of screens assembled at different times without a final design pass.

**Suggested change:** Normalize page titles, sentence case, form actions, dialog headers/footers, and semantic colors. Keep the guest background and official branding if they serve the product; the main need is coherent treatment, not a new visual identity.

**9. Too much space before useful work**

Sources: [tailwind.config.js:15](../tailwind.config.js#L15), [app.css:50](../resources/css/app.css#L50), [AuthenticatedLayout.tsx:82](../resources/js/Layouts/AuthenticatedLayout.tsx#L82), [Profile/Edit.tsx:22](../resources/js/Pages/Profile/Edit.tsx#L22).

The shared font scale defines `text-xs` as 15px, `text-sm` as 17px, and the base as 19px. The expanded desktop sidebar is 300px wide. Large text combines with repeated introductions, substantial panel padding, and multiple heading bands.

On the inspected desktop:

- Offices displayed only a small number of records below the persistent navigation cards.
- Documents required horizontal scrolling to reach its row actions.
- Profile had a large gap before the first form.

Larger text can be an intentional readability requirement. The mismatch is between text size, available width, and the amount of surrounding structure.

**Suggested change:** Remove redundant bands and padding first. Then tune column widths and layout around the intended readable text size. Do not simply shrink all text or focus targets to make more rows fit.

**10. Document creation: useful editor, overframed entrance**

Sources: [DocumentCreation/Index.tsx:615](../resources/js/Pages/DocumentCreation/Index.tsx#L615), [editor wrapper:644](../resources/js/Pages/DocumentCreation/Index.tsx#L644), [template metadata:755](../resources/js/Pages/DocumentCreation/Index.tsx#L755), [paper padding:776](../resources/js/Pages/DocumentCreation/Index.tsx#L776).

The screen stacks a page introduction, a blue-topped editor panel, a title/action row, a template/metadata row, generous paper-area padding, and a separately framed formatting toolbar before the document itself.

“Edit and preview use the same page layout” reads like an implementation explanation. The actual paper-based editor, official header, and document fields are much more specific to DOTS and should remain the focus.

**Suggested change:** Consolidate the control bands and reduce the space before the writing surface. Keep template/page information concise. Keep the page-sized document layout and standard formatting controls.

**11. Privacy notice: many decorative layers**

Sources: [PrivacyNoticeModal.tsx:58](../resources/js/Components/PrivacyNoticeModal.tsx#L58), [introduction and accordions:69](../resources/js/Components/PrivacyNoticeModal.tsx#L69).

The notice uses a blurred overlay, heavy shadow, rounded outer panel, blue header, tinted shield tile, a separately bordered introduction with an accent stripe, an outer accordion box, and individually bordered accordion sections. Its footer adds “Your privacy is important to us.”

This gives a formal reading task the same decorated-card treatment as the dashboard.

**Suggested change:** Simplify the framing and use clear section dividers. Preserve the notice’s approved content and required acknowledgment behavior; this finding is about presentation.

**Functional UI issues found during the scan**

These deserve attention regardless of whether the interface looks generated.

| Issue | Evidence | Suggested correction |
|---|---|---|
| Errors can receive a green success icon | [WorkspaceAlert.tsx:9](../resources/js/Components/WorkspaceAlert.tsx#L9) chooses warning versus success solely from the presence of `onConfirm`. [Documents/Index.tsx:423](../resources/js/Pages/Documents/Index.tsx#L423) and line 436 pass load errors without `onConfirm`. | Add an explicit error/success/info/confirmation variant. This is confirmed by source logic; no failure was deliberately triggered in the browser. |
| Routine saves interrupt work with a modal | [Dashboard.tsx:98](../resources/js/Pages/Dashboard.tsx#L98), [Offices/Index.tsx:136](../resources/js/Pages/Offices/Index.tsx#L136), and [profile form:107](../resources/js/Pages/Profile/Partials/UpdateProfileInformationForm.tsx#L107) open acknowledgment dialogs after ordinary success. | Use a concise inline status or accessible notification for routine success. Retain confirmations where users need to make a consequential decision. |
| Document actions require horizontal scrolling at the inspected desktop size | [Documents/Index.tsx:653](../resources/js/Pages/Documents/Index.tsx#L653), unwrapped tracking identifiers at line 708, and minimum widths on title/transaction/action columns. Confirmed in the live page. | Rebalance columns, allow suitable wrapping, and consider a persistent action column. Verify with realistic long titles and identifiers. |
| Connected-system zero counts do not distinguish empty from unavailable | [IntegrationController.php:44](../app/Http/Controllers/IntegrationController.php#L44), [IplumaController.php:25](../app/Http/Controllers/IplumaController.php#L25), [ConnectedDocuments.tsx:124](../resources/js/Components/ConnectedDocuments.tsx#L124), and [empty state:230](../resources/js/Components/ConnectedDocuments.tsx#L230). Missing configuration and failures can all become `[]`. | Supply explicit connection/load state from the backend. Show “Unavailable” or “Not configured” where appropriate, and reserve zero for a successful empty response. The current explanatory popover is useful but insufficient as the primary state indicator. |

**Module-by-module coverage**

Ratings concern each module’s own content; every authenticated page also inherits the shared shell.

| Module | Assessment | Basis |
|---|---|---|
| Dashboard | Strongest generated-dashboard appearance; prioritize first | Live + source |
| Latest / All Documents | Useful register with excessive labels, saturated headings, and action-density issues | All Documents live; shared source for Latest |
| Document creation | Domain-specific editor; simplify surrounding bands and spacing | Live + source |
| Approved documents / approval queues | Mostly ordinary work lists and decision controls; inherit editor-page styling | Source |
| Drafts | Low–moderate concern: “Drafts,” “Saved drafts,” source heading, and a Draft pill on every row repeat context | [Drafts/Index.tsx:55](../resources/js/Pages/Drafts/Index.tsx#L55) |
| Tracking / generation archives | Mostly task-focused filters and lists; details repeat nested timeline styling | [Archives/Index.tsx:140](../resources/js/Pages/Archives/Index.tsx#L140) |
| Audit Trail | Moderate concern: repeated headings and per-event cards; detailed change information is valuable | [AuditTrail/Index.tsx:158](../resources/js/Pages/AuditTrail/Index.tsx#L158) |
| Libraries / Setup and related landing aliases | Strong concern: repeated cards and an instructional placeholder-style panel | Libraries live + source |
| Offices | Main concern is persistent navigation and excessive pre-table height; table itself is conventional | Live + source |
| Ranges | Same library framing; CRUD form/table itself is conventional | [Ranges/Index.tsx:187](../resources/js/Pages/Ranges/Index.tsx#L187) |
| Document types | Same framing; template assignment is useful domain-specific UI | [DocumentTypes/Index.tsx:200](../resources/js/Pages/DocumentTypes/Index.tsx#L200) |
| Purpose types | Same framing and repeated introductory copy | [PurposeTypes/Index.tsx:187](../resources/js/Pages/PurposeTypes/Index.tsx#L187) |
| Action types | Same framing; ordinary list/form underneath | [ActionTypes/Index.tsx:192](../resources/js/Pages/ActionTypes/Index.tsx#L192) |
| Connected systems directory | Strong placeholder-style landing pattern | Source |
| PDMIS / DRIP / iPluma | Moderate concern: navigation cards, summary strip, multiple document headings; useful shared table and signer details | [ConnectedDocuments.tsx:153](../resources/js/Components/ConnectedDocuments.tsx#L153) |
| Gmail notifications | Low–moderate aesthetic concern; nested setup panel and icon tile, but configuration/status information has a concrete purpose | [GmailIntegration/Index.tsx:24](../resources/js/Pages/GmailIntegration/Index.tsx#L24) |
| User accounts | Low aesthetic concern: straightforward table and HRIS lookup; harmonize modal and controls | [UserAccounts/Index.tsx:180](../resources/js/Pages/UserAccounts/Index.tsx#L180) |
| Profile and its three forms | Strong starter-template appearance | Live + source |
| Login / ForgotPassword / ResetPassword | Weak AI-style signal: custom branded guest screen and ordinary forms; blur/shadow is secondary | [GuestLayout.tsx:5](../resources/js/Layouts/GuestLayout.tsx#L5), [Auth pages](../resources/js/Pages/Auth/) |
| Register / ConfirmPassword / VerifyEmail | Recognizable older starter-form conventions; source alone cannot establish authorship | [Auth pages](../resources/js/Pages/Auth/) |
| Public tracking | Low concern: metadata and a routing timeline match the task; some palette/type differences from the workspace | [PublicTracking/Show.tsx:24](../resources/js/Pages/PublicTracking/Show.tsx#L24) |
| Privacy notice | Moderate decorative layering | Source |
| Alerts / dialogs | Generic icon-tile feedback and inconsistent variants; explicit error-state bug above | Source; document dialog live |
| Document paper / print layouts | Low concern: official letterhead, real document fields, paper sizing, and disposition tables have a specific purpose | [PaginatedDocument.tsx](../resources/js/Components/PaginatedDocument.tsx), [DocumentDispositionPrint.tsx](../resources/js/Components/DocumentDispositionPrint.tsx), [PDF Blade layout](../resources/views/documents/generated.blade.php) |

**What already feels specific and should be kept**

- Official NCIP assets and document stationery.
- Office routing, tracking identifiers, approval/revision work, and clear permission explanations.
- Search, real table columns, meaningful filters, and record history.
- Standard editor toolbar icons: bold, alignment, lists, and tables have established meanings.
- Accessible labels, visible focus, pending/error text, and reduced-motion support in the shared dialog.
- Processing-turnaround methodology, independent workflow counts, and the accessible chart data table.

The unused `ApplicationLogo.tsx` and old `CrudAlertModal.tsx` were not counted as visible UI findings. Active imports named `CrudAlertModal` in several pages actually point to `WorkspaceAlert`.

**Recommended cleanup order**

1. Fix the incorrect alert icon and keep frequent document actions accessible at the intended desktop width.
2. Simplify the dashboard’s summary cards and panel borders; make the receiving task the main focus.
3. Replace persistent library/system feature cards with compact navigation on child pages.
4. Remove duplicate introductory copy and the large landing-page instruction boxes.
5. Standardize buttons, headings, dialogs, status treatments, and page spacing across Profile, Audit Trail, and the workspace.
6. Simplify document-history framing, editor chrome, and privacy-notice decoration.
7. Add explicit connected-system load states with the necessary backend support.

For visual validation, review realistic long records at desktop and laptop widths, then narrow screens; check empty, error, permission-restricted, and busy states. Keep readable text and useful icons. The intended result is a contemporary working application with clearer priorities, not a stripped-down or dated interface.
