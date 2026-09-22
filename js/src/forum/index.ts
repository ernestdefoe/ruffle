import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import ItemList from 'flarum/common/utils/ItemList';
import CommentPost from 'flarum/forum/components/CommentPost';
import TextEditor from 'flarum/common/components/TextEditor';
import TextEditorButton from 'flarum/common/components/TextEditorButton';
import decorate from './decorate';
import registerWithScribe, { scribeEnabled } from './scribe';
import InsertFlashModal from './InsertFlashModal';

export { default as decorate } from './decorate';

app.initializers.add('ernestdefoe/ruffle', () => {
  registerWithScribe();

  /*
   * 🚨 `refreshContent` rather than `oncreate`.
   *
   * It is core's own seam for "this post's rendered HTML just landed in the
   * DOM", and it runs on both oncreate AND onupdate. A reply that arrives live
   * while someone is reading, a post edited in place, a thread scrolled back
   * into view — all of them replace content without a page load, and an
   * `oncreate` hook sees none of them. The embed would simply be a link, and
   * only for the people who were already on the page: the bug nobody can
   * reproduce because reloading fixes it.
   */
  extend(CommentPost.prototype, 'refreshContent', function (this: any) {
    decorate(this.element as HTMLElement);
  });

  /*
   * The composer button for Flarum's own editor. Scribe gets its own, through
   * Scribe's registry — adding both would put two buttons that do the same
   * thing side by side in the same toolbar.
   */
  if (!scribeEnabled()) {
    extend(TextEditor.prototype, 'toolbarItems', function (this: any, items: ItemList<any>) {
      items.add(
        'ruffleFlash',
        TextEditorButton.component(
          {
            icon: 'fas fa-bolt',
            onclick: () =>
              app.modal.show(InsertFlashModal, {
                onsubmit: ({
                  url,
                  width,
                  height,
                }: {
                  url: string;
                  width: number;
                  height: number;
                }) => {
                  /*
                   * Width and height are written out only when they differ
                   * from the forum's defaults. A post that says nothing about
                   * size follows the setting, so an admin who later decides
                   * 800×600 suits their forum changes every one of them at
                   * once — rather than having had the old default baked into
                   * each post at the moment it was written.
                   */
                  const attrs =
                    width || height ? ` width=${width} height=${height}` : '';

                  this.attrs.composer.editor.insertAtCursor(
                    `[swf${attrs}]${url}[/swf]`,
                    false
                  );
                },
              }),
          },
          app.translator.trans('ernestdefoe-ruffle.forum.composer.button')
        ),
        -5
      );
    });
  }

  /*
   * A post rendered anywhere other than the post stream — a search preview, a
   * user's recent activity, an extension's widget — never passes through
   * CommentPost, so it is not decorated. Nothing is lost when it is not: the
   * placeholder still contains a working link to the file, which is exactly
   * what it is there for.
   */
});
