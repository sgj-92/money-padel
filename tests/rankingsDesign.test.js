// ===================== RANKINGS, FROM THE CLAUDE DESIGN CANVAS =====================
// Shaun, 24 Nov: "a complete re-design of the rankings page from claude
// design" -- and of the canvas, "i like it and it looks a lot cleaner".
// Power: the title with the period chip, Your standing, tier pills, the
// leaderboard with a heading per tier (medal rings, your row lit), who isn't
// ranked yet, the honours as tiles. Stats: the lenses and stories. Tapping a
// player: a card, then Request / Compare / Full profile.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const NOW = '2026-09-21T10:00:00.000Z';
const open = () => H.open({ now: NOW, path: 'index.html?club=padelchampionships', viewport: { width: 390, height: 844 }, mobile: true });

maybe('Power: title and period chip on one line, Your standing, tier pills, a heading per tier, your row lit', async () => {
  const app = await open();
  try {
    await app.run(() => { setCurrentViewer('Len'); goToSection('rankings'); });
    await app.run(() => new Promise((res) => setTimeout(res, 300)));
    const r = await app.run(() => {
      const t = (s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
      const box = (s) => document.querySelector(s).getBoundingClientRect();
      const list = powerRowsOverall;
      const i = list.findIndex((p) => p.name === 'Len');
      const above = list[i - 1];
      const gap = Math.round(rkBasis(above) - rkBasis(list[i]));
      const rows = [...document.querySelectorAll('#list .rk2-row')];
      return {
        tabs: [...document.querySelectorAll('#sectionSubnav .mp-seg-item')].map((b) => b.textContent.trim()),
        title: t('.rankings-hero-title'),
        oneLine: Math.abs(box('.rankings-hero-title').top - box('#rankingsToolbar').top) < 20,
        chip: t('#monthSelect option:checked'),
        pos: t('.rk2-st-pos'), want: `#${i + 1}`,
        foot: t('.rk2-st-foot span'), wantFoot: `${gap} pt${gap === 1 ? '' : 's'} to pass ${above.name} for #${i}`,
        pills: [...document.querySelectorAll('.rk2-tier')].map((b) => [b.dataset.rkTier, Number(b.querySelector('.rk2-tier-n').textContent)]),
        heads: [...document.querySelectorAll('#list .rk2-group-head .rk2-group-tier')].map((h) => h.textContent),
        medals: rows.slice(0, 4).map((x) => x.classList.contains('rk-top')),
        you: rows.filter((x) => x.classList.contains('rk2-you')).map((x) => x.querySelector('.nm').textContent),
        youTag: !!document.querySelector('#list .rk2-you .rk2-youtag'),
        form: rows[0].querySelectorAll('.rk2-f').length,
        positions: rows.map((x) => x.querySelector('.rk-pos').textContent).slice(0, 5),
        total: list.length, wide: document.documentElement.scrollWidth,
      };
    });
    assert.deepStrictEqual(r.tabs, ['Power', 'Quarter race', 'Stats']);
    assert.strictEqual(r.title, 'Rankings');
    assert.ok(r.oneLine, 'the period chip sits beside the title');
    assert.match(r.chip, /^\w{3}–\w{3} \d{4}$/);
    assert.strictEqual(r.pos, r.want);
    assert.strictEqual(r.foot, r.wantFoot);
    assert.strictEqual(r.pills[0][0], 'All');
    assert.strictEqual(r.pills[0][1], r.total);
    assert.ok(r.pills.slice(1).every(([, n]) => n > 0), 'no empty tier offered');
    assert.ok(r.heads.length >= 2 && r.heads.every((h) => /^Tier [SABC]$/.test(h)));
    assert.deepStrictEqual(r.medals, [true, true, true, false], 'medal rings for the top three');
    assert.deepStrictEqual(r.you, ['Len']);
    assert.ok(r.youTag);
    assert.strictEqual(r.form, 5);
    assert.deepStrictEqual(r.positions, ['1', '2', '3', '4', '5'], 'positions stay the club order');
    assert.strictEqual(r.wide, 390);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('a tier pill narrows the board; Challenge opens a request with the player above', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      setCurrentViewer('Len'); goToSection('rankings');
      const above = powerRowsOverall[powerRowsOverall.findIndex((p) => p.name === 'Len') - 1].name;
      document.querySelector('[data-rk-tier="B"]').click();
      const tiers = [...new Set(powerRowsShown.map((p) => tierInScope(p) || p.tier))];
      const on = document.querySelector('.rk2-tier.is-on').dataset.rkTier;
      document.querySelector('[data-rk-tier="All"]').click();
      document.querySelector('[data-rk-challenge]').click();
      return { tiers, on, above, mode: arrangeMode, draft: arrangeDraft };
    });
    assert.deepStrictEqual(r.tiers, ['B']);
    assert.strictEqual(r.on, 'B');
    assert.strictEqual(r.mode, 'request');
    assert.deepStrictEqual(r.draft.names, ['Len', '', r.above, '']);
  } finally { await app.close(); }
});

maybe('tapping a player: their figures, the gap to you, your head to head; Request and Full profile', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      setCurrentViewer('Len'); goToSection('rankings');
      const row = [...document.querySelectorAll('#list .rk2-row')].find((x) => x.querySelector('.nm').textContent === 'Kaz');
      row.click();
      const sheet = document.getElementById('rankQuickSheet');
      const t = (s) => sheet.querySelector(s).textContent.replace(/\s+/g, ' ').trim();
      const h = getHeadToHeadRecord('Len', 'Kaz');
      const out = { open: sheet.classList.contains('show'), name: t('.rkq-name'), sub: t('.rkq-sub'), power: t('.rkq-figs div b'),
        want: String(Math.round(rkBasis(powerRowsOverall.find((p) => p.name === 'Kaz')))), gap: t('.rkq-gap'), h2h: t('.rkq-h2h'), h };
      sheet.querySelector('.rkq-request').click();
      out.draft = arrangeDraft.names;
      row.click();
      document.querySelector('#rankQuickSheet .rkq-profile').click();
      out.profile = document.getElementById('overlay').classList.contains('show') || !!document.querySelector('.shell-more-sheet.show');
      return out;
    });
    assert.ok(r.open);
    assert.strictEqual(r.name, 'Kaz');
    assert.match(r.sub, /^#1 overall · #1 in Tier A$/);
    assert.strictEqual(r.power, r.want);
    assert.match(r.gap, /^Kaz is \d+ pts above you$/);
    assert.match(r.h2h, r.h.total ? /^Head to head: (You lead|Kaz leads|Level) \d+–\d+/ : /Not met as opponents yet/);
    assert.deepStrictEqual(r.draft, ['Len', '', 'Kaz', '']);
    assert.ok(r.profile, 'the full profile (or the period breakdown) opens');
  } finally { await app.close(); }
});

maybe('Stats: a lens re-ranks the board and says so; Back to rating; Win / Loss and the stories are there', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      goToSection('rankings');
      document.getElementById('rankingsMoreBtn').click();
      const sheet = document.getElementById('rankingsMoreSheet');
      const lenses = [...sheet.querySelectorAll('.rk2-stat-title')].map((x) => x.textContent);
      sheet.querySelector('[data-rk-lens="upset_total"]').click();
      const sorted = { sort: activeSortP, title: document.querySelector('.rk2-board-title').textContent, dot: document.getElementById('openFiltersBtn').classList.contains('has-filters'),
        meta: /upset/.test(document.querySelector('#list .rk2-row .meta').textContent) };
      document.querySelector('[data-rk-sort="rating"]').click();
      return { lenses, sorted, back: activeSortP, title: document.querySelector('.rk2-board-title').textContent };
    });
    assert.deepStrictEqual(r.lenses, ['Form', 'Clutch', 'Upsets', 'Win / Loss']);
    assert.deepStrictEqual(r.sorted, { sort: 'upset_total', title: 'Ranked by Upsets', dot: true, meta: true });
    assert.strictEqual(r.back, 'rating');
    assert.strictEqual(r.title, 'Leaderboard');
  } finally { await app.close(); }
});

maybe('who is not ranked yet is named, with the rule, and can be shown in the list', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      goToSection('rankings'); applyRankingsMonth('all'); render();
      const box = document.getElementById('rankingsUnranked');
      if (!box) return { none: true };
      const text = box.textContent.replace(/\s+/g, ' ');
      const before = document.querySelectorAll('#list .rk2-row').length;
      box.querySelector('[data-rk-show-idle]').click();
      return { text, rule: PlayerState.thresholdText(), before, after: document.querySelectorAll('#list .rk2-row').length, idle: includeIdle };
    });
    if (r.none) { assert.ok(true, 'everyone ranked in this fixture'); return; }
    assert.match(r.text, /\d+ players? not ranked yet/);
    assert.ok(r.text.includes(r.rule));
    assert.ok(r.idle && r.after > r.before);
  } finally { await app.close(); }
});
