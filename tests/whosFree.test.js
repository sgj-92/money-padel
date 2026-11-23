// ===================== WHEN I'M FREE, AND WHO ELSE IS =====================
// Shaun, 23 Nov: "add somewhere that a player can see their schedule for when
// they've said they can play, perhaps within the Next Game section ... linked
// so that players (and admin) can see who else is available around their
// times so they can request games with them."

const test = require('node:test');
const assert = require('node:assert');
const A = require('../assets/js/domain/players/availability.js');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const MON = '2026-11-23';

test('who shares my time: overlap only, most first; everyone free without me; the first time all are free', () => {
  const all = {
    me: { unit: 'half', weekly: { mon: [18, 18.5, 19, 19.5, 20, 20.5] } },
    a: { unit: 'half', weekly: { mon: [19, 19.5, 20, 20.5, 21] } },
    b: { unit: 'half', weekly: { mon: [9, 9.5] } },
    c: { unit: 'half', weekly: { mon: [20, 20.5] } },
    off: { unit: 'half', weekly: { mon: [19] }, exceptions: [{ date: MON, free: [] }] },
  };
  const names = ['me', 'a', 'b', 'c', 'off', 'unknown'];
  assert.deepStrictEqual(A.othersFree(all, names, MON, 'me').map((x) => [x.name, A.rangesText(x.shared)]), [['a', '7–9pm'], ['c', '8–9pm']]);
  assert.deepStrictEqual(A.othersFree(all, names, MON, null).map((x) => x.name), ['me', 'a', 'b', 'c']);
  assert.deepStrictEqual(A.othersFree(all, names, '2026-11-24', 'me'), [], 'not free myself: nobody shares my time');
  assert.strictEqual(A.firstCommon(all, ['me', 'a', 'c'], MON), 20);
  assert.strictEqual(A.firstCommon(all, ['me', 'b'], MON), null);
  assert.strictEqual(A.timeOf(20.5), '20:30');
  assert.strictEqual(A.timeOf(9), '09:00');
});

const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const EVE = [18, 18.5, 19, 19.5, 20, 20.5, 21, 21.5];
const DOCS = { availability: {
  Kaz: { unit: 'half', weekly: Object.fromEntries(days.map((d) => [d, EVE])) },
  Len: { unit: 'half', weekly: { tue: [20, 20.5, 21] } },
  Erf: { unit: 'half', weekly: { tue: [19, 19.5, 20, 20.5] } },
  Osh: { unit: 'half', weekly: { tue: [9, 9.5] } },
} };
const open = () => H.open({ now: '2026-11-23T10:00:00.000Z', path: 'index.html?club=padelchampionships', viewport: { width: 390, height: 844 }, mobile: true, documents: DOCS });

maybe('Home › Next game: my next seven days free, each with who else is free then; a day opens Who\'s free', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      setCurrentViewer('Kaz'); goToSection('home');
      const rows = [...document.querySelectorAll('#homeNextGame .wf-day')].map((b) => [b.querySelector('.wf-day-name').textContent, b.querySelector('.wf-day-time').textContent, b.querySelector('.wf-day-who').textContent]);
      document.querySelectorAll('#homeNextGame .wf-day')[1].click();
      const sheet = document.getElementById('whosFreeSheet');
      return { rows, open: sheet.classList.contains('show'), on: sheet.querySelector('.wf-chip.is-on').dataset.wfDate,
        week: sheet.querySelector('.wf-week-label').textContent, days: [...sheet.querySelectorAll('.wf-chip')].map((c) => c.dataset.wfDate),
        people: [...sheet.querySelectorAll('[data-wf-pick]')].map((b) => [b.dataset.wfPick, b.querySelector('.wf-shared').textContent]), wide: document.documentElement.scrollWidth };
    });
    assert.strictEqual(r.rows.length, 7);
    assert.deepStrictEqual(r.rows[0], ['Today', '6–10pm', 'nobody else yet']);
    assert.deepStrictEqual(r.rows[1], ['Tomorrow', '6–10pm', 'Erf, Len'], 'Osh is free Tuesday morning: not at my time');
    assert.strictEqual(r.open, true);
    assert.strictEqual(r.on, '2026-11-24');
    assert.strictEqual(r.week, 'This week');
    assert.deepStrictEqual(r.days, ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'], 'Monday to Sunday');
    assert.deepStrictEqual(r.people, [['Erf', 'With you 7–9pm'], ['Len', 'With you 8–9:30pm']]);
    assert.strictEqual(r.wide, 390);
  } finally { await app.close(); }
});

maybe('picking people opens the request filled in: the four, the date, the first time everyone is free', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      setCurrentViewer('Kaz');
      openWhosFree('2026-11-24');
      const sheet = document.getElementById('whosFreeSheet');
      sheet.querySelector('[data-wf-pick="Erf"]').click();
      sheet.querySelector('[data-wf-pick="Len"]').click();
      const label = sheet.querySelector('.wf-go').textContent;
      sheet.querySelector('.wf-go').click();
      return { label, mode: arrangeMode, draft: arrangeDraft, closed: !sheet.classList.contains('show'), arrange: document.getElementById('arrangeSheet').classList.contains('show') };
    });
    assert.strictEqual(r.label, 'Request a game with Erf, Len');
    assert.strictEqual(r.mode, 'request');
    assert.deepStrictEqual(r.draft, { names: ['Kaz', 'Erf', 'Len', ''], date: '2026-11-24', time: '20:00', venue: '' });
    assert.ok(r.closed && r.arrange);
  } finally { await app.close(); }
});

maybe('an Admin not playing sees everyone free and sets up the game on the Agreed form', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      isUnlocked = true; adminRole = 'owner';
      if (typeof clearCurrentViewer === 'function') clearCurrentViewer();
      else { try { localStorage.removeItem('mp_viewer'); } catch (e) {} }
      whosFreeMe = () => null;
      openWhosFree('2026-11-24');
      const sheet = document.getElementById('whosFreeSheet');
      const people = [...sheet.querySelectorAll('[data-wf-pick]')].map((b) => b.dataset.wfPick);
      ['Kaz', 'Erf', 'Len', 'Osh'].forEach((n) => sheet.querySelector(`[data-wf-pick="${n}"]`).click());
      sheet.querySelector('.wf-go').click();
      return { people, mode: arrangeMode, draft: agreedDraft };
    });
    assert.deepStrictEqual(r.people.sort(), ['Erf', 'Kaz', 'Len', 'Osh']);
    assert.strictEqual(r.mode, 'agreed');
    assert.deepStrictEqual(r.draft.names, ['Kaz', 'Erf', 'Len', 'Osh']);
    assert.strictEqual(r.draft.date, '2026-11-24');
    assert.strictEqual(r.draft.time, '', 'no time all four are free');
  } finally { await app.close(); }
});

maybe('by the week: ‹ › move a week at a time, up to eight ahead; past days cannot be chosen', async () => {
  const app = await H.open({ now: '2026-11-25T10:00:00.000Z', path: 'index.html?club=padelchampionships', viewport: { width: 390, height: 844 }, mobile: true, documents: DOCS });
  try {
    const r = await app.run(() => {
      setCurrentViewer('Kaz');
      openWhosFree('2026-11-25');
      const sheet = document.getElementById('whosFreeSheet');
      const past = [...sheet.querySelectorAll('.wf-chip')].filter((c) => c.disabled).map((c) => c.dataset.wfDate);
      const prevDisabled = sheet.querySelector('[data-wf-week="-1"]').disabled;
      sheet.querySelector('[data-wf-week="1"]').click();
      const next = { label: sheet.querySelector('.wf-week-label').textContent, on: sheet.querySelector('.wf-chip.is-on').dataset.wfDate,
        people: [...sheet.querySelectorAll('[data-wf-pick]')].map((b) => b.dataset.wfPick) };
      for (let i = 0; i < 12; i++) { const b = sheet.querySelector('[data-wf-week="1"]'); if (!b.disabled) b.click(); }
      const far = { label: sheet.querySelector('.wf-week-label').textContent, nextDisabled: sheet.querySelector('[data-wf-week="1"]').disabled, week: whosFreeView.week };
      sheet.querySelector('[data-wf-pick]') && sheet.querySelector('[data-wf-pick]').click();
      const day = whosFreeView.date;
      if (sheet.querySelector('.wf-go') && !sheet.querySelector('.wf-go').disabled) sheet.querySelector('.wf-go').click();
      return { past, prevDisabled, next, far, day, draftDate: arrangeDraft && arrangeDraft.date };
    });
    assert.deepStrictEqual(r.past, ['2026-11-23', '2026-11-24']);
    assert.strictEqual(r.prevDisabled, true);
    assert.deepStrictEqual(r.next, { label: 'Next week', on: '2026-11-30', people: [] }, 'Monday 30th: nobody else free on Mondays');
    assert.strictEqual(r.far.week, 8);
    assert.strictEqual(r.far.nextDisabled, true);
    assert.match(r.far.label, /^\d+ \w{3} – \d+ \w{3}$/);
    if (r.draftDate) assert.strictEqual(r.draftDate, r.day, 'a game booked weeks ahead keeps its date');
  } finally { await app.close(); }
});
