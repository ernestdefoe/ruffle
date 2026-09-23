# Changelog

Ruffle for Flarum — play Flash (`.swf`) in posts, through a sandboxed emulator
rather than a plugin that no longer exists.

## [Unreleased]

### Internal

- **The three decisions that have actually been wrong are now tested.** What
  counts as a `.swf` link, what a response body really is, and where the player
  is fetched from all moved into `js/src/common/swf.ts`, which imports nothing
  from Flarum and so can be exercised by `npm test` — 23 cases, including the
  ones that bit: a `.swf` named in a query string is not a `.swf` link, and a
  correct `content-type` does not make a body a movie.

### Fixed

- Choosing a self-hosted player and leaving the address blank (or filling it
  with spaces) produced `/ruffle.js` against the forum's own root. It now falls
  back to the CDN, which is what an unfilled setting means.

## [0.1.4] — 2026-09-23

### Fixed

- **The diagnosis was skipped in the one case it could not explain.** 0.1.2
  checked that the file could be fetched and, if it could, handed straight over
  to Ruffle — which then put up its own "failed to fetch the SWF" panel anyway.
  So a URL that answers perfectly well but is not a movie produced exactly the
  error the new message existed to replace, and the CORS advice it *did* give
  was wrong for same-origin files.

  The check now reads the first three bytes. Every SWF starts with `FWS`, `CWS`
  or `ZWS`, and the usual culprits announce themselves: a host that blocks
  `.swf` downloads, a soft 404, or a login wall all answer 200 with HTML.

  Verified same-origin against a real movie (plays), a URL answering with a web
  page, a URL answering with something that is not a movie, and a genuine 404 —
  each naming its own cause.

## [0.1.3] — 2026-09-23

### Fixed

- **No way to insert a movie on a forum running Scribe 1.1.x.** The composer
  button for Flarum's own editor was skipped whenever Scribe was *installed*,
  on the assumption that Scribe's own toolbar would supply one. Scribe only
  gained a registry to supply it with in 1.2.0 — so on every Scribe forum until
  then, our button was suppressed in one editor and never added to the other.
  Nothing errored. The feature was simply absent, which is the hardest kind of
  gap to spot because each half works.

  The condition now asks whether Scribe's editor is actually *running* — which
  is a different question from whether it is installed, and also covers Scribe
  standing its editor down when flarum/markdown or fof/rich-text is enabled.

  Verified in all three arrangements: Scribe 1.2.0 active (button in Scribe's
  toolbar, not duplicated in core's), Scribe absent (button in core's toolbar),
  and Scribe installed but stood down by markdown (button in core's toolbar,
  alongside markdown's own).

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
