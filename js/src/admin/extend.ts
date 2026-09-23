import app from 'flarum/admin/app';
import Admin from 'flarum/common/extenders/Admin';

/*
 * `m` is a global on a Flarum page, not a module. Importing 'mithril' makes
 * webpack try to bundle its own copy.
 */
declare const m: import('mithril').Static;

function t(key: string): string {
  return app.translator.trans(`ernestdefoe-ruffle.admin.settings.${key}`) as string;
}

const key = (name: string) => `ernestdefoe-ruffle.${name}`;

/**
 * 🚨 The `Admin` extender, NOT `app.extensionData`.
 *
 * `app.extensionData` is the Flarum 1.x API and is simply absent in Flarum 2 —
 * not deprecated, gone. Calling `.for()` on it throws inside the initializer,
 * core catches that per extension, and the only thing an admin is told is
 * "ernestdefoe/ruffle failed to initialize, check the browser console". The
 * forum keeps working, every other page is fine, and the real cause is
 * console-only — so it reads like the extension is broken rather than like one
 * line is wrong.
 *
 * It shipped that way here and reached a user within hours of the first
 * release. The check costs nothing: `grep -rn 'app\.extensionData' js/src`
 * before calling an admin page done, and then OPEN the page. Compiling is not
 * evidence that anything renders.
 */
export default [
  new Admin()
    /*
     * 🚨 `customSetting` for anything returning a vnode, and a plain function
     * rather than an arrow. `setting()` expects a descriptor OBJECT back and
     * crashes the page when handed a vnode; and core calls the callback as
     * `entry.call(this)` with `this` bound to the AdminPage, which an arrow
     * function silently discards.
     *
     * Not a control: the opening paragraph of the page. An admin deciding
     * whether to allow Flash on their forum in 2026 deserves the position
     * stated plainly rather than inferred from a row of switches.
     */
    .customSetting(function () {
      return m('.Form-group.RuffleSettings-intro', m('p', t('intro')));
    })

    // ---- the player -----------------------------------------------------
    .setting(() => ({
      setting: key('source'),
      label: t('source_label'),
      type: 'select',
      options: { cdn: t('source_cdn'), self: t('source_self') },
      default: 'cdn',
    }))
    .setting(() => ({
      setting: key('version'),
      label: t('version_label'),
      help: t('version_help'),
      type: 'text',
      default: '0.6.0',
    }))
    .setting(() => ({
      setting: key('path'),
      label: t('path_label'),
      help: t('path_help'),
      placeholder: t('path_placeholder'),
      type: 'text',
    }))

    // ---- what a movie may do --------------------------------------------
    .setting(() => ({
      setting: key('allowScriptAccess'),
      label: t('allow_script_access_label'),
      help: t('allow_script_access_help'),
      type: 'boolean',
    }))
    .setting(() => ({
      setting: key('allowNetworking'),
      label: t('allow_networking_label'),
      help: t('allow_networking_help'),
      type: 'select',
      options: {
        none: t('allow_networking_none'),
        internal: t('allow_networking_internal'),
        all: t('allow_networking_all'),
      },
      default: 'none',
    }))

    // ---- display ---------------------------------------------------------
    .setting(() => ({
      setting: key('autoplay'),
      label: t('autoplay_label'),
      help: t('autoplay_help'),
      type: 'select',
      options: {
        click: t('autoplay_click'),
        auto: t('autoplay_auto'),
        on: t('autoplay_on'),
      },
      default: 'click',
    }))
    .setting(() => ({
      setting: key('width'),
      label: t('width_label'),
      type: 'number',
      min: 1,
      default: 550,
    }))
    .setting(() => ({
      setting: key('height'),
      label: t('height_label'),
      help: t('size_help'),
      type: 'number',
      min: 1,
      default: 400,
    }))
    .setting(() => ({
      setting: key('maxWidth'),
      label: t('max_width_label'),
      type: 'number',
      min: 0,
      default: 0,
    }))
    .setting(() => ({
      setting: key('maxHeight'),
      label: t('max_height_label'),
      help: t('max_help'),
      type: 'number',
      min: 0,
      default: 0,
    }))

    // ---- links -----------------------------------------------------------
    .setting(() => ({
      setting: key('upgradeLinks'),
      label: t('upgrade_links_label'),
      help: t('upgrade_links_help'),
      type: 'boolean',
    }))

    .customSetting(function () {
      return m(
        '.Form-group.RuffleSettings-how',
        m('label', t('how_heading')),
        m('.helpText', t('how_body'))
      );
    }),
];
