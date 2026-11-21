// ===================== THE CLUB TICKER =====================
// Shaun, 21 Nov: "the floating thing with information at the top ... slowly
// moves across the screen".

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;

maybe('a strip of club news under the header: real facts, looping, pausable (remembered), never in the way', async () => {
  const app = await H.open({ now: '2026-09-21T10:00:00.000Z', viewport: { width: 390, height: 844 } });
  try {
    const r = await app.run(async () => {
      const el = document.getElementById('clubTicker');
      const header = document.querySelector('.shell-header');
      const items = [...el.querySelectorAll('.club-ticker-track > .club-ticker-item')].map((x) => [...x.childNodes].map((c) => c.textContent).join(' ').replace(/\s+/g, ' ').trim());
      const copies = el.querySelectorAll('.club-ticker-copy .club-ticker-item').length;
      const sept = getAllApprovedMatches().filter((m) => m.date.startsWith('2026-09')).length;
      const moving = getComputedStyle(el.querySelector('.club-ticker-track')).animationName;
      el.querySelector('.club-ticker-pause').click();
      const paused = getComputedStyle(el.querySelector('.club-ticker-track')).animationPlayState;
      // Redrawn after a change, still paused.
      recomputeAll();
      const stillPaused = document.querySelector('#clubTicker .club-ticker-track').classList.contains('is-paused');
      return { after: header.nextElementSibling && header.nextElementSibling.id, items, copies, sept, moving, paused, stillPaused,
        kept: localStorage.getItem('clubTickerPaused'), wide: document.documentElement.scrollWidth };
    });
    assert.strictEqual(r.after, 'clubTicker', 'right under the header');
    assert.ok(r.items.length >= 5, r.items.join(' | '));
    assert.ok(r.items.some((t) => /^👥 Players \d+$/.test(t)), r.items.join(" | "));
    assert.ok(r.items.includes(`🎾 This month ${r.sept} games`), r.items.join(' | '));
    assert.ok(r.items.some((t) => /^🏁 Leading the race \S+ [+−-]?\d/.test(t)));
    assert.ok(r.items.some((t) => /^👑 Top rating \S+ \d{4}$/.test(t)));
    assert.strictEqual(r.copies, r.items.length, 'twice over, so it loops without a gap');
    assert.strictEqual(r.moving, 'club-ticker-move');
    assert.strictEqual(r.paused, 'paused');
    assert.ok(r.stillPaused);
    assert.strictEqual(r.kept, '1');
    assert.strictEqual(r.wide, 390, 'never wider than the phone');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

// Shaun, 21 Nov: "It doesn't move" -- on a phone with Reduce Motion on.
maybe('it moves even with Reduce Motion on, and a redraw with the same news does not restart it', async () => {
  const app = await H.open({ viewport: { width: 390, height: 844 } });
  try {
    await app.page.emulateMedia({ reducedMotion: 'reduce' });
    const r = await app.run(async () => {
      const left = () => document.querySelector('#clubTicker .club-ticker-track').getBoundingClientRect().left;
      const a = left();
      await new Promise((res) => setTimeout(res, 1500));
      const track = document.querySelector('#clubTicker .club-ticker-track');
      recomputeAll();
      return { a, b: left(), same: track === document.querySelector('#clubTicker .club-ticker-track'),
        copy: getComputedStyle(document.querySelector('#clubTicker .club-ticker-copy')).display };
    });
    assert.ok(r.b < r.a - 10, `moved: ${r.a} -> ${r.b}`);
    assert.ok(r.same, 'not rebuilt for the same news');
    assert.notStrictEqual(r.copy, 'none');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
