<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face { font-family: Arial; font-style: normal; font-weight: 400; src: url("{{ storage_path('app/private/fonts/arial/Arial.ttf') }}") format("truetype"); }
@font-face { font-family: Arial; font-style: normal; font-weight: 700; src: url("{{ storage_path('app/private/fonts/arial/Arial-Bold.ttf') }}") format("truetype"); }
@font-face { font-family: Arial; font-style: italic; font-weight: 400; src: url("{{ storage_path('app/private/fonts/arial/Arial-Italic.ttf') }}") format("truetype"); }
@font-face { font-family: Arial; font-style: italic; font-weight: 700; src: url("{{ storage_path('app/private/fonts/arial/Arial-BoldItalic.ttf') }}") format("truetype"); }
@page { size: letter portrait; margin: 1.71875in .65in 1.75in; }
body { margin:0; padding:0; font-family: Arial, sans-serif; font-size: 11pt; font-weight:400; line-height: 1.55; color: #111; }
header { position: fixed; top: -1.21875in; left: 0; right: 0; height: 1in; text-align: center; }
header .full-header { height: 90px; max-width: 100%; }
.header-layout { width:100%; border-collapse:collapse; }
.header-layout td { vertical-align:middle; text-align:center; padding:0; }
.header-layout .logo-cell { width:75px; }
.header-layout img { max-height:70px; max-width:70px; }
.header-layout .header-text { font-size:10pt; padding:0 10px; }
.header-layout .header-text div:nth-child(2) { font-weight:bold; }
.metadata { padding-bottom: 24px; border-bottom: 1px solid #222; margin-bottom: 26px; }
.letter-metadata { padding-bottom:0; border-bottom:0; margin-bottom:0; }
.metadata table, table.cc { width: 100%; border-collapse: collapse; }
.metadata th, .metadata td { padding:0; }
.metadata th, .cc th { width: 106px; text-align: left; vertical-align: top; font-size: 11pt; font-weight:bold; line-height:1.3; }
.metadata td, .cc td { padding-left: 36px; vertical-align: top; white-space: pre-wrap; overflow-wrap: break-word; }
.metadata th, .metadata td, .cc th, .cc td { padding-top: 4px; padding-bottom: 4px; }
.metadata td.field-colon, .cc td.field-colon { width:8px; padding-left:30px; font-size:11pt; font-weight:bold; line-height:1.3; }
/* Match the editor's input boxes and 8px field gap, not just their text lines.
   PDF min-height is content-box: name 26 + 4 padding = 30px; position = 22px.
   The final 8px cell gap plus 24px below the table matches the 32px divider gap. */
.metadata th { padding-top:4px; padding-bottom:8px; }
.metadata td { padding-top:0; padding-bottom:8px; white-space:normal; }
.metadata td.field-colon { padding-top:4px; }
.metadata .field-value { min-height:23px; padding:4px 6px 4px 0; font-weight:bold; white-space:pre-wrap; }
.metadata .person-name { min-height:26px; padding-bottom:0; font-size:11pt; line-height:1.3; }
.metadata .position { min-height:22px; padding-right:6px; font-size:10pt; font-weight:normal; line-height:1.25; margin:0; white-space:pre-wrap; }
.letter-date { margin:0 0 22px auto; max-width:48%; text-align:right; font-weight:normal; }
.letter-subject { font-weight:bold; }
.letter-divider { margin-top:22px; }
.signature-list { display:grid; gap:16px 24px; margin-top:24px; }
.signature-block { min-width:0; text-align:left; page-break-inside:avoid; break-inside:avoid; }
.signature-space { height:56px; }
.signature-name { max-width:100%; min-height:23px; font-weight:bold; white-space:pre-wrap; }
.signature-position { max-width:100%; min-height:22px; font-size:10pt; white-space:pre-wrap; }
.body { white-space: pre-wrap; overflow-wrap: break-word; }
.rich-body { white-space: normal; overflow-wrap: break-word; }
.rich-body p { margin:0 0 9pt; white-space:pre-wrap; word-wrap:break-word; }
.rich-body h2 { font-size:14pt; margin:16px 0 10px; page-break-after:avoid; }
.rich-body h3 { font-size:12pt; margin:12px 0 8px; page-break-after:avoid; }
.rich-body ul, .rich-body ol { padding-left:28px; margin:0 0 12px; }
.rich-body li p { margin-bottom:5px; }
.rich-table { width:100%; border-collapse:collapse; table-layout:fixed; margin:14px 0; }
.rich-table th, .rich-table td { border:1px solid #aeb7c2; padding:7px; vertical-align:top; text-align:left; word-wrap:break-word; }
.rich-table th { background:#edf0f4; font-weight:bold; }
.rich-table p { margin:0; }
.rich-table thead { display:table-header-group; }
.rich-table tr { page-break-inside:avoid; }
.rich-table .continuation-row td { border-top-style:dashed; }
.cc { margin-top: 28px; font-size: 10pt; }
footer { position: fixed; bottom: -1.25in; left: 0; right: 0; height: 1.0833in; border-top: 1px solid #b9b9b9; padding-top: 8px; font-size: 6pt; line-height: 1.4; }
footer .seal { position: absolute; top: 12px; left: 0; width: 55px; height: 55px; }
footer .details { margin-left: 67px; }
footer strong { font-size: 7.5pt; }
footer .tagline { height: 17px; max-width: 100%; margin-top: 5px; }
</style></head><body>
<header>
@if (isset($template) && $template['header_mode'] === 'logos')
<table class="header-layout"><tr>
<td class="logo-cell"><img src="{{ $template['header_images'][0]['src'] }}" alt="{{ $template['header_images'][0]['alt'] }}"></td>
<td class="header-text">@foreach ($template['header_text'] as $line)<div>{{ $line }}</div>@endforeach</td>
<td class="logo-cell">@if (isset($template['header_images'][1]))<img src="{{ $template['header_images'][1]['src'] }}" alt="{{ $template['header_images'][1]['alt'] }}">@endif</td>
</tr></table>
@else
<img class="full-header" src="{{ $template['header_images'][0]['src'] ?? $header }}" alt="{{ $template['header_images'][0]['alt'] ?? 'National Commission on Indigenous Peoples' }}">
@endif
</header>
<footer>
<img class="seal" src="{{ $template['footer_seal']['src'] ?? 'data:image/png;base64,'.base64_encode(file_get_contents(public_path('images/bagong-pilipinas.png'))) }}" alt="Bagong Pilipinas">
<div class="details"><strong>{{ $content['footer_office_name'] ?? 'NATIONAL COMMISSION ON INDIGENOUS PEOPLES' }}</strong><br>
6th and 7th Floors, Sunnymede IT Center, 1614 Quezon Avenue,<br>South Triangle, Quezon City 1103<br>
(02) 875 1200 · ncip.gov.ph · csc@ncip.gov.ph<br>
<img class="tagline" src="{{ $template['footer_tagline']['src'] ?? 'data:image/png;base64,'.base64_encode(file_get_contents(public_path('images/ncip-footer.png'))) }}" alt="Masaganang Katutubong Pamayanan: Sandigan ng Pambansang Kaunlaran"></div>
</footer>
@php
$pageTemplate = ($content['page_template'] ?? 'memo') === 'letter' ? 'letter' : 'memo';
// Visibility: explicit show_* flags win (this is what the editor sends). Documents
// saved before the flags existed keep the old always-visible core fields.
$flag = fn (string $key, bool $fallback): bool => array_key_exists($key, $content) && $content[$key] !== null ? (bool) $content[$key] : $fallback;
$shown = [
    'for' => $flag('show_for', true),
    'thru' => $flag('show_thru', filled($content['thru'] ?? null) || filled($content['thru_position'] ?? null)),
    'attention' => $flag('show_attention', filled($content['attention'] ?? null) || filled($content['attention_position'] ?? null)),
    'from' => $flag('show_from', true),
    'subject' => $flag('show_subject', true),
    'date' => $flag('show_date', true),
];
$recipientLabel = ($content['recipient_label'] ?? 'FOR') === 'TO' ? 'TO' : 'FOR';
$recipients = collect(is_array($content['recipients'] ?? null) && count($content['recipients'])
    ? $content['recipients']
    : [['name' => $content['for'] ?? '', 'position' => $content['for_position'] ?? '']])->values();
$rowKeys = array_values(array_filter(
    $pageTemplate === 'letter' ? ['for', 'from', 'subject'] : ['for', 'thru', 'attention', 'from', 'subject', 'date'],
    fn ($key) => $shown[$key],
));
@endphp
@if ($pageTemplate === 'letter' && $shown['date'])
<div class="letter-date">{{ \App\Services\DocumentMetadata::displayDate($content['date'] ?? null) }}</div>
@endif
<div class="metadata {{ $pageTemplate === 'letter' ? 'letter-metadata' : '' }}"><table>
@foreach ($rowKeys as $key)
@if ($key === 'for')
@foreach ($recipients as $index => $recipient)
<tr><th>{{ $index === 0 ? $recipientLabel : '' }}</th><td class="field-colon">{{ $index === 0 ? ':' : '' }}</td><td><div class="field-value person-name">{{ $recipient['name'] ?? '' }}</div><div class="position">{{ $recipient['position'] ?? '' }}</div></td></tr>
@endforeach
@else
<tr><th>{{ strtoupper($key) }}</th><td class="field-colon">:</td><td><div class="field-value {{ in_array($key, ['thru', 'attention', 'from']) ? 'person-name' : '' }} {{ $pageTemplate === 'letter' && $key === 'subject' ? 'letter-subject' : '' }}">{{ $key === 'date' ? \App\Services\DocumentMetadata::displayDate($content[$key] ?? null) : ($content[$key] ?? '') }}</div>@if (in_array($key, ['thru', 'attention', 'from']))<div class="position">{{ $content[$key.'_position'] ?? '' }}</div>@endif</td></tr>
@endif
@endforeach
</table></div>
@if ($pageTemplate === 'letter')<hr class="letter-divider">@endif
@if (isset($content['body_document']))
<div class="rich-body">{!! app(\App\Services\RichDocumentContent::class)->html($content['body_document']) !!}</div>
@else
<div class="body">{{ $content['body'] ?? '' }}</div>
@endif
@php
$legacySignature = !empty($content['show_signature_block']) || filled($content['signature_name'] ?? null) || filled($content['signature_position'] ?? null);
$signatureBlocks = is_array($content['signature_blocks'] ?? null) ? array_values($content['signature_blocks']) : ($legacySignature ? [['name' => $content['signature_name'] ?? '', 'position' => $content['signature_position'] ?? '']] : []);
$showSignatures = $flag('show_signature', count($signatureBlocks) > 0);
$sides = ['left', 'center', 'right'];
$counters = ['left' => 0, 'center' => 0, 'right' => 0];
// Same side => stacked. Row = number of earlier blocks on that side. Old blocks without
// `align` alternate left/right, the same as the old 2-column grid.
$placed = collect($signatureBlocks)->values()->map(function ($block, $index) use (&$counters, $sides) {
    $align = in_array($block['align'] ?? null, $sides, true) ? $block['align'] : ($index % 2 ? 'right' : 'left');
    return ['name' => $block['name'] ?? '', 'position' => $block['position'] ?? '', 'align' => $align, 'row' => ++$counters[$align]];
});
$wideSignatures = $placed->contains(fn ($block) => $block['align'] !== 'left');
$orderedSignatures = $placed->sortBy(fn ($block) => $block['row'] * 10 + array_search($block['align'], $sides))->values();
@endphp
@if ($showSignatures && count($signatureBlocks))
@if ($pageTemplate === 'letter')<div>Sincerely,</div>@endif
<section class="signature-list" style="grid-template-columns: {{ $wideSignatures ? 'repeat(3,minmax(0,1fr))' : 'minmax(0,1fr)' }};">
@foreach ($orderedSignatures as $signature)
<div class="signature-block" style="grid-column: {{ $wideSignatures ? array_search($signature['align'], $sides) + 1 : 1 }}; grid-row: {{ $signature['row'] }};">
<div class="signature-space"></div>
<div class="signature-name">{{ $signature['name'] ?? '' }}</div>
<div class="signature-position">{{ $signature['position'] ?? '' }}</div>
</div>
@endforeach
</section>
@endif
@php
$ccLines = array_filter($content['cc'] ?? [], fn ($line) => trim((string) $line) !== '');
$showCc = $flag('show_cc', count($ccLines) > 0);
@endphp
@if ($showCc)
<table class="cc"><tr><th>CC</th><td class="field-colon">:</td><td>{{ implode("\n", $ccLines) }}</td></tr></table>
@endif
</body></html>
