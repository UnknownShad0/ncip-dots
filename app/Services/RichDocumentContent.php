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
            $colspan = $attrs['colspan'] ?? 1;
            $rowspan = $attrs['rowspan'] ?? 1;
            $this->check(is_int($colspan) && $colspan >= 1 && $colspan <= 6, 'Invalid table cell column span.');
            $this->check(is_int($rowspan) && $rowspan >= 1 && $rowspan <= 200, 'Invalid table cell row span.');
            $width = $attrs['colwidth'] ?? null;
            $this->check($width === null || (is_array($width) && array_is_list($width) && count($width) === $colspan
                && count(array_filter($width, fn ($value) => ! is_int($value) || $value < 40 || $value > 2000)) === 0), 'Invalid table column width.');
            $out['attrs'] = ['colspan' => $colspan, 'rowspan' => $rowspan, 'colwidth' => $width];
        }
        $children = $node['content'] ?? [];
        $this->check(is_array($children) && array_is_list($children), 'Invalid document content.');
        foreach ($children as $child) {
            $this->check(is_array($child), 'Invalid document element.');
            $out['content'][] = $this->node($child, $type, $depth + 1);
        }
        if (! in_array($type, ['paragraph', 'heading', 'hardBreak', 'tableRow'], true)) {
            $this->check(count($children) > 0, 'Document containers cannot be empty.');
        }
        if ($type === 'table') {
            $this->check(count($children) <= 200, 'Tables support up to 6 columns and 200 rows.');
            $grid = $this->tableGrid($out);
            foreach ($out['content'] as $index => $row) {
                if ($index === 0 && $this->isHeader($row)) {
                    foreach ($row['content'] as $cell) {
                        $this->check($cell['attrs']['rowspan'] === 1, 'Header cells cannot extend into body rows.');
                        $this->check(mb_strlen($this->plainText($cell)) <= 80 && count($cell['content']) === 1 && substr_count($this->plainText($cell), "\n") <= 2,
                            'Keep table header cells under 80 characters and on at most three lines.');
                    }
                }
            }
            $hasWidths = false;
            foreach ($out['content'] as $row) {
                foreach ($row['content'] as $cell) $hasWidths = $hasWidths || $cell['attrs']['colwidth'] !== null;
            }
            if ($hasWidths) {
                $widths = $this->columnWidths($out, $grid);
                foreach ($grid['placements'] as $rowIndex => $placements) {
                    foreach ($placements as $cellIndex => $column) {
                        $span = $out['content'][$rowIndex]['content'][$cellIndex]['attrs']['colspan'];
                        $out['content'][$rowIndex]['content'][$cellIndex]['attrs']['colwidth'] = array_slice($widths, $column, $span);
                    }
                }
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
            $grid = $this->tableGrid($node);
            $widths = $this->columnWidths($node, $grid);
            $colgroup = '<colgroup>'.implode('', array_map(fn ($width) => '<col style="width:'.$this->widthPercent($width).'%">', $widths)).'</colgroup>';
            $header = '';
            $rowOffset = 0;
            if ($this->isHeader($rows[0])) {
                $header = '<thead>'.$this->renderTableRow($rows[0], $grid['placements'][0], $widths).'</thead>';
                array_shift($rows);
                $rowOffset = 1;
            }
            $body = '';
            $merged = $this->hasMergedCells($node);
            foreach ($rows as $bodyIndex => $row) {
                $rowIndex = $bodyIndex + $rowOffset;
                if ($merged) {
                    $body .= $this->renderTableRow($row, $grid['placements'][$rowIndex], $widths);
                    continue;
                }
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
        if (in_array($type, ['tableCell', 'tableHeader'], true)) {
            if (($node['attrs']['colspan'] ?? 1) > 1) $attrs .= ' colspan="'.$node['attrs']['colspan'].'"';
            if (($node['attrs']['rowspan'] ?? 1) > 1) $attrs .= ' rowspan="'.$node['attrs']['rowspan'].'"';
            if (isset($node['attrs']['colwidth'][0])) {
                $attrs .= ' style="width:'.$this->widthPercent(array_sum($node['attrs']['colwidth'])).'%"';
            }
        }

        return '<'.$tag.$attrs.'>'.($inner ?: ($type === 'paragraph' ? '<br>' : '')).'</'.$tag.'>';
    }

    private function renderTableRow(array $row, array $placements, array $widths): string
    {
        $html = '<tr>';
        foreach ($row['content'] as $index => $cell) {
            $tag = $cell['type'] === 'tableHeader' ? 'th' : 'td';
            $colspan = $cell['attrs']['colspan'];
            $rowspan = $cell['attrs']['rowspan'];
            $width = array_sum(array_slice($widths, $placements[$index], $colspan));
            $attrs = ' style="width:'.$this->widthPercent($width).'%"';
            if ($colspan > 1) $attrs .= ' colspan="'.$colspan.'"';
            if ($rowspan > 1) $attrs .= ' rowspan="'.$rowspan.'"';
            $inner = implode('', array_map(fn ($child) => $this->render($child), $cell['content']));
            $html .= '<'.$tag.$attrs.'>'.$inner.'</'.$tag.'>';
        }

        return $html.'</tr>';
    }

    private function hasMergedCells(array $table): bool
    {
        foreach ($table['content'] as $row) {
            foreach ($row['content'] as $cell) {
                if ($cell['attrs']['colspan'] > 1 || $cell['attrs']['rowspan'] > 1) return true;
            }
        }

        return false;
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

    /** @return array{columns:int,placements:array<int,array<int,int>>} */
    private function tableGrid(array $table): array
    {
        $rows = $table['content'];
        $rowCount = count($rows);
        $occupied = [];
        $placements = [];
        $columns = 0;
        foreach ($rows as $rowIndex => $row) {
            $column = 0;
            foreach ($row['content'] as $cellIndex => $cell) {
                while ($occupied[$rowIndex][$column] ?? false) $column++;
                $colspan = $cell['attrs']['colspan'];
                $rowspan = $cell['attrs']['rowspan'];
                $this->check($rowIndex + $rowspan <= $rowCount, 'A merged table cell extends beyond the final row.');
                $placements[$rowIndex][$cellIndex] = $column;
                for ($rowspanIndex = $rowIndex; $rowspanIndex < $rowIndex + $rowspan; $rowspanIndex++) {
                    for ($columnIndex = $column; $columnIndex < $column + $colspan; $columnIndex++) {
                        $this->check(! ($occupied[$rowspanIndex][$columnIndex] ?? false), 'Merged table cells overlap.');
                        $occupied[$rowspanIndex][$columnIndex] = true;
                    }
                }
                $column += $colspan;
                $columns = max($columns, $column);
            }
            $placements[$rowIndex] ??= [];
        }
        $this->check($columns >= 1 && $columns <= 6, 'Tables support up to 6 columns and 200 rows.');
        foreach (array_keys($rows) as $rowIndex) {
            for ($column = 0; $column < $columns; $column++) {
                $this->check($occupied[$rowIndex][$column] ?? false, 'Every table row must cover the same columns.');
            }
            $this->check(count($occupied[$rowIndex] ?? []) === $columns, 'Every table row must cover the same columns.');
        }

        return ['columns' => $columns, 'placements' => $placements];
    }

    private function columnWidths(array $table, ?array $grid = null): array
    {
        $grid ??= $this->tableGrid($table);
        $desired = array_fill(0, $grid['columns'], 0);
        foreach ($grid['placements'] as $rowIndex => $placements) {
            foreach ($placements as $cellIndex => $column) {
                $cell = $table['content'][$rowIndex]['content'][$cellIndex];
                foreach ($cell['attrs']['colwidth'] ?? [] as $offset => $width) {
                    if (! $desired[$column + $offset]) $desired[$column + $offset] = $width;
                }
            }
        }
        foreach ($desired as $index => $width) {
            if (! $width) $desired[$index] = 691 / $grid['columns'];
        }
        $widths = array_fill(0, $grid['columns'], 0);
        $pending = array_keys($desired);
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
