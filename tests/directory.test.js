// ===================== PLAYERS DIRECTORY: THE VISUAL CONTRACT =====================
// The approved direction (Shaun and CGPT, 20 Sep; Ledger, "Players Directory
// refresh") asked for a directory that leads with players, not with a filter
// form. The first pass (43401f8) folded Tier and Status away but kept a
// bordered filter card, two full-width form buttons for sort, the Rankings
// tier pills and the form toggles at full size, and plain rows -- so on a
// phone it still read as controls followed by a list, and Shaun reported it
// as unrefreshed.
//
// The existing Directory tests pin BEHAVIOUR (filters work, letters only in
// A-Z, inactive-only badges). These pin the look that the behaviour is
// wrapped in, which is what regressed without anything failing.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;

const openDirectory = async (app) => {
  await app.page.setViewportSize({ width: 375, height: 812 });   // iPhone SE / mini
  await app.run(() => { goToSection('players'); playersFiltersOpen = false; playersSortBy = 'name'; renderPlayersTab(); });
  await app.page.waitForTimeout(60);   // let the shell hide the Rankings chrome
};

maybe('the filter is a line of text, not a card', async () => {
  const app = await H.open();
  try {
    await openDirectory(app);
    const r = await app.run(() => {
      const el = document.getElementById('playersFilterToggle');
      const cs = getComputedStyle(el);
      return {
        border: cs.borderTopWidth, background: cs.backgroundColor, height: el.getBoundingClientRect().height,
        font: cs.fontFamily, text: el.textContent.replace(/\s+/g, ' ').trim(),
      };
    });
    assert.strictEqual(r.border, '0px', 'no border: the bordered dropdown was the rejected treatment');
    assert.match(r.background, /rgba\(0, 0, 0, 0\)|transparent/, 'no card background');
    assert.ok(r.height <= 32, `a line, not a panel (${r.height}px)`);
    assert.match(r.font, /Helvetica|Arial|sans-serif/i, 'controls are interface type');
    assert.match(r.text, /Filters · All tiers, all players/);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('sort is a compact control beside the count, not a full-width button bar', async () => {
  const app = await H.open();
  try {
    await openDirectory(app);
    const r = await app.run(() => {
      const seg = document.getElementById('playersSortToggle');
      const count = document.querySelector('#playersView .pdir-count');
      const s = seg.getBoundingClientRect();
      const c = count.getBoundingClientRect();
      const host = document.getElementById('playersView').getBoundingClientRect();
      return {
        height: Math.round(s.height), widthShare: s.width / host.width,
        sameLineAsCount: Math.abs((s.top + s.height / 2) - (c.top + c.height / 2)) < 8,
        labels: [...seg.querySelectorAll('button')].map((b) => b.textContent.trim()),
        font: getComputedStyle(seg.querySelector('button')).fontFamily,
      };
    });
    assert.ok(r.height <= 32, `compact, not a 40px form button (${r.height}px)`);
    assert.ok(r.widthShare < 0.6, `it should not span the screen (${Math.round(r.widthShare * 100)}%)`);
    assert.strictEqual(r.sameLineAsCount, true, 'it shares a line with the player count');
    assert.deepStrictEqual(r.labels, ['A–Z', 'Power Rating'], 'both sorts are still offered');
    assert.match(r.font, /Helvetica|Arial|sans-serif/i);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('players start near the top of the screen, filters shut or open', async () => {
  const app = await H.open();
  try {
    await openDirectory(app);
    // The club ticker (its own strip above every page) is not this page's layout.
    const strip = await app.run(() => { const t = document.getElementById('clubTicker'); return t ? Math.round(t.getBoundingClientRect().height) : 0; });
    const shut = await app.run(() => Math.round(document.querySelector('#playersView .pdir-row').getBoundingClientRect().top)) - strip;
    await app.run(() => { document.getElementById('playersFilterToggle').click(); });
    const open = await app.run(() => Math.round(document.querySelector('#playersView .pdir-row').getBoundingClientRect().top)) - strip;
    // Measured before this change at 375x812: 256px shut, 438px open.
    assert.ok(shut <= 230, `first player at ${shut}px with filters shut (was 256)`);
    assert.ok(open <= 360, `first player at ${open}px with filters open (was 438)`);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('open filters are small chips with one selected look', async () => {
  const app = await H.open();
  try {
    await openDirectory(app);
    const r = await app.run(() => {
      document.getElementById('playersFilterToggle').click();
      const tier = [...document.querySelectorAll('#playersTierBar .tierbtn')];
      const status = [...document.querySelectorAll('#playersActiveToggle .fg-toggle-btn')];
      const chosen = (els) => getComputedStyle(els.find((b) => b.classList.contains('active'))).backgroundColor;
      const labels = [...document.querySelectorAll('#playersView .pdir-filters .fg-label')];
      return {
        tierHeight: Math.max(...tier.map((b) => b.getBoundingClientRect().height)),
        statusHeight: Math.max(...status.map((b) => b.getBoundingClientRect().height)),
        tierChosen: chosen(tier), statusChosen: chosen(status),
        sortChosen: getComputedStyle(document.querySelector('#playersSortToggle .active')).backgroundColor,
        labelFonts: labels.map((l) => getComputedStyle(l).fontFamily),
      };
    });
    assert.ok(r.tierHeight <= 30, `tier chips are compact (${r.tierHeight}px)`);
    assert.ok(r.statusHeight <= 30, `status chips are compact (${r.statusHeight}px)`);
    assert.strictEqual(r.tierChosen, r.statusChosen,
      'a selected tier and a selected status look the same — one panel, one "chosen"');
    assert.strictEqual(r.tierChosen, r.sortChosen, 'and so does the selected sort');
    r.labelFonts.forEach((f) => assert.match(f, /Helvetica|Arial|sans-serif/i, 'section labels are interface type'));
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('a row is a player card: avatar, serif name, sans detail, a way in', async () => {
  const app = await H.open();
  try {
    await openDirectory(app);
    const r = await app.run(() => {
      const rows = [...document.querySelectorAll('#playersView .pdir-row')];
      const first = rows[0];
      const byTier = {};
      rows.forEach((row) => {
        const t = [...row.classList].find((c) => /^pdir-tier-/.test(c));
        const av = row.querySelector('.pdir-avatar');
        if (t && av && !byTier[t]) byTier[t] = getComputedStyle(av).color;
      });
      const name = PLAYERS.find((p) => p.name === first.dataset.player);
      return {
        avatar: (first.querySelector('.pdir-avatar') || {}).textContent || null,
        expectedInitials: initials(first.dataset.player),
        tierClass: [...first.classList].find((c) => /^pdir-tier-/.test(c)) || null,
        expectedTier: 'pdir-tier-' + name.tier.toLowerCase(),
        nameFont: getComputedStyle(first.querySelector('.pdir-name')).fontFamily,
        metaFont: getComputedStyle(first.querySelector('.pdir-meta')).fontFamily,
        chevron: !!first.querySelector('.pdir-chev'),
        tierColours: byTier,
        height: Math.round(first.getBoundingClientRect().height),
      };
    });
    assert.strictEqual(r.avatar, r.expectedInitials, 'each card carries the player\'s initials');
    assert.strictEqual(r.tierClass, r.expectedTier, 'and says which tier it belongs to');
    const colours = new Set(Object.values(r.tierColours));
    assert.ok(Object.keys(r.tierColours).length >= 3 && colours.size >= 3,
      'tiers are told apart at a glance, by the club\'s own tier colours');
    assert.match(r.nameFont, /Georgia|Iowan|serif/i, 'identity in the public serif');
    assert.match(r.metaFont, /Helvetica|Arial|sans-serif/i, 'detail in interface type');
    assert.strictEqual(r.chevron, true, 'a subtle profile affordance');
    assert.ok(r.height <= 58, `rows are cards, not panels (${r.height}px)`);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('an inactive player is unmistakable without Active saying anything', async () => {
  const app = await H.open();
  try {
    await app.run(() => { const away = PLAYERS.find((p) => p.name === 'Max'); away.status = 'temporarilyInactive'; away.active = false;   // the fixture's only flagged player is archived, so mark one away
    });
    await openDirectory(app);
    const r = await app.run(() => {
      const rows = [...document.querySelectorAll('#playersView .pdir-row')];
      const inactive = rows.find((row) => row.classList.contains('is-inactive'));
      const active = rows.find((row) => !row.classList.contains('is-inactive'));
      const op = (row) => Number(getComputedStyle(row.querySelector('.pdir-name')).opacity);
      return {
        inactiveCount: rows.filter((row) => row.classList.contains('is-inactive')).length,
        expected: livePlayers().filter((p) => !p.active).length,
        badged: !!(inactive && inactive.querySelector('.pdir-inactive')),
        quieter: inactive && active ? op(inactive) < op(active) : null,
      };
    });
    assert.strictEqual(r.inactiveCount, r.expected);
    assert.strictEqual(r.badged, true, 'the badge stays');
    assert.strictEqual(r.quieter, true, 'and the row itself steps back');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('nothing runs off the side of a narrow phone', async () => {
  const app = await H.open();
  try {
    for (const width of [320, 375, 390]) {
      await app.page.setViewportSize({ width, height: 800 });
      const r = await app.run(() => {
        goToSection('players'); playersFiltersOpen = true; renderPlayersTab();
        return { overflow: document.documentElement.scrollWidth > window.innerWidth + 1 };
      });
      assert.strictEqual(r.overflow, false, `horizontal overflow at ${width}px`);
    }
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
