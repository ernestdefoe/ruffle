import assert from 'node:assert/strict';
import { isSwfUrl, classifyBody, ruffleScriptUrl } from '../../.test-build/swf.js';

let failed = 0;
const it = (name, fn) => {
  try {
    fn();
    console.log('  ok   ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL ' + name + '\n       ' + e.message);
  }
};

const BASE = 'https://forum.example/d/1-thread';

console.log('isSwfUrl');
it('a plain .swf link', () => assert.equal(isSwfUrl('https://e.com/game.swf', BASE), true));
it('uppercase extension', () => assert.equal(isSwfUrl('https://e.com/GAME.SWF', BASE), true));
it('a query string does not hide it', () =>
  assert.equal(isSwfUrl('https://e.com/game.swf?v=2&t=9', BASE), true));
it('a fragment does not hide it', () =>
  assert.equal(isSwfUrl('https://e.com/game.swf#top', BASE), true));
it('relative to the page', () => assert.equal(isSwfUrl('/files/game.swf', BASE), true));
// The one that matters: a .swf named in the QUERY is not a .swf link.
it('a .swf in the query string is not one', () =>
  assert.equal(isSwfUrl('https://e.com/download?file=game.swf', BASE), false));
it('an ordinary page is not one', () => assert.equal(isSwfUrl('https://e.com/about', BASE), false));
it('.swfx is not .swf', () => assert.equal(isSwfUrl('https://e.com/game.swfx', BASE), false));
it('nonsense does not throw', () => assert.equal(isSwfUrl('::::', BASE), false));

console.log('classifyBody');
it('uncompressed FWS', () => assert.equal(classifyBody('FWS', 'application/octet-stream'), 'swf'));
it('zlib CWS', () => assert.equal(classifyBody('CWS', ''), 'swf'));
it('LZMA ZWS', () => assert.equal(classifyBody('ZWS', ''), 'swf'));
// The three ways a host says no while still answering 200.
it('an HTML content-type', () =>
  assert.equal(classifyBody('abc', 'text/html; charset=utf-8'), 'html'));
it('a body that starts with a tag', () =>
  assert.equal(classifyBody('<!d', 'application/octet-stream'), 'html'));
it('leading whitespace before the tag', () => assert.equal(classifyBody('  <', ''), 'html'));
it('anything else', () => assert.equal(classifyBody('PK!', ''), 'other'));
// A correct content-type must not rescue a body that is not a movie.
it('a swf content-type does not make it one', () =>
  assert.equal(classifyBody('not', 'application/x-shockwave-flash'), 'other'));

console.log('ruffleScriptUrl');
it('the pinned CDN default', () =>
  assert.equal(
    ruffleScriptUrl('cdn', '0.6.0', ''),
    'https://cdn.jsdelivr.net/npm/@ruffle-rs/ruffle@0.6.0/ruffle.js'
  ));
it('self-hosted', () =>
  assert.equal(
    ruffleScriptUrl('self', '0.6.0', 'https://f.example/ruffle'),
    'https://f.example/ruffle/ruffle.js'
  ));
it('a trailing slash is what admins paste', () =>
  assert.equal(
    ruffleScriptUrl('self', '0.6.0', 'https://f.example/ruffle/'),
    'https://f.example/ruffle/ruffle.js'
  ));
it('several trailing slashes', () =>
  assert.equal(
    ruffleScriptUrl('self', '0.6.0', 'https://f.example/ruffle///'),
    'https://f.example/ruffle/ruffle.js'
  ));
// Choosing "self" and filling in nothing must not produce "/ruffle.js".
it('self with an empty path falls back to the CDN', () =>
  assert.equal(
    ruffleScriptUrl('self', '0.6.0', '   '),
    'https://cdn.jsdelivr.net/npm/@ruffle-rs/ruffle@0.6.0/ruffle.js'
  ));
it('a version is escaped into the url', () =>
  assert.ok(
    ruffleScriptUrl('cdn', '0.7.0-nightly.2026.9.22', '').endsWith(
      '@0.7.0-nightly.2026.9.22/ruffle.js'
    )
  ));

console.log(failed ? `\n${failed} failing` : '\nall passing');
process.exit(failed ? 1 : 0);
