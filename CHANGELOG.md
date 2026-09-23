# Changelog

Ruffle for Flarum — play Flash (`.swf`) in posts, through a sandboxed emulator
rather than a plugin that no longer exists.

## [0.1.2] — 2026-09-23

### Fixed

- **"Failed to fetch the SWF" now says why.** A movie the browser cannot read —
  on another domain without an `Access-Control-Allow-Origin` header, linked over
  `http://` from an HTTPS forum, or simply gone — produced Ruffle's own generic
  panel, which sends people to look at the player, the extension and their
  Flarum install when the cause is the file's host. The file is now checked
  before the player is started, and the embed says which of those it is.

  🚨 This could not be done in a `catch`: `player.ruffle().load()` does **not**
  reject when the fetch fails. It resolves, and Ruffle renders the failure
  inside itself — so a `try`/`catch` around it looks like handling and silently
  never runs.

- **"The Flash player could not be loaded" is no longer shown when the player
  loaded fine.** The player failing and the movie failing have different causes
  and different fixes, and they were sharing one sentence.

### Changed

- Checking the file first also means a movie that cannot play never mounts
  several megabytes of player in order to display an error.

## [0.1.1] — 2026-09-23

### Fixed

- **The settings page never loaded, and the AdminCP only said "ernestdefoe/ruffle
  failed to initialize".** Settings were registered through
  `app.extensionData` — the Flarum 1.x API, which is absent in Flarum 2, not
  deprecated. Calling it threw inside the initializer, core caught that per
  extension, and the real cause was visible only in the browser console. The
  forum side was unaffected throughout: posts rendered, players played. Settings
  now go through the `Admin` extender, which is the Flarum 2 way.

🚨 **Upgrading requires `php flarum cache:clear`.** Flarum serves one compiled
`assets/admin.js` for the whole forum and will keep serving the old one
otherwise — the extension looks unchanged and the error persists.

## [0.1.0] — 2026-09-23

Initial release.

### Added

- **`[swf]` in the composer.** `[swf]url[/swf]` and `[swf=url][/swf]`, both with
  optional `width` and `height`.
- **A toolbar button** for Flarum's own editor, and one for
  [Scribe](https://github.com/ernestdefoe/scribe) where a movie is a real node
  in the document.
- **Plain `.swf` links become players**, if you want them to. Done in the
  browser, so the post still stores an ordinary link and switching the setting
  off gives every one of them back.
- **Press-to-play**, so the multi-megabyte player is fetched only when a reader
  actually asks for a movie. A page with no Flash on it costs about 10 KB.
- **Scripting and networking shut by default.** A `.swf` is a program, and on a
  forum the files come from members. Ruffle's own defaults are more permissive
  than a forum wants — `allowNetworking` defaults to unrestricted — so leaving
  them unset would have been choosing the wrong thing by not choosing.
- **A plain link inside every embed**, which is what readers get with JavaScript
  off, in a feed reader, and in Flarum's notification emails.
- **A pinned player version**, never "latest", self-hosted or from jsDelivr.

### Notes for anyone reading the source

Three things cost real time and are documented where they live:

- The BBCode needs `forceLookahead`. Without it `[swf=url][/swf]` renders the
  player *and* leaves a literal `[/swf]` in the post, because Flarum always has
  Autolink on and the URL inside the BBCode's own start tag gets matched as a
  link, breaking the tag apart. The player showing up is what makes it easy to
  miss.
- Autolinking `.swf` URLs belongs in the browser, not the parser. Server-side it
  collides with the BBCode's own attribute, and s9e's Preg plugin silently drops
  the lookarounds that would have fixed it — so the guard you write is not the
  guard that runs.
- Scribe's element is `<embed>`, not `<ruffle-embed>`. s9e rejects hyphens in
  element names outright, so a custom element is not available to any Flarum
  extension whatever the HTML spec says.
