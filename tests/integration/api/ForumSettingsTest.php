<?php

namespace ErnestDefoe\Ruffle\Tests\integration\api;

use ErnestDefoe\Ruffle\Settings;
use Flarum\Testing\integration\TestCase;
use PHPUnit\Framework\Attributes\Test;

/**
 * The player is built in the browser from the forum payload, so its
 * settings, their types and their defaults are the extension's security
 * posture as installed.
 */
class ForumSettingsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ernestdefoe-ruffle');
    }

    private function forum(): array
    {
        return json_decode((string) $this->send($this->request('GET', '/api'))->getBody(), true)['data']['attributes'];
    }

    #[Test]
    public function a_new_forum_gets_the_locked_down_defaults()
    {
        $forum = $this->forum();

        $this->assertFalse($forum['ruffleAllowScriptAccess']);
        $this->assertSame('none', $forum['ruffleAllowNetworking']);
        $this->assertSame('', $forum['ruffleScriptAccessHosts']);
        $this->assertSame('click', $forum['ruffleAutoplay']);
        $this->assertSame('cdn', $forum['ruffleSource']);
        $this->assertSame('0.6.0', $forum['ruffleVersion']);
        $this->assertSame(550, $forum['ruffleWidth']);
        $this->assertSame(400, $forum['ruffleHeight']);
        $this->assertSame(0, $forum['ruffleMaxWidth']);
        $this->assertTrue($forum['ruffleUpgradeLinks']);
    }

    #[Test]
    public function every_setting_reaches_the_browser()
    {
        $forum = $this->forum();

        foreach (array_keys(Settings::FORUM) as $name) {
            $this->assertArrayHasKey('ruffle'.ucfirst($name), $forum);
        }
    }

    #[Test]
    public function a_switch_turned_off_arrives_off()
    {
        // Stored as strings: "0" is a true string and must not arrive as on.
        $this->setting('ernestdefoe-ruffle.upgradeLinks', '0');
        $this->setting('ernestdefoe-ruffle.allowScriptAccess', '1');
        $this->setting('ernestdefoe-ruffle.width', '800');
        $this->setting('ernestdefoe-ruffle.autoplay', 'auto');

        $forum = $this->forum();

        $this->assertFalse($forum['ruffleUpgradeLinks']);
        $this->assertTrue($forum['ruffleAllowScriptAccess']);
        $this->assertSame(800, $forum['ruffleWidth']);
        $this->assertSame('auto', $forum['ruffleAutoplay']);
    }
}
