<!doctype html>
<html><head><meta charset="utf-8"><style>
@page { size: letter portrait; margin: 1.6667in .65in 1.75in; }
body { font-family: DejaVu Sans, sans-serif; font-size: 11pt; line-height: 1.55; color: #111; }
header { position: fixed; top: -1.1667in; left: 0; right: 0; height: 1in; text-align: center; }
header img { height: 90px; max-width: 100%; }
h1 { text-align: center; margin-bottom: 16px !important; font-size: 14pt; line-height: 1.5; margin: 0; font-weight: 600; }
table { width: 100%; border-collapse: collapse; }
.metadata { padding-bottom: 22px; border-bottom: 1px solid #222; margin-bottom: 26px; }
th { width: 1.1in; text-align: left; vertical-align: top; font-size: 10pt; }
td { padding-left: 16px; vertical-align: top; white-space: pre-wrap; overflow-wrap: break-word; }
th, td { padding-top: 4px; padding-bottom: 4px; }
.body { white-space: pre-wrap; overflow-wrap: break-word; }
.cc { margin-top: 28px; font-size: 10pt; }
footer { position: fixed; bottom: -1.25in; left: 0; right: 0; height: 1.0833in; border-top: 1px solid #b9b9b9; padding-top: 8px; font-size: 6pt; line-height: 1.4; }
footer .seal { position: absolute; top: 12px; left: 0; width: 55px; height: 55px; }
footer .details { margin-left: 67px; }
footer strong { font-size: 7.5pt; }
footer .tagline { height: 17px; max-width: 100%; margin-top: 5px; }
</style></head><body>
<header><img src="{{ $header }}" alt="National Commission on Indigenous Peoples"></header>
<footer>
<img class="seal" src="data:image/png;base64,{{ base64_encode(file_get_contents(public_path('images/bagong-pilipinas.png'))) }}" alt="Bagong Pilipinas">
<div class="details"><strong>NATIONAL COMMISSION ON INDIGENOUS PEOPLES</strong><br>
6th and 7th Floors, Sunnymede IT Center, 1614 Quezon Avenue,<br>South Triangle, Quezon City 1103<br>
(02) 875 1200 · ncip.gov.ph · csc@ncip.gov.ph<br>
<img class="tagline" src="data:image/png;base64,{{ base64_encode(file_get_contents(public_path('images/ncip-footer.png'))) }}" alt="Masaganang Katutubong Pamayanan: Sandigan ng Pambansang Kaunlaran"></div>
</footer>
<h1>{{ $title }}</h1>
<div class="metadata"><table>
@foreach (['for' => 'FOR', 'thru' => 'THRU', 'attention' => 'ATTENTION', 'from' => 'FROM', 'subject' => 'SUBJECT', 'date' => 'DATE'] as $key => $label)
@if (filled($content[$key] ?? null) || in_array($key, ['for', 'from', 'subject', 'date']))
<tr><th>{{ $label }}:</th><td>{{ $content[$key] ?? '' }}</td></tr>
@endif
@endforeach
</table></div>
<div class="body">{{ $content['body'] ?? '' }}</div>
@if (count(array_filter($content['cc'] ?? [])))
<table class="cc"><tr><th>CC:</th><td>{{ implode("\n", array_filter($content['cc'])) }}</td></tr></table>
@endif
</body></html>
