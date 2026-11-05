import assert from 'node:assert/strict';
import test from 'node:test';
import { appUrl, parseEntry, resolveScreen } from '../src/routes.ts';

test('canonical paths select their own screen before any legacy query', () => {
  for (const prefix of ['', '/toy_diary', '/nested/project']) {
    const root = `https://example.test${prefix}`;
    assert.deepEqual(parseEntry(new URL(`${root}/owner/?screen=care`)), { screen: 'owner', basePath: `${prefix}/` });
    for (const screen of ['booking', 'prices', 'care'] as const) {
      assert.deepEqual(parseEntry(new URL(`${root}/customer/${screen}/?screen=owner`)), { screen, basePath: `${prefix}/` });
      assert.equal(resolveScreen(new URL(`${root}/customer/${screen}/index.html`)), screen);
    }
    assert.equal(resolveScreen(new URL(`${root}/customer/?screen=owner`)), 'home');
    assert.equal(resolveScreen(new URL(`${root}/customer/unknown/?screen=owner`)), 'booking');
  }
});

test('legacy entries and directory mounts retain their deployment base', () => {
  assert.deepEqual(parseEntry(new URL('https://example.test/toy_diary/?screen=owner')), { screen: 'owner', basePath: '/toy_diary/' });
  assert.deepEqual(parseEntry(new URL('https://example.test/toy_diary/index.html?screen=care&token=abc')), { screen: 'care', basePath: '/toy_diary/' });
  assert.deepEqual(parseEntry(new URL('https://example.test/owner')), { screen: 'owner', basePath: '/' });
  assert.deepEqual(parseEntry(new URL('https://example.test/toy_diary/owner/index.html')), { screen: 'owner', basePath: '/toy_diary/' });
  assert.equal(resolveScreen(new URL('https://example.test/')), 'home');
  assert.equal(resolveScreen(new URL('https://example.test/toy_diary/?screen=unknown')), 'home');
  assert.equal(resolveScreen(new URL('https://example.test/unrecognized/')), 'home');
});

test('cross-screen links stay inside the same deployment and encode token values', () => {
  const source = new URL('https://example.test/toy_diary/owner/?v=old');
  assert.equal(appUrl('booking', {}, source), 'https://example.test/toy_diary/customer/booking/');
  assert.equal(appUrl('owner', {}, new URL('https://example.test/customer/prices/')), 'https://example.test/owner/');
  assert.equal(appUrl('care', { token: 'a&b', v: 'new', screen: 'owner' }, source), 'https://example.test/toy_diary/customer/care/?token=a%26b&v=new');
  assert.equal(appUrl('prices', {}, new URL('https://example.test/nested/project/index.html?screen=booking')), 'https://example.test/nested/project/customer/prices/');
});
