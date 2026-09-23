import { settings, type RuffleSettings } from '../common/settings';

/**
 * Everything that talks to Ruffle lives behind this module, and nothing imports
 * it statically — see decorate.ts for the dynamic import.
 *
 * 🚨 This file is the performance design. Ruffle is a Flash Player compiled to
 * WebAssembly and the runtime is several megabytes. Fetching it because a page
 * happens to contain a post that mentions Flash would be far worse than any
 * JavaScript weight Flarum normally deals with, so nothing here runs until a
 * reader has actually asked for a movie.
 */

/**
 * Which half of `play()` gave up.
 *
 * 🚨 The two have different causes and different fixes — the PLAYER not
 * arriving is a CDN, a CSP or a self-hosted path; the MOVIE not arriving is the
 * file's own host. The caller cannot tell them apart from the outside, and
 * sniffing the message would mean depending on wording Ruffle is free to
 * change, so the failure says which one it was.
 */
export class RuffleError extends Error {
  constructor(
    message: string,
    public readonly stage: 'player' | 'movie'
  ) {
    super(message);
    this.name = 'RuffleError';
  }
}

interface RufflePlayerElement extends HTMLElement {
  ruffle(): { load(config: Record<string, unknown>): Promise<void> };
  remove(): void;
}

interface RuffleApi {
  newest(): { createPlayer(): RufflePlayerElement };
}

declare global {
  interface Window {
    RufflePlayer?: RuffleApi & { config?: Record<string, unknown> };
  }
}

/**
 * Where ruffle.js comes from.
 *
 * 🚨 The CDN URL is version-pinned, never `latest`. Ruffle is an emulator of a
 * twenty-year-old format and its behaviour on any given file genuinely changes
 * between releases; a forum whose player silently moved underneath it produces
 * "it worked last week" reports that cannot be reproduced.
 */
function scriptUrl(config: RuffleSettings): string {
  if (config.source === 'self' && config.path) {
    return config.path.replace(/\/+$/, '') + '/ruffle.js';
  }

  return `https://cdn.jsdelivr.net/npm/@ruffle-rs/ruffle@${encodeURIComponent(config.version)}/ruffle.js`;
}

let loading: Promise<RuffleApi> | null = null;

/**
 * Fetch ruffle.js once per page, however many embeds ask for it.
 *
 * The promise itself is the lock: three readers pressing play on three movies
 * in the same thread share one request, and the second and third do not have to
 * know the first happened.
 */
function loadRuffle(config: RuffleSettings): Promise<RuffleApi> {
  if (loading) return loading;

  loading = new Promise<RuffleApi>((resolve, reject) => {
    if (window.RufflePlayer?.newest) {
      resolve(window.RufflePlayer);
      return;
    }

    /*
     * 🚨 `polyfills: false`, set BEFORE the script loads because Ruffle reads
     * its config as it boots.
     *
     * Ruffle's polyfill scans the whole document for `<object>` and `<embed>`
     * elements and replaces them with players — on every page, continuously,
     * via a MutationObserver. This extension never emits either element into a
     * rendered post (the formatter's template checker would not allow it
     * anyway), so the scan can only find things that are not ours: an embed in
     * some other extension's widget, in a custom header, in an advert. Leaving
     * it on means installing this extension quietly changes pages that have
     * nothing to do with Flash posts.
     */
    window.RufflePlayer = window.RufflePlayer || ({} as RuffleApi);
    window.RufflePlayer.config = { ...(window.RufflePlayer.config ?? {}), polyfills: false };

    const script = document.createElement('script');
    script.src = scriptUrl(config);
    script.async = true;
    script.onload = () => {
      if (window.RufflePlayer?.newest) resolve(window.RufflePlayer);
      else reject(new RuffleError('ruffle.js loaded but exposed no player', 'player'));
    };
    /*
     * 🚨 Reset the lock on failure, so a reader who was offline for the first
     * attempt can press play again and get a real second try rather than the
     * same rejected promise for the rest of their session.
     */
    script.onerror = () => {
      loading = null;
      reject(new RuffleError('could not load ruffle.js from ' + script.src, 'player'));
    };

    document.head.appendChild(script);
  });

  return loading;
}

/**
 * Replace `container`'s contents with a running player.
 *
 * Returns nothing and throws on failure; the caller owns what a failure looks
 * like, because only it knows what the reader was looking at before.
 */
export async function play(
  container: HTMLElement,
  url: string,
  size: { width: number; height: number }
): Promise<void> {
  const config = settings();
  const api = await loadRuffle(config);

  const player = api.newest().createPlayer();
  player.style.width = '100%';
  player.style.height = '100%';
  player.style.display = 'block';

  container.replaceChildren(player);

  /*
   * 🚨 These four are the security posture, and they are passed per player
   * rather than set globally on purpose: a global config object is something
   * any other script on the page can reach in and change.
   *
   * A .swf is a program. ActionScript's ExternalInterface can call JavaScript
   * on the host page, and getURL/navigateToURL/Socket can reach the network —
   * those are the sandbox's own doors, and on a forum the files come from
   * members. Ruffle's own defaults are more permissive than a forum wants
   * (`allowNetworking` defaults to "all"), so leaving them unset would be
   * choosing the wrong thing by not choosing.
   */
  try {
    await loadMovie(player, url, size, config);
  } catch (e) {
    throw new RuffleError(e instanceof Error ? e.message : String(e), 'movie');
  }
}

async function loadMovie(
  player: RufflePlayerElement,
  url: string,
  size: { width: number; height: number },
  config: RuffleSettings
): Promise<void> {
  await player.ruffle().load({
    url,
    allowScriptAccess: config.allowScriptAccess,
    allowNetworking: config.allowNetworking,
    /*
     * 🚨 Always 'on', never Ruffle's 'off', and the difference is a bug you
     * only see by looking at the thing.
     *
     * Our own 'click' setting means "do not fetch several megabytes of player
     * until a reader asks for it" — and by the time this function runs, one
     * has. Passing that through as Ruffle's 'off' makes Ruffle draw ITS play
     * button on top of the movie, so the reader presses play, waits through a
     * download, and is shown a second play button to press. Two buttons for
     * one intention.
     */
    autoplay: 'on',
    // Black bars rather than a stretched movie when the container's aspect
    // ratio does not match the stage's.
    letterbox: 'on',
    // The reader pressed play; they do not need to press it again for sound.
    unmuteOverlay: 'hidden',
    width: size.width,
    height: size.height,
  });
}
