/**
 * The decisions this extension gets wrong, in one file with no Flarum imports.
 *
 * 🚨 Everything here is pure on purpose. These three are the parts that have
 * actually been wrong in front of a user — what counts as a .swf link, what a
 * response body really is, and where the player is fetched from — and they were
 * unreachable from a test while they lived inside modules that import
 * `flarum/common/app`. Compiled and exercised by js/tests/swf.test.mjs.
 */

/** What came back from a URL, judged by its first bytes rather than its name. */
export type BodyKind = 'swf' | 'html' | 'other';

/**
 * Does this link point at a Flash movie?
 *
 * 🚨 Parsed, not pattern-matched. The path is what decides: a query string or a
 * fragment must not stop `movie.swf?v=2` being recognised, and `?file=x.swf`
 * must not conjure one out of a URL that points somewhere else entirely.
 */
export function isSwfUrl(href: string, base: string): boolean {
  try {
    return new URL(href, base).pathname.toLowerCase().endsWith('.swf');
  } catch {
    return false;
  }
}

/**
 * 🚨 A readable URL is not a readable movie, and assuming it was is what let
 * the very failure this diagnoses slip through: the fetch succeeded, nothing
 * looked wrong, the player started, and Ruffle put up its own opaque panel.
 *
 * Every SWF begins with `FWS` (uncompressed), `CWS` (zlib) or `ZWS` (LZMA).
 * Three bytes settle it — and the usual causes give themselves away here,
 * because a host blocking .swf downloads, a soft 404 and a login wall all
 * answer 200 with HTML.
 */
export function classifyBody(head: string, contentType: string): BodyKind {
  if (head.startsWith('FWS') || head.startsWith('CWS') || head.startsWith('ZWS')) {
    return 'swf';
  }

  if (contentType.toLowerCase().includes('html') || head.trimStart().startsWith('<')) {
    return 'html';
  }

  return 'other';
}

/**
 * Shrink a movie to fit inside an admin's ceiling, keeping its shape.
 *
 * 🚨 Scaled, not truncated. Clamping each side independently turns a 1600x400
 * banner into an 800x400 one — a different movie, squashed, and Ruffle then
 * letterboxes the result inside the wrong box. The whole point of a size on an
 * embed is its aspect ratio; a ceiling should make it smaller, not reshape it.
 *
 * A limit of 0 (or anything not positive) means "no limit", so an admin who
 * only wants to cap the height does not have to invent a width.
 *
 * Rounded, and never below 1: a ceiling of 1 against a very wide movie would
 * otherwise produce a height of 0 and an embed with no box at all.
 */
export function fitWithin(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const scale = Math.min(
    maxWidth > 0 ? maxWidth / width : 1,
    maxHeight > 0 ? maxHeight / height : 1,
    1 // never enlarge — a ceiling is not a target
  );

  if (scale >= 1) return { width, height };

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Where ruffle.js is fetched from.
 *
 * 🚨 Version-pinned, never `latest`. Ruffle emulates a twenty-year-old format
 * and its behaviour on any given file genuinely changes between releases; a
 * forum whose player moved underneath it produces "it worked last week" reports
 * that cannot be reproduced.
 */
export function ruffleScriptUrl(source: string, version: string, path: string): string {
  if (source === 'self' && path.trim() !== '') {
    // Trailing slashes are what an admin naturally pastes, and a doubled slash
    // is a 404 on some servers and a redirect on others.
    return path.trim().replace(/\/+$/, '') + '/ruffle.js';
  }

  return `https://cdn.jsdelivr.net/npm/@ruffle-rs/ruffle@${encodeURIComponent(version)}/ruffle.js`;
}
