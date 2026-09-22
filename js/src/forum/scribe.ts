import app from 'flarum/common/app';
import InsertFlashModal from './InsertFlashModal';

/**
 * Registration with Scribe, if Scribe is there.
 *
 * 🚨 Deliberately NOT `import … from 'ext:ernestdefoe/scribe/forum'`. That
 * compiles to `flarum.reg.get('ernestdefoe-scribe', 'forum')`, which returns
 * `undefined` on a forum without Scribe — and destructuring an export off
 * `undefined` throws while this module is still being evaluated, before any
 * initializer runs. In Flarum that does not break one extension; it aborts the
 * whole bundle, so every extension registered after this one in the same file
 * silently never loads, and the error points here rather than at them.
 *
 * `onLoad` also removes the ordering question entirely: it fires immediately if
 * Scribe is already registered, and later if it is not yet.
 *
 * 🚨 The module id is `registry`, not `forum`. Flarum's build registers a module
 * under its own source path and only for modules webpack keeps separate, so
 * Scribe's bundle exposes `common/toolbarButtons` and `common/ScribeEditorDriver`
 * and no `forum` at all — waiting on that id waits forever, and the failure is
 * silent at both ends. `registry` is a name Scribe adds by hand for exactly this
 * purpose.
 */

const SCRIBE = 'ernestdefoe-scribe';
const REGISTRY = 'registry';

interface ScribeApi {
  registerExtension?: (factory: (kit: any) => any) => void;
  registerButton?: (button: Record<string, unknown>) => void;
}

declare const flarum: {
  reg: { onLoad(namespace: string, id: string, handler: (module: any) => void): void };
  extensions: Record<string, unknown>;
};

/**
 * `<embed>`, matching the element the server aliases onto the RUFFLE tag.
 *
 * 🚨 The element name and the server alias are one decision written in two
 * files, and Scribe drops anything its formatter does not recognise at PARSE
 * time — silently. Change this to some other element without changing
 * src/Formatter/Configure.php and the post still saves; the movie is just gone
 * from it, with no error and nothing in the log.
 *
 * 🚨 And a custom element is not an option, however much `<ruffle-embed>` would
 * read better: s9e rejects hyphens in element names outright.
 */
function node(kit: any) {
  const { Node, mergeAttributes } = kit;

  return Node.create({
    name: 'ruffleFlash',
    group: 'block',
    // Nothing inside it, ever — the player is built from attributes alone.
    atom: true,
    draggable: true,

    addAttributes() {
      return {
        src: { default: null },
        width: { default: null },
        height: { default: null },
      };
    },

    parseHTML() {
      return [{ tag: 'embed[src]' }];
    },

    renderHTML({ HTMLAttributes }: any) {
      return ['embed', mergeAttributes(HTMLAttributes)];
    },

    /*
     * 🚨 A card, not the element itself. `<embed>` inside a contenteditable is
     * a live embed: the browser tries to render the plugin content, which in
     * 2026 means a broken-plugin box the author cannot select, click past or
     * delete. What the editor SHOWS and what it SERIALISES are different
     * things, and renderHTML above is the one that reaches the server.
     */
    addNodeView() {
      return ({ node: n }: any) => {
        const dom = document.createElement('div');
        dom.className = 'RuffleEmbed-editorCard';
        dom.contentEditable = 'false';

        const icon = document.createElement('i');
        icon.className = 'icon fas fa-bolt';
        icon.setAttribute('aria-hidden', 'true');

        const label = document.createElement('span');
        label.textContent = n.attrs.src ?? '';

        dom.append(icon, label);

        return { dom };
      };
    },
  });
}

export default function registerWithScribe(): void {
  if (typeof flarum === 'undefined' || !flarum.reg) return;

  flarum.reg.onLoad(SCRIBE, REGISTRY, (scribe: ScribeApi) => {
    scribe.registerExtension?.(node);

    scribe.registerButton?.({
      key: 'ruffleFlash',
      icon: 'fas fa-bolt',
      label: 'flash',
      translationKey: 'ernestdefoe-ruffle.forum.composer.button',
      active: (editor: any) => editor.isActive('ruffleFlash'),
      run: (editor: any) => {
        app.modal.show(InsertFlashModal, {
          onsubmit: ({ url, width, height }: { url: string; width: number; height: number }) => {
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'ruffleFlash',
                attrs: { src: url, width: String(width), height: String(height) },
              })
              .run();
          },
        });
      },
    });
  });
}

/**
 * Whether Scribe is the editor in play.
 *
 * Used to decide which composer button to add: adding both would put two
 * buttons that do the same thing in the same toolbar.
 */
export function scribeEnabled(): boolean {
  return typeof flarum !== 'undefined' && SCRIBE in (flarum.extensions ?? {});
}
