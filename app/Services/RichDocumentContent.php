<?php

namespace App\Services;

use Illuminate\Validation\ValidationException;

/** The allowlisted document schema shared with the Tiptap editor. Never accepts HTML. */
class RichDocumentContent
{
    private int $nodes = 0;

    public function normalize(array $document): array
    {
        $this->nodes = 0;
        $this->check(strlen(json_encode($document)) <= 500000, 'Document formatting is too large.');
        $result = $this->node($document, null, 0);
        $text = $this->plainText($result);
        $this->check(mb_strlen($text) <= 50000, 'The document body must not exceed 50,000 characters.');

        return $result;
    }

    private function node(array $node, ?string $parent, int $depth): array
    {
        $this->check(++$this->nodes <= 10000 && $depth <= 12, 'The document has too many nested elements.');
        $type = $node['type'] ?? '';
        $allowed = match ($parent) {
            null => ['doc'],
            'doc' => ['paragraph', 'heading', 'bulletList', 'orderedList', 'table'],
            'paragraph', 'heading' => ['text', 'hardBreak'],
            'bulletList', 'orderedList' => ['listItem'],
            'listItem' => ['paragraph', 'bulletList', 'orderedList'],
            'table' => ['tableRow'],
            'tableRow' => ['tableCell', 'tableHeader'],
            'tableCell', 'tableHeader' => ['paragraph'],
            default => [],
        };
        $this->check(in_array($type, $allowed, true), 'Unsupported document element: '.(is_string($type) ? $type : 'unknown').'.');
        $out = ['type' => $type];
        if ($type === 'text') {
            $this->check(is_string($node['text'] ?? null) && $node['text'] !== '', 'Invalid document text.');
            $out['text'] = $node['text'];
            $this->check(is_array($node['marks'] ?? []), 'Invalid text formatting.');
            foreach ($node['marks'] ?? [] as $mark) {
                $this->check(is_array($mark) && in_array($mark['type'] ?? null, ['bold', 'italic', 'underline', 'strike'], true), 'Unsupported text formatting.');
                $out['marks'][] = ['type' => $mark['type']];
            }

            return $out;
        }
        $attrs = $node['attrs'] ?? [];
        $this->check(is_array($attrs), 'Invalid document attributes.');
        if (in_array($type, ['paragraph', 'heading'], true)) {
            $align = $attrs['textAlign'] ?? 'left';
            $this->check(in_array($align, ['left', 'center', 'right', 'justify'], true), 'Invalid text alignment.');
            $out['attrs']['textAlign'] = $align;
        }
        if ($type === 'heading') {
            $this->check(in_array($attrs['level'] ?? null, [2, 3], true), 'Use heading level 2 or 3.');
            $out['attrs']['level'] = $attrs['level'];
        }
        if ($type === 'orderedList') {
            $start = $attrs['start'] ?? 1;
            $this->check(is_int($start) && $start >= 1 && $start <= 9999, 'Invalid list numbering.');
            $out['attrs']['start'] = $start;
        }
        if (in_array($type, ['tableCell', 'tableHeader'], true)) {
            $this->check(($attrs['colspan'] ?? 1) === 1 && ($attrs['rowspan'] ?? 1) === 1, 'Merged cells are not supported yet. Split merged cells before pasting.');
            $width = $attrs['colwidth'] ?? null;
            $this->check($width === null || (is_array($width) && array_is_list($width) && count($width) === 1
                && is_int($width[0]) && $width[0] >= 40 && $width[0] <= 2000), 'Invalid table column width.');
            $out['attrs'] = ['colspan' => 1, 'rowspan' => 1, 'colwidth' => $width];
        }
        $children = $node['content'] ?? [];
        $this->check(is_array($children) && array_is_list($children), 'Invalid document content.');
        foreach ($children as $child) {
            $this->check(is_array($child), 'Invalid document element.');
            $out['content'][] = $this->node($child, $type, $depth + 1);
        }
        if (! in_array($type, ['paragraph', 'heading', 'hardBreak'], true)) {
            $this->check(count($children) > 0, 'Document containers cannot be empty.');
        }
        if ($type === 'table') {
            $columns = count($out['content'][0]['content']);
            $this->check($columns >= 1 && $columns <= 6 && count($children) <= 200, 'Tables support up to 6 columns and 200 rows.');
            foreach ($out['content'] as $index => $row) {
                $this->check(count($row['content']) === $columns, 'Each table row must have the same number of cells.');
                if ($index === 0 && $this->isHeader($row)) {
                    foreach ($row['content'] as $cell) {
                        $this->check(mb_strlen($this->plainText($cell)) <= 80 && count($cell['content']) === 1 && substr_count($this->plainText($cell), "\n") <= 2,
                            'Keep table header cells under 80 characters and on at most three lines.');
                    }
                }
            }
            // The first row defines the entire table, including continuation pages.
            if (array_filter($out['content'][0]['content'], fn ($cell) => $cell['attrs']['colwidth'] !== null)) {
                $widths = $this->columnWidths($out);
                foreach ($out['content'] as &$row) {
                    foreach ($row['content'] as $index => &$cell) {
                        $cell['attrs']['colwidth'] = [$widths[$index]];
                    }
                    unset($cell);
                }
                unset($row);
            }
        }

        return $out;
    }

    public function plainText(array $node): string
    {
        if (($node['type'] ?? '') === 'text') {
            return $node['text'];
        }
        if (($node['type'] ?? '') === 'hardBreak') {
            return "\n";
        }
        $separator = in_array($node['type'] ?? '', ['paragraph', 'heading'], true) ? '' : "\n";

        return implode($separator, array_map(fn ($child) => $this->plainText($child), $node['content'] ?? []));
    }

    public function html(array $document): string
    {
        return $this->render($this->normalize($document));
    }

    private function render(array $node): string
    {
        $type = $node['type'];
        if ($type === 'text') {
            $text = e($node['text']);
            foreach ($node['marks'] ?? [] as $mark) {
                $tag = ['bold' => 'strong', 'italic' => 'em', 'underline' => 'u', 'strike' => 's'][$mark['type']];
                $text = '<'.$tag.'>'.$text.'</'.$tag.'>';
            }

            return $text;
        }
        if ($type === 'hardBreak') {
            return '<br>';
        }
        if ($type === 'table') {
            $rows = $node['content'];
            $widths = $this->columnWidths($node);
            $colgroup = '<colgroup>'.implode('', array_map(fn ($width) => '<col style="width:'.$this->widthPercent($width).'%">', $widths)).'</colgroup>';
            $header = $this->isHeader($rows[0]) ? '<thead>'.$this->render(array_shift($rows)).'</thead>' : '';
            $body = '';
            foreach ($rows as $row) {
                // Dompdf cannot split a single tall row. Fragment long cells before layout,
                // retaining inline marks and all text in aligned continuation rows.
                $cells = [];
                foreach ($row['content'] as $index => $cell) {
                    // Bound row height using the actual column width, including narrow columns.
                    $limit = max(8, (int) floor(($widths[$index] * .75 - 10) / 12) * 8);
                    $cells[] = $this->cellFragments($cell, $limit);
                }
                $count = max(array_map('count', $cells));
                for ($i = 0; $i < $count; $i++) {
                    $body .= '<tr'.($i ? ' class="continuation-row"' : '').'>';
                    foreach ($cells as $index => $parts) {
                        $body .= '<td style="width:'.$this->widthPercent($widths[$index]).'%">'.$this->render($parts[$i] ?? ['type' => 'paragraph']).'</td>';
                    }
                    $body .= '</tr>';
                }
            }

            return '<table class="rich-table">'.$colgroup.$header.'<tbody>'.$body.'</tbody></table>';
        }
        $inner = implode('', array_map(fn ($child) => $this->render($child), $node['content'] ?? []));
        if ($type === 'doc') {
            return $inner;
        }
        $tag = match ($type) {
            'paragraph' => 'p', 'heading' => 'h'.$node['attrs']['level'],
            'bulletList' => 'ul', 'orderedList' => 'ol', 'listItem' => 'li',
            'tableRow' => 'tr', 'tableCell' => 'td', 'tableHeader' => 'th',
        };
        $attrs = isset($node['attrs']['textAlign']) ? ' style="text-align:'.$node['attrs']['textAlign'].'"' : '';
        if ($type === 'orderedList') {
            $attrs .= ' start="'.$node['attrs']['start'].'"';
        }
        if (in_array($type, ['tableCell', 'tableHeader'], true) && isset($node['attrs']['colwidth'][0])) {
            $attrs .= ' style="width:'.$this->widthPercent($node['attrs']['colwidth'][0]).'%"';
        }

        return '<'.$tag.$attrs.'>'.($inner ?: ($type === 'paragraph' ? '<br>' : '')).'</'.$tag.'>';
    }

    private function cellFragments(array $cell, int $limit): array
    {
        $parts = [];
        foreach ($cell['content'] as $paragraph) {
            $current = ['type' => 'paragraph', 'attrs' => $paragraph['attrs'] ?? [], 'content' => []];
            $length = 0;
            $breaks = 0;
            foreach ($paragraph['content'] ?? [] as $inline) {
                $characters = $inline['type'] === 'text' ? mb_str_split($inline['text']) : ["\n"];
                foreach ($characters as $char) {
                    if ($length >= $limit || $breaks >= 3) {
                        $parts[] = $current;
                        $current['content'] = [];
                        $length = $breaks = 0;
                    }
                    if ($char === "\n") {
                        $current['content'][] = ['type' => 'hardBreak'];
                        $breaks++;
                    } else {
                        $last = count($current['content']) - 1;
                        if ($last >= 0 && $current['content'][$last]['type'] === 'text' && ($current['content'][$last]['marks'] ?? []) === ($inline['marks'] ?? [])) {
                            $current['content'][$last]['text'] .= $char;
                        } else {
                            $current['content'][] = [...$inline, 'text' => $char];
                        }
                    }
                    $length++;
                }
            }
            $parts[] = $current;
        }

        return $parts;
    }

    private function widthPercent(int $width): string
    {
        return number_format($width / 691 * 100, 4, '.', '');
    }

    private function columnWidths(array $table): array
    {
        $cells = $table['content'][0]['content'];
        $desired = array_map(fn ($cell) => $cell['attrs']['colwidth'][0] ?? 691 / count($cells), $cells);
        $widths = array_fill(0, count($cells), 0);
        $pending = array_keys($cells);
        $remaining = 691;
        while ($pending) {
            $sum = array_sum(array_intersect_key($desired, array_flip($pending)));
            $small = array_filter($pending, fn ($index) => $desired[$index] / $sum * $remaining < 40);
            if (! $small) {
                // Avoid one-pixel drift from floating-point rounding on repeated saves.
                foreach ($pending as $index) $widths[$index] = (int) floor($desired[$index] / $sum * $remaining + 1e-9);
                break;
            }
            foreach ($small as $index) {
                $widths[$index] = 40;
                $remaining -= 40;
            }
            $pending = array_diff($pending, $small);
        }
        $widths[array_search(max($widths), $widths)] += 691 - array_sum($widths);

        return $widths;
    }

    private function isHeader(array $row): bool
    {
        return count(array_filter($row['content'], fn ($cell) => $cell['type'] === 'tableHeader')) === count($row['content']);
    }

    private function check(bool $condition, string $message): void
    {
        if (! $condition) {
            throw ValidationException::withMessages(['content.body_document' => $message]);
        }
    }
}
