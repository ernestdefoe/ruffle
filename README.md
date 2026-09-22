# Ruffle for Flarum

**Play Flash in posts again.**

Write `[swf]https://example.com/movie.swf[/swf]` and the post gets a player.
Not Adobe's plugin — [Ruffle](https://ruffle.rs), an open-source Flash emulator
written in Rust and compiled to WebAssembly, running in the page like any other
script.

[![Flarum](https://img.shields.io/badge/Flarum-2.0-orange)](https://flarum.org)
[![Licence](https://img.shields.io/badge/licence-MIT-blue)](LICENSE)

---

## Why this is not the Flash you remember

The vulnerabilities that ended Flash were in the *runtime* — the ActiveX control
and the NPAPI plugin, native code with access to the machine, shipped to a
billion desktops. Ruffle is none of those things. It shares no code with Adobe's
player, runs inside the browser's own WebAssembly sandbox, and has no more reach
into your computer than the page it sits on.

What a `.swf` can still do is talk to the page it is embedded in and open
connections of its own — ActionScript's `ExternalInterface`, `navigateToURL`,
`Socket`. Those are the sandbox's own doors, and on a forum the files come from
members. **Both are shut by default here**, and an admin who runs their own
archive can open them deliberately.

## What you get

- **`[swf]` in the composer.** `[swf]url[/swf]`, or with a size:
  `[swf width=800 height=600]url[/swf]`.
- **A toolbar button** in Flarum's editor, and in
  [Scribe](https://github.com/ernestdefoe/scribe) if you use it — where a movie
  becomes a real block you can select, drag and delete.
- **Plain links become players**, optionally. A post containing a bare link to a
  `.swf` gets a player instead. Turn it off and they are links again — the post
  itself was never rewritten.
- **Press-to-play by default.** The player is several megabytes; nobody
  downloads it for a thread they are only reading.
- **A real link underneath.** Every embed contains an ordinary link to the file,
  which is what search engines index and what readers get with JavaScript off,
  in a feed reader, or in Flarum's notification emails.

## Installation

```bash
composer require ernestdefoe/ruffle
php flarum cache:clear
```

Then open **Ruffle** in the AdminCP.

## Where the player comes from

By default, a **pinned version** from jsDelivr. Pinned, never "latest": Ruffle
emulates a twenty-year-old format and its behaviour on any given file genuinely
changes between releases, and a player that moves underneath a running forum
produces bug reports nobody can reproduce.

To **host it yourself** — no third-party request, and your forum's privacy
policy stays shorter — download the *selfhosted* package from
[Ruffle's releases](https://github.com/ruffle-rs/ruffle/releases), extract it
somewhere public, and point the setting at that folder.

Two things your server must get right:

- **`.wasm` files must be served as `application/wasm`.** Nginx does not do this
  by default. The player loads and then fails to start, which looks like a bug
  in the extension rather than a MIME type.
  ```
  types { application/wasm wasm; }
  ```
- **If you set a Content-Security-Policy**, it needs `'wasm-unsafe-eval'` in
  `script-src`.

## Settings

| | |
| --- | --- |
| **Where the player is loaded from** | jsDelivr, or a copy you host |
| **Ruffle version** | Pinned. Change it deliberately |
| **Let movies call JavaScript** | `ExternalInterface`. Off by default |
| **Network access** | None / same movie only / unrestricted. None by default |
| **When a movie starts** | On press (default), automatically, or always |
| **Default size** | 550 × 400 — Flash's own default stage |
| **Turn plain `.swf` links into players** | On by default |

## Works with Scribe

[Scribe](https://github.com/ernestdefoe/scribe) stores posts as HTML rather than
Markdown, so it needs its own integration — and it has one. Install both and a
**Flash movie** button appears in Scribe's toolbar; a movie is a real node in
the document, shown as a card rather than a broken plugin box, and saved as an
`<embed>` element that the server understands.

Scribe 1.2 or later is required for the toolbar button. Older versions still
render posts containing Flash correctly; they just cannot insert one.

## How it actually works

The server never builds a player and never touches a `.swf`. The formatter turns
`[swf]` into an inert placeholder carrying the URL — that is the only design
s9e\TextFormatter permits, since its template checker rejects `<object>`,
`<embed>`, `<iframe>` and `<script>` in a template outright, and it is right to.

The browser turns that placeholder into a player, and only when a reader asks:
the code that talks to Ruffle is a separate chunk, and Ruffle itself is fetched
on the first press. A page with no Flash on it costs about 10 KB.

## Requirements

- Flarum 2.0
- PHP 8.3+

## Licence

MIT. Ruffle itself is MIT OR Apache-2.0 and is not bundled — it is fetched at
runtime from wherever you point it. This extension is not affiliated with the
Ruffle project.

## Changelog

**[CHANGELOG.md](CHANGELOG.md)**
