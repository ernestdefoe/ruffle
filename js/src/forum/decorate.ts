import app from 'flarum/common/app';
import extractText from 'flarum/common/utils/extractText';
import { settings } from '../common/settings';

/** Set on an element once we have taken it over, so we never do it twice. */
const CLAIMED = 'ruffleReady';

function t(key: string): string {
  return app.translator.trans(`ernestdefoe-ruffle.forum.${key}`) as string;
}

function isSwfUrl(href: string): boolean {
  try {
    // Parsed, not regexed: a query string or a fragment must not stop a .swf
    // being recognised, and `?download=x.swf` must not make one out of nothing.
    return new URL(href, window.location.href).pathname.toLowerCase().endsWith('.swf');
  } catch {
    return false;
  }
}

/**
 * Turn a plain link to a .swf file into an embed placeholder.
 *
 * 🚨 Done here rather than in the formatter, and that is a deliberate reversal
 * of where this belongs.
 *
 * Autolinking `.swf` URLs server-side means matching them inside the parser,
 * where they collide with the BBCode's own attribute — `[swf=…/game.swf]` gets
 * torn in half by whichever plugin matches the URL first. s9e's Preg plugin
 * also silently drops the lookarounds that would have fixed it, so the guard
 * you write is not the guard that runs.
 *
 * Doing it in the browser has a better property anyway: the post still stores
 * an ordinary link. Switch the setting off and every one of them is a link
 * again, with nothing rewritten and nothing to migrate back.
 */
function upgradeLinks(root: HTMLElement): void {
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
    if (!isSwfUrl(link.href)) return;
    // A link that is already inside one of our embeds is its own fallback.
    if (link.closest('.RuffleEmbed')) return;

    const embed = document.createElement('div');
    embed.className = 'RuffleEmbed';
    embed.dataset.swf = link.href;
    embed.appendChild(link.cloneNode(true));

    link.replaceWith(embed);
  });
}

function size(embed: HTMLElement): { width: number; height: number } {
  const config = settings();
  const width = parseInt(embed.dataset.width || '', 10);
  const height = parseInt(embed.dataset.height || '', 10);

  return {
    width: Number.isFinite(width) && width > 0 ? width : config.width,
    height: Number.isFinite(height) && height > 0 ? height : config.height,
  };
}

/**
 * Work out WHY the browser could not read a .swf, from the browser.
 *
 * 🚨 Run BEFORE the player is handed the URL, not in a catch afterwards.
 * `player.ruffle().load()` does NOT reject when the .swf cannot be fetched — it
 * resolves, and Ruffle draws its own panel inside the player saying it failed
 * to fetch. So there is no exception to catch: a `try`/`catch` around `load()`
 * looks like it handles this and silently never runs. Checking first is the
 * only way to say anything useful, and it also avoids mounting several
 * megabytes of player that can only display an error.
 *
 * Ruffle's own message stops at "failed to fetch the SWF", which sends people
 * to look at the player, at the extension and at their Flarum install — when
 * the cause is almost always the file's own host saying no.
 *
 * 🚨 Cross-origin, this CANNOT tell a missing file from a missing CORS header.
 * An opaque `no-cors` response resolves for a 404 exactly as it does for a 200,
 * so the status is not visible to us at all. The message says both rather than
 * picking one — a confident wrong diagnosis is worse than an honest pair.
 */
async function diagnose(url: string): Promise<string | null> {
  let target: URL;

  try {
    target = new URL(url, window.location.href);
  } catch {
    return t('reason_unreachable');
  }

  // Definite, and worth naming on its own: the browser blocks it outright and
  // nothing about the file or its host is wrong.
  if (window.location.protocol === 'https:' && target.protocol === 'http:') {
    return t('reason_mixed');
  }

  try {
    /*
     * A plain GET, and deliberately not a HEAD (not every host allows one) nor
     * a Range request (some answer 416 and look broken when they are fine).
     * `fetch` resolves as soon as the headers arrive and the body is never
     * read here, so this does not download the movie twice — Ruffle's own
     * request a moment later is served from cache.
     */
    const res = await fetch(url);

    if (res.ok) return await looksLikeSwf(res);

    /*
     * 🚨 `extractText`, not a cast. A translation with a parameter comes back
     * as an array of vnodes, not a string — casting it lands `[object Object]`
     * in the message, and only for the one line that interpolates anything.
     */
    return extractText(
      app.translator.trans('ernestdefoe-ruffle.forum.reason_status', { code: String(res.status) })
    );
  } catch {
    try {
      /*
       * An opaque response still resolves when the host is reachable, which
       * separates "your forum may not read this" from "this address goes
       * nowhere". It cannot separate either from a 404 — see above.
       */
      await fetch(url, { method: 'GET', mode: 'no-cors' });
      return t('reason_cors');
    } catch {
      return t('reason_unreachable');
    }
  }
}

/**
 * Is what came back actually a Flash movie?
 *
 * 🚨 A readable URL is not a readable MOVIE, and assuming it was left the worst
 * possible gap: the fetch succeeded, this function said nothing was wrong, the
 * player started, and Ruffle put up its own "failed to fetch" panel — so the
 * whole diagnosis was skipped in precisely the case it could not explain. The
 * first person to hit it reported the same error for a same-origin file, where
 * the CORS advice we were giving is simply wrong.
 *
 * Every SWF begins with `FWS` (uncompressed), `CWS` (zlib) or `ZWS` (LZMA).
 * Three bytes settle it, and the common causes announce themselves: a host that
 * blocks .swf downloads, a soft 404, or a login wall all answer 200 with HTML.
 */
async function looksLikeSwf(res: Response): Promise<string | null> {
  let head: string;

  try {
    const buf = await res.clone().arrayBuffer();
    head = String.fromCharCode(...new Uint8Array(buf.slice(0, 3)));
  } catch {
    // Unreadable body, but the request itself was fine — say nothing rather
    // than invent a cause.
    return null;
  }

  if (head === 'FWS' || head === 'CWS' || head === 'ZWS') return null;

  const type = (res.headers.get('content-type') || '').toLowerCase();

  return type.includes('html') || head.startsWith('<') ? t('reason_html') : t('reason_not_swf');
}

/**
 * 🚨 Two different failures, two different messages.
 *
 * The player failing to load and the MOVIE failing to load are not the same
 * thing and do not have the same fix, but they used to print the same sentence
 * — "The Flash player could not be loaded" — which is actively misleading when
 * the player is sitting there working and it is the file that could not be
 * read. It points at the extension instead of at the file's host.
 */
function fail(embed: HTMLElement, url: string, kind: 'player' | 'movie', reason?: string): void {
  embed.classList.add('RuffleEmbed--failed');
  embed.replaceChildren();

  const message = document.createElement('p');
  message.className = 'RuffleEmbed-message';
  message.textContent = kind === 'player' ? t('failed') : t('failed_movie');

  const help = document.createElement('p');
  help.className = 'RuffleEmbed-help';
  help.textContent = reason ?? t('failed_help');

  const link = document.createElement('a');
  link.className = 'RuffleEmbed-fallback';
  link.href = url;
  link.rel = 'nofollow noopener ugc';
  link.target = '_blank';
  link.textContent = t('open_original');

  embed.append(message, help, link);
}

/**
 * Build the poster a reader presses, and mount the player when they do.
 *
 * The poster carries the real dimensions so pressing play does not shove the
 * rest of the thread down the page — the box is already the size the movie will
 * be. `<button>` rather than a styled div, so it is reachable by keyboard and
 * announced as something you can press.
 */
function prepare(embed: HTMLElement): void {
  if (embed.dataset[CLAIMED]) return;

  const url = embed.dataset.swf;
  if (!url) return;

  embed.dataset[CLAIMED] = '1';

  const { width, height } = size(embed);
  const stage = document.createElement('div');
  stage.className = 'RuffleEmbed-stage';
  stage.style.aspectRatio = `${width} / ${height}`;
  stage.style.maxWidth = `${width}px`;

  const start = async () => {
    stage.replaceChildren();
    stage.classList.add('RuffleEmbed-stage--loading');

    const loading = document.createElement('p');
    loading.className = 'RuffleEmbed-message';
    loading.textContent = t('loading');
    stage.appendChild(loading);

    // Before the player, not after — see diagnose().
    const problem = await diagnose(url);

    if (problem !== null) {
      fail(embed, url, 'movie', problem);
      return;
    }

    try {
      // The only place the player is pulled in. Everything above this line is
      // a few hundred bytes; everything below it is several megabytes.
      const { play } = await import('./player');
      await play(stage, url, { width, height });
      stage.classList.remove('RuffleEmbed-stage--loading');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[ruffle]', e);

      /*
       * The failure says which half of it gave up (see RuffleError in
       * player.ts). The movie case is all but unreachable now that the file is
       * checked first, but a file can still vanish between the two requests.
       */
      const movie = (e as { stage?: string })?.stage === 'movie';

      fail(embed, url, movie ? 'movie' : 'player', movie ? await diagnose(url) ?? undefined : undefined);
    }
  };

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'RuffleEmbed-play';
  button.setAttribute('aria-label', t('play'));

  const icon = document.createElement('i');
  icon.className = 'icon fas fa-play';
  icon.setAttribute('aria-hidden', 'true');

  const caption = document.createElement('span');
  caption.className = 'RuffleEmbed-caption';
  caption.textContent = t('play');

  button.append(icon, caption);
  button.addEventListener('click', start);
  stage.appendChild(button);

  embed.replaceChildren(stage);

  if (settings().autoplay !== 'click') start();
}

/**
 * Find every Flash embed inside a piece of rendered content and take it over.
 *
 * 🚨 Must be called for content that arrives WITHOUT a page load as well —
 * a new reply appearing live, a post being edited in place, a thread scrolled
 * into view. Content that only gets decorated on first paint looks like it
 * works right up until someone posts while you are reading.
 */
export default function decorate(root: HTMLElement | null | undefined): void {
  if (!root) return;

  if (settings().upgradeLinks) upgradeLinks(root);

  root.querySelectorAll<HTMLElement>('.RuffleEmbed').forEach(prepare);
}
