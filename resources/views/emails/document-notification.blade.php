@php
    $palette = match ($tone) {
        'success' => ['accent' => '#227d51', 'soft' => '#e4f5ec', 'border' => '#b9e4ce'],
        'warning' => ['accent' => '#975b00', 'soft' => '#fff2d4', 'border' => '#f0d28b'],
        'danger' => ['accent' => '#b23035', 'soft' => '#fdeaea', 'border' => '#efc0c2'],
        'receipt' => ['accent' => '#16737a', 'soft' => '#e5f6f6', 'border' => '#b8dddd'],
        default => ['accent' => '#1852a4', 'soft' => '#e6eef9', 'border' => '#c4d5ec'],
    };
@endphp
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>{{ $heading }}</title>
    <style>
        @media only screen and (max-width: 640px) {
            .email-shell { width: 100% !important; }
            .email-pad { padding-left: 22px !important; padding-right: 22px !important; }
            .email-title { font-size: 25px !important; line-height: 31px !important; }
            .email-button { display: block !important; text-align: center !important; }
        }
    </style>
</head>
<body style="margin:0; padding:0; background:#f3f6fb; color:#1c293d; font-family:Arial, Helvetica, sans-serif; -webkit-text-size-adjust:100%;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; mso-hide:all;">
        {{ $preheader }}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background:#f3f6fb;">
        <tr>
            <td align="center" style="padding:30px 12px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" class="email-shell" style="width:600px; max-width:600px; background:#ffffff; border:1px solid #d3ddeb; border-radius:14px; overflow:hidden; box-shadow:0 8px 24px rgba(28,41,61,.08);">
                    <tr>
                        <td class="email-pad" style="padding:24px 34px; background:#123057; border-bottom:4px solid #e68b18;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    @if (is_file($logoPath))
                                        <td width="58" valign="middle" style="width:58px; padding-right:14px;">
                                            <img src="{{ $message->embed($logoPath) }}" width="52" height="52" alt="NCIP" style="display:block; width:52px; height:52px; border:0;">
                                        </td>
                                    @endif
                                    <td valign="middle">
                                        <div style="font-size:12px; line-height:17px; font-weight:700; letter-spacing:1.2px; color:#c8d8ef; text-transform:uppercase;">National Commission on Indigenous Peoples</div>
                                        <div style="margin-top:2px; font-size:20px; line-height:26px; font-weight:700; color:#ffffff;">{{ $productName }}</div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td class="email-pad" style="padding:34px 34px 12px;">
                            <span style="display:inline-block; padding:6px 10px; border:1px solid {{ $palette['border'] }}; border-radius:999px; background:{{ $palette['soft'] }}; color:{{ $palette['accent'] }}; font-size:11px; line-height:14px; font-weight:700; letter-spacing:.8px; text-transform:uppercase;">{{ $label }}</span>
                            <h1 class="email-title" style="margin:16px 0 0; color:#1c293d; font-size:29px; line-height:36px; font-weight:700;">{{ $heading }}</h1>
                        </td>
                    </tr>

                    <tr>
                        <td class="email-pad" style="padding:12px 34px 8px; color:#1c293d; font-size:16px; line-height:25px;">
                            <p style="margin:0 0 16px;">Hello {{ $recipientName }},</p>
                            <p style="margin:0;">{{ $intro }}</p>
                        </td>
                    </tr>

                    @if ($details !== [])
                        <tr>
                            <td class="email-pad" style="padding:20px 34px 8px;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; border:1px solid #d3ddeb; border-radius:10px; border-collapse:separate; overflow:hidden;">
                                    @foreach ($details as $detail)
                                        <tr>
                                            <td valign="top" width="145" style="width:145px; padding:11px 14px; border-bottom:{{ $loop->last ? '0' : '1px solid #e4eaf3' }}; background:#f7f9fc; color:#5c6c83; font-size:13px; line-height:20px; font-weight:700;">{{ $detail['label'] }}</td>
                                            <td valign="top" style="padding:11px 14px; border-bottom:{{ $loop->last ? '0' : '1px solid #e4eaf3' }}; color:#1c293d; font-size:14px; line-height:20px; font-weight:600; word-break:break-word;">{{ $detail['value'] }}</td>
                                        </tr>
                                    @endforeach
                                </table>
                            </td>
                        </tr>
                    @endif

                    @if (filled($remarks))
                        <tr>
                            <td class="email-pad" style="padding:18px 34px 4px;">
                                <div style="padding:16px 18px; border-left:4px solid {{ $palette['accent'] }}; border-radius:6px; background:{{ $palette['soft'] }};">
                                    <div style="margin-bottom:5px; color:{{ $palette['accent'] }}; font-size:12px; line-height:17px; font-weight:700; letter-spacing:.4px; text-transform:uppercase;">{{ $remarksLabel ?: 'Remarks' }}</div>
                                    <div style="color:#1c293d; font-size:14px; line-height:22px;">{!! nl2br(e($remarks)) !!}</div>
                                </div>
                            </td>
                        </tr>
                    @endif

                    @if (filled($closing))
                        <tr>
                            <td class="email-pad" style="padding:18px 34px 4px; color:#1c293d; font-size:15px; line-height:24px;">
                                <p style="margin:0;">{{ $closing }}</p>
                            </td>
                        </tr>
                    @endif

                    @if (filled($actionLabel) && filled($actionUrl))
                        <tr>
                            <td class="email-pad" style="padding:22px 34px 8px;">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                    <tr>
                                        <td bgcolor="{{ $palette['accent'] }}" style="border-radius:8px;">
                                            <a href="{{ $actionUrl }}" class="email-button" style="display:inline-block; padding:13px 20px; border:1px solid {{ $palette['accent'] }}; border-radius:8px; background:{{ $palette['accent'] }}; color:#ffffff; font-size:15px; line-height:20px; font-weight:700; text-decoration:none;">{{ $actionLabel }}</a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    @endif

                    @if (filled($notice))
                        <tr>
                            <td class="email-pad" style="padding:20px 34px 4px;">
                                <div style="padding:13px 15px; border:1px solid #d3ddeb; border-radius:8px; background:#f7f9fc; color:#5c6c83; font-size:12px; line-height:19px;">{{ $notice }}</div>
                            </td>
                        </tr>
                    @endif

                    <tr>
                        <td class="email-pad" style="padding:28px 34px 30px;">
                            <div style="padding-top:18px; border-top:1px solid #e4eaf3; color:#6c7b90; font-size:11px; line-height:18px;">
                                This is an automated message from the NCIP {{ $productName }}. Please do not reply to this email.
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
