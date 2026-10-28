<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$docxPath = $root . '/docs/project-concept-paper-v2.docx';
$diagramDir = $root . '/output/dots-guide-diagrams';
$tempPath = $docxPath . '.tmp';

$flowNames = [
    'lifecycle', 'sequential', 'parallel', 'qr',
    'lifecycle', 'login', 'lifecycle', 'sequential', 'parallel', 'childroute', 'qr',
];
$titles = [
    'Document preparation and tracking', 'Sequential routing', 'Parallel routing', 'QR tracking and protected actions',
    'Document preparation and tracking', 'Secure login', 'Document preparation and tracking',
    'Sequential routing', 'Parallel routing', 'Child office routing', 'QR tracking and protected actions',
];

$zip = new ZipArchive();
if ($zip->open($docxPath) !== true) {
    throw new RuntimeException("Cannot open {$docxPath}");
}
$documentXml = $zip->getFromName('word/document.xml');
$relsXml = $zip->getFromName('word/_rels/document.xml.rels');
$typesXml = $zip->getFromName('[Content_Types].xml');
if ($documentXml === false || $relsXml === false || $typesXml === false) {
    throw new RuntimeException('DOCX is missing a required package part.');
}

$doc = new DOMDocument('1.0', 'UTF-8');
$doc->preserveWhiteSpace = false;
$doc->formatOutput = true;
if (!$doc->loadXML($documentXml, LIBXML_NOBLANKS)) {
    throw new RuntimeException('Could not parse document.xml.');
}
$xp = new DOMXPath($doc);
$xp->registerNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main');
$xp->registerNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships');
$xp->registerNamespace('wp', 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing');
$xp->registerNamespace('a', 'http://schemas.openxmlformats.org/drawingml/2006/main');
$xp->registerNamespace('pic', 'http://schemas.openxmlformats.org/drawingml/2006/picture');
$tables = $xp->query('//w:tbl[.//w:pPr/w:pStyle[@w:val="Flow"]]');
if (!$tables || $tables->length !== count($flowNames)) {
    throw new RuntimeException('Expected ' . count($flowNames) . ' workflow tables, found ' . ($tables?->length ?? 0) . '.');
}

$rels = new DOMDocument('1.0', 'UTF-8');
$rels->preserveWhiteSpace = false;
$rels->formatOutput = true;
if (!$rels->loadXML($relsXml, LIBXML_NOBLANKS)) {
    throw new RuntimeException('Could not parse document relationships.');
}
$relNs = 'http://schemas.openxmlformats.org/package/2006/relationships';
$imageRelType = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
$existingIds = [];
foreach ($rels->getElementsByTagNameNS($relNs, 'Relationship') as $rel) {
    $existingIds[] = $rel->getAttribute('Id');
}
$idNumber = 1;
$addedImages = [];
$maxCx = 5_580_000; // 6.1 inches, leaves room inside standard page margins.

foreach ($tables as $index => $table) {
    $n = $index + 1;
    $name = $flowNames[$index];
    $pngPath = $diagramDir . '/' . $name . '.png';
    if (!is_file($pngPath)) {
        throw new RuntimeException("Missing workflow image: {$pngPath}");
    }
    $imageInfo = getimagesize($pngPath);
    if ($imageInfo === false) {
        throw new RuntimeException("Invalid PNG: {$pngPath}");
    }
    $cx = $maxCx;
    $cy = (int) round($cx * $imageInfo[1] / $imageInfo[0]);
    do {
        $relId = 'rIdFlow' . $idNumber++;
    } while (in_array($relId, $existingIds, true));
    $existingIds[] = $relId;
    $mediaName = "dots-flow-{$n}.png";
    $addedImages['word/media/' . $mediaName] = file_get_contents($pngPath);

    $rel = $rels->createElementNS($relNs, 'Relationship');
    $rel->setAttribute('Id', $relId);
    $rel->setAttribute('Type', $imageRelType);
    $rel->setAttribute('Target', 'media/' . $mediaName);
    $rels->documentElement->appendChild($rel);

    $p = $doc->createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'w:p');
    $pPr = $doc->createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'w:pPr');
    $jc = $doc->createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'w:jc');
    $jc->setAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'w:val', 'center');
    $pPr->appendChild($jc);
    $spacing = $doc->createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'w:spacing');
    $spacing->setAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'w:before', '80');
    $spacing->setAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'w:after', '120');
    $pPr->appendChild($spacing);
    $p->appendChild($pPr);
    $run = $doc->createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'w:r');
    $drawing = $doc->createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'w:drawing');
    $inline = $doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'wp:inline');
    foreach (['distT', 'distB', 'distL', 'distR'] as $attr) $inline->setAttribute($attr, '0');
    $extent = $doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'wp:extent');
    $extent->setAttribute('cx', (string)$cx); $extent->setAttribute('cy', (string)$cy);
    $inline->appendChild($extent);
    $effect = $doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'wp:effectExtent');
    foreach (['l','t','r','b'] as $side) $effect->setAttribute($side, '0');
    $inline->appendChild($effect);
    $docPr = $doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'wp:docPr');
    $docPr->setAttribute('id', (string)(1000 + $n)); $docPr->setAttribute('name', $titles[$index]);
    $inline->appendChild($docPr);
    $frame = $doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'wp:cNvGraphicFramePr');
    $locks = $doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:graphicFrameLocks');
    $locks->setAttribute('noChangeAspect', '1'); $frame->appendChild($locks); $inline->appendChild($frame);

    $graphic = $doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:graphic');
    $graphicData = $doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:graphicData');
    $graphicData->setAttribute('uri', 'http://schemas.openxmlformats.org/drawingml/2006/picture');
    $pic = $doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/picture', 'pic:pic');
    $nv = $doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/picture', 'pic:nvPicPr');
    $cnv = $doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/picture', 'pic:cNvPr');
    $cnv->setAttribute('id', (string)(10000 + $n)); $cnv->setAttribute('name', $mediaName);
    $nv->appendChild($cnv); $nv->appendChild($doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/picture', 'pic:cNvPicPr'));
    $pic->appendChild($nv);
    $fill = $doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/picture', 'pic:blipFill');
    $blip = $doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:blip');
    $blip->setAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'r:embed', $relId);
    $fill->appendChild($blip);
    $stretch = $doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:stretch');
    $stretch->appendChild($doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:fillRect'));
    $fill->appendChild($stretch); $pic->appendChild($fill);
    $spPr = $doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/picture', 'pic:spPr');
    $xfrm = $doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:xfrm');
    $offset = $doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:off');
    $offset->setAttribute('x', '0'); $offset->setAttribute('y', '0');
    $xfrm->appendChild($offset);
    $shapeExtent = $doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:ext');
    $shapeExtent->setAttribute('cx', (string)$cx); $shapeExtent->setAttribute('cy', (string)$cy);
    $xfrm->appendChild($shapeExtent); $spPr->appendChild($xfrm);
    $geom = $doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:prstGeom');
    $geom->setAttribute('prst', 'rect'); $geom->appendChild($doc->createElementNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'a:avLst'));
    $spPr->appendChild($geom); $pic->appendChild($spPr);
    $graphicData->appendChild($pic); $graphic->appendChild($graphicData); $inline->appendChild($graphic);
    $drawing->appendChild($inline); $run->appendChild($drawing); $p->appendChild($run);

    $table->parentNode->insertBefore($p, $table);
    $table->parentNode->removeChild($table);
}

$types = new DOMDocument('1.0', 'UTF-8');
$types->preserveWhiteSpace = false;
$types->formatOutput = true;
if (!$types->loadXML($typesXml, LIBXML_NOBLANKS)) throw new RuntimeException('Could not parse content types.');
$ctNs = 'http://schemas.openxmlformats.org/package/2006/content-types';
$hasPng = false;
foreach ($types->getElementsByTagNameNS($ctNs, 'Default') as $default) {
    if (strtolower($default->getAttribute('Extension')) === 'png') $hasPng = true;
}
if (!$hasPng) {
    $default = $types->createElementNS($ctNs, 'Default');
    $default->setAttribute('Extension', 'png');
    $default->setAttribute('ContentType', 'image/png');
    $types->documentElement->appendChild($default);
}

$zip->close();
$src = new ZipArchive(); $dst = new ZipArchive();
if ($src->open($docxPath) !== true || $dst->open($tempPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    throw new RuntimeException('Could not prepare the updated DOCX package.');
}
for ($i = 0; $i < $src->numFiles; $i++) {
    $stat = $src->statIndex($i);
    $entry = $stat['name'];
    if ($entry === 'word/document.xml') $contents = $doc->saveXML();
    elseif ($entry === 'word/_rels/document.xml.rels') $contents = $rels->saveXML();
    elseif ($entry === '[Content_Types].xml') $contents = $types->saveXML();
    else $contents = $src->getFromIndex($i);
    $dst->addFromString($entry, $contents);
}
foreach ($addedImages as $entry => $contents) $dst->addFromString($entry, $contents);
$src->close(); $dst->close();
if (!rename($tempPath, $docxPath)) throw new RuntimeException('Could not replace the V2 DOCX.');
echo 'Inserted ' . count($flowNames) . " workflow images into {$docxPath}\n";
