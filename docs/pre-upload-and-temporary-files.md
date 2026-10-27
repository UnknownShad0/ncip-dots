# Pre-Upload and Temporary Files

**Status:** Implemented 2026-10-27

This guide explains the pre-upload feature in plain language: what happens to a file, why the app temporarily stores it, and what users gain from uploading before submitting a form.

## What is pre-upload?

With a normal form upload, selecting a file only keeps it in the browser. The browser sends the file after the user submits the form.

With **pre-upload**, selecting or dropping a file starts sending it to the server right away. The form can stay open while the file uploads, and the user can see its progress before submitting.

Pre-upload does not make the internet transfer faster. It shows the transfer earlier and lets the user do other form work while it runs.

## Simple flow

```text
Choose or drop a file
        |
        v
Upload starts and progress appears
        |
        +--> User fills in the form
        |
        v
Upload finishes; a temporary file is ready
        |
        v
User submits the form
        |
        v
The app attaches the temporary file to the document
```

If the user removes the file, the app requests deletion of its temporary copy. If the user leaves the form, the temporary copy expires and is cleaned up.

## What is a temporary upload?

The file needs a safe place on the server before the document or workflow action has been submitted. The app saves it in **private temporary storage** and creates a short-lived record with an unguessable token. That record identifies the file and its owner, purpose, and expiration time.

The token is a temporary reference. It is not a public download link. On final submission, the server checks that the token belongs to the signed-in user, matches the expected upload purpose and document, has not expired, and still points to an existing file. The server then runs its normal file checks and attaches the file to the document.

If final submission fails validation, the temporary upload remains available so the user can correct the form and submit again.

## Where pre-upload is used

In the authenticated **Documents** page, pre-upload currently covers:

- A new routing record's source file.
- Supporting files added to a new routing record.
- A replacement file when editing a draft.
- A new document version when forwarding a document.
- A wet-signed PDF uploaded during approval.

The separate public QR tracking page retains its existing direct-upload flow.

## Advantages

- **Progress appears before submission.** Users can see a large PDF moving to the server instead of waiting after clicking Submit.
- **Upload overlaps with form work.** Users can enter details while the file transfers.
- **Upload problems appear sooner.** A failed upload can be retried before the user submits the form.
- **The final form request is smaller.** It sends a temporary upload token instead of sending the same file again.
- **An unfinished form does not create a document record.** The document or workflow action is created only after the user submits.

## Disadvantages and tradeoffs

- **More moving parts.** Pre-upload needs a temporary-upload endpoint, tokens, a database table, and cleanup.
- **Temporary storage is used before submission.** Abandoned forms leave files until they expire and cleanup runs.
- **The scheduler must run.** The app schedules expired-file cleanup hourly. The deployed environment must run Laravel's scheduler for that cleanup schedule to execute.
- **Progress is not resumable.** This implementation uses a regular upload request, not chunked or resumable uploads. If the connection fails, the user retries the file from the beginning.
- **It does not increase transfer speed.** Connection speed and server limits still determine how long the upload takes.

## Why temporary storage matters

When the file uploads, the user may still cancel the form, close the page, or encounter a validation error. The app cannot yet treat that file as a final document attachment.

Temporary storage lets the app:

1. Show upload progress before form submission.
2. Keep the uploaded file available while the form is completed or corrected.
3. Attach it only after the final request passes authorization and validation.
4. Delete it if the user removes it, or after it expires if the form is abandoned.

## Safety and validation

- Temporary files are stored on the private document disk.
- Temporary upload records are tied to the signed-in user.
- Tokens are checked against the upload purpose and, where applicable, the document ID.
- File type and size are checked during pre-upload and again during final submission.
- Temporary records expire after six hours.
- The cleanup command is `php artisan document-uploads:clean-expired`; Laravel's scheduler runs it hourly when the scheduler is configured.
- A user can have up to ten unexpired temporary uploads at one time.

## Try it

1. Open **Documents → New Routing Record**.
2. Choose or drop a large PDF into **Source file**.
3. Watch the progress bar start before you submit the form.
4. While it uploads, fill in the document details.
5. Wait for **Uploaded and ready to submit**, then create the routing record.
6. Try removing a selected file and confirm it disappears from the form. Select another file and retry an upload if one fails.

Supporting files, forwarded versions, and signed PDFs show their own pre-upload progress in their respective forms.

## Implementation notes

The authenticated upload endpoint is `POST /document-uploads`; the matching owner-only cancellation endpoint is `DELETE /document-uploads/{token}`. Final document actions submit the token and attach the staged file through the existing validation and storage flow. The temporary-upload database migration must be applied in each environment before using this feature.
