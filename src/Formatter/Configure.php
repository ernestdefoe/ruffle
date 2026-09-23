<?php

namespace ErnestDefoe\Ruffle\Formatter;

use Flarum\Extension\ExtensionManager;
use Flarum\Locale\TranslatorInterface;
use s9e\TextFormatter\Configurator;

/**
 * Teaches s9e\TextFormatter that a post can contain a Flash movie.
 *
 * One tag, `RUFFLE`, reachable by two syntaxes so both editors can produce it:
 * a BBCode for the plain/Markdown composer, and — only where Scribe is
 * enabled — an `<embed>` element, because Scribe stores posts as HTML.
 *
 * What the tag renders is NOT a player. It is an inert placeholder carrying the
 * URL, which the frontend turns into one. That is deliberate and it is the only
 * design s9e will accept: the template checker rejects `<object>`, `<embed>`,
 * `<iframe>` and `<script>` in a template outright, and it is right to. It also
 * means a multi-megabyte WebAssembly runtime is never a consequence of merely
 * rendering a page.
 */
class Configure
{
    /** The tag name. Deliberately specific — `FLASH` is the kind of name two extensions pick. */
    public const TAG = 'RUFFLE';

    private const FALLBACK_DEFAULT = 'Open this Flash file';

    public function __construct(
        private readonly ExtensionManager $extensions,
        private readonly TranslatorInterface $translator,
    ) {
    }

    public function __invoke(Configurator $config): void
    {
        /*
         * Another extension may already own this tag name. Registering over it
         * would replace its template with ours and silently change how its
         * posts render, which is a far worse outcome than this extension
         * quietly doing nothing.
         */
        if ($config->tags->exists(self::TAG)) {
            return;
        }

        $tag = $config->tags->add(self::TAG);

        /*
         * 🚨 `#url` is the whole server-side security boundary, and it is doing
         * more than it looks. It rejects `javascript:` and `data:` — verified,
         * not assumed: `[swf]javascript:alert(1)[/swf]` does not become a tag
         * at all, it stays literal text in the post.
         */
        $tag->attributes->add('url')->filterChain->append('#url');

        /*
         * A still image the author supplies, shown in place of an empty box
         * until someone presses play.
         *
         * 🚨 There is no way to generate this automatically that is worth
         * having. The only thing that can render a frame of a .swf is Ruffle,
         * which means downloading several megabytes of player and the movie
         * itself — for every embed on the page, to show a thumbnail. That is
         * strictly worse than just playing them. Extracting a frame
         * server-side means decoding compressed SWF and rasterising vector
         * graphics in PHP, or shelling out to swftools. So: the author knows
         * what the movie looks like, and `<video poster>` has had the right
         * answer to this for fifteen years.
         */
        $poster = $tag->attributes->add('poster');
        $poster->required = false;
        $poster->filterChain->append('#url');

        foreach (['width', 'height'] as $name) {
            $attribute = $tag->attributes->add($name);
            $attribute->required = false;
            $attribute->filterChain->append('#uint');
        }

        $tag->template = $this->template();

        $this->addBBCode($config);

        if ($this->extensions->isEnabled('ernestdefoe-scribe')) {
            $this->addHtmlElement($config);
        }
    }

    /**
     * The placeholder, plus a plain link to the file.
     *
     * The link is not a nicety. It is what a reader gets with JavaScript off,
     * in a feed reader, in the notification emails Flarum sends, and in the
     * gap before the player mounts — and it is what search engines index. An
     * embed that renders as an empty box in all of those places would be the
     * same content simply lost.
     */
    private function template(): string
    {
        return '<div class="RuffleEmbed" data-swf="{@url}" data-width="{@width}" data-height="{@height}">'
            /*
             * In the stored HTML rather than drawn by JavaScript, so it is also
             * what a link preview, a feed reader and a search engine see.
             * `loading="lazy"` because a thread full of embeds should not fetch
             * a screenshot for each one before you have scrolled to it.
             */
            .'<xsl:if test="@poster">'
            .'<img class="RuffleEmbed-poster" src="{@poster}" alt="" loading="lazy"/>'
            .'</xsl:if>'
            .'<a class="RuffleEmbed-fallback" href="{@url}" rel="nofollow noopener ugc" target="_blank">'
            .$this->fallbackText()
            .'</a>'
            .'</div>';
    }

    /**
     * `[swf]url[/swf]`, `[swf=url][/swf]`, and either with width/height.
     *
     * 🚨 `forceLookahead` is not optional, and the reason is worth writing down
     * because the symptom points nowhere near the cause.
     *
     * Without it, `[swf=https://…/game.swf][/swf]` renders the player AND
     * leaves a literal `[/swf]` in the post. Flarum always has the Autolink
     * plugin on, so the URL sitting inside the BBCode's own start tag gets
     * matched as a link, which breaks the start tag apart; s9e then treats the
     * BBCode as standalone and the closing tag is orphaned. Requiring a
     * lookahead makes the pair match as a pair.
     *
     * The cost is that an unclosed `[swf=url]` no longer works — it renders as
     * an ordinary link. That is the better failure: the author sees their own
     * text unchanged and fixes it, rather than getting a working player with
     * rubbish next to it that they have to notice.
     */
    private function addBBCode(Configurator $config): void
    {
        $config->plugins->load('BBCodes');

        $config->BBCodes->add('SWF', [
            'tagName' => self::TAG,
            'defaultAttribute' => 'url',
            'contentAttributes' => ['url'],
            'forceLookahead' => true,
        ]);
    }

    /**
     * `<embed src="…">` — the Scribe path.
     *
     * 🚨 Loaded ONLY when Scribe is enabled. On a Markdown
     * forum, Litedown escapes raw HTML, and that is the behaviour an admin
     * there has chosen; the HTMLElements plugin would punch one hole straight
     * through it. The hole is small — a single element whose only attribute is
     * `#url`-filtered — but "small" is not a reason to open something nobody
     * asked for.
     *
     * 🚨 `<embed>` rather than a custom element because s9e will not have one:
     * `aliasElement('ruffle-embed', …)` throws "Invalid element name". Hyphens
     * are rejected, so a custom element is not available to any Flarum
     * extension, whatever the HTML spec allows. `<embed src>` is the element
     * Flash actually used, which makes it the honest choice anyway — and it is
     * one Scribe's own vocabulary does not claim, so the two coexist on the
     * same plugin instance rather than fighting over it.
     */
    private function addHtmlElement(Configurator $config): void
    {
        $plugin = $config->plugins->load('HTMLElements');

        $plugin->aliasElement('embed', self::TAG);
        $plugin->aliasAttribute('embed', 'src', 'url');
        $plugin->aliasAttribute('embed', 'width', 'width');
        $plugin->aliasAttribute('embed', 'height', 'height');
        $plugin->aliasAttribute('embed', 'poster', 'poster');
    }

    /**
     * The one translatable string the template carries, resolved now because a
     * compiled template cannot ask for it later.
     *
     * 🚨 An XSL template is compiled once and cached for the whole forum, so
     * there is no viewer at this point to have a language — it resolves against
     * the forum's default locale, and forum/mount.ts replaces the visible text
     * per reader once the player is built.
     *
     * 🚨 And it falls back rather than throwing. This runs while the formatter
     * is COMPILING, which happens inside a cache miss on an ordinary page
     * render. An exception escaping here does not break one embed; it takes
     * down every page on the forum that renders a post.
     *
     * 🚨 Escaped as XML, because the result is spliced into a template that has
     * to compile. A translator who writes an apostrophe or an ampersand must
     * not be able to produce a forum that renders no posts at all.
     */
    private function fallbackText(): string
    {
        $text = self::FALLBACK_DEFAULT;
        $key = 'ernestdefoe-ruffle.forum.open_file';

        try {
            $translated = $this->translator->trans($key);
            if (is_string($translated) && $translated !== '' && $translated !== $key) {
                $text = $translated;
            }
        } catch (\Throwable) {
            // Keep the English default; see above.
        }

        return htmlspecialchars($text, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }
}
