// ===================== A CAMERA BESIDE EACH TABLE HEADING =====================
// Shaun, 27 Nov: "I need these screens to be shareable with a button ... a
// small camera icon next to each heading 'All tiers' then split by each. The
// screen capture tool at the top doesn't work great ... the entire width."

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;

maybe('the race: a camera beside All tiers and each tier; it makes a titled picture of that whole table', async () => {
  const app = await H.open({ now: '2026-11-21T10:00:00.000Z', path: 'index.html?club=padelchampionships', mobile: true, viewport: { width: 390, height: 844 } });
  try {
    const r = await app.run(async () => {
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      goToSection('rankings');
      [...document.querySelectorAll('#sectionSubnav .mp-seg-item')].find((b) => /race/i.test(b.textContent)).click();
      await wait(200);
      const btns = [...document.querySelectorAll('[data-share-section]')];
      const out = { labels: btns.map((b) => b.dataset.shareLabel), targetsExist: btns.every((b) => !!document.getElementById(b.dataset.shareSection)),
        beside: btns.every((b) => b.parentElement.classList.contains('section-share-row') && b.previousElementSibling.classList.contains('lg-tier-head')) };
      let title = null; const real = captureFrame;
      window.captureFrame = (shot, bg, css, t) => { title = t; out.shotWide = shot.width; return real(shot, bg, css, t); };
      document.querySelector('[data-share-section="raceTierBodyALL"]').click();
      for (let i = 0; i < 60 && !document.querySelector('.capture-sheet img'); i++) await wait(200);
      out.title = title; out.sheet = !!document.querySelector('.capture-sheet img');
      out.tableWide = document.getElementById('raceTierBodyALL').scrollWidth;
      out.headingStill = !!document.querySelector('#raceTierALL[aria-expanded="true"]');
      return out;
    });
    assert.deepStrictEqual(r.labels.slice(0, 1), ['All tiers']);
    assert.ok(r.labels.slice(1).length >= 1 && r.labels.slice(1).every((l) => /^Tier [SABC]$/.test(l)));
    assert.ok(r.targetsExist && r.beside);
    assert.match(r.title, /^\w{3}–\w{3} \d{4} Quarterly Race · All tiers$/);
    assert.ok(r.sheet, 'the Share / Save sheet opens with the picture');
    assert.ok(r.shotWide >= r.tableWide * 2 - 4, 'the whole width of the table, at 2x');
    assert.ok(r.headingStill, 'tapping the camera does not fold the section');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
