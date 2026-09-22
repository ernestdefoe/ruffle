import app from 'flarum/common/app';

export type Autoplay = 'click' | 'auto' | 'on';
export type Networking = 'none' | 'internal' | 'all';

export interface RuffleSettings {
  source: 'cdn' | 'self';
  version: string;
  path: string;
  autoplay: Autoplay;
  allowScriptAccess: boolean;
  allowNetworking: Networking;
  width: number;
  height: number;
  upgradeLinks: boolean;
}

/**
 * 🚨 Mirrors src/Settings.php::DEFAULTS, and has to stay in step with it.
 *
 * These are not "just in case" values — they are what runs on a forum whose
 * admin has never opened the settings page, which is most of them. In
 * particular `allowScriptAccess: false` and `allowNetworking: 'none'` are the
 * two that keep a member-supplied movie inside the sandbox.
 */
export const DEFAULTS: RuffleSettings = {
  source: 'cdn',
  version: '0.6.0',
  path: '',
  autoplay: 'click',
  allowScriptAccess: false,
  allowNetworking: 'none',
  width: 550,
  height: 400,
  upgradeLinks: true,
};

/**
 * 🚨 Read fresh each time rather than cached at module load.
 *
 * `app.forum` does not exist yet when this module is evaluated, and an admin
 * changing a setting updates the attribute in place — a value captured once at
 * boot would go stale the moment they did.
 */
export function settings(): RuffleSettings {
  const read = <K extends keyof RuffleSettings>(key: K): RuffleSettings[K] => {
    const value = app.forum?.attribute<RuffleSettings[K]>(
      'ruffle' + key.charAt(0).toUpperCase() + key.slice(1)
    );

    return value === undefined || value === null ? DEFAULTS[key] : value;
  };

  return {
    source: read('source'),
    version: read('version'),
    path: read('path'),
    autoplay: read('autoplay'),
    allowScriptAccess: read('allowScriptAccess'),
    allowNetworking: read('allowNetworking'),
    width: read('width'),
    height: read('height'),
    upgradeLinks: read('upgradeLinks'),
  };
}
