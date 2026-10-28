<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$docxPath = $root . '/docs/project-concept-paper-v2.docx';
$tempPath = $docxPath . '.tmp';
$imagePath = $root . '/output/dots-guide-diagrams/overview.png';
$imagePart = 'word/media/dots-system-overview.png';
$ns = [
    'w' => 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'r' => 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'wp' => 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'a' => 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'pic' => 'http://schemas.openxmlformats.org/drawingml/2006/picture',
];
$doc = new DOMDocument('1.0', 'UTF-8'); $doc->preserveWhiteSpace = false; $doc->formatOutput = true;
$rels = new DOMDocument('1.0', 'UTF-8'); $rels->preserveWhiteSpace = false; $rels->formatOutput = true;
$types = new DOMDocument('1.0', 'UTF-8'); $types->preserveWhiteSpace = false; $types->formatOutput = true;
$src = new ZipArchive();
if ($src->open($docxPath) !== true) throw new RuntimeException('Could not open the current V2 document.');
if (!$doc->loadXML($src->getFromName('word/document.xml'), LIBXML_NOBLANKS)) throw new RuntimeException('Could not read document.xml.');
if (!$rels->loadXML($src->getFromName('word/_rels/document.xml.rels'), LIBXML_NOBLANKS)) throw new RuntimeException('Could not read document relationships.');
if (!$types->loadXML($src->getFromName('[Content_Types].xml'), LIBXML_NOBLANKS)) throw new RuntimeException('Could not read content types.');
if (!is_file($imagePath)) throw new RuntimeException('The complete system overview PNG is missing.');

// Fill required transform coordinates and assign unique picture-property IDs.
$fix = new DOMXPath($doc);
$fix->registerNamespace('a', $ns['a']);
foreach ($fix->query('//a:off') as $offset) {
    if (!$offset->hasAttribute('x')) $offset->setAttribute('x', '0');
    if (!$offset->hasAttribute('y')) $offset->setAttribute('y', '0');
}
foreach ($fix->query('//pic:cNvPr') as $i => $nonVisual) {
    $nonVisual->setAttribute('id', (string)($i + 1));
}

$xp = new DOMXPath($doc);
foreach ($ns as $prefix => $uri) $xp->registerNamespace($prefix, $uri);
$overviewHeading = null;
foreach ($xp->query('//w:body/w:p') as $paragraph) {
    if (str_contains(trim($xp->evaluate('string(.)', $paragraph)), 'Document lifecycle overview')) {
        $overviewHeading = $paragraph;
        break;
    }
}
if (!$overviewHeading) throw new RuntimeException('Could not find the Document lifecycle overview section in the guide.');

$relNs = 'http://schemas.openxmlformats.org/package/2006/relationships';
$imageRelType = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
$existingIds = [];
foreach ($rels->getElementsByTagNameNS($relNs, 'Relationship') as $relationship) $existingIds[] = $relationship->getAttribute('Id');
$relId = 'rIdSystemOverview';
while (in_array($relId, $existingIds, true)) $relId .= 'X';
$relationship = $rels->createElementNS($relNs, 'Relationship');
$relationship->setAttribute('Id', $relId); $relationship->setAttribute('Type', $imageRelType); $relationship->setAttribute('Target', 'media/dots-system-overview.png');
$rels->documentElement->appendChild($relationship);

$info = getimagesize($imagePath); if (!$info) throw new RuntimeException('Overview PNG cannot be read.');
$cx = 5_580_000; $cy = (int)round($cx * $info[1] / $info[0]);
$el = fn(string $prefix, string $name) => $doc->createElementNS($ns[$prefix], $prefix . ':' . $name);
$p = $el('w', 'p'); $pPr = $el('w', 'pPr'); $jc = $el('w', 'jc'); $jc->setAttributeNS($ns['w'], 'w:val', 'center'); $pPr->appendChild($jc);
$spacing = $el('w', 'spacing'); $spacing->setAttributeNS($ns['w'], 'w:before', '100'); $spacing->setAttributeNS($ns['w'], 'w:after', '140'); $pPr->appendChild($spacing); $p->appendChild($pPr);
$run = $el('w', 'r'); $drawing = $el('w', 'drawing'); $inline = $el('wp', 'inline');
foreach (['distT','distB','distL','distR'] as $attribute) $inline->setAttribute($attribute, '0');
$extent = $el('wp', 'extent'); $extent->setAttribute('cx', (string)$cx); $extent->setAttribute('cy', (string)$cy); $inline->appendChild($extent);
$effect = $el('wp', 'effectExtent'); foreach (['l','t','r','b'] as $side) $effect->setAttribute($side, '0'); $inline->appendChild($effect);
$docPr = $el('wp', 'docPr'); $docPr->setAttribute('id', '2010'); $docPr->setAttribute('name', 'DOTS complete system workflow'); $inline->appendChild($docPr);
$frame = $el('wp', 'cNvGraphicFramePr'); $locks = $el('a', 'graphicFrameLocks'); $locks->setAttribute('noChangeAspect', '1'); $frame->appendChild($locks); $inline->appendChild($frame);
$graphic = $el('a', 'graphic'); $graphicData = $el('a', 'graphicData'); $graphicData->setAttribute('uri', $ns['pic']);
$picture = $el('pic', 'pic'); $nv = $el('pic', 'nvPicPr'); $cnv = $el('pic', 'cNvPr'); $cnv->setAttribute('id', (string)($xp->query('//pic:cNvPr')->length + 1)); $cnv->setAttribute('name', 'dots-system-overview.png'); $nv->appendChild($cnv); $nv->appendChild($el('pic', 'cNvPicPr')); $picture->appendChild($nv);
$fill = $el('pic', 'blipFill'); $blip = $el('a', 'blip'); $blip->setAttributeNS($ns['r'], 'r:embed', $relId); $fill->appendChild($blip);
$stretch = $el('a', 'stretch'); $stretch->appendChild($el('a', 'fillRect')); $fill->appendChild($stretch); $picture->appendChild($fill);
$shape = $el('pic', 'spPr'); $transform = $el('a', 'xfrm'); $offset = $el('a', 'off'); $offset->setAttribute('x', '0'); $offset->setAttribute('y', '0'); $transform->appendChild($offset);
$shapeExtent = $el('a', 'ext'); $shapeExtent->setAttribute('cx', (string)$cx); $shapeExtent->setAttribute('cy', (string)$cy); $transform->appendChild($shapeExtent); $shape->appendChild($transform);
$geometry = $el('a', 'prstGeom'); $geometry->setAttribute('prst', 'rect'); $geometry->appendChild($el('a', 'avLst')); $shape->appendChild($geometry); $picture->appendChild($shape);
$graphicData->appendChild($picture); $graphic->appendChild($graphicData); $inline->appendChild($graphic); $drawing->appendChild($inline); $run->appendChild($drawing); $p->appendChild($run);
$overviewHeading->parentNode->insertBefore($p, $overviewHeading->nextSibling);

$typesNs = 'http://schemas.openxmlformats.org/package/2006/content-types';
$hasPng = false;
foreach ($types->getElementsByTagNameNS($typesNs, 'Default') as $default) if (strtolower($default->getAttribute('Extension')) === 'png') $hasPng = true;
if (!$hasPng) { $default = $types->createElementNS($typesNs, 'Default'); $default->setAttribute('Extension', 'png'); $default->setAttribute('ContentType', 'image/png'); $types->documentElement->appendChild($default); }

$src->close(); $dst = new ZipArchive();
if ($dst->open($tempPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) throw new RuntimeException('Could not create the repaired DOCX.');
$src = new ZipArchive(); if ($src->open($docxPath) !== true) throw new RuntimeException('Could not reopen source DOCX.');
for ($i = 0; $i < $src->numFiles; $i++) {
    $entry = $src->getNameIndex($i);
    if ($entry === 'word/document.xml') $contents = $doc->saveXML();
    elseif ($entry === 'word/_rels/document.xml.rels') $contents = $rels->saveXML();
    elseif ($entry === '[Content_Types].xml') $contents = $types->saveXML();
    else $contents = $src->getFromIndex($i);
    $dst->addFromString($entry, $contents);
}
$dst->addFile($imagePath, $imagePart);
$src->close(); $dst->close();
if (!rename($tempPath, $docxPath)) throw new RuntimeException('Could not replace the V2 document.');
echo "Repaired picture metadata and added the overall workflow diagram.\n";
