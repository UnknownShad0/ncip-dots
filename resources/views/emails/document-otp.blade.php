<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>DOTS verification code</title>
    <style>
        @media only screen and (max-width: 640px) {
            .email-shell { width: 100% !important; }
            .email-pad { padding-left: 22px !important; padding-right: 22px !important; }
            .otp-code { font-size: 30px !important; letter-spacing: 7px !important; }
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
                        <td class="email-pad" style="padding:34px 34px 8px;">
                            <span style="display:inline-block; padding:6px 10px; border:1px solid #c4d5ec; border-radius:999px; background:#e6eef9; color:#1852a4; font-size:11px; line-height:14px; font-weight:700; letter-spacing:.8px; text-transform:uppercase;">Secure document access</span>
                            <h1 style="margin:16px 0 0; color:#1c293d; font-size:29px; line-height:36px; font-weight:700;">Verify your DOTS access</h1>
                        </td>
                    </tr>

                    <tr>
                        <td class="email-pad" style="padding:12px 34px 8px; color:#1c293d; font-size:16px; line-height:25px;">
                            <p style="margin:0 0 16px;">Hello {{ $recipientName }},</p>
                            <p style="margin:0;">Enter this one-time verification code on the secure QR tracking page:</p>
                        </td>
                    </tr>

                    <tr>
                        <td class="email-pad" style="padding:20px 34px 10px;">
                            <div style="padding:22px 16px; border:1px solid #b8cae4; border-radius:12px; background:#f4f8fd; text-align:center;">
                                <div style="margin-bottom:9px; color:#5c6c83; font-size:11px; line-height:15px; font-weight:700; letter-spacing:1px; text-transform:uppercase;">Your verification code</div>
                                <div class="otp-code" style="color:#123057; font-family:'Courier New', Courier, monospace; font-size:36px; line-height:44px; font-weight:700; letter-spacing:9px;">{{ $code }}</div>
                                <div style="margin-top:9px; color:#5c6c83; font-size:12px; line-height:18px;">Expires in {{ $expiresMinutes }} minutes</div>
                            </div>
                        </td>
                    </tr>

                    <tr>
                        <td class="email-pad" style="padding:14px 34px 8px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; border:1px solid #d3ddeb; border-radius:10px; border-collapse:separate; overflow:hidden;">
                                <tr>
                                    <td width="145" style="width:145px; padding:11px 14px; border-bottom:1px solid #e4eaf3; background:#f7f9fc; color:#5c6c83; font-size:13px; line-height:20px; font-weight:700;">Tracking number</td>
                                    <td style="padding:11px 14px; border-bottom:1px solid #e4eaf3; color:#1c293d; font-family:'Courier New', Courier, monospace; font-size:14px; line-height:20px; font-weight:700; word-break:break-word;">{{ $trackingNumber }}</td>
                                </tr>
                                <tr>
                                    <td width="145" style="width:145px; padding:11px 14px; background:#f7f9fc; color:#5c6c83; font-size:13px; line-height:20px; font-weight:700;">Requested</td>
                                    <td style="padding:11px 14px; color:#1c293d; font-size:14px; line-height:20px;">{{ $requestedAt }}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td class="email-pad" style="padding:18px 34px 4px;">
                            <div style="padding:14px 16px; border-left:4px solid #b66a00; border-radius:7px; background:#fff4dc; color:#704600; font-size:13px; line-height:21px;">
                                <strong>Keep this code private.</strong> DOTS personnel will never ask you to share it. This code only opens a short-lived session for the document shown above; your DOTS role and office permissions still apply.
                            </div>
                        </td>
                    </tr>

                    <tr>
                        <td class="email-pad" style="padding:18px 34px 30px;">
                            <p style="margin:0 0 18px; color:#5c6c83; font-size:13px; line-height:21px;">If you did not request this code, ignore this email. No document action will occur without the correct code.</p>
                            <div style="padding-top:18px; border-top:1px solid #e4eaf3; color:#6c7b90; font-size:11px; line-height:18px;">
                                This is an automated security message from the NCIP {{ $productName }}. Please do not reply to this email.
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
