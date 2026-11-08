// ===================== PLAYERS' OTHER SPELLINGS =====================
// Shaun, 8 Nov: "We have a player called Jords but sometimes people write
// Jordz and vice versa. Preferably I don't have to correct the name every
// time I enter a result with his name in, incorrectly."

const test = require('node:test');
const assert = require('node:assert');
const FP = require('../assets/js/fixtureParse.js');
const RP = require('../assets/js/domain/matches/resultParse.js');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;
const DIR = ['Jords', 'Rishi', 'Fatch', 'Tom', 'Tee', 'Max', 'Kaz', 'KC', 'Len'];
const AKA = { jordz: 'Jords' };

test('a known other spelling is the player, read without asking; any case of a name is the player', () => {
  assert.deepStrictEqual([FP.resolveName('Jordz', DIR, null, AKA).status, FP.resolveName('Jordz', DIR, null, AKA).name], ['ok', 'Jords']);
  assert.strictEqual(FP.resolveName('JORDZ', DIR, null, AKA).name, 'Jords');
  assert.strictEqual(FP.resolveName('jords', DIR, null, AKA).name, 'Jords');
  assert.strictEqual(FP.resolveName('Jordz', DIR, null, null).status, 'suggested', 'without the list, one letter off is still offered, not taken for a new player');
});

test('one letter off one player is offered as them and said so; short names are never guessed; a real stranger stays new', () => {
  const r = FP.resolveName('Rishii', DIR, null, AKA);
  assert.deepStrictEqual([r.status, r.options], ['suggested', ['Rishi']]);
  ['Tomm', 'Maxx', 'Teee'].forEach((n) => assert.strictEqual(FP.resolveName(n, DIR, null, AKA).status, 'unknown', `${n}: too short to guess`));
  assert.strictEqual(FP.resolveName('Topsy', DIR, null, AKA).status, 'unknown');
});

test('the result reader: "Jordz" is read as Jords, with a note; no new-player warning', () => {
  const r = RP.parse('Jordz & Fatch beat Rishi & Max 6-4 6-3', { directory: DIR, today: '2026-11-08', aliases: AKA });
  assert.deepStrictEqual(r.winners, ['Jords', 'Fatch']);
  assert.ok(r.notes.some((n) => /Read "Jordz" as Jords/.test(n)));
  assert.ok(!r.warnings.some((w) => /isn't a club player/.test(w)));
});

maybe('Add a game: "Jordz" is submitted as Jords, never as a new player; an Admin can add another spelling', async () => {
  const app = await H.open({ now: '2026-09-21T10:00:00.000Z' });
  try {
    const r = await app.run(async () => {
      const others = PLAYERS.map((p) => p.name).filter((n) => n !== 'Jords').slice(0, 3);
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
      currentUserName = 'Shaun';
      set('agDate', '2026-09-20'); set('agA1', 'Jordz'); set('agA2', others[0]); set('agB1', others[1]); set('agB2', others[2]);
      const note = document.getElementById('agNameNote').textContent;
      const tierPicker = !!document.querySelector('.ag-new-tier');
      addGameSets = [{ w: '6', l: '1' }, { w: '6', l: '2' }];
      await submitNewGame();
      const sub = extraMatchesState.filter((m) => m.status === 'pending').slice(-1)[0];
      // An Admin adds "Rishy" for Rishi.
      isUnlocked = true; adminRole = 'owner'; adminOpenSections.players = true; renderManage();
      document.getElementById('aliasTyped').value = 'Rishy';
      document.getElementById('aliasPlayer').value = 'Rishi';
      window.__writes.length = 0;
      await document.getElementById('aliasAdd').onclick();
      return { note, tierPicker, winners: sub.winners, newTiers: sub.newPlayerTiers || null,
        stored: window.__writes.map((w) => `${w.collection}/${w.id}`), rishy: canonicalPlayerName('rishy'), list: document.getElementById('manageView').innerText };
    });
    assert.match(r.note, /“Jordz” is read as Jords\./);
    assert.strictEqual(r.tierPicker, false, 'no "new player" tier picker');
    assert.strictEqual(r.winners[0], 'Jords');
    assert.strictEqual(r.newTiers, null);
    assert.deepStrictEqual(r.stored, ['moneypadel/moneypadel_name_aliases']);
    assert.strictEqual(r.rishy, 'Rishi');
    assert.match(r.list, /“jordz” → Jords\s*built in/);
    assert.match(r.list, /“rishy” → Rishi/);
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});
