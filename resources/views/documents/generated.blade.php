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
<div class="metadata"><table>
@foreach (['for' => ($content['recipient_label'] ?? 'FOR') === 'TO' ? 'TO' : 'FOR', 'thru' => 'THRU', 'attention' => 'ATTENTION', 'from' => 'FROM', 'subject' => 'SUBJECT', 'date' => 'DATE'] as $key => $label)
@if (filled($content[$key] ?? null) || filled($content[$key.'_position'] ?? null) || in_array($key, ['from', 'subject']))
<tr><th>{{ $label }}</th><td class="field-colon">:</td><td><div class="field-value {{ in_array($key, ['for', 'thru', 'attention', 'from']) ? 'person-name' : '' }}">{{ $key === 'date' ? \App\Services\DocumentMetadata::displayDate($content[$key] ?? null) : ($content[$key] ?? '') }}</div>@if (in_array($key, ['for', 'thru', 'attention', 'from']) && filled($content[$key.'_position'] ?? null))<div class="position">{{ $content[$key.'_position'] }}</div>@endif</td></tr>
@endif
@endforeach
</table></div>
@if (isset($content['body_document']))
<div class="rich-body">{!! app(\App\Services\RichDocumentContent::class)->html($content['body_document']) !!}</div>
@else
<div class="body">{{ $content['body'] ?? '' }}</div>
@endif
@if (count(array_filter($content['cc'] ?? [])))
<table class="cc"><tr><th>CC</th><td class="field-colon">:</td><td>{{ implode("\n", array_filter($content['cc'])) }}</td></tr></table>
@endif
</body></html>
