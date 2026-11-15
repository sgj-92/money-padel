// ===================== AN EMPTY POWER RANKINGS LIST SAYS WHY =====================
// Shaun, 15 Nov (Padel Championships): ten players, but none has 10 rated
// games yet, so Power Rankings read "No players match that filter". It now
// says what is hiding them and offers to show them.

const test = require('node:test');
const assert = require('node:assert');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;

maybe('nobody with the minimum games: the list says so and one tap shows everyone', async () => {
  const app = await H.open({ now: '2026-09-21T10:00:00.000Z' });
  try {
    const r = await app.run(() => {
      document.querySelector('#tabrow .tab-btn[data-tab="power"]').click();
      setMinGames(999); render();
      const empty = document.getElementById('empty');
      const said = { shown: empty.style.display, text: empty.innerText };
      document.getElementById('powerShowAllGames').click();
      return { said, rows: document.querySelectorAll('#list > *').length, min: minGames, hidden: document.getElementById('empty').style.display };
    });
    assert.strictEqual(r.said.shown, 'block');
    assert.match(r.said.text, /^Nobody here has 999\+ rated games yet\. Show all \d+ players$/);
    assert.strictEqual(r.min, 0);
    assert.ok(r.rows > 0, 'everyone is listed');
    assert.strictEqual(r.hidden, 'none');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
