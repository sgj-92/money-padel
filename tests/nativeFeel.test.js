// ===================== NATIVE FEEL =====================
// Shaun, 22 Nov: "refactor it to feel like a polished native iOS app rather
// than a web form": pill switches for short dropdowns, presses and
// transitions, slide-up sheets, optimistic updates and skeletons, 16px
// inputs, no selection on buttons, room for a thumb.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'css', 'native.css'), 'utf8');
const wait = (ms) => new Promise((res) => setTimeout(res, ms));

test('buttons press, never select text or flash grey, and are thumb-sized on a touch screen', () => {
  assert.match(CSS, /button:not\(:disabled\):active[^{]*\{\s*transform: scale\(\.96\)/);
  assert.match(CSS, /user-select: none/);
  assert.match(CSS, /-webkit-tap-highlight-color: transparent/);
  assert.match(CSS, /@media \(pointer: coarse\)\{[\s\S]*?min-height: 44px/);
});

maybe('a sheet slides up, a short pull springs back, a long pull closes it through its own route', async () => {
  const app = await H.open({ mobile: true });
  try {
    const r = await app.run(async () => {
      goToSection('rankings'); openRankingsMoreTables();
      const sheet = document.getElementById('rankingsMoreSheet'), panel = sheet.querySelector('.shell-more-panel');
      const early = panel.getBoundingClientRect().top;
      await new Promise((res) => setTimeout(res, 450));
      const rest = panel.getBoundingClientRect().top;
      const touch = (type, y) => {
        const t = new Touch({ identifier: 1, target: panel, clientX: 100, clientY: y });
        panel.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], changedTouches: [t] }));
      };
      // A short, slow pull: back where it was.
      touch('touchstart', rest + 20); touch('touchmove', rest + 40); touch('touchmove', rest + 60);
      const pulled = panel.style.transform;
      await new Promise((res) => setTimeout(res, 300));
      touch('touchend', rest + 60);
      const afterShort = sheet.classList.contains('show');
      // A long pull: closed.
      touch('touchstart', rest + 20); touch('touchmove', rest + 120); touch('touchmove', rest + 260); touch('touchend', rest + 260);
      return { early, rest, pulled, afterShort, afterLong: sheet.classList.contains('show'),
        hiddenStyle: getComputedStyle(sheet).visibility };
    });
    assert.ok(r.early > r.rest, `rises from below (${r.early} -> ${r.rest})`);
    assert.strictEqual(r.pulled, 'translateY(40px)', 'follows the thumb');
    assert.strictEqual(r.afterShort, true, 'a short pull springs back');
    assert.strictEqual(r.afterLong, false, 'a long pull closes it');
    await wait(300);
    const gone = await app.run(() => ({ vis: getComputedStyle(document.getElementById('rankingsMoreSheet')).visibility, events: getComputedStyle(document.getElementById('rankingsMoreSheet')).pointerEvents }));
    assert.deepStrictEqual(gone, { vis: 'hidden', events: 'none' }, 'once closed it is out of the way');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('a dropdown of a few short choices is a row of pills that drives it; a long list stays a dropdown', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 } });
  try {
    const r = await app.run(async () => {
      const box = document.createElement('div');
      box.innerHTML = `<select class="fg-select" id="tShort" aria-label="Kind"><option value="none">Not free</option><option value="all">Free all day</option><option value="range">Free from…</option></select>
        <select class="fg-select" id="tLong">${Array.from({ length: 12 }, (_, i) => `<option>${i}</option>`).join('')}</select>
        <select class="fg-select" id="tNative" data-native="1"><option>A</option><option>B</option></select>`;
      document.body.appendChild(box);
      await new Promise((res) => setTimeout(res, 30));
      const s = document.getElementById('tShort');
      const heard = []; s.onchange = () => heard.push(s.value);
      const pills = [...s.nextElementSibling.querySelectorAll('.seg-pill')];
      pills[2].click();
      return {
        labels: pills.map((p) => p.textContent), group: s.nextElementSibling.getAttribute('aria-label'),
        value: s.value, heard, checked: pills.map((p) => p.getAttribute('aria-checked')),
        long: !!document.getElementById('tLong').dataset.seg, native: !!document.getElementById('tNative').dataset.seg,
      };
    });
    assert.deepStrictEqual(r.labels, ['Not free', 'Free all day', 'Free from…']);
    assert.strictEqual(r.group, 'Kind');
    assert.strictEqual(r.value, 'range');
    assert.deepStrictEqual(r.heard, ['range'], 'the screen hears it as before');
    assert.deepStrictEqual(r.checked, ['false', 'false', 'true']);
    assert.strictEqual(r.long, false);
    assert.strictEqual(r.native, false);
  } finally { await app.close(); }
});

maybe('a question is a sheet with two big buttons; anything but the yes is a no', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 } });
  try {
    const r = await app.run(async () => {
      const yes = confirmSheet('Delete it?', { ok: 'Delete', danger: true });
      const sheet = document.getElementById('confirmSheet');
      const shown = sheet.classList.contains('show');
      const ok = sheet.querySelector('.cf-ok');
      const label = ok.textContent, danger = ok.classList.contains('is-danger');
      ok.click();
      const a = await yes;
      const no = confirmSheet('Again?'); sheet.querySelector('.cf-cancel').click();
      const b = await no;
      const back = confirmSheet('Once more?'); sheet.click();
      const c = await back;
      return { shown, label, danger, a, b, c, open: sheet.classList.contains('show') };
    });
    assert.deepStrictEqual(r, { shown: true, label: 'Delete', danger: true, a: true, b: false, c: false, open: false });
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('while reading, the shape of what is coming, not a word; and the words stay for a screen reader', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 } });
  try {
    const html = await app.run(() => skeletonHtml('Reading codes…', 3));
    assert.match(html, /role="status"/);
    assert.match(html, /<span class="sr-only">Reading codes…<\/span>/);
    assert.strictEqual((html.match(/class="skel-row"/g) || []).length, 3);
  } finally { await app.close(); }
});

maybe('saving playing hours shows Saved at once, and puts it back if the database says no', async () => {
  const app = await H.open({ path: 'index.html?club=padelchampionships', viewport: { width: 390, height: 844 } });
  try {
    const r = await app.run(async () => {
      isUnlocked = true;
      let release; const gate = new Promise((res) => { release = res; });
      window.saveAvailability = async () => { await gate; return false; };
      openAvailabilitySheet('Kaz');
      document.querySelector('[data-av-day="mon"][data-av-hour="18"]').click();
      document.querySelector('.av-save').click();
      const at = { msg: document.querySelector('.av-msg').textContent, kept: !!availabilityState.Kaz };
      release(); await new Promise((res) => setTimeout(res, 30));
      return { at, after: { msg: document.querySelector('.av-msg').textContent, kept: !!availabilityState.Kaz } };
    });
    assert.deepStrictEqual(r.at, { msg: 'Saved.', kept: true }, 'no waiting on the network');
    assert.strictEqual(r.after.kept, false, 'put back');
    assert.match(r.after.msg, /Couldn’t save/);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('pills that would not fit their box give the dropdown back (Rankings keeps its compact boxes)', async () => {
  const app = await H.open({ path: 'index.html?club=padelchampionships', viewport: { width: 390, height: 844 } });
  try {
    const r = await app.run(async () => {
      const box = document.createElement('div');
      box.style.width = '120px';
      box.innerHTML = '<select class="fg-select" id="tTight"><option>All time</option><option>Apr–Jun 2026</option><option>Jul–Sep 2026</option></select>';
      document.body.appendChild(box);
      goToSection('rankings');
      await new Promise((res) => setTimeout(res, 100));
      const t = document.getElementById('tTight');
      return { tight: t.dataset.seg, pills: !!box.querySelector('.seg-pills'), visible: !t.classList.contains('seg-native'),
        rankingsPills: document.querySelectorAll('#rankingsView .seg-pills, .rankings-toolbar .seg-pills').length, wide: document.documentElement.scrollWidth };
    });
    assert.deepStrictEqual(r, { tight: 'no', pills: false, visible: true, rankingsPills: 0, wide: 390 });
  } finally { await app.close(); }
});
