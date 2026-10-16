<?php

namespace Tests\Feature;

use App\Services\DocumentPdf;
use Dompdf\FrameDecorator\Text;
use Tests\TestCase;

class DocumentPdfLayoutTest extends TestCase
{
    public function test_filled_metadata_matches_editor_input_heights_and_field_gaps(): void
    {
        $pdf = app(DocumentPdf::class)->pdf('Metadata spacing', [
            'recipient_label' => 'TO',
            'for' => 'Alias dolore volupta', 'for_position' => 'Nisi natus inventore',
            'thru' => 'Ea odit officiis qui', 'thru_position' => 'Ipsa ullam sapiente',
            'attention' => 'Recusandae Sed dign', 'attention_position' => 'Omnis consequat Nec',
            'from' => 'Magni eveniet volup', 'from_position' => 'Sit dignissimos eum',
            'subject' => 'Hic obcaecati qui ex', 'date' => 'Illo sint ullamco do',
            'body_document' => ['type' => 'doc', 'content' => [['type' => 'paragraph',
                'content' => [['type' => 'text', 'text' => 'Body starts here.']]]]],
        ]);
        $callbacks = [];
        foreach ($pdf->getCallbacks() as $event => $handlers) {
            foreach ($handlers as $handler) {
                $callbacks[] = ['event' => $event, 'f' => $handler];
            }
        }
        $boxes = [];
        $callbacks[] = ['event' => 'begin_frame', 'f' => function ($frame) use (&$boxes): void {
            $node = $frame->get_node();
            if ($node instanceof \DOMElement) {
                $class = trim($node->getAttribute('class'));
                if (in_array($class, ['field-value person-name', 'field-value', 'position', 'rich-body'])) {
                    $boxes[$class][] = ['y' => $frame->get_position('y') / .75,
                        'height' => $frame->get_margin_height() / .75];
                }
            }
        }];
        $pdf->setCallbacks($callbacks)->render();

        // Editor: 30px name + 22px designation + 8px gap = 60px per person.
        $this->assertCount(4, $boxes['field-value person-name']);
        $this->assertCount(4, $boxes['position']);
        foreach ([165, 225, 285, 345] as $index => $y) {
            $this->assertEqualsWithDelta($y, $boxes['field-value person-name'][$index]['y'], .1);
            $this->assertEqualsWithDelta(30, $boxes['field-value person-name'][$index]['height'], .1);
            $this->assertEqualsWithDelta($y + 30, $boxes['position'][$index]['y'], .1);
            $this->assertEqualsWithDelta(22, $boxes['position'][$index]['height'], .1);
        }
        // Subject/date: rounded textarea scrollHeight = 31px, plus 8px field gap.
        foreach ([405, 444] as $index => $y) {
            $this->assertEqualsWithDelta($y, $boxes['field-value'][$index]['y'], .1);
            $this->assertEqualsWithDelta(31, $boxes['field-value'][$index]['height'], .1);
        }
        // After DATE: 32px divider margin + 1px border + 26px body margin.
        $this->assertEqualsWithDelta(444 + 31 + 32 + 1 + 26, $boxes['rich-body'][0]['y'], .1);
    }

    public function test_pdf_uses_browser_line_height_without_inflating_a_two_page_body(): void
    {
        $inline = [];
        for ($line = 1; $line <= 55; $line++) {
            if ($line > 1) {
                $inline[] = ['type' => 'hardBreak'];
            }
            $inline[] = ['type' => 'text', 'text' => 'Measured line '.$line,
                'marks' => match ($line % 4) {
                    1 => [], 2 => [['type' => 'bold']], 3 => [['type' => 'italic']],
                    0 => [['type' => 'bold'], ['type' => 'italic']],
                }];
        }
        $pdf = app(DocumentPdf::class)->pdf('Layout test', [
            'from' => 'Test Sender', 'subject' => 'Layout measurement',
            'body_document' => ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => $inline]]],
        ]);
        $callbacks = [];
        foreach ($pdf->getCallbacks() as $event => $handlers) {
            foreach ($handlers as $handler) {
                $callbacks[] = ['event' => $event, 'f' => $handler];
            }
        }
        $lines = [];
        $callbacks[] = ['event' => 'begin_frame', 'f' => function ($frame, $canvas) use (&$lines): void {
            if ($frame instanceof Text && str_starts_with($frame->get_text(), 'Measured line')) {
                $lines[] = ['page' => $canvas->get_page_number(), 'y' => $frame->get_position('y'),
                    'height' => $frame->get_margin_height()];
            }
        }];
        $pdf->setCallbacks($callbacks)->render();

        $this->assertSame(2, $pdf->getDomPDF()->getCanvas()->get_page_count());
        $this->assertCount(55, $lines);
        foreach ($lines as $index => $line) {
            // Browser: 11pt * 1.55 = 17.05pt (22.733 CSS px), for all four Arial faces.
            $this->assertEqualsWithDelta(17.05, $line['height'], .01);
            $this->assertGreaterThanOrEqual(165 * .75, $line['y']);
            $this->assertLessThanOrEqual((1056 - 168) * .75 + .01, $line['y'] + $line['height']);
            if ($index > 0 && $line['page'] === $lines[$index - 1]['page']) {
                $this->assertEqualsWithDelta(17.05, $line['y'] - $lines[$index - 1]['y'], .01);
            }
        }
    }
}
