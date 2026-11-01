// ===================== ADMIN MONTHLY BOARD PACK =====================
// Admin / Manage › Monthly Board Pack: an admin chooses a month, the modules,
// their order and presentation, adds commentary, previews and saves. What is
// saved is the choice (moneypadel_board_pack_YYYY-MM); every figure is drawn
// from the same functions the rest of the app shows, for that month as it was.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const NOW = '2026-09-28T12:00:00.000Z';
const open = (club) => H.open({ now: NOW, club });
const KEY = 'moneypadel_board_pack_2026-08';


async function openSection(app){
  await app.run(() => {
    isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
    legacyTabBtn('manage').click(); renderManage();
    document.querySelector('[data-acc-toggle="boardpack"]').click();
  });
  await app.page.waitForSelector('#bpStatus');
}

maybe('Admin only: not on the locked screen, not read at start-up, and a save refuses without the lock', async () => {
  const app = await open();
  try {
    const r = await app.run(async () => {
      const startupReads = window.__reads.filter((x) => String(x.id || '').startsWith('moneypadel_board_pack')).length;
      isUnlocked = false; legacyTabBtn('manage').click(); renderManage();
      const lockedText = document.getElementById('manageView').textContent;
      const writes = window.__writes.length;
      const res = await saveBoardPackConfig(BoardPack.defaultConfig('2026-08'));
      return { startupReads, shown: lockedText.includes('Monthly Board Pack'), res, wrote: window.__writes.length - writes };
    });
    assert.deepStrictEqual(r, { startupReads: 0, shown: false, res: { ok: false, message: 'Only an admin can save the Board Pack.' }, wrote: 0 });
    await openSection(app);
    const shown = await app.run(() => !!document.getElementById('bpMonth'));
    assert.ok(shown, 'unlocked, the section is there');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('choose a month, select, deselect, reorder, set options, add commentary, preview and save', async () => {
  const app = await open();
  let saved;
  try {
    await openSection(app);
    const months = await app.run(() => [...document.querySelectorAll('#bpMonth option')].map((o) => o.value));
    assert.deepStrictEqual(months, ['2026-09', '2026-08', '2026-07', '2026-06'], 'every month with games, newest first');
    assert.strictEqual(await app.page.$eval('#bpMonth', (s) => s.value), '2026-09', 'opens on the month the monthly screens open on');

    await app.page.selectOption('#bpMonth', '2026-08');
    await app.page.waitForSelector('#bpStatus');
    const p = app.page;
    const idx = (id) => p.$eval(`[data-bp-module="${id}"]`, (el) => Number(el.dataset.bpItem));
    // Deselect the overview, select Merit.
    await p.click(`[data-bp-toggle="${await idx('overview')}"]`);
    await p.click(`[data-bp-toggle="${await idx('merit')}"]`);
    // Kings up above Power.
    await p.click(`[data-bp-move="${await idx('kings')}"][data-delta="-1"]`);
    // Power: Tier A, top 3.
    await p.selectOption(`[data-bp-opt="${await idx('power')}"][data-key="tier"]`, 'A');
    await p.selectOption(`[data-bp-opt="${await idx('power')}"][data-key="top"]`, '3');
    // Commentary, moved to the top.
    await p.click('#bpAddNote');
    const n = await p.$$eval('[data-bp-item]', (els) => els.length);
    await p.fill(`[data-bp-note-title="${n - 1}"]`, 'Chair’s summary');
    await p.fill(`[data-bp-note-body="${n - 1}"]`, 'Good month.\n<b>Not bold</b>');
    assert.strictEqual(await p.textContent('#bpStatus'), 'Saving…', 'changes save as they are made');
    for (let i = n - 1; i > 0; i--) await p.click(`[data-bp-move="${i}"][data-delta="-1"]`);

    await p.click('#bpPreviewBtn');
    const preview = await p.evaluate(() => ({
      order: [...document.querySelectorAll('#bpPreview .bp-module')].map((s) => s.dataset.module || 'note:' + s.querySelector('.bp-module-title').textContent),
      noteTag: document.querySelector('#bpPreview .bp-note .bp-note-tag').textContent,
      noteHtml: document.querySelector('#bpPreview .bp-note-body').innerHTML,
      powerRows: document.querySelectorAll('#bpPreview [data-module="power"] tbody tr').length,
      powerTiers: [...document.querySelectorAll('#bpPreview [data-module="power"] .bp-subhead')].map((h) => h.textContent),
    }));
    assert.deepStrictEqual(preview.order, ['note:Chair’s summary', 'results_table', 'over_80', 'lost_pct', 'kings', 'power', 'league', 'merit', 'race', 'rating_movers', 'tier_moves']);
    assert.strictEqual(preview.noteTag, 'Admin commentary', 'manual content is marked as such');
    assert.strictEqual(preview.noteHtml, 'Good month.<br>&lt;b&gt;Not bold&lt;/b&gt;', 'and is text, not markup');
    assert.strictEqual(preview.powerRows, 3);
    assert.deepStrictEqual(preview.powerTiers, ['Tier A'], 'one tier chosen: its section only');

    // No Save button: every change has been saved as it was made.
    assert.strictEqual(await p.$('#bpSave'), null);
    await p.waitForFunction(() => /^Saved .* by Shaun\.$/.test(document.getElementById('bpStatus').textContent));
    const w = await app.run((key) => window.__writes.filter((x) => x.id === key), KEY);
    assert.ok(w.length >= 1, 'saved to that month\'s document');
    assert.deepStrictEqual(await app.run(() => [...new Set(window.__writes.map((x) => x.id))]), [KEY], 'and nothing else');
    saved = JSON.parse(w.at(-1).doc.value);
    assert.strictEqual(saved.month, '2026-08');
    assert.strictEqual(saved.updatedBy, 'Shaun');
    assert.ok(saved.updatedAt && saved.basis && saved.basis.games > 0 && saved.basis.fingerprint);
    const on = saved.items.filter((it) => it.kind === 'note' || it.enabled).map((it) => it.kind === 'note' ? 'note' : it.id);
    assert.deepStrictEqual(on, ['note', 'results_table', 'over_80', 'lost_pct', 'kings', 'power', 'league', 'merit', 'race', 'rating_movers', 'tier_moves']);
    assert.deepStrictEqual(saved.items.find((it) => it.id === 'power').options, { split: 'split', tier: 'A', top: '3', min: '5', players: 'all' });
    assert.deepStrictEqual(Object.keys(saved).sort(), ['basis', 'items', 'month', 'updatedAt', 'updatedBy', 'version'], 'the choice and its stamp -- no figures');
    assert.match(await p.textContent('#bpStatus'), /^Saved .* by Shaun\.$/);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }

  // A fresh session reads it back exactly.
  const again = await open({ [KEY]: saved });
  try {
    await openSection(again);
    await again.page.selectOption('#bpMonth', '2026-08');
    await again.page.waitForSelector('#bpStatus');
    const r = await again.run(() => ({
      status: document.getElementById('bpStatus').textContent,
      drift: !!document.getElementById('bpDrift'),
      checked: [...document.querySelectorAll('[data-bp-toggle]')].filter((c) => c.checked).map((c) => c.closest('[data-bp-module]').dataset.bpModule),
      first: document.querySelector('[data-bp-item="0"]').classList.contains('bp-item-note'),
      title: document.querySelector('[data-bp-note-title="0"]').value,
      body: document.querySelector('[data-bp-note-body="0"]').value,
      powerTop: document.querySelector(`[data-bp-module="power"] [data-key="top"]`).value,
    }));
    assert.match(r.status, /^Saved .* by Shaun\.$/);
    assert.deepStrictEqual(r, { status: r.status, drift: false, checked: ['results_table', 'over_80', 'lost_pct', 'kings', 'power', 'league', 'merit', 'race', 'rating_movers', 'tier_moves'],
      first: true, title: 'Chair’s summary', body: 'Good month.\n<b>Not bold</b>', powerTop: '3' });
    // September was never saved: its own default, untouched by August's pack.
    await again.page.selectOption('#bpMonth', '2026-09');
    await again.page.waitForSelector('#bpStatus');
    assert.match(await again.page.textContent('#bpStatus'), /Not saved yet for September 2026/);
    assert.deepStrictEqual(again.pageErrors, []);
  } finally { await again.close(); }
});

maybe('a saved pack says when the month\'s record has changed since it was saved', async () => {
  const stale = { version: 1, month: '2026-08', items: [], basis: { games: 3, fingerprint: 'not-this-record' }, updatedAt: '2026-09-01T09:00:00.000Z', updatedBy: 'Shaun' };
  const app = await open({ [KEY]: stale });
  try {
    await openSection(app);
    await app.page.selectOption('#bpMonth', '2026-08');
    await app.page.waitForSelector('#bpStatus');
    const warn = await app.run(() => (document.getElementById('bpDrift') || {}).textContent || '');
    assert.match(warn, /The record for August 2026 has changed since this pack was saved \(3 games then, \d+ now/);
  } finally { await app.close(); }
});

maybe('every figure is the canonical one: the same functions the app\'s own screens show', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      const out = [];
      const eq = (a, b, what) => { if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${what}: ${JSON.stringify(a).slice(0, 200)} != ${JSON.stringify(b).slice(0, 200)}`); };
      const data = (id, month, options) => boardPackModuleData({ id, options: Object.assign(BoardPack.defaultOptions(id), options || {}) }, month);
      boardPackMonths().forEach((m) => {
        // Rankings: the month's Power list and Kings of Tiers, as the Rankings screen has them.
        // (The screen draws no podium on a month since 1 Nov; the pack keeps its top three.)
        activeTab = 'power'; activeSortP = 'rating'; query = ''; activeTier = 'All'; selectedMonth = m; minGames = 5;
        const top3 = rankingPool(m, defaultRankingMinGames(m)).slice(0, 3).map((p) => ({ name: p.name, rating: p.scopeRating }));
        eq(data('power', m, { top: '3', split: 'one' }).rows.map((x) => ({ name: x.name, rating: x.rating })), top3, `${m} power = the month's top three`);
        // Split by tier: each tier's section is that tier's own ranking, from the same pool.
        const pool = rankingPool(m, defaultRankingMinGames(m));
        data('power', m, { top: 'all' }).tiers.forEach((t) => eq(t.rows.map((x) => x.name), pool.filter((x) => x.scopeTier === t.tier).map((x) => x.name), `${m} power tier ${t.tier}`));
        eq(data('power', m, { top: 'all' }).tiers.map((t) => t.tier), groupedTiers().filter((t) => pool.some((x) => x.scopeTier === t)), `${m} power: every tier`);
        eq(data('kings', m).kings, computeKingsOfTiers(), `${m} kings`);
        // Drawn as the Rankings screen's own Kings of Tiers tiles.
        const kingsHtml = document.createElement('div');
        kingsHtml.innerHTML = boardPackRenderers().kings(data('kings', m), m);
        const k = computeKingsOfTiers();
        eq([...kingsHtml.querySelectorAll('.kings-card:not(:has(.kings-name-empty))')].map((c) => [c.querySelector('.kings-name').textContent, c.querySelector('.kings-rating').textContent, !!c.querySelector('img.kings-crown[src="assets/rankings/podium-crown-laurel.png"]')]),
          k ? TIER_ORDER_LIST.filter((t) => k[t]).map((t) => [k[t].name, String(k[t].rating), true]) : [], `${m} kings tiles`);

        // Monthly Information: every list, as the Information tab prints it.
        summaryMonth = m; summaryMode = 'information'; renderSummary();
        const tab = document.getElementById('summaryContent').textContent.replace(/\s+/g, ' ');
        const info = data('information', m);
        const line = (g, tail) => `${g.rank}. ${g.names.join(' / ')} — ${tail}`;
        info.mostGames.forEach((g) => { if (!tab.includes(line(g, `${g.value} game`))) out.push(`${m} most games ${g.names}`); });
        info.highestWinPct.forEach((g) => { if (!tab.includes(line(g, `${g.value}% wins`))) out.push(`${m} win% ${g.names}`); });
        info.mostWins.forEach((g) => { if (!tab.includes(line(g, ''))) out.push(`${m} wins ${g.names}`); });
        info.hardestGames.forEach((g) => { if (!tab.includes(line(g, `${g.value}`))) out.push(`${m} hardest ${g.names}`); });
        eq(data('most_wins', m).groups, info.mostWins, `${m} most wins`);
        eq(data('best_record', m).groups, info.highestWinPct, `${m} best record`);
        eq(data('most_games', m).groups, info.mostGames, `${m} most games`);

        // Monthly stories: the Power Rankings stories for the month.
        monthlySummaryOpen = true;   // closed by default since 1 Nov; its figures are what is compared
        const stories = document.createElement('div'); stories.innerHTML = buildMonthlyStoriesHtml(m);
        const st = stories.textContent.replace(/\s+/g, ' ');
        const mv = data('rating_movers', m);
        mv.risers.concat(mv.fallers).forEach((x) => { if (!st.includes(`${x.playerId}${Math.round(x.startRating)} → ${Math.round(x.endRating)}`)) out.push(`${m} mover ${x.playerId}`); });
        eq(mv.risers.map((x) => x.playerId), MonthlyViews.ratingMovementTable(MONTHLY_VIEWS, m).filter((x) => x.ratingChange > 0).slice(0, 3).map((x) => x.playerId), `${m} risers`);
        eq(data('performance', m).rows.map((x) => x.playerId), MonthlyViews.performanceTable(MONTHLY_VIEWS, m).slice(0, 3).map((x) => x.playerId), `${m} performance`);
        eq(data('crossovers', m, { top: 'all' }).rows, MONTHLY_VIEWS.byMonth[m].crossovers, `${m} crossovers`);

        // League, Merit, Race: the tables' own builders, by the tier held on each match's date.
        const split = Object.values(computeMonthlySummaryStats(m, { splitByTier: true })).filter((s) => s.games > 0);
        data('league', m).tiers.forEach((t) => {
          const want = split.filter((s) => (s.segmentTier || '?') === t.tier)
            .sort((a, b) => b.points - a.points || b.gd - a.gd || a.name.localeCompare(b.name)).map((s) => [s.name, s.points, s.games]);
          eq(t.rows.map((s) => [s.name, s.points, s.games]), want, `${m} league ${t.tier}`);
        });
        const merit = MeritTable.build(meritMatches(m), historicalTierOf, { tierForRow: historicalTierOf }).table;
        data('merit', m).tiers.forEach((t) => eq(t.rows, merit.filter((x) => x.tier === t.tier && x.played > 0), `${m} merit ${t.tier}`));
        const race = buildMonthlyRace(m).table;
        data('race', m, { provisional: 'show' }).tiers.forEach((t) => eq(t.rows, race.filter((x) => x.tier === t.tier), `${m} race ${t.tier}`));

        // The monthly results table and the over-80% list, checked against a
        // tally made here straight from the month's approved matches.
        const tally = {};
        getAllApprovedMatches().filter((x) => x.date.slice(0, 7) === m).forEach((x) => {
          const add = (n, k) => { const t = tally[n] = tally[n] || { games: 0, wins: 0, draws: 0, losses: 0 }; t.games++; t[k]++; };
          x.winners.forEach((n) => add(n, x.isDraw ? 'draws' : 'wins'));
          x.losers.forEach((n) => add(n, x.isDraw ? 'draws' : 'losses'));
        });
        const table = data('results_table', m, { split: 'one' }).rows;
        eq(table.map((x) => x.name).sort(), Object.keys(tally).sort(), `${m} results table players`);
        table.forEach((x) => {
          const t = tally[x.name] || {};
          eq([x.games, x.wins, x.draws, x.losses, x.points], [t.games, t.wins, t.draws, t.losses, 3 * t.wins + t.draws], `${m} results ${x.name}`);
        });
        eq(table.map((x) => x.points), table.map((x) => x.points).slice().sort((a, b) => b - a), `${m} ordered by points`);
        const byDiff = data('results_table', m, { sort: 'difficulty', split: 'one' }).rows;
        // Split by tier: the League's own split rows, each tier in the points order.
        const splitRows = leagueSplitRows(m).filter((x) => x.games > 0);
        const byTier = data('results_table', m);
        eq(byTier.tiers.map((t) => t.tier), groupedTiers().filter((t) => splitRows.some((x) => x.tier === t)), `${m} results: every tier`);
        byTier.tiers.forEach((t) => eq(t.rows.map((x) => [x.name, x.games, x.points]), sortLeagueRows(splitRows.filter((x) => x.tier === t.tier), 'points', true).map((x) => [x.name, x.games, x.points]), `${m} results tier ${t.tier}`));
        eq(byTier.rows.reduce((n, x) => n + x.games, 0), splitRows.filter((x) => x.tier !== '?').reduce((n, x) => n + x.games, 0), `${m} results: every game in a tier`);
        eq(byDiff.map((x) => x.hardness), byDiff.map((x) => x.hardness).slice().sort((a, b) => b - a), `${m} ordered by difficulty`);
        const hardest = monthlyInformation(m, { top: 1 }).hardestGames;
        if (hardest.length && !hardest[0].names.includes(byDiff.filter((x) => x.games >= 3)[0].name)) out.push(`${m} hardest = Information's`);
        [1, 3, 5].forEach((min) => {
          const o = data('over_80', m, { min: String(min) });
          const l = data('lost_pct', m, { min: String(min) });
          const who = (k) => Object.keys(tally).filter((n) => tally[n].games >= min && tally[n][k] * 5 >= tally[n].games * 4).sort();
          eq(o.won.map((x) => x.name).sort(), who('wins'), `${m} won 80%+ (${min}+)`);
          eq(l.lost.map((x) => x.name).sort(), who('losses'), `${m} lost 80%+ (${min}+)`);
          eq([o.lost, l.won], [undefined, undefined], `${m} winning and losing are separate modules`);
        });
        // Any threshold the Admin picks, and reaching it counts.
        ['50', '60', '70', '75', '90', '100'].forEach((t) => {
          const o = data('over_80', m, { threshold: t });
          const l = data('lost_pct', m, { threshold: t });
          const who = (k) => Object.keys(tally).filter((n) => tally[n].games >= 3 && tally[n][k] * 100 >= Number(t) * tally[n].games).sort();
          eq([o.threshold, o.won.map((x) => x.name).sort(), l.threshold, l.lost.map((x) => x.name).sort()], [Number(t), who('wins'), Number(t), who('losses')], `${m} over ${t}%`);
        });
        // Highest loss %: losses over games played (draws are games), 3+
        // games, ties sharing a place -- not lowest win %.
        const lossPct = (n) => Math.round(1000 * tally[n].losses / tally[n].games) / 10;
        const eligible = Object.keys(tally).filter((n) => tally[n].games >= 3);
        const worst = data('worst_record', m, { top: 'all' }).groups;
        eq(worst.flatMap((g) => g.names).sort(), eligible.sort(), `${m} highest loss %: everyone with 3+ games`);
        worst.forEach((g) => g.names.forEach((n) => eq(g.value, lossPct(n), `${m} loss % ${n}`)));
        eq(worst.map((g) => g.value), worst.map((g) => g.value).slice().sort((a, b) => b - a), `${m} highest loss % first`);
        eq(data('worst_record', m).groups, info.highestLossPct, `${m} worst record = Monthly Information's list`);

        // Doughnuts, the month's games, tier changes.
        const dn = computeDoughnutStats(m);
        eq(data('doughnuts', m, { top: 'all' }).received, topNTied(dn.filter((x) => x.received > 0), 'received', Infinity, true), `${m} doughnuts`);
        eq(data('overview', m).games, MeaningfulMonth.countInMonth(getAllApprovedMatches(), m), `${m} games`);
        eq(data('tier_moves', m).rows.map((c) => c.name), V3_TIER_HISTORY.changes.filter((c) => c.effectiveDate.slice(0, 7) === m).map((c) => c.playerId), `${m} tier moves`);
      });
      return out;
    });
    assert.deepStrictEqual(r, []);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('a past month is that month: tiers as they were, only that month\'s games', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      const d = (id, m, o) => boardPackModuleData({ id, options: Object.assign(BoardPack.defaultOptions(id), o || {}) }, m);
      // Fatch was promoted C -> B on 1 August. July's pack files him in C.
      const current = PLAYERS.find((p) => p.name === 'Fatch').tier;
      const julyPower = d('power', '2026-07', { top: 'all' }).rows.find((x) => x.name === 'Fatch');
      const julyC = d('power', '2026-07', { tier: 'C', top: 'all' }).rows.map((x) => x.name);
      const julyB = d('power', '2026-07', { tier: 'B', top: 'all' }).rows.map((x) => x.name);
      const julyLeague = d('league', '2026-07').tiers.map((t) => [t.tier, t.rows.some((x) => x.name === 'Fatch')]).filter(([, has]) => has).map(([t]) => t);
      const augMoves = d('tier_moves', '2026-08').rows;
      // Month scoping: every league game in each month's pack is a game of that month.
      const scoped = boardPackMonths().every((m) => d('league', m, { top: 'all' }).tiers.every((t) => t.rows.every((x) => x.matchList.every((g) => g.date.slice(0, 7) === m))));
      // Form is Last 10 as it stood at the month's close, not today's.
      const julyForm = d('form', '2026-07', { top: 'all' }).rows;
      const formEndsInJuly = julyForm.every((x) => x.to <= '2026-07-31');
      return { current, julyTier: julyPower && julyPower.tier, inC: julyC.includes('Fatch'), inB: julyB.includes('Fatch'), julyLeague,
        augMoves: augMoves.map((c) => [c.name, c.fromTier, c.toTier]), scoped, formEndsInJuly, formRows: julyForm.length };
    });
    assert.deepStrictEqual(r, { current: 'B', julyTier: 'C', inC: true, inB: false, julyLeague: ['C'],
      augMoves: [['Fatch', 'C', 'B']], scoped: true, formEndsInJuly: true, formRows: r.formRows });
    assert.ok(r.formRows > 0);
  } finally { await app.close(); }
});

maybe('compiling and saving packs changes no rating, table or race', async () => {
  const app = await open();
  try {
    const r = await app.run(async () => {
      const fingerprint = () => JSON.stringify({
        players: PLAYERS.map((p) => [p.name, p.rating, p.tier, p.total]),
        closing: MONTHLY_VIEWS.byMonth,
        months: getAvailableMonths().map((m) => [computeMonthlySummaryStats(m), MeritTable.build(meritMatches(m), historicalTierOf).table, buildMonthlyRace(m).table]),
        journey: V3_JOURNEY.length,
      });
      const before = fingerprint();
      const writes = window.__writes.length;
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
      for (const m of boardPackMonths()) {
        let c = BoardPack.defaultConfig(m);
        c.items.forEach((_, i) => { c = BoardPack.setEnabled(c, i, true); });
        boardPackHtml(c);
        await saveBoardPackConfig(c);
      }
      const ids = window.__writes.slice(writes).map((w) => w.id);
      return { same: fingerprint() === before, ids };
    });
    assert.strictEqual(r.same, true);
    assert.deepStrictEqual(r.ids, ['2026-09', '2026-08', '2026-07', '2026-06'].map((m) => `moneypadel_board_pack_${m}`), 'nothing but the packs is written');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});


maybe('Power Rankings options: the minimum games and which players, judged at the month\'s close', async () => {
  const app = await H.open({ now: NOW });
  try {
    const r = await app.run(() => {
      const d = (o) => boardPackModuleData({ id: 'power', options: Object.assign(BoardPack.defaultOptions('power'), { top: 'all' }, o) }, '2026-09');
      const total = (name) => computeMonthlyStats('2026-09')[name].total;
      const out = {};
      out.defaultIsRankings = d({}).rows.map((x) => x.name).join() === rankingPool('2026-09', 5).map((x) => x.name).join();
      out.floors = ['1', '3', '5', '10'].map((min) => { const rows = d({ min }).rows; return [min, rows.length, rows.every((x) => total(x.name) >= Number(min))]; });
      const monthEnd = Date.UTC(2026, 9, 1) - 1;
      const ranked = d({ min: '1', players: 'ranked' }).rows;
      out.ranked = ranked.every((x) => playerStateOf(x.name, monthEnd).rankable);
      // An inactive player: left out when asked, kept by default.
      const p = PLAYERS.find((x) => x.name === d({ min: '1' }).rows[0].name);
      p.active = false;
      out.inactive = [p.name, d({ min: '1' }).rows.some((x) => x.name === p.name), d({ min: '1', players: 'active' }).rows.some((x) => x.name === p.name), d({ min: '1', players: 'ranked' }).rows.some((x) => x.name === p.name)];
      p.active = true;
      out.foot = boardPackRenderers().power(d({ min: '3', players: 'active' }), '2026-09');
      return out;
    });
    assert.strictEqual(r.defaultIsRankings, true, 'by default, the Rankings month pool');
    const sizes = r.floors.map((f) => f[1]);
    assert.ok(sizes[0] >= sizes[1] && sizes[1] >= sizes[2] && sizes[2] >= sizes[3] && sizes[0] > sizes[2], JSON.stringify(r.floors));
    r.floors.forEach((f) => assert.ok(f[2], `every row has ${f[0]}+ games`));
    assert.strictEqual(r.ranked, true);
    assert.deepStrictEqual(r.inactive.slice(1), [true, false, false], `${r.inactive[0]} kept by default, left out on request`);
    assert.match(r.foot, /3\+ games in the month; inactive players left out\./);
  } finally { await app.close(); }
});

maybe('records always read wins, draws, losses', async () => {
  const app = await H.open({ now: NOW });
  try {
    const r = await app.run(() => {
      const d = (id) => boardPackModuleData({ id, options: BoardPack.defaultOptions(id) }, '2026-09');
      const best = boardPackBlocks().best_record(d('best_record'), '2026-09')[0].rows
        .concat(boardPackBlocks().worst_record(d('worst_record'), '2026-09')[0].rows);
      const stats = computeMonthlySummaryStats('2026-09');
      return { best: best.map((x) => [x.name, x.value]), stats: Object.fromEntries(best.map((x) => [x.name.split(' / ')[0], stats[x.name.split(' / ')[0]]])),
        pairs: boardPackBlocks().partnerships(d('partnerships'), '2026-09')[0].rows.map((x) => x.value) };
    });
    r.best.forEach(([name, value]) => {
      const s = r.stats[name.split(' / ')[0]];
      assert.ok(value.endsWith(`· ${s.wins}W ${s.draws}D ${s.losses}L`), `${name}: ${value}`);
    });
    r.pairs.forEach((v) => assert.match(v, /^\d+W \d+D \d+L \(/));
  } finally { await app.close(); }
});

maybe('winning and losing each have their own threshold; Highest loss % is losses over games played', async () => {
  const app = await H.open({ now: NOW });
  try {
    await openSection(app);
    await app.page.selectOption('#bpMonth', '2026-09');
    await app.page.waitForSelector('#bpStatus');
    const p = app.page;
    const idx = (id) => p.$eval(`[data-bp-module="${id}"]`, (el) => Number(el.dataset.bpItem));
    assert.deepStrictEqual(await p.$$eval('[data-bp-module="over_80"] .bp-check, [data-bp-module="lost_pct"] .bp-check, [data-bp-module="worst_record"] .bp-check', (els) => els.map((e) => e.textContent.trim())),
      ['Won a set % of games or more', 'Lost a set % of games or more', 'Highest loss % (3+ games)']);
    await p.selectOption(`[data-bp-opt="${await idx('over_80')}"][data-key="threshold"]`, '60');
    await p.selectOption(`[data-bp-opt="${await idx('lost_pct')}"][data-key="threshold"]`, '50');
    await p.selectOption(`[data-bp-opt="${await idx('lost_pct')}"][data-key="min"]`, '5');
    await p.click(`[data-bp-toggle="${await idx('worst_record')}"]`);
    await p.click('#bpPreviewBtn');
    const r = await app.run(() => {
      const text = (id) => document.querySelector(`#bpPreview [data-module="${id}"]`).textContent.replace(/\s+/g, ' ');
      const item = (id) => boardPackDraft.items.find((it) => it.id === id);
      const won = boardPackModuleData(item('over_80'), '2026-09').won;
      const lost = boardPackModuleData(item('lost_pct'), '2026-09').lost;
      const worst = boardPackModuleData(item('worst_record'), '2026-09').groups;
      return {
        won: text('over_80'), lost: text('lost_pct'), worst: text('worst_record'),
        wonNames: won.map((x) => x.name), lostRows: lost.map((x) => [x.name, x.games, x.losspct]),
        worstFirst: worst[0], options: [item('over_80').options, item('lost_pct').options],
        deck: boardPackDeck(boardPackDraft).slides.filter((x) => ['over_80', 'lost_pct', 'worst_record'].includes(x.id)).map((x) => [x.id, x.title, x.groups[0].rows.length]),
      };
    });
    assert.deepStrictEqual(r.options, [{ threshold: '60', min: '3' }, { threshold: '50', min: '5' }], 'set separately');
    assert.match(r.won, /Won 60% or more/);
    assert.ok(!/Lost/.test(r.won), 'the win module no longer lists losers');
    assert.match(r.lost, /Lost 50% or more/);
    assert.match(r.lost, /Players with 5\+ games that month/);
    r.lostRows.forEach(([n, g, pct]) => { assert.ok(g >= 5 && pct >= 50, n); assert.ok(r.lost.includes(`${n}lost ${pct}%`), n); });
    r.wonNames.forEach((n) => assert.ok(r.won.includes(n), n));
    assert.ok(r.worstFirst && r.worst.includes(`${r.worstFirst.value}% lost`), r.worst);
    assert.match(r.worst, /Losses ÷ games played, 3\+ games/);
    const deck = Object.fromEntries(r.deck.map(([id, title, n]) => [id, [title, n]]));
    if (r.wonNames.length) assert.deepStrictEqual(deck.over_80, ['Won 60% or more', Math.min(5, r.wonNames.length)]);
    if (r.lostRows.length) assert.deepStrictEqual(deck.lost_pct, ['Lost 50% or more', Math.min(5, r.lostRows.length)]);
    assert.strictEqual(deck.worst_record[0], 'Highest loss %');
    await p.waitForFunction(() => /^Saved .* by Shaun\.$/.test(document.getElementById('bpStatus').textContent));
    const saved = await app.run(() => JSON.parse(window.__writes.filter((w) => w.id === 'moneypadel_board_pack_2026-09').at(-1).doc.value));
    assert.deepStrictEqual(saved.items.filter((it) => ['over_80', 'lost_pct', 'worst_record'].includes(it.id)).map((it) => [it.id, it.enabled, it.options.threshold || it.options.top]),
      [['over_80', true, '60'], ['lost_pct', true, '50'], ['worst_record', true, '3']]);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('the pack saves itself as it changes, before anything is published, and to the month it was changed in', async () => {
  const app = await H.open({ now: NOW });
  try {
    await openSection(app);
    await app.page.selectOption('#bpMonth', '2026-08');
    await app.page.waitForSelector('#bpStatus');
    const p = app.page;
    const writes = (m) => app.run((key) => window.__writes.filter((x) => x.id === key).map((x) => JSON.parse(x.doc.value)), `moneypadel_board_pack_${m}`);
    const idx = (id) => p.$eval(`[data-bp-module="${id}"]`, (el) => Number(el.dataset.bpItem));
    await p.selectOption(`[data-bp-opt="${await idx('over_80')}"][data-key="threshold"]`, '70');
    assert.strictEqual(await p.textContent('#bpStatus'), 'Saving…');
    await p.waitForFunction(() => /^Saved .* by Shaun\.$/.test(document.getElementById('bpStatus').textContent));
    assert.strictEqual((await writes('2026-08')).at(-1).items.find((it) => it.id === 'over_80').options.threshold, '70');

    // Change, then straight to another month: it is saved to August, not lost.
    await p.selectOption(`[data-bp-opt="${await idx('power')}"][data-key="min"]`, '3');
    await p.selectOption('#bpMonth', '2026-09');
    await p.waitForSelector('#bpStatus');
    assert.strictEqual((await writes('2026-08')).at(-1).items.find((it) => it.id === 'power').options.min, '3');
    assert.strictEqual((await writes('2026-09')).length, 0, 'September untouched');
    assert.strictEqual(await app.run(() => window.__writes.filter((w) => /review_/.test(w.id)).length), 0, 'nothing published');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});


maybe('partnerships carry their draws: counted from the month\'s approved draws, in the record and the win %', async () => {
  const app = await H.open({ now: NOW });
  try {
    // The seeded record has no draw between two qualifying pairs; add one --
    // two September pairs who have each played twice -- while checking.
    const shown = await app.run(() => {
      // In the record, and in the rated draws partnerships are built from
      // (matchesIncludingDraws), as a recompute would leave it.
      const draw = { id: 'test-draw', date: '2026-09-20', winners: ['KC', 'Rishi'], losers: ['Erf', 'Osh'], isDraw: true, sets: [[5, 5]] };
      V3_MATCHES.push(draw);
      DRAW_MATCHES.push({ ...draw, performance_residual: 0, games_winner: 5, games_loser: 5 });
      const rows = boardPackModuleData({ id: 'partnerships', options: { top: 'all' } }, '2026-09');
      return boardPackBlocks().partnerships(rows, '2026-09')[0].rows.filter((x) => /KC & Rishi|Erf & Osh/.test(x.name)).map((x) => x.value);
    });
    assert.strictEqual(shown.length, 2);
    shown.forEach((v) => assert.match(v, /^\d+W 1D \d+L \(/));
    const r = await app.run(() => getAvailableMonths().map((m) => {
      const rows = boardPackModuleData({ id: 'partnerships', options: { top: 'all' } }, m).rows;
      const drawn = (pair) => getAllApprovedMatches().filter((x) => x.isDraw && x.date.slice(0, 7) === m
        && [x.winners, x.losers].some((t) => t.length === 2 && [...t].sort().join('|') === pair.join('|'))).length;
      return rows.map((p) => ({ m, pair: p.pair.join(' & '), draws: p.draws, expected: drawn(p.pair),
        winpct: p.winpct, expectedPct: Math.round(1000 * p.wins / (p.wins + p.losses + drawn(p.pair))) / 10 }));
    }).flat());
    assert.ok(r.length > 0);
    assert.ok(r.some((x) => x.expected > 0), 'the record has a pair with a draw to check');
    r.forEach((x) => assert.deepStrictEqual([x.draws, x.winpct], [x.expected, x.expectedPct], `${x.m} ${x.pair}`));
    await app.run(() => {
      V3_MATCHES.splice(V3_MATCHES.findIndex((x) => x.id === 'test-draw'), 1);
      DRAW_MATCHES.splice(DRAW_MATCHES.findIndex((x) => x.id === 'test-draw'), 1);
    });
  } finally { await app.close(); }
});

maybe('split by tier, a player who moved tier mid-month is in each tier they played in, with that spell\'s games', async () => {
  const app = await H.open({ now: NOW });
  try {
    const r = await app.run(() => {
      const d = (id, o) => boardPackModuleData({ id, options: Object.assign(BoardPack.defaultOptions(id), o || {}) }, '2026-09');
      // The busiest Tier B player, moved up to Tier A partway through their month.
      const whole = d('results_table', { split: 'one' }).rows;
      const mover = whole.filter((x) => historicalTierOf(x.name, '2026-09-30') === 'B').sort((a, b) => b.games - a.games)[0];
      const games = getAllApprovedMatches().filter((m) => m.date.slice(0, 7) === '2026-09' && m.winners.concat(m.losers).includes(mover.name));
      const dates = games.map((m) => m.date).sort();
      const cut = dates.find((x) => x > dates[0]) || dates[0];
      const real = historicalTierOf;
      historicalTierOf = (name, date) => (name === mover.name ? (date >= cut ? 'A' : 'B') : real(name, date));
      try {
        const split = d('results_table');
        const one = d('results_table', { split: 'one' });
        const inTier = (t) => (split.tiers.find((x) => x.tier === t) || { rows: [] }).rows.find((x) => x.name === mover.name);
        return { name: mover.name, total: mover.games,
          spells: [games.filter((m) => m.date < cut).length, games.filter((m) => m.date >= cut).length],
          A: inTier('A') && inTier('A').games, B: inTier('B') && inTier('B').games,
          oneRows: one.rows.filter((x) => x.name === mover.name).map((x) => x.games) };
      } finally { historicalTierOf = real; }
    });
    assert.ok(r.spells[0] > 0 && r.spells[1] > 0, `${r.name} played on both sides of the change (${r.spells})`);
    assert.deepStrictEqual([r.B, r.A], r.spells, 'each tier holds that spell\'s games');
    assert.deepStrictEqual(r.oneRows, [r.total], 'one list: one row, the whole month');
  } finally { await app.close(); }
});

maybe('the Merit slide splits wins Hard, Even and Fav, which add up to W (Shaun, 30 Oct)', async () => {
  const app = await open();
  try {
    const r = await app.run(() => {
      const m = boardPackMonths()[0];
      const d = boardPackModuleData({ id: 'merit', options: BoardPack.defaultOptions('merit') }, m);
      const tables = boardPackBlocks().merit(d, m).filter((b) => b.type === 'table');
      return { headers: tables[0].headers, rows: tables.flatMap((t) => t.rows.map((row) => row.map((c) => (c && typeof c === 'object' ? c.text : c)))) };
    });
    assert.deepStrictEqual(r.headers, ['#', 'Player', 'P', 'W', 'Hard', 'Even', 'Fav', 'Pts']);
    assert.ok(r.rows.length > 0);
    r.rows.forEach((row) => assert.strictEqual(Number(row[4]) + Number(row[5]) + Number(row[6]), Number(row[3]), `${row[1]}: Hard + Even + Fav = W`));
    assert.ok(r.rows.some((row) => Number(row[5]) > 0), 'the month has even wins');
  } finally { await app.close(); }
});
