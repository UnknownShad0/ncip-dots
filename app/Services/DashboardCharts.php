<?php

namespace App\Services;

use App\Models\Document;
use App\Models\DocumentType;
use Illuminate\Database\Eloquent\Builder;

class DashboardCharts
{
    // A null office means all offices only when explicitly authorized by the caller.
    public function forOffice(?int $officeId, bool $allOffices = false): array
    {
        $documents = Document::query();
        if (! $allOffices) {
            app(DocumentAccess::class)->scopeForOffices($documents, $officeId === null ? [] : [$officeId]);
        }
        $eligible = (clone $documents)->where('is_archived', false)->where('legacy_needs_review', false);

        return [
            'stats' => [
                'incoming_documents' => (clone $eligible)->whereHas('latestTrail', fn (Builder $trail) => $trail
                    ->whereRaw('LOWER(status) = ?', ['available'])
                    ->when(! $allOffices, fn (Builder $trail) => $trail->where('to_office_id', $officeId)))->count(),
                'pending_documents' => (clone $eligible)->whereHas('latestTrail', fn (Builder $trail) => $trail
                    ->whereRaw('LOWER(status) = ?', ['pending'])
                    ->when(! $allOffices, fn (Builder $trail) => $trail->where('to_office_id', $officeId)))->count(),
                'released_documents' => (clone $documents)->whereHas('trails', fn (Builder $trail) => $trail
                    ->whereRaw('LOWER(status) = ?', ['available'])
                    ->when(! $allOffices, fn (Builder $trail) => $trail->where('from_office_id', $officeId)))->count(),
                'archived_documents' => (clone $documents)->where('is_archived', true)->count(),
            ],
            'documentTypes' => $this->documentTypes($documents),
        ];
    }

    public function documentTypes(Builder $documents): array
    {
        $types = DocumentType::query()->pluck('name', 'id');
        $counts = [];

        foreach ((clone $documents)->selectRaw('document_type_id, COUNT(*) as total')->groupBy('document_type_id')->get() as $row) {
            $name = $types->get($row->document_type_id, 'Unspecified');
            $counts[$name] = ($counts[$name] ?? 0) + (int) $row->total;
        }
        arsort($counts);

        return collect($counts)->map(fn ($count, $name) => ['name' => $name, 'count' => $count])->values()->all();
    }
}
