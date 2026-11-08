// ===================== CAPTURE: ANY PART OF THE APP AS A PICTURE =====================
// Shaun, 8 Nov: "a selector that can choose the area and I just copy/save the
// image. Ideally it allows me to go beyond full screen too to capture info
// that's in a long list."

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;

test('the picture maker is shipped with the app, unmodified, with its licence', () => {
  const lib = fs.readFileSync(path.join(__dirname, '..', 'assets/vendor/html2canvas-1.4.1.min.js'), 'utf8');
  assert.match(lib.slice(0, 300), /html2canvas 1\.4\.1[\s\S]*Released under MIT License/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'assets/vendor/README.md'), 'utf8'), /html2canvas-1\.4\.1\.min\.js/);
});

maybe('tap the camera, tap a result: it is chosen (not opened); Bigger, Smaller, Whole screen; the whole list comes out taller than the screen', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 }, now: '2026-09-21T10:00:00.000Z' });
  try {
    const r = await app.run(async () => {
      gamesMonth = 'all';
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      await new Promise((res) => setTimeout(res, 100));
      document.getElementById('shellCaptureBtn').click();
      const card = document.querySelector('#gamesView [data-game-card]');
      const openedBefore = card.querySelectorAll('.msc-open-row, .match-detail').length;
      card.querySelector('.cc-title').click();
      const chosen = captureState.selected;
      const opened = card.querySelectorAll('.msc-open-row, .match-detail').length !== openedBefore;
      document.querySelector('[data-cap="bigger"]').click();
      const bigger = captureState.selected;
      document.querySelector('[data-cap="smaller"]').click();
      const back = captureState.selected === chosen;
      document.querySelector('[data-cap="whole"]').click();
      const whole = captureState.selected;
      const wholeH = whole.getBoundingClientRect().height;
      const cv = await capturePicture(whole);
      // And make it through the bar, to the result sheet.
      await takeCapture(whole);
      const sheet = document.querySelector('.capture-sheet');
      return { chosenIsCard: chosen === card || card.contains(chosen) || chosen.contains(card), opened,
        grew: bigger !== chosen && bigger.contains(chosen), back, wholeContains: whole.contains(card), wholeH, viewH: innerHeight,
        cvH: cv.height, cvW: cv.width, sheet: !!sheet && /Share|Save/.test(sheet.innerText), modeOff: !document.body.classList.contains('capture-mode') };
    });
    assert.ok(r.chosenIsCard, 'tapping a result chooses that result');
    assert.strictEqual(r.opened, false, 'and does not open it');
    assert.ok(r.grew, 'Bigger takes in more');
    assert.ok(r.back, 'Smaller goes back');
    assert.ok(r.wholeContains, 'Whole screen holds the result');
    assert.ok(r.wholeH > r.viewH * 2, `the whole list (${r.wholeH}px) is far longer than the screen (${r.viewH}px)`);
    assert.ok(r.cvH >= r.wholeH * 2, `the picture is the whole list at 2x: ${r.cvH} for ${r.wholeH}`);
    assert.ok(r.sheet, 'then Share / Save');
    assert.ok(r.modeOff);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('a table that scrolls sideways comes out at its full width', async () => {
  const app = await H.open({ viewport: { width: 360, height: 740 }, now: '2026-09-21T10:00:00.000Z' });
  try {
    const r = await app.run(async () => {
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      await new Promise((res) => setTimeout(res, 100));
      const wrap = document.createElement('div');
      wrap.style.cssText = 'width:300px; overflow-x:auto;';
      wrap.innerHTML = '<div style="width:900px; height:60px; background:linear-gradient(90deg,red,blue);">wide</div>';
      document.getElementById('gamesView').prepend(wrap);
      const cv = await capturePicture(wrap);
      return { w: cv.width };
    });
    assert.ok(r.w >= 900 * 2, `full width at 2x: ${r.w}`);
  } finally { await app.close(); }
});

maybe('drag the box, drag a corner past the bottom of the screen (the page scrolls with it), draw a fresh area; the picture is that area', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 }, now: '2026-09-21T10:00:00.000Z' });
  try {
    const page = app.page;
    await app.run(async () => {
      gamesMonth = 'all';
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      await new Promise((res) => setTimeout(res, 100));
      document.getElementById('shellCaptureBtn').click();
      const card = document.querySelectorAll('#gamesView [data-game-card]')[1];
      card.scrollIntoView({ block: 'start' }); window.scrollBy(0, -140);
      card.querySelector('.cc-title').click();
    });
    const box = await page.$('.capture-box');
    const b0 = await box.boundingBox();
    const scrollStart = await app.run(() => scrollY);
    // Move: drag the middle of the box down 40px.
    await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2);
    await page.mouse.down();
    await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2 + 40, { steps: 5 });
    await page.mouse.up();
    const moved = await app.run(() => ({ ...captureState.rect }));
    // Resize: drag the bottom-right corner to the bottom edge and hold: the page scrolls, the area grows past the screen.
    const se = await (await page.$('.capture-handle-se')).boundingBox();
    const scroll0 = await app.run(() => scrollY);
    await page.mouse.move(se.x + 13, se.y + 13);
    await page.mouse.down();
    await page.mouse.move(se.x + 13, 835, { steps: 5 });
    await page.waitForTimeout(700);
    await page.mouse.up();
    const grown = await app.run(() => ({ rect: { ...captureState.rect }, scrolled: scrollY }));
    const cv = await app.run(async () => { const c = await captureAreaPicture(captureState.rect); return { w: c.width, h: c.height }; });
    // Draw: a fresh area.
    await app.run(() => document.querySelector('[data-cap="draw"]').click());
    await page.mouse.move(40, 200);
    await page.mouse.down();
    await page.mouse.move(300, 420, { steps: 6 });
    await page.mouse.up();
    const drawn = await app.run(() => ({ rect: { ...captureState.rect }, sy: scrollY, layer: !!document.querySelector('.capture-draw') }));
    assert.ok(Math.abs(moved.top - (b0.y + scrollStart + 40)) <= 2, `moved down 40px: ${moved.top} vs ${b0.y + scrollStart + 40}`);
    assert.ok(grown.scrolled > scroll0, 'the page scrolled while the corner was held at the edge');
    assert.ok(grown.rect.top + grown.rect.height > scroll0 + 844, 'the area now runs past the bottom of the first screen');
    assert.ok(cv.h >= grown.rect.height * 2, `the picture holds the whole area: ${cv.h} for ${grown.rect.height}`);
    assert.ok(Math.abs(cv.w - (grown.rect.width * 2 + 64)) <= 4, 'its width is the area\'s, framed');
    assert.deepStrictEqual([Math.round(drawn.rect.left), Math.round(drawn.rect.top - drawn.sy), Math.round(drawn.rect.width), Math.round(drawn.rect.height)], [40, 200, 260, 220]);
    assert.strictEqual(drawn.layer, false, 'drawing ends when the finger lifts');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
