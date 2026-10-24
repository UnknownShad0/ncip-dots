<?php

return [
    'otp_ttl_minutes' => (int) env('QR_DOCUMENT_OTP_TTL_MINUTES', 10),
    'session_ttl_minutes' => (int) env('QR_DOCUMENT_SESSION_TTL_MINUTES', 20),
    'max_attempts' => (int) env('QR_DOCUMENT_OTP_MAX_ATTEMPTS', 5),
    'resend_cooldown_seconds' => (int) env('QR_DOCUMENT_OTP_RESEND_COOLDOWN_SECONDS', 60),
];
