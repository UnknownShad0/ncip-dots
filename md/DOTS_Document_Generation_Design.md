# DOTS Document Generation Design

**Status:** For review; this describes a proposed user experience and data flow, not an approved specification.

This note focuses on how a staff member would enter information into a document, how DOTS would generate a dynamic file, and how the user would preview and print it. It complements [DOTS_Document_Creation_Workflow_Proposal.md](DOTS_Document_Creation_Workflow_Proposal.md), which covers approval, verification, and registration.

## 1. User flow

```text
Choose “Create document”
          ↓
Choose a document type
          ↓
DOTS loads the matching approved template and its input fields
          ↓
User fills in the fields and document content
          ↓
User opens a live preview and checks page layout
          ↓
User saves a draft, prints/downloads a PDF, or submits for approval
```

The form and preview should be in one workspace. On a wide screen, show the form beside the preview; on a narrow screen, use **Edit** and **Preview** tabs. Preview updates as the user edits, with a clear print or PDF action.

## 2. Choosing a type and template

The user selects a value from the existing `document_types` library. That library currently describes document categories; it does not by itself contain the layout or fields needed to generate a file. The application therefore needs an explicit mapping from an active document type to an approved generation template.

For example:

| Document type | Generation template | Input fields |
|---|---|---|
| Memorandum | Memorandum v1 | FOR, THRU, ATTENTION, FROM, SUBJECT, DATE, CONTENT, CC |
| Certification | Certification v2 | Recipient, subject, certification text, date, signatory |

If a document type has no active template, show a helpful message and do not silently generate a generic or incorrect document. Template choice and version should be saved on the draft so a later template update does not change an existing draft.

## 3. Friendly way to enter dynamic data

Avoid asking users to edit a blank Word-like page or type placeholder codes such as `{{subject}}`. Instead, DOTS should render a normal form from the selected template’s field definitions.

For the initial template, the fields would be:

| Field | Suggested control | Notes |
|---|---|---|
| FOR | Text input or office/person selector | Use a selector only if the value should come from DOTS office or user records. |
| THRU | Text input or office/person selector | May be optional if the selected document type does not use it. |
| ATTENTION | Text input | Optional, based on office format. |
| FROM | Defaulted from the creator’s office, editable if policy permits | Keep the source value and displayed value clear. |
| SUBJECT | Text input | Usually required; can be used as the draft title. |
| DATE | Date picker | Default to today, but allow editing if backdating is permitted. |
| CONTENT | Large multiline editor | Start with a plain rich-text editor or structured paragraphs; see content recommendation below. |
| CC | Repeatable recipient rows | “Add recipient” lets the user enter several names or offices. |

Required fields, maximum lengths, defaults, and allowed input types should be configured per template. This lets different document types have different fields while keeping the form familiar and guided.

### Recommended CONTENT input for a first version

Use a simple editor that supports paragraphs, bold, italics, numbered lists, and bullet lists. Keep page styling, margins, letterhead, and fixed labels in the approved template rather than allowing each user to redesign the document. This gives users enough flexibility to write the body while keeping generated documents consistent.

If the office needs complex tables, exact Word pagination, or advanced formatting, decide that before choosing the editor or PDF-generation method. A browser preview can differ from Microsoft Word pagination, so the target output format matters.

## 4. How the dynamic file is produced

Each approved template should define two related things:

1. **Input schema:** field names, labels, control types, required/optional status, default values, and validation rules.
2. **Presentation template:** page size, margins, letterhead, fixed text, field positions, typography, and where each field value appears.

The user fills the input schema. DOTS validates and saves the data as structured draft content. The renderer places those values into the selected template. For example, `SUBJECT` is stored as a subject value and inserted into the subject area; the user never edits the internal template token.

The generation record should retain the template ID and version, the structured input values, and each generated output file. When a user edits a draft after generating a PDF, DOTS should make a new version so the earlier submitted version remains identifiable for approval and comparison.

## 5. Preview and print

The preview should show the document as it will be printed, including the values for FOR, THRU, ATTENTION, FROM, SUBJECT, DATE, CONTENT, and CC. Include page boundaries and page numbers when the chosen template needs them. Long content should flow to additional pages instead of being clipped.

The existing disposition form in `resources/js/Pages/Documents/Index.tsx` is a useful local example: it builds a dedicated printable React view, applies print-specific CSS, and invokes the browser print dialog. The generation preview can follow that pattern by rendering a dedicated print layout from the draft data. It should use print styles to hide the app navigation, buttons, and editor, and apply the chosen paper size and margins.

For a first version, the user can select **Print / Save as PDF** and use the browser’s print dialog. If DOTS must produce a downloadable PDF without relying on browser print settings, use a server-side PDF renderer based on the same approved template and validate that the PDF layout matches the preview. The chosen approach should be confirmed against office requirements.

The preview screen should provide:

- **Back to edit** without losing unsaved field values;
- **Save draft**;
- **Print / Save as PDF**;
- **Generate new version** after content changes;
- **Submit for approval** only when required fields are complete.

## 6. Draft, output, and approval relationship

Generated content is not yet an official routed DOTS document. During drafting, retain it as a creation draft and generated file version. On submission, mark the specific generated version as the submitted version. Approval decisions refer to that version. If revisions are requested, the user edits the draft and generates a new version before resubmitting.

After approval and the office’s required final-file verification, registration creates the official `documents` row and attaches the verified final file using the current document file relationship. The official document then enters the existing `document_trails` routing workflow. This preserves the distinction between a generated draft and a document officially tracked by DOTS.

## 7. Suggested screen layout

```text
┌──────────────────────────────┬──────────────────────────────┐
│ Document details             │ Live document preview        │
│                              │                              │
│ Document type [Memorandum ▾] │ FOR: ...                     │
│ FOR           [___________]  │ THRU: ...                    │
│ THRU          [___________]  │ ATTENTION: ...               │
│ ATTENTION     [___________]  │ FROM: ...                    │
│ FROM          [___________]  │ SUBJECT: ...                 │
│ SUBJECT       [___________]  │ DATE: ...                    │
│ DATE          [___________]  │                              │
│ CONTENT       [___________]  │ Body text flows across      │
│               [___________]  │ printable page(s)           │
│ CC            [+ recipient]  │ CC: ...                      │
│                              │                              │
│ [Save draft] [Preview/Print] │ [Print / Save as PDF]        │
└──────────────────────────────┴──────────────────────────────┘
```

On mobile, the editor and preview should be separate tabs or steps rather than squeezed into two columns.

## 8. Data design questions

The implementation will likely need records for templates and template versions, template fields, creation drafts, draft field values, and generated file versions. The exact schema should wait until these decisions are made:

1. Are the generated documents primarily memoranda, letters, certificates, or several formats?
2. Is the required output a printable PDF, editable DOCX, or both?
3. Should users choose an office/person from DOTS, or enter FOR, THRU, ATTENTION, FROM, and CC as free text?
4. Which fields are required for each document type, and can users edit the FROM value?
5. What formatting must CONTENT support (plain paragraphs, rich text, tables, images)?
6. Which paper size, header, footer, fonts, margins, and signature areas are official?
7. Must a generated PDF be byte-for-byte the same in preview and print, or is browser print-to-PDF acceptable?
8. Who can create, approve, publish, and retire templates?

## 9. Suggested first release

Start with one confirmed document type and one approved template. Implement its guided fields, a controlled body editor, draft saving, live print preview, and browser print-to-PDF. Preserve generated versions and link the submitted version to its approval record. Add other document types after staff have reviewed the first output on screen and on paper.

No application code or database migrations have been changed as part of this design note.
