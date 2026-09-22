<?php

/*
 * Ruffle for Flarum — play Flash (.swf) in posts.
 *
 * The split across this file is the whole architecture: the SERVER only ever
 * produces an inert placeholder carrying a URL, and the BROWSER turns that into
 * a player on demand. Nothing here loads, proxies or inspects a SWF.
 */

use ErnestDefoe\Ruffle\Formatter\Configure;
use ErnestDefoe\Ruffle\Settings;
use Flarum\Extend;

/*
 * 🚨 The cast is not decoration. Settings come out of the database as strings,
 * and '0' is a true string. Serialising a switch raw is how one an admin turned
 * OFF arrives at the browser turned ON.
 *
 * 🚨 The arrow function captures $name by VALUE at the point it is defined,
 * which is the only reason one loop can build nine different callbacks. A
 * `function () use (&$name)` here would give every setting the last key in the
 * list.
 */
$settings = new Extend\Settings();

foreach (array_keys(Settings::FORUM) as $name) {
    $settings = $settings
        ->default(Settings::key($name), Settings::DEFAULTS[$name])
        ->serializeToForum(
            'ruffle'.ucfirst($name),
            Settings::key($name),
            fn ($value) => Settings::cast($name, $value)
        );
}

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        /*
         * 🚨 Not optional. Ruffle's own loader is fetched at runtime, but the
         * code that mounts a player is a dynamic import so it stays out of
         * forum.js — a visitor reading a thread with no Flash in it should pay
         * nothing for this extension. Flarum does not publish an extension's
         * chunk files unless the directory holding them is declared; without
         * this the browser requests the chunk, gets a 404, and embeds silently
         * never mount, with no server-side error anywhere to find.
         */
        ->jsDirectory(__DIR__.'/js/dist/forum')
        ->css(__DIR__.'/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        ->css(__DIR__.'/less/admin.less'),

    new Extend\Locales(__DIR__.'/locale'),

    (new Extend\Formatter())
        ->configure(Configure::class),

    $settings,
];
