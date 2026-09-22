import app from 'flarum/common/app';
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

function fail(embed: HTMLElement, url: string): void {
  embed.classList.add('RuffleEmbed--failed');
  embed.replaceChildren();

  const message = document.createElement('p');
  message.className = 'RuffleEmbed-message';
  message.textContent = t('failed');

  const help = document.createElement('p');
  help.className = 'RuffleEmbed-help';
  help.textContent = t('failed_help');

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

    try {
      // The only place the player is pulled in. Everything above this line is
      // a few hundred bytes; everything below it is several megabytes.
      const { play } = await import('./player');
      await play(stage, url, { width, height });
      stage.classList.remove('RuffleEmbed-stage--loading');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[ruffle]', e);
      fail(embed, url);
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
