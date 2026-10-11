<?php

// Local-only, idempotent visual fixture. Never modifies existing business records.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\{Document, DocumentCreationDraft, DocumentType, Office, User};
use Illuminate\Support\Facades\DB;

if (! app()->environment('local')) {
    throw new RuntimeException('This visual fixture is restricted to the local environment.');
}
$office = Office::findOrFail(320);
if (trim($office->short_name) !== 'OSESSC -SCD') {
    throw new RuntimeException('Expected OSESSC -SCD office.');
}
$actors = User::where('office_id', $office->id)->where('is_active', true)->where('role_id', 3)->orderBy('id')->limit(2)->get();
if ($actors->count() < 2) throw new RuntimeException('Two office users are required for this demo.');
$type = DocumentType::firstOrFail();
$marker = '[DEMO ONLY] Processing Performance OSESSC-SCD';
$note = 'Synthetic local graph fixture, not an actual document or user decision. Safe to identify for later cleanup.';
$result = DB::transaction(function () use ($office, $actors, $type, $marker, $note) {
    $document = Document::withTrashed()->where('tracking_number', 'DEMO-PERF-SCD-20261011')->first();
    if (! $document) {
        $document = Document::create([
            'title' => $marker.' - Tracking', 'tracking_number' => 'DEMO-PERF-SCD-20261011',
            'office_id' => $office->id, 'created_by' => $actors[0]->id, 'document_type_id' => $type->id,
            'status' => 'terminal', 'is_archived' => true, 'is_finalized' => true,
            'notify_by_email' => false, 'received_at' => '2026-10-05 01:00:00', 'remarks' => $note,
        ]);
        foreach ([
            ['pending', 'Received', '2026-10-05 01:00:00', $office->id],
            ['available', 'Released - Demo only', '2026-10-07 01:00:00', null],
            ['terminal', 'Demo fixture archived', '2026-10-07 01:00:01', null],
        ] as [$status, $action, $time, $to]) {
            $trail = $document->trails()->make(['from_office_id' => $office->id, 'to_office_id' => $to,
                'created_by' => $actors[0]->id, 'status' => $status, 'action' => $action, 'remarks' => $note]);
            $trail->forceFill(['created_at' => $time, 'updated_at' => $time])->save();
        }
    }
    $draft = DocumentCreationDraft::where('title', $marker.' - Approval')->first();
    if (! $draft) {
        $draft = DocumentCreationDraft::create([
            'title' => $marker.' - Approval', 'document_type_id' => $type->id,
            'created_by' => $actors[0]->id, 'approver_office_id' => $office->id,
            'decided_by' => $actors[1]->id, 'content' => ['demo_only' => true, 'note' => $note],
            'status' => 'rejected', 'version_number' => 1, 'decision_remarks' => $note,
            'submitted_at' => '2026-10-05 01:00:00', 'decision_at' => '2026-10-08 01:00:00',
        ]);
        foreach ([
            ['Submitted for approval', '2026-10-05 01:00:00', $actors[0]->id],
            ['Rejected', '2026-10-08 01:00:00', $actors[1]->id],
        ] as [$event, $time, $actor]) {
            $record = $draft->events()->make(['event' => $event, 'user_id' => $actor, 'remarks' => $note,
                'metadata' => ['version' => 1, 'approver_office_id' => $office->id, 'demo_only' => true]]);
            $record->forceFill(['created_at' => $time, 'updated_at' => $time])->save();
        }
    }
    return ['document_id' => $document->id, 'draft_id' => $draft->id];
});
echo json_encode(['demo_records' => $result, 'performance' => app(App\Services\ProcessingPerformance::class)->forOffice($office->id)], JSON_PRETTY_PRINT).PHP_EOL;
