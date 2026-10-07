<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'hris' => [
        'url' => env('HRIS_API_URL'),
        'token' => env('HRIS_API_TOKEN'),
        'employee_path' => env('HRIS_EMPLOYEE_PATH', '/api/employees'),
        'office_path' => env('HRIS_OFFICE_PATH', '/api/offices'),
        'credentials_path' => env('HRIS_CREDENTIALS_PATH', '/api/login-credentials/verify'),
    ],

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'drip' => [
        'url' => env('DRIP_API_URL'),
        'key' => env('DRIP_API_KEY'),
        'app_name' => env('DRIP_APP_NAME', 'DRIP'),
        'auth_header' => 'x-api-key',
    ],

    'pdmis' => [
        'url' => env('PDMIS_API_URL'),
        'key' => env('PDMIS_API_TOKEN'),
        'app_name' => env('PDMIS_APP_NAME', 'PDMIS'),
        'auth_header' => 'Authorization',
    ],

    'ipluma' => [
        'url' => env('IPLUMA_API_URL'),
        'key' => env('IPLUMA_API_KEY'),
        'app_name' => env('IPLUMA_APP_NAME', 'IPluma'),
        'auth_header' => 'x-api-key',
    ],

];
