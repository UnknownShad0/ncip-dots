<!doctype html>
<html><head><meta charset="utf-8"><style>
@page { size: letter portrait; margin: 1.6667in .65in 1.75in; }
body { font-family: DejaVu Sans, sans-serif; font-size: 11pt; line-height: 1.55; color: #111; }
header { position: fixed; top: -1.1667in; left: 0; right: 0; height: 1in; text-align: center; }
@if (isset($template) && ! $template['repeat_header'])
header { position: absolute; }
@endif
header .full-header { height: 90px; max-width: 100%; }
.header-layout { width:100%; border-collapse:collapse; }
.header-layout td { vertical-align:middle; text-align:center; padding:0; }
.header-layout .logo-cell { width:75px; }
.header-layout img { max-height:70px; max-width:70px; }
.header-layout .header-text { font-size:10pt; padding:0 10px; }
.header-layout .header-text div:nth-child(2) { font-weight:bold; }
h1 { text-align: center; margin: 0 0 16px; font-size: 14pt; line-height: 1.5; font-weight: bold; }
.metadata { padding-bottom: 22px; border-bottom: 1px solid #222; margin-bottom: 26px; }
.metadata table, table.cc { width: 100%; border-collapse: collapse; }
.metadata th, .cc th { width: 1.1in; text-align: left; vertical-align: top; font-size: 10pt; }
.metadata td, .cc td { padding-left: 16px; vertical-align: top; white-space: pre-wrap; overflow-wrap: break-word; }
.metadata th, .metadata td, .cc th, .cc td { padding-top: 4px; padding-bottom: 4px; }
.body { white-space: pre-wrap; overflow-wrap: break-word; }
.rich-body { white-space: normal; overflow-wrap: break-word; }
.rich-body p { margin:0 0 9pt; white-space:pre-wrap; word-wrap:break-word; }
.rich-body h2 { font-size:14pt; margin:12pt 0 8pt; page-break-after:avoid; }
.rich-body h3 { font-size:12pt; margin:10pt 0 6pt; page-break-after:avoid; }
.rich-body ul, .rich-body ol { padding-left:24pt; margin:0 0 10pt; }
.rich-body li p { margin-bottom:4pt; }
.rich-table { width:100%; border-collapse:collapse; table-layout:fixed; margin:10pt 0; }
.rich-table th, .rich-table td { border:1px solid #aeb7c2; padding:5pt; vertical-align:top; text-align:left; word-wrap:break-word; }
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
<div class="details"><strong>NATIONAL COMMISSION ON INDIGENOUS PEOPLES</strong><br>
6th and 7th Floors, Sunnymede IT Center, 1614 Quezon Avenue,<br>South Triangle, Quezon City 1103<br>
(02) 875 1200 · ncip.gov.ph · csc@ncip.gov.ph<br>
<img class="tagline" src="{{ $template['footer_tagline']['src'] ?? 'data:image/png;base64,'.base64_encode(file_get_contents(public_path('images/ncip-footer.png'))) }}" alt="Masaganang Katutubong Pamayanan: Sandigan ng Pambansang Kaunlaran"></div>
</footer>
<h1>{{ $title }}</h1>
<div class="metadata"><table>
@foreach (['for' => 'FOR', 'thru' => 'THRU', 'attention' => 'ATTENTION', 'from' => 'FROM', 'subject' => 'SUBJECT', 'date' => 'DATE'] as $key => $label)
@if (filled($content[$key] ?? null) || in_array($key, ['for', 'from', 'subject', 'date']))
<tr><th>{{ $label }}:</th><td>{{ $content[$key] ?? '' }}</td></tr>
@endif
@endforeach
</table></div>
@if (isset($content['body_document']))
<div class="rich-body">{!! app(\App\Services\RichDocumentContent::class)->html($content['body_document']) !!}</div>
@else
<div class="body">{{ $content['body'] ?? '' }}</div>
@endif
@if (count(array_filter($content['cc'] ?? [])))
<table class="cc"><tr><th>CC:</th><td>{{ implode("\n", array_filter($content['cc'])) }}</td></tr></table>
@endif
</body></html>
