<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\DocumentCreationDraft;
use App\Models\DocumentType;
use App\Models\DocumentCreationTemplate;
use App\Models\User;
use App\Services\PdfmeGenerator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class DocumentCreationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $drafts = DocumentCreationDraft::query()->with(['creator:id,name', 'approver:id,name', 'documentType:id,name', 'events.user:id,name'])
            ->where(fn ($q) => $q->where('created_by', $user->id)->orWhere('approver_id', $user->id)->orWhere('verified_by', $user->id))
            ->when($request->query('queue') === 'approval', fn ($q) => $q->where('approver_id', $user->id)->where('status', 'pending_approval'))
            ->when($request->query('queue') === 'submitted', fn ($q) => $q->where('created_by', $user->id)->where('status', 'pending_approval'))
            ->when($request->query('queue') === 'revision', fn ($q) => $q->where('created_by', $user->id)->where('status', 'revision_requested'))
            ->when($request->query('queue') === 'verification', fn ($q) => $q->where('created_by', $user->id)->where('status', 'awaiting_verification'))
            ->latest()->get()
            ->map(function (DocumentCreationDraft $draft) {
                $version = $draft->versions()->where('version_number', $draft->version_number)->first();
                $draft->setAttribute('current_submission', $version ? [
                    'version_number' => $version->version_number,
                    'content' => $version->content,
                    'template_json' => $version->template_json ?? $draft->template?->template_json,
                    'submitted_at' => $version->created_at,
                ] : null);

                return $draft;
            });

        return Inertia::render('DocumentCreation/Index', [
            'drafts' => $drafts,
            'documentTypes' => DocumentType::query()->where('is_active', true)->whereHas('creationTemplate', fn ($query) => $query->where('is_active', true))->with('creationTemplate:id,document_type_id,name,version,template_json,is_active')->orderBy('name')->get(['id', 'name']),
            'approvers' => User::query()->where('is_active', true)->where('id', '<>', $user->id)->orderBy('name')->get(['id', 'name', 'role']),
            'currentUserId' => $user->id,
            'logoDataUri' => 'data:image/png;base64,'.base64_encode(file_get_contents(public_path('images/header.png'))),
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validateDraft($request);
        $this->assertTemplateMatchesType($data['template_id'], $data['document_type_id']);
        $draft = DocumentCreationDraft::create([...$data, 'created_by' => $request->user()->id, 'status' => 'draft']);
        $draft->events()->create(['user_id' => $request->user()->id, 'event' => 'Draft created']);
        return back()->with('success', 'Draft saved.');
    }

    public function update(Request $request, DocumentCreationDraft $draft)
    {
        abort_unless((int) $draft->created_by === (int) $request->user()->id && in_array($draft->status, ['draft', 'revision_requested'], true), 403);
        $data = $this->validateDraft($request);
        $this->assertTemplateMatchesType($data['template_id'], $data['document_type_id']);
        $draft->update([...$data, 'status' => 'draft']);
        $draft->events()->create(['user_id' => $request->user()->id, 'event' => 'Draft updated']);
        return back()->with('success', 'Draft updated.');
    }

    public function submit(Request $request, DocumentCreationDraft $draft)
    {
        abort_unless((int) $draft->created_by === (int) $request->user()->id && in_array($draft->status, ['draft', 'revision_requested'], true), 403);
        $data = $request->validate(['approver_id' => ['required', 'integer', 'exists:users,id']]);
        abort_if((int) $data['approver_id'] === (int) $request->user()->id, 422, 'Choose a different approver.');
        abort_unless(User::query()->whereKey($data['approver_id'])->where('is_active', true)->exists(), 422, 'Choose an active approver.');
        $number = $draft->version_number + 1;
        $template = $draft->template;
        abort_unless($template?->is_active, 422, 'The selected PDF template is no longer active.');
        $contentSnapshot = [...$draft->content, '_logo_data_uri' => 'data:image/png;base64,'.base64_encode(file_get_contents(public_path('images/header.png')))];
        $pdfBytes = app(PdfmeGenerator::class)->generate($template->template_json, $this->pdfInputs($contentSnapshot));
        $fileName = 'version-'.$number.'.pdf';
        $filePath = "document-creation/submitted/{$draft->id}/{$fileName}";
        Storage::disk('local')->put($filePath, $pdfBytes);
        $draft->versions()->create(['version_number' => $number, 'content' => $contentSnapshot, 'template_version' => $template->version, 'template_json' => $template->template_json, 'file_path' => $filePath, 'file_name' => $fileName, 'sha256' => hash('sha256', $pdfBytes), 'created_by' => $request->user()->id]);
        $draft->update(['approver_id' => $data['approver_id'], 'version_number' => $number, 'status' => 'pending_approval', 'submitted_at' => now(), 'decision_at' => null, 'decision_remarks' => null]);
        $draft->events()->create(['user_id' => $request->user()->id, 'event' => 'Submitted for approval', 'metadata' => ['version' => $number]]);
        return back()->with('success', 'Document version submitted for approval.');
    }

    public function decide(Request $request, DocumentCreationDraft $draft)
    {
        abort_unless((int) $draft->approver_id === (int) $request->user()->id && $draft->status === 'pending_approval', 403);
        $data = $request->validate(['decision' => ['required', 'in:approved,revision_requested,rejected'], 'version_number' => ['required', 'integer'], 'remarks' => ['nullable', 'string', 'max:4000']]);
        abort_unless((int) $data['version_number'] === (int) $draft->version_number, 409, 'This submission has changed. Refresh and review the latest version.');
        $nextStatus = $data['decision'] === 'approved' ? 'awaiting_verification' : $data['decision'];
        $draft->update(['status' => $nextStatus, 'decision_at' => now(), 'decision_remarks' => $data['remarks'] ?? null]);
        $draft->events()->create(['user_id' => $request->user()->id, 'event' => ucfirst(str_replace('_', ' ', $data['decision'])), 'remarks' => $data['remarks'] ?? null, 'metadata' => ['version' => $draft->version_number]]);
        return back()->with('success', 'Approval decision recorded.');
    }

    public function verify(Request $request, DocumentCreationDraft $draft)
    {
        abort_unless($this->canAccess($draft, $request), 403);
        abort_unless($draft->status === 'approved' || $draft->status === 'awaiting_verification', 403);
        $data = $request->validate(['returned_file' => ['required', 'file', 'max:20480'], 'result' => ['required', 'in:verified,changes_flagged'], 'notes' => ['nullable', 'string', 'max:4000']]);
        $submittedVersion = $draft->versions()->where('version_number', $draft->version_number)->first();
        $returnedSha256 = hash_file('sha256', $data['returned_file']->getRealPath());
        $path = $data['returned_file']->store('document-creation/returned', 'local');
        $draft->update(['status' => $data['result'] === 'verified' ? 'verified' : 'awaiting_verification', 'verified_file_path' => $path, 'verified_file_name' => $data['returned_file']->getClientOriginalName(), 'verified_by' => $request->user()->id, 'verified_at' => now(), 'verification_result' => $data['result'], 'verification_notes' => $data['notes'] ?? null]);
        $draft->events()->create([
            'user_id' => $request->user()->id,
            'event' => $data['result'] === 'verified' ? 'Final file verified' : 'Differences flagged',
            'remarks' => $data['notes'] ?? null,
            'metadata' => ['submitted_sha256' => $submittedVersion?->sha256, 'returned_sha256' => $returnedSha256, 'byte_identical' => $submittedVersion?->sha256 === $returnedSha256],
        ]);
        return back()->with('success', 'Verification result recorded.');
    }

    public function downloadReturnedFile(Request $request, DocumentCreationDraft $draft)
    {
        abort_unless($this->canAccess($draft, $request), 403);
        abort_unless($draft->verified_file_path, 404);
        return Storage::disk('local')->download($draft->verified_file_path, $draft->verified_file_name);
    }

    public function downloadSubmittedFile(Request $request, DocumentCreationDraft $draft)
    {
        abort_unless($this->canAccess($draft, $request), 403);
        $version = $draft->versions()->where('version_number', $draft->version_number)->firstOrFail();
        abort_unless($version->file_path && Storage::disk('local')->exists($version->file_path), 404);
        return Storage::disk('local')->download($version->file_path, $draft->title.'-version-'.$version->version_number.'.pdf');
    }

    public function register(Request $request, DocumentCreationDraft $draft)
    {
        abort_unless($this->canAccess($draft, $request), 403);
        abort_unless($draft->status === 'verified' && !$draft->official_document_id, 403);
        $officeId = $request->user()->office_id;
        abort_unless($officeId, 422, 'Assign your account to an office before registering this document.');
        $document = DB::transaction(function () use ($request, $draft, $officeId) {
            $filePath = Storage::disk('local')->path($draft->verified_file_path);
            $publicPath = Storage::disk('public')->putFileAs('documents', new \Illuminate\Http\File($filePath), basename($draft->verified_file_path));
            $document = Document::create([
                'title' => $draft->title, 'tracking_number' => 'draft-'.\Illuminate\Support\Str::uuid(),
                'document_type_id' => $draft->document_type_id, 'office_id' => $officeId,
                'created_by' => $draft->created_by, 'status' => 'pending', 'is_finalized' => true,
                'remarks' => 'Created through Document Creation workflow.',
            ]);
            $officeName = $request->user()->office?->name ?: 'DOTS';
            $prefix = trim(preg_replace('/-+/', '-', preg_replace('/\s+/', '-', trim($officeName))), '-');
            $document->update(['tracking_number' => $prefix.'-'.now()->format('y-m-d').'-'.str_pad((string) $document->id, 4, '0', STR_PAD_LEFT)]);
            $document->files()->create(['file_name' => basename($publicPath), 'original_name' => $draft->verified_file_name, 'file_path' => $publicPath, 'mime_type' => mime_content_type(Storage::disk('public')->path($publicPath)), 'size_bytes' => Storage::disk('public')->size($publicPath), 'uploaded_by' => $request->user()->id]);
            $document->trails()->create(['from_office_id' => $officeId, 'created_by' => $request->user()->id, 'status' => 'pending', 'action' => 'Registered from Document Creation']);
            $draft->update(['official_document_id' => $document->id, 'status' => 'registered']);
            $draft->events()->create(['user_id' => $request->user()->id, 'event' => 'Registered in DOTS', 'metadata' => ['document_id' => $document->id]]);
            return $document;
        });
        return back()->with('success', 'Registered as '.$document->tracking_number.'.');
    }

    private function validateDraft(Request $request): array
    {
        $data = $request->validate([
            'document_type_id' => ['required', 'integer', 'exists:document_types,id'],
            'template_id' => ['required', 'integer', 'exists:document_creation_templates,id'],
            'title' => ['required', 'string', 'max:255'],
            'content' => ['required', 'array'],
            'content.for' => ['nullable', 'string', 'max:255'], 'content.thru' => ['nullable', 'string', 'max:255'],
            'content.attention' => ['nullable', 'string', 'max:255'], 'content.from' => ['required', 'string', 'max:255'],
            'content.subject' => ['required', 'string', 'max:255'], 'content.date' => ['required', 'date'],
            'content.body' => ['required', 'string', 'max:50000'], 'content.cc' => ['nullable', 'array'], 'content.cc.*' => ['nullable', 'string', 'max:255'],
        ]);
        $data['content']['cc'] = array_values(array_filter($data['content']['cc'] ?? []));
        return $data;
    }

    private function assertTemplateMatchesType(int $templateId, int $documentTypeId): void
    {
        abort_unless(DocumentCreationTemplate::query()->whereKey($templateId)->where('document_type_id', $documentTypeId)->where('is_active', true)->whereHas('documentType', fn ($query) => $query->where('is_active', true))->exists(), 422, 'Choose the active template assigned to this document type.');
    }

    private function pdfInputs(array $content): array
    {
        return [
            'FOR' => $content['for'] ?? '', 'THRU' => $content['thru'] ?? '',
            'ATTENTION' => $content['attention'] ?? '', 'FROM' => $content['from'] ?? '',
            'SUBJECT' => $content['subject'] ?? '', 'DATE' => $content['date'] ?? '',
            'CONTENT' => $content['body'] ?? '', 'CC' => implode('; ', $content['cc'] ?? []),
            'logo' => $content['_logo_data_uri'] ?? '',
        ];
    }

    private function canAccess(DocumentCreationDraft $draft, Request $request): bool
    {
        return in_array((int) $request->user()->id, [(int) $draft->created_by, (int) $draft->approver_id, (int) $draft->verified_by], true);
    }
}
