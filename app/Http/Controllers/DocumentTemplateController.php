<?php

namespace App\Http\Controllers;

use App\Models\DocumentCreationTemplate;
use App\Models\DocumentType;
use App\Services\PdfmeGenerator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class DocumentTemplateController extends Controller
{
    public function index()
    {
        return Inertia::render('PdfDesigner/Index', [
            'documentTypes' => DocumentType::query()->where('is_active', true)->with('creationTemplate:id,document_type_id,name,version,is_active')->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function edit(DocumentType $documentType)
    {
        abort_unless($documentType->is_active, 404);
        $template = $documentType->creationTemplate;

        return Inertia::render('PdfDesigner/Edit', [
            'documentType' => $documentType->only(['id', 'name']),
            'templateId' => $template?->id,
            'templateName' => $template?->name ?? $documentType->name.' template',
            'templateVersion' => $template?->version ?? 0,
            'template' => $template?->template_json ?? $this->starterTemplate(),
            'logoUrl' => asset('images/header.png'),
            'saveUrl' => route('document-templates.update', $documentType),
        ]);
    }

    public function update(Request $request, DocumentType $documentType)
    {
        abort_unless($documentType->is_active, 404);
        $data = $request->validate([
            'template_json' => ['required', 'array'],
            'template_json.basePdf' => ['required', 'array'],
            'template_json.basePdf.width' => ['required', 'numeric', 'min:50', 'max:1000'],
            'template_json.basePdf.height' => ['required', 'numeric', 'min:50', 'max:1000'],
            'template_json.basePdf.padding' => ['required', 'array', 'size:4'],
            'template_json.basePdf.padding.*' => ['numeric', 'min:0'],
            'template_json.schemas' => ['required', 'array', 'min:1'],
        ]);

        if (strlen(json_encode($data['template_json'])) > 500_000) {
            throw ValidationException::withMessages(['template_json' => 'The template is too large to save.']);
        }

        $schemas = collect($data['template_json']['schemas'])->flatten(1);
        if ($schemas->isEmpty() || $schemas->count() > 80) {
            throw ValidationException::withMessages(['template_json' => 'A template must contain between 1 and 80 fields.']);
        }
        foreach ($schemas as $schema) {
            if (!is_array($schema)) {
                throw ValidationException::withMessages(['template_json' => 'Every page field must be a valid schema object.']);
            }
            $allowedFields = ['FOR', 'THRU', 'ATTENTION', 'FROM', 'SUBJECT', 'DATE', 'CONTENT', 'CC', 'logo'];
            $type = $schema['type'] ?? null;
            if (!in_array($type, ['text', 'image'], true) || !in_array($schema['name'] ?? null, $allowedFields, true)) {
                throw ValidationException::withMessages(['template_json' => 'Use the standard document field names and text/image field types.']);
            }
            foreach (['name', 'position', 'width', 'height'] as $key) {
                if (!array_key_exists($key, $schema)) {
                    throw ValidationException::withMessages(['template_json' => 'Each field must include a name, position, width, and height.']);
                }
            }
            $position = $schema['position'];
            if (!is_array($position) || !is_numeric($position['x'] ?? null) || !is_numeric($position['y'] ?? null)
                || !is_numeric($schema['width']) || !is_numeric($schema['height'])
                || $position['x'] < 0 || $position['y'] < 0 || $schema['width'] <= 0 || $schema['height'] <= 0
                || $position['x'] + $schema['width'] > $data['template_json']['basePdf']['width']
                || $position['y'] + $schema['height'] > $data['template_json']['basePdf']['height']) {
                throw ValidationException::withMessages(['template_json' => 'Every field must have valid coordinates and fit within the page.']);
            }
            if (($schema['name'] === 'logo') !== ($type === 'image')) {
                throw ValidationException::withMessages(['template_json' => 'The logo must use an image field; other standard fields must use text.']);
            }
        }

        $template = DocumentCreationTemplate::firstOrNew(['document_type_id' => $documentType->id]);
        $template->fill([
            'name' => $documentType->name.' template',
            'version' => $template->exists ? $template->version + 1 : 1,
            'template_json' => $data['template_json'],
            'is_active' => true,
            'created_by' => $request->user()->id,
        ])->save();

        return redirect()->route('document-templates.edit', $documentType)->with('success', 'PDF template saved.');
    }

    public function generate(Request $request, DocumentCreationTemplate $template)
    {
        abort_unless($template->is_active && $template->documentType?->is_active, 404);
        $data = $request->validate(['inputs' => ['required', 'array', 'max:80'], 'inputs.*' => ['nullable', 'string', 'max:50000']]);
        $schemaNames = collect($template->template_json['schemas'] ?? [])->flatten(1)->pluck('name')->filter()->unique();
        $inputs = collect($data['inputs'])->only($schemaNames->all())->all();

        if (isset($inputs['logo'])) {
            $logoPath = public_path('images/header.png');
            $inputs['logo'] = 'data:image/png;base64,'.base64_encode(file_get_contents($logoPath));
        }

        $pdfBytes = app(PdfmeGenerator::class)->generate($template->template_json, $inputs);
        $path = 'pdf-runs/'.Str::uuid().'.pdf';
        Storage::disk('local')->put($path, $pdfBytes);
        return response()->download(Storage::disk('local')->path($path), Str::slug($template->name).'.pdf')->deleteFileAfterSend(true);
    }

    private function starterTemplate(): array
    {
        $fields = [
            ['logo', 'image', 12, 8, 40, 24],
            ['FOR', 'text', 20, 48, 170, 12],
            ['THRU', 'text', 20, 64, 170, 12],
            ['ATTENTION', 'text', 20, 80, 170, 12],
            ['FROM', 'text', 20, 96, 170, 12],
            ['SUBJECT', 'text', 20, 112, 170, 16],
            ['DATE', 'text', 20, 132, 170, 12],
            ['CONTENT', 'text', 20, 150, 170, 85],
            ['CC', 'text', 20, 240, 170, 25],
        ];

        return [
            'basePdf' => ['width' => 210, 'height' => 297, 'padding' => [10, 10, 10, 10]],
            'schemas' => [[...collect($fields)->map(fn ($field) => [
                'name' => $field[0], 'type' => $field[1], 'position' => ['x' => $field[2], 'y' => $field[3]], 'width' => $field[4], 'height' => $field[5],
            ])->all()]],
        ];
    }
}
