// ===================== A RESULT'S ASTERISK AND NOTE =====================
// Shaun, 6 Nov: "a few games lately with disagreements and forfeits. I want
// to be able to add an asterisk to a result and also leave a note."
// An Admin marks a result (Results › Manage); everyone sees the asterisk and
// the note wherever the result is shown; no rating or table changes.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const MN = require('../assets/js/domain/matches/matchNote.js');
const H = require('./helpers/uiHarness.js');

const maybe = H.available() ? test : test.skip;

test('an entry: tidied, capped, and nothing at all when there is nothing to show', () => {
  assert.deepStrictEqual(MN.entry({ asterisk: true, note: '  Forfeit   —  injured ', by: 'Shaun', at: 't' }),
    { asterisk: true, note: 'Forfeit — injured', by: 'Shaun', at: 't' });
  assert.strictEqual(MN.entry({ asterisk: false, note: '   ' }), null);
  assert.strictEqual(MN.entry({ note: 'x'.repeat(400) }).note.length, MN.MAX_NOTE);
  const notes = MN.withEntry({}, 'a', MN.entry({ asterisk: true }));
  assert.ok(MN.forMatch(notes, 'a'));
  assert.deepStrictEqual(MN.withEntry(notes, 'a', null), {});
  assert.deepStrictEqual(Object.keys(MN.carried(notes, 'a', 'b')), ['b'], 'a corrected game keeps its note');
  assert.deepStrictEqual([MN.mark({ asterisk: true }), MN.noteLine({ asterisk: true, note: 'Forfeit' }), MN.noteLine({ asterisk: false, note: 'Disputed' })],
    ['*', '* Forfeit', 'Note: Disputed']);
});

test('only an Admin can write the notes: it is not a member document in the database rules', () => {
  const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
  assert.ok(!rules.includes(`'${MN.STORAGE_KEY}'`));
});

maybe('an Admin asterisks a result with a note; everyone sees it on Results, head to head and the scorecard; nothing is re-rated', async () => {
  const app = await H.open({ now: '2026-09-21T10:00:00.000Z' });
  try {
    const r = await app.run(async () => {
      const m = matchesIncludingDraws().filter((x) => !x.isDraw).slice(-1)[0];
      const ratingsBefore = JSON.stringify(PLAYERS.map((p) => [p.name, p.rating]));
      isUnlocked = true; adminRole = 'owner'; currentUserName = 'Shaun';
      gamesMonth = 'all';
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      managingGameId = m.id; renderGamesTab();
      const box = document.querySelector(`[data-note-editor="${CSS.escape(m.id)}"]`);
      box.querySelector('[data-note-asterisk]').checked = true;
      box.querySelector('[data-note-text]').value = 'Forfeit: injury in the second set. Score agreed by both pairs.';
      window.__writes.length = 0;
      await saveMatchNoteFrom(m.id, false);
      const writes = window.__writes.map((w) => `${w.collection}/${w.id}`);
      const card = [...document.querySelectorAll('#gamesView [data-game-card]')].find((el) => el.dataset.gameCard === m.id);
      const cardText = card.innerText;
      // As a member, with Admin locked.
      isUnlocked = false; adminRole = null; renderGamesTab();
      const memberCard = [...document.querySelectorAll('#gamesView [data-game-card]')].find((el) => el.dataset.gameCard === m.id).innerText;
      const editorForMember = !!document.querySelector('[data-note-editor]');
      // Head to head.
      h2hPlayerA = m.winners[0]; h2hPlayerB = m.losers[0]; h2hMonth = 'all';
      const opp = matchesIncludingDraws().filter((x) => (x.winners.includes(h2hPlayerA) && x.losers.includes(h2hPlayerB)) || (x.losers.includes(h2hPlayerA) && x.winners.includes(h2hPlayerB)));
      const text = h2hExportText(opp, [], false);
      // The scorecard.
      const sc = matchResultCardHtml(matchResultCardFor(m.id));
      return { writes, cardText, memberCard, editorForMember, text, sc: /Forfeit: injury/.test(sc) && /match-asterisk/.test(sc),
        stored: matchNotesState[m.id], same: ratingsBefore === JSON.stringify(PLAYERS.map((p) => [p.name, p.rating])) };
    });
    assert.deepStrictEqual(r.writes, ['moneypadel/moneypadel_match_notes'], 'one Admin document, nothing in the record');
    assert.match(r.cardText, /\*/);
    assert.match(r.cardText, /Forfeit: injury in the second set/);
    assert.match(r.memberCard, /\* Forfeit: injury in the second set/, 'members see the asterisk and the note');
    assert.strictEqual(r.editorForMember, false, 'only an Admin can change it');
    assert.match(r.text, /\*\n {3}\* Forfeit: injury in the second set/, 'copied head-to-head results carry it');
    assert.ok(r.sc, 'the scorecard shows it');
    assert.deepStrictEqual([r.stored.asterisk, r.stored.by], [true, 'Shaun']);
    assert.ok(r.same, 'no rating moves');
    assert.deepStrictEqual(app.pageErrors, []);
  } finally { await app.close(); }
});

maybe('removing it leaves the result as it was', async () => {
  const app = await H.open({ now: '2026-09-21T10:00:00.000Z' });
  try {
    const r = await app.run(async () => {
      const m = matchesIncludingDraws().filter((x) => !x.isDraw).slice(-1)[0];
      matchNotesState = { [m.id]: { asterisk: true, note: 'Disputed', by: 'Shaun', at: 't' } };
      isUnlocked = true; adminRole = 'owner';
      gamesMonth = 'all';
      document.querySelector('#tabrow .tab-btn[data-tab="games"]').click();
      managingGameId = m.id; renderGamesTab();
      await saveMatchNoteFrom(m.id, true);
      return { left: matchNotesState[m.id] || null, shown: !!document.querySelector('#gamesView .match-note, #gamesView .match-asterisk') };
    });
    assert.deepStrictEqual(r, { left: null, shown: false });
  } finally { await app.close(); }
});
