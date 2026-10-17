<?php

namespace Tests\Feature;

use App\Services\DocumentPdf;
use Tests\TestCase;

class DocumentPdfLayoutTest extends TestCase
{
    private function content(int $lines = 12): array
    {
        $inline = [];
        for ($line = 0; $line < $lines; $line++) {
            if ($line) $inline[] = ['type' => 'hardBreak'];
            $inline[] = ['type' => 'text', 'text' => 'Line '.($line + 1).' keeps the same page in edit and print.'];
        }

        return [
            'recipient_label' => 'TO',
            'for' => 'Alias dolore volupta', 'for_position' => 'Nisi natus inventore',
            'thru' => 'Ea odit officiis qui', 'thru_position' => 'Ipsa ullam sapiente',
            'attention' => 'Recusandae Sed dign', 'attention_position' => 'Omnis consequat Nec',
            'from' => 'Magni eveniet volup', 'from_position' => 'Sit dignissimos eum',
            'subject' => 'Hic obcaecati qui ex', 'date' => 'Illo sint ullamco do', 'cc' => ['Records'],
            'body_document' => ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => $inline]]],
        ];
    }

    private function assertSharedLayout(array $content): array
    {
        $service = app(DocumentPdf::class);
        // Both are actual Chromium renders, one with editable controls/Tiptap and
        // one in output mode. Compare the measured fields and every text rect.
        $edit = $service->pdf('Layout test', $content, measureEditor: true);
        $print = $service->pdf('Layout test', $content);
        $this->assertEquals($edit->layout(), $print->layout());
        $this->assertStringStartsWith('%PDF-', $print->output());
        preg_match_all('/\/Type\s*\/Page\b/', $print->output(), $pages);
        $this->assertCount($edit->pageCount(), $pages[0], 'The PDF must have exactly the editor sheet count.');
        $this->assertSame(816, $print->layout()['geometry']['width']);

        return $print->layout();
    }

    public function test_a_full_first_page_and_one_extra_line_have_identical_edit_and_pdf_breaks(): void
    {
        $this->assertSame(1, $this->assertSharedLayout($this->content(12))['pages']);
        $this->assertSame(2, $this->assertSharedLayout($this->content(13))['pages']);
    }

    public function test_blank_optionals_and_blank_cc_lines_keep_the_editor_geometry(): void
    {
        $content = $this->content(8);
        foreach (['for', 'for_position', 'thru', 'thru_position', 'attention', 'attention_position', 'from_position', 'date'] as $key) {
            $content[$key] = '';
        }
        $content['cc'] = ['Records', '', 'Another office', ''];
        $layout = $this->assertSharedLayout($content);
        $this->assertCount(11, $layout['geometry']['fields']);
        $this->assertSame("Records\n\nAnother office\n", $layout['geometry']['fields'][10]['value']);
    }

    public function test_wrapped_metadata_and_inline_styles_keep_the_same_rectangles(): void
    {
        $content = $this->content(16);
        $content['subject'] = str_repeat('A subject long enough to wrap across multiple lines. ', 4);
        $content['for_position'] = "First designation\nSecond designation";
        $content['body_document']['content'][0]['content'][0]['marks'] = [['type' => 'bold'], ['type' => 'italic']];
        $layout = $this->assertSharedLayout($content);
        $this->assertGreaterThan(31, $layout['geometry']['fields'][8]['height']);
    }

    public function test_lists_and_a_tall_table_cell_use_the_same_browser_pagination(): void
    {
        $paragraph = fn ($text) => ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $text]]];
        $content = $this->content(1);
        $content['body_document']['content'] = [
            ['type' => 'orderedList', 'content' => array_map(fn ($i) => ['type' => 'listItem', 'content' => [$paragraph('Item '.$i.' '.str_repeat('wrapped list text ', 12))]], range(1, 8))],
            ['type' => 'table', 'content' => [['type' => 'tableRow', 'content' => [
                ['type' => 'tableCell', 'attrs' => ['colspan' => 1, 'rowspan' => 1, 'colwidth' => [691]],
                    'content' => [$paragraph(str_repeat('A tall table cell must continue without losing any text. ', 70))]],
            ]]]],
        ];
        $this->assertGreaterThan(1, $this->assertSharedLayout($content)['pages']);
    }
}
