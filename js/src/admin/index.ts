/*
 * Settings are registered through the `Admin` extender in extend.ts, which
 * Flarum picks up from this bundle's `extend` export. There is no initializer
 * here on purpose: `app.extensionData` — the Flarum 1.x way of doing this — is
 * absent in Flarum 2, and calling it throws inside the initializer where core
 * catches it and reports only "failed to initialize".
 */
export { default as extend } from './extend';
