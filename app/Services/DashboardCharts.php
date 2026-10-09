<?php

namespace App\Services;

use App\Models\DocumentType;
use App\Support\LegacyDocumentTypeMap;
use Illuminate\Database\Eloquent\Builder;

class DashboardCharts
{
    public function documentTypes(Builder $documents, Builder $legacyDocuments): array
    {
        $types = DocumentType::query()->pluck('name', 'id');
        $legacyTypes = LegacyDocumentTypeMap::typesByLegacyId();
        $counts = [];

        foreach ((clone $documents)->selectRaw('document_type_id, COUNT(*) as total')->groupBy('document_type_id')->get() as $row) {
            $name = $types->get($row->document_type_id, 'Unspecified');
            $counts[$name] = ($counts[$name] ?? 0) + (int) $row->total;
        }
        foreach ((clone $legacyDocuments)->selectRaw('dtId, COUNT(*) as total')->groupBy('dtId')->get() as $row) {
            $name = $legacyTypes->get($row->dtId)?->name ?? 'Unspecified';
            $counts[$name] = ($counts[$name] ?? 0) + (int) $row->total;
        }
        arsort($counts);

        return collect($counts)->map(fn ($count, $name) => ['name' => $name, 'count' => $count])->values()->all();
    }
}
