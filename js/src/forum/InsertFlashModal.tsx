import app from 'flarum/common/app';
/*
 * 🚨 FormModal, not Modal. In Flarum 2 the base `Modal` renders no <form> at
 * all, so a `type="submit"` button inside it submits nothing and `onsubmit` is
 * never called — the Insert button looks finished, is styled, has a label, and
 * does nothing when pressed. FormModal is the one that wraps its content in a
 * form and calls `onsubmit`.
 */
import FormModal from 'flarum/common/components/FormModal';
import type { IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import Stream from 'flarum/common/utils/Stream';
import { settings } from '../common/settings';

export interface InsertFlashAttrs extends IInternalModalAttrs {
  onsubmit: (movie: { url: string; width: number; height: number }) => void;
}

function t(key: string): string {
  return app.translator.trans(`ernestdefoe-ruffle.forum.composer.${key}`) as string;
}

/**
 * Asks for a URL and a size. Used by both editors, because both need exactly
 * this and neither should grow its own copy of it.
 */
export default class InsertFlashModal extends FormModal<InsertFlashAttrs> {
  url = Stream('');
  width = Stream('');
  height = Stream('');

  oninit(vnode: any) {
    super.oninit(vnode);

    const config = settings();
    this.width = Stream(String(config.width));
    this.height = Stream(String(config.height));
  }

  className() {
    return 'InsertFlashModal Modal--small';
  }

  title() {
    return t('title');
  }

  content() {
    return (
      <div className="Modal-body">
        <div className="Form-group">
          <label>{t('url')}</label>
          <input
            className="FormControl"
            type="url"
            inputmode="url"
            placeholder={t('url_placeholder')}
            bidi={this.url}
          />
        </div>

        <div className="Form-group InsertFlashModal-size">
          <label>{t('size')}</label>
          <div className="InsertFlashModal-sizeFields">
            <input
              className="FormControl"
              type="number"
              min="1"
              aria-label={t('width')}
              bidi={this.width}
            />
            <span aria-hidden="true">×</span>
            <input
              className="FormControl"
              type="number"
              min="1"
              aria-label={t('height')}
              bidi={this.height}
            />
          </div>
        </div>

        <div className="Form-group">
          {Button.component(
            { className: 'Button Button--primary', type: 'submit', disabled: !this.url().trim() },
            t('insert')
          )}
        </div>
      </div>
    );
  }

  /**
   * 🚨 The URL is checked here only to catch a typo, never as a security
   * measure. The real filter is `#url` on the server, which is the one that
   * runs on text this modal never touched — a pasted post, an import, an API
   * client. A check that only exists in the composer protects nobody.
   */
  onsubmit(e: SubmitEvent) {
    e.preventDefault();

    const url = this.url().trim();

    if (!/^https?:\/\//i.test(url)) {
      this.alertAttrs = { type: 'error', content: t('invalid_url') };
      return;
    }

    let path = '';
    try {
      path = new URL(url).pathname.toLowerCase();
    } catch {
      this.alertAttrs = { type: 'error', content: t('invalid_url') };
      return;
    }

    // A warning, not a refusal: a URL that serves a .swf without saying so in
    // its path is unusual but perfectly legal, and only the author knows.
    if (!path.endsWith('.swf') && !window.confirm(t('not_swf'))) return;

    const positive = (value: string, fallback: number) => {
      const n = parseInt(value, 10);
      return Number.isFinite(n) && n > 0 ? n : fallback;
    };

    const config = settings();

    this.attrs.onsubmit({
      url,
      width: positive(this.width(), config.width),
      height: positive(this.height(), config.height),
    });

    this.hide();
  }
}
