<?php

namespace ErnestDefoe\Ruffle\Tests;

use ErnestDefoe\Ruffle\Formatter\Configure;
use Flarum\Extension\ExtensionManager;
use Flarum\Locale\TranslatorInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use s9e\TextFormatter\Configurator;

/**
 * What a post containing Flash turns into, end to end.
 *
 * 🚨 These are not unit tests of a function; they run the real s9e parser and
 * renderer, because every bug this file exists to catch lived in the
 * interaction between plugins rather than in any one of them. The stray
 * `[/swf]` that `forceLookahead` fixes only appears when Autolink is loaded —
 * a test that configured our tag alone would have passed while the forum was
 * visibly broken.
 */
class FormatterTest extends TestCase
{
    /**
     * A formatter configured the way Flarum configures one, plus us.
     *
     * Litedown and Autolink are what flarum/markdown and core put there, and
     * leaving either out would test a forum nobody runs.
     */
    private function formatter(bool $scribeEnabled): array
    {
        $config = new Configurator();
        $config->plugins->load('Autolink');
        $config->plugins->load('Escaper');
        $config->plugins->load('Litedown');

        $extensions = $this->createMock(ExtensionManager::class);
        $extensions->method('isEnabled')
            ->willReturnCallback(fn (string $id) => $scribeEnabled && $id === 'ernestdefoe-scribe');

        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnArgument(0);

        (new Configure($extensions, $translator))($config);

        $objects = $config->finalize();

        return [$objects['parser'], $objects['renderer']];
    }

    private function render(string $text, bool $scribe = false): string
    {
        [$parser, $renderer] = $this->formatter($scribe);

        return $renderer->render($parser->parse($text));
    }

    public static function bbcodeProvider(): array
    {
        return [
            'content form' => ['[swf]https://e.com/g.swf[/swf]', null, null],
            'attribute form' => ['[swf=https://e.com/g.swf][/swf]', null, null],
            'attribute form with size' => ['[swf=https://e.com/g.swf width=550 height=400][/swf]', '550', '400'],
            'content form with size' => ['[swf width=800 height=600]https://e.com/g.swf[/swf]', '800', '600'],
            'query string survives' => ['[swf]https://e.com/g.swf?a=1&b=2[/swf]', null, null],
        ];
    }

    #[DataProvider('bbcodeProvider')]
    public function test_bbcode_becomes_an_embed(string $text, ?string $width, ?string $height): void
    {
        $out = $this->render($text);

        $this->assertStringContainsString('class="RuffleEmbed"', $out);
        $this->assertStringContainsString('data-swf="https://e.com/g.swf', $out);
        $this->assertStringContainsString('data-width="'.($width ?? '').'"', $out);
        $this->assertStringContainsString('data-height="'.($height ?? '').'"', $out);
    }

    /**
     * 🚨 The regression test for `forceLookahead`.
     *
     * Without it `[swf=url][/swf]` renders the player AND leaves a literal
     * `[/swf]` sitting in the post, because Autolink matches the URL inside the
     * BBCode's own start tag and breaks it apart. The player showing up is why
     * this was easy to miss.
     */
    #[DataProvider('bbcodeProvider')]
    public function test_no_bbcode_markup_survives_into_the_post(string $text): void
    {
        $this->assertDoesNotMatchRegularExpression('~\[/?swf~', $this->render($text));
    }

    /**
     * The whole server-side security boundary, stated as a test.
     *
     * `#url` rejects these, and the result is not an empty embed — the text is
     * never recognised as a tag at all and stays exactly as it was typed.
     */
    public function test_dangerous_urls_are_not_embedded(): void
    {
        foreach (['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>'] as $url) {
            $out = $this->render('[swf]'.$url.'[/swf]');

            $this->assertStringNotContainsString('RuffleEmbed', $out, $url.' was embedded');
            $this->assertStringNotContainsString('<script', $out);
        }
    }

    /**
     * A plain link stays a plain link.
     *
     * Upgrading these is the browser's job (js/src/forum/decorate.ts), and
     * doing it here as well would mean the post itself had been rewritten —
     * with nothing to undo when an admin turns the setting off.
     */
    public function test_a_bare_swf_url_is_left_as_a_link(): void
    {
        $out = $this->render('look at https://e.com/g.swf here');

        $this->assertStringNotContainsString('RuffleEmbed', $out);
        $this->assertStringContainsString('<a href="https://e.com/g.swf"', $out);
    }

    public function test_a_poster_is_rendered_into_the_post(): void
    {
        $out = $this->render('[swf poster=https://e.com/shot.png]https://e.com/g.swf[/swf]');

        $this->assertStringContainsString('<img class="RuffleEmbed-poster" src="https://e.com/shot.png"', $out);
        $this->assertStringContainsString('loading="lazy"', $out);
    }

    public function test_no_poster_means_no_img_at_all(): void
    {
        $this->assertStringNotContainsString('RuffleEmbed-poster', $this->render('[swf]https://e.com/g.swf[/swf]'));
    }

    /**
     * 🚨 A poster is a URL from a member like any other, so it goes through the
     * same filter — and a rejected one must cost the poster, not the embed.
     */
    public function test_a_dangerous_poster_is_dropped_but_the_movie_survives(): void
    {
        $out = $this->render('[swf poster=javascript:alert(1)]https://e.com/g.swf[/swf]');

        $this->assertStringNotContainsString('RuffleEmbed-poster', $out);
        $this->assertStringNotContainsString('javascript:', $out);
        $this->assertStringContainsString('data-swf="https://e.com/g.swf"', $out);
    }

    public function test_a_poster_survives_the_scribe_path(): void
    {
        $out = $this->render(
            '<embed src="https://e.com/g.swf" poster="https://e.com/shot.png">',
            scribe: true
        );

        $this->assertStringContainsString('src="https://e.com/shot.png"', $out);
        $this->assertStringContainsString('data-swf="https://e.com/g.swf"', $out);
    }

    public function test_the_embed_carries_a_link_for_readers_without_javascript(): void
    {
        $out = $this->render('[swf]https://e.com/g.swf[/swf]');

        $this->assertStringContainsString('<a class="RuffleEmbed-fallback" href="https://e.com/g.swf"', $out);
    }

    // ---- the Scribe path ---------------------------------------------------

    public function test_embed_element_becomes_a_player_when_scribe_is_enabled(): void
    {
        $out = $this->render('<embed src="https://e.com/g.swf" width="550" height="400">', scribe: true);

        $this->assertStringContainsString('data-swf="https://e.com/g.swf"', $out);
        $this->assertStringContainsString('data-width="550"', $out);
        $this->assertStringContainsString('data-height="400"', $out);
    }

    /**
     * 🚨 The HTMLElements plugin is loaded ONLY where Scribe is.
     *
     * On a Markdown forum, Litedown escapes raw HTML because that is what the
     * admin chose; loading the plugin anyway would punch a hole through it that
     * nobody asked for.
     */
    public function test_embed_element_is_inert_without_scribe(): void
    {
        $out = $this->render('<embed src="https://e.com/g.swf">', scribe: false);

        $this->assertStringNotContainsString('RuffleEmbed', $out);
        $this->assertStringContainsString('&lt;embed', $out);
    }

    public function test_embed_element_cannot_smuggle_an_attribute(): void
    {
        $out = $this->render('<embed src="https://e.com/g.swf" onload="alert(1)">', scribe: true);

        $this->assertStringContainsString('RuffleEmbed', $out);
        $this->assertStringNotContainsString('onload', $out);
    }

    public function test_embed_element_with_a_dangerous_src_is_not_embedded(): void
    {
        $out = $this->render('<embed src="javascript:alert(1)">', scribe: true);

        $this->assertStringNotContainsString('RuffleEmbed', $out);
    }

    // ---- living alongside other extensions ---------------------------------

    /**
     * 🚨 If something else already owns the tag name, we do nothing at all.
     *
     * Registering over it would replace that extension's template with ours and
     * silently change how its existing posts render — a much worse outcome than
     * this extension being inert.
     */
    public function test_an_existing_tag_of_the_same_name_is_left_alone(): void
    {
        $config = new Configurator();
        $config->plugins->load('Litedown');

        $other = $config->tags->add(Configure::TAG);
        $other->template = '<p class="SomebodyElse"/>';

        $extensions = $this->createMock(ExtensionManager::class);
        $extensions->method('isEnabled')->willReturn(false);
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnArgument(0);

        (new Configure($extensions, $translator))($config);

        $this->assertSame('<p class="SomebodyElse"/>', (string) $config->tags[Configure::TAG]->template);
    }
}
