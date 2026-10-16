<?php

// Usage: php scripts/install-document-fonts.php /path/to/licensed/arial/fonts
// Font binaries stay in private storage and are not published as web fonts.
$source = $argv[1] ?? '/System/Library/Fonts/Supplemental';
$root = dirname(__DIR__);
$destination = $root.'/storage/app/private/fonts/arial';
$faces = [
    'Arial.ttf' => ['Arial.ttf', 'arial.ttf'],
    'Arial-Bold.ttf' => ['Arial Bold.ttf', 'Arial-Bold.ttf', 'arialbd.ttf'],
    'Arial-Italic.ttf' => ['Arial Italic.ttf', 'Arial-Italic.ttf', 'ariali.ttf'],
    'Arial-BoldItalic.ttf' => ['Arial Bold Italic.ttf', 'Arial-BoldItalic.ttf', 'arialbi.ttf'],
];
$files = [];
foreach ($faces as $target => $names) {
    foreach ($names as $name) {
        if (is_file($source.'/'.$name)) {
            $files[$target] = $source.'/'.$name;
            break;
        }
    }
    if (! isset($files[$target])) {
        fwrite(STDERR, "Missing {$target} in {$source}. Supply a directory containing all four Arial TTF faces.\n");
        exit(1);
    }
}
foreach ([$destination, $root.'/storage/fonts'] as $directory) {
    if (! is_dir($directory) && ! mkdir($directory, 0755, true)) {
        throw new RuntimeException('Cannot create '.$directory);
    }
}
foreach ($files as $target => $file) {
    if (realpath($file) !== realpath($destination.'/'.$target) && ! copy($file, $destination.'/'.$target)) {
        throw new RuntimeException('Cannot install '.$target);
    }
}
echo "Installed Arial Regular, Bold, Italic, and Bold Italic for PDF embedding.\n";
