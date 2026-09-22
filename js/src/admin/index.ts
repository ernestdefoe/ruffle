import app from 'flarum/admin/app';

/*
 * `m` is a global on a Flarum page, not a module. Importing 'mithril' makes
 * webpack try to bundle its own copy, which is both a build failure here and,
 * were it to resolve, a second Mithril sharing nothing with the running one.
 */
declare const m: import('mithril').Static;

function t(key: string): string {
  return app.translator.trans(`ernestdefoe-ruffle.admin.settings.${key}`) as string;
}

const key = (name: string) => `ernestdefoe-ruffle.${name}`;

app.initializers.add('ernestdefoe/ruffle', () => {
  // @ts-ignore — `extensionData` is real at runtime but absent from core's
  // published dist-typings for AdminApplication.
  app.extensionData
    .for('ernestdefoe-ruffle')

    /*
     * 🚨 A bare function, not `{ type: 'custom' }`. Core's
     * `buildSettingComponent` branches on `typeof entry === 'function'` and
     * passes anything else to FormGroup, which has no 'custom' type — so an
     * object renders as an empty form row rather than as this text.
     *
     * Not a control: the opening paragraph of the page. An admin deciding
     * whether to allow Flash on their forum in 2026 deserves the position
     * stated plainly, rather than having to infer it from a row of switches.
     */
    .registerSetting(() => m('.Form-group.RuffleSettings-intro', m('p', t('intro'))))

    // ---- the player -----------------------------------------------------
    .registerSetting({
      setting: key('source'),
      label: t('source_label'),
      type: 'select',
      options: { cdn: t('source_cdn'), self: t('source_self') },
      default: 'cdn',
    })
    .registerSetting({
      setting: key('version'),
      label: t('version_label'),
      help: t('version_help'),
      type: 'text',
      default: '0.6.0',
    })
    .registerSetting({
      setting: key('path'),
      label: t('path_label'),
      help: t('path_help'),
      placeholder: t('path_placeholder'),
      type: 'text',
    })

    // ---- what a movie may do --------------------------------------------
    .registerSetting({
      setting: key('allowScriptAccess'),
      label: t('allow_script_access_label'),
      help: t('allow_script_access_help'),
      type: 'boolean',
    })
    .registerSetting({
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
    })

    // ---- display ---------------------------------------------------------
    .registerSetting({
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
    })
    .registerSetting({
      setting: key('width'),
      label: t('width_label'),
      type: 'number',
      min: 1,
      default: 550,
    })
    .registerSetting({
      setting: key('height'),
      label: t('height_label'),
      help: t('size_help'),
      type: 'number',
      min: 1,
      default: 400,
    })

    // ---- links -----------------------------------------------------------
    .registerSetting({
      setting: key('upgradeLinks'),
      label: t('upgrade_links_label'),
      help: t('upgrade_links_help'),
      type: 'boolean',
    })

    .registerSetting(() =>
      m(
        '.Form-group.RuffleSettings-how',
        m('label', t('how_heading')),
        m('.helpText', t('how_body'))
      )
    );
});
