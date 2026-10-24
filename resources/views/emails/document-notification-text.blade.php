{{ strtoupper($label) }}

{{ $heading }}

Hello {{ $recipientName }},

{{ $intro }}
@if ($details !== [])

@foreach ($details as $detail)
{{ $detail['label'] }}: {{ $detail['value'] }}
@endforeach
@endif
@if (filled($remarks))

{{ $remarksLabel ?: 'Remarks' }}:
{{ $remarks }}
@endif
@if (filled($closing))

{{ $closing }}
@endif
@if (filled($actionLabel) && filled($actionUrl))

{{ $actionLabel }}:
{{ $actionUrl }}
@endif
@if (filled($notice))

{{ $notice }}
@endif

---
This is an automated message from the NCIP {{ $productName }}. Please do not reply to this email.
