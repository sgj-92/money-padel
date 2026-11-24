// Shaun's screenshot, 22 Nov: scrolled down on an iPhone, the page showed
// under the clock and battery -- the header had scrolled away. The body was a
// scroll container (overflow-x: hidden), which stops position: sticky.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;

maybe('the header stays at the top of a phone screen while the page scrolls, and nothing scrolls sideways', async () => {
  const app = await H.open({ now: '2026-09-21T10:00:00.000Z', viewport: { width: 390, height: 844 }, mobile: true });
  try {
    await app.run(() => goToSection('rankings'));
    await app.page.evaluate(() => window.scrollTo(0, 800));
    const r = await app.run(() => new Promise((res) => setTimeout(() => res({
      scrolled: scrollY, top: Math.round(document.querySelector('.shell-header').getBoundingClientRect().top),
      wide: document.documentElement.scrollWidth,
    }), 100)));
    assert.ok(r.scrolled > 0);
    assert.strictEqual(r.top, 0, 'pinned to the top');
    assert.strictEqual(r.wide, 390);
  } finally { await app.close(); }
});
