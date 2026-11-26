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

// Shaun, 26 Nov: with the viewer chip and Messages, the camera fell off the
// right edge and "Shaun ▾" wrapped onto two lines.
for (const width of [360, 390]) {
  maybe(`at ${width}px everything in the header is on screen and on one line`, async () => {
    const app = await H.open({ now: '2026-11-26T06:55:00.000Z', path: 'index.html?club=padelchampionships', viewport: { width, height: 844 }, mobile: true });
    try {
      await app.run(() => { setCurrentViewer('Shaun'); goToSection('home'); });
      const r = await app.run(() => {
        const h = document.querySelector('.shell-header');
        const kids = [...h.querySelectorAll(':scope > *')].filter((e) => getComputedStyle(e).display !== 'none');
        const chip = h.querySelector('.home-viewer-switch') || h.querySelector('#shellSectionTitle');
        return { right: Math.max(...kids.map((e) => e.getBoundingClientRect().right)), chipH: chip.getBoundingClientRect().height,
          camera: !!document.getElementById('shellCaptureBtn'), messages: !!document.getElementById('shellMessagesBtn') };
      });
      assert.ok(r.camera && r.messages);
      assert.ok(r.right <= width, `the last item ends at ${r.right}px`);
      assert.ok(r.chipH <= 32, `the chip is one line (${r.chipH}px)`);
    } finally { await app.close(); }
  });
}
