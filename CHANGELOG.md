# Changelog

Ruffle for Flarum — play Flash (`.swf`) in posts, through a sandboxed emulator
rather than a plugin that no longer exists.

## [Unreleased]

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
