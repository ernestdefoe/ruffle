<?php

namespace ErnestDefoe\Ruffle;

/**
 * Every setting this extension has, its key, and the value a forum that has
 * never opened the settings page gets.
 *
 * Kept in one place because both ends read it: PHP serialises the defaults to
 * the frontend, and the AdminCP writes back to the same keys. A default that
 * disagreed between the two would show an admin one value and apply another.
 */
abstract class Settings
{
    public const PREFIX = 'ernestdefoe-ruffle.';

    /**
     * 🚨 These are the defaults a forum runs on until someone changes them, so
     * they are the security posture of the extension as installed.
     *
     * `allowScriptAccess` and `allowNetworking` are the two that matter. A SWF
     * is a program: ActionScript can call out to JavaScript on the host page
     * (ExternalInterface) and can open URLs and sockets (navigateToURL,
     * getURL, Socket). Ruffle is a sandbox — it does not run Flash Player, and
     * the ActiveX/NPAPI exploit classes are simply not present — but those two
     * APIs are the sandbox's own doors, and on a forum the files come from
     * members. Both are shut here. An admin who runs their own archive can
     * open them; nobody gets them by accident.
     */
    public const DEFAULTS = [
        // 'cdn' or 'self' — see js/src/forum/loader.ts for what each resolves to.
        'source' => 'cdn',
        // Pinned, never "latest". A player that changes underneath a running
        // forum is a bug report nobody can reproduce.
        'version' => '0.6.0',
        // Base URL of a self-hosted copy, i.e. the folder holding ruffle.js.
        'path' => '',
        // 'click' (Ruffle's "off" — a poster the reader presses), 'auto', 'on'.
        'autoplay' => 'click',
        'allowScriptAccess' => false,
        'allowNetworking' => 'none',
        // Flash's own default stage, and still the right guess for most files.
        'width' => 550,
        'height' => 400,
        /*
         * A ceiling on what a member can post, in pixels. 0 is no limit, which
         * is what every existing forum gets — a new setting must not quietly
         * resize everything already written.
         */
        'maxWidth' => 0,
        'maxHeight' => 0,
        // Turn a plain link to a .swf into a player. Done in the browser, not
        // the formatter — see js/src/forum/upgradeLinks.ts for why.
        'upgradeLinks' => true,
    ];

    /** Settings the frontend needs, with their types, for serializeToForum. */
    public const FORUM = [
        'source' => 'string',
        'version' => 'string',
        'path' => 'string',
        'autoplay' => 'string',
        'allowScriptAccess' => 'bool',
        'allowNetworking' => 'string',
        'width' => 'int',
        'height' => 'int',
        'maxWidth' => 'int',
        'maxHeight' => 'int',
        'upgradeLinks' => 'bool',
    ];

    public static function key(string $name): string
    {
        return self::PREFIX.$name;
    }

    /**
     * Cast a stored setting to the type the frontend expects.
     *
     * Settings come back from the database as strings — including '0', which is
     * truthy as a string and false as a bool. Serialising that raw is how a
     * switch an admin turned OFF arrives at the browser as ON.
     */
    public static function cast(string $name, mixed $value): mixed
    {
        $default = self::DEFAULTS[$name];

        if ($value === null || $value === '') {
            return $default;
        }

        return match (self::FORUM[$name]) {
            'bool' => (bool) (int) $value,
            'int' => (int) $value,
            default => (string) $value,
        };
    }
}
