<?php

namespace ErnestDefoe\Ruffle\Tests\integration\api;

use Flarum\Formatter\Formatter;
use Flarum\Testing\integration\TestCase;
use PHPUnit\Framework\Attributes\Test;

/**
 * The formatter as a forum really builds it, with the extensions Ruffle sits
 * beside. The unit tests configure Ruffle alone; these catch what only shows
 * when another extension has configured the same s9e plugins first.
 */
class FormatterWiringTest extends TestCase
{
    private function render(string $text): string
    {
        $formatter = $this->app()->getContainer()->make(Formatter::class);

        return $formatter->render($formatter->parse($text));
    }

    #[Test]
    public function a_flash_bbcode_becomes_an_embed_in_a_real_post()
    {
        $this->extension('ernestdefoe-ruffle');

        $this->assertStringContainsString('<div class="RuffleEmbed" data-swf="https://e.com/g.swf"', $this->render('[swf]https://e.com/g.swf[/swf]'));
        $this->assertStringNotContainsString('RuffleEmbed', $this->render('[swf]javascript:alert(1)[/swf]'));
    }

    #[Test]
    public function the_forums_other_bbcodes_keep_working()
    {
        $this->extension('flarum-bbcode', 'ernestdefoe-ruffle');

        $out = $this->render('[b]bold[/b] [url=https://x.com]a link[/url] [swf]https://e.com/g.swf[/swf]');

        $this->assertStringContainsString('<b>bold</b>', $out);
        $this->assertStringContainsString('<a href="https://x.com"', $out);
        $this->assertStringContainsString('class="RuffleEmbed"', $out);
    }

    #[Test]
    public function scribe_posts_keep_their_formatting_and_gain_the_embed()
    {
        $this->extension('ernestdefoe-scribe', 'ernestdefoe-ruffle');

        $out = $this->render('<p><strong>bold</strong> text</p><embed src="https://e.com/g.swf" width="550" height="400">');

        $this->assertStringContainsString('<p><strong>bold</strong> text</p>', $out);
        $this->assertStringContainsString('<div class="RuffleEmbed" data-swf="https://e.com/g.swf" data-width="550" data-height="400"', $out);
    }

    #[Test]
    public function without_scribe_raw_html_stays_escaped()
    {
        $this->extension('ernestdefoe-ruffle');

        $this->assertStringNotContainsString('RuffleEmbed', $this->render('<embed src="https://e.com/g.swf">'));
    }
}
