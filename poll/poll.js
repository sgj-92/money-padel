// ===================== THE TIER POLL PAGE =====================
// Shaun, 9 Nov: "For Padel Championships, we're going to do an initial poll
// for everyone's tiers ... a new webpage on the domain for standings where I
// can add everyone's name in a list, then the rows to vote are Tier S, A, B
// and C."
//
//   Everyone   picks their name, then S / A / B / C (or skip) for each
//              player; can change their vote while the poll is open.
//   An Admin   (signed in, data/adminAuth.js) pastes the names, opens and
//              closes the poll, sees the results, and can set the suggested
//              tiers as the players' starting tiers (Player tags).
//
// Stored in the community's own Firebase: tierPoll/current (the list, open or
// closed; Admin writes) and tierPollBallots/{ballot} (one per voter's device;
// anyone may write, only an Admin may read -- firestore.rules). Counting is
// TierPoll (poll/tierPoll.js).

(function () {
  var main = document.getElementById('pollMain');
  var adminBox = document.getElementById('pollAdmin');
  var POLL = 'current';
  var BALLOT_KEY = 'tierPollBallot_' + CLUB.id;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var poll = null;            // { players: [...], open: bool }
  var mine = null;            // { id, voter, votes }

  document.title = CLUB.name + ' · Tier poll';
  document.getElementById('pollBrand').textContent = CLUB.name;
  var mark = document.getElementById('pollMark');
  mark.src = '../' + CLUB.logo;

  function loadMine() {
    try { var v = JSON.parse(localStorage.getItem(BALLOT_KEY) || 'null'); if (v && v.id) return v; } catch (e) { /* none */ }
    var id = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    return { id: id, voter: '', votes: {} };
  }
  function keepMine() { try { localStorage.setItem(BALLOT_KEY, JSON.stringify(mine)); } catch (e) { /* this device only */ } }

  async function readPoll() {
    var doc = await db.collection('tierPoll').doc(POLL).get();
    var d = doc.exists ? doc.data() : null;
    return { players: (d && Array.isArray(d.players)) ? d.players : [], open: !!(d && d.open) };
  }

  // ---- Voting ---------------------------------------------------------------
  function render() {
    if (!poll.players.length) {
      main.innerHTML = '<h1>Tier poll</h1><p class="poll-sub">The poll isn’t ready yet. Check back soon.</p>';
      return;
    }
    if (!poll.open) {
      main.innerHTML = '<h1>Tier poll</h1><p class="poll-sub">The poll is closed. Thanks to everyone who voted.</p>';
      return;
    }
    var who = mine.voter;
    var html = '<h1>Tier poll</h1>'
      + '<p class="poll-sub">Put each player in the tier you think they play at: <b>S</b> the strongest, then <b>A</b>, <b>B</b> and <b>C</b>. Skip anyone you haven’t played. You can change your vote until the poll closes.</p>'
      + '<label class="poll-label" for="pollVoter">Who are you?</label>'
      + '<select id="pollVoter" class="poll-select"><option value="">Choose your name</option>'
      + poll.players.map(function (p) { return '<option' + (p === who ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') + '</select>';
    if (who) {
      html += '<div class="poll-grid" role="table" aria-label="Your votes">'
        + '<div class="poll-row poll-head" role="row"><span role="columnheader">Player</span>'
        + TierPoll.TIERS.map(function (t) { return '<span role="columnheader">' + t + '</span>'; }).join('') + '</div>'
        + poll.players.map(function (p) {
          var v = mine.votes[p] || '';
          return '<div class="poll-row" role="row" data-player="' + esc(p) + '"><span class="poll-name" role="cell">' + esc(p) + (p === who ? ' <em>(you)</em>' : '') + '</span>'
            + TierPoll.TIERS.map(function (t) {
              return '<button type="button" role="cell" class="poll-pick' + (v === t ? ' is-on' : '') + '" data-tier="' + t + '" aria-pressed="' + (v === t) + '" aria-label="' + esc(p) + ': Tier ' + t + '">' + t + '</button>';
            }).join('') + '</div>';
        }).join('') + '</div>'
        + '<p class="poll-count" id="pollCount"></p>'
        + '<button type="button" class="poll-go" id="pollSend">Save my vote</button>'
        + '<p class="poll-msg" id="pollMsg" role="status"></p>';
    }
    main.innerHTML = html;
    document.getElementById('pollVoter').onchange = function (e) { mine.voter = e.target.value; keepMine(); render(); };
    if (!who) return;
    var count = function () {
      var n = Object.keys(mine.votes).length;
      document.getElementById('pollCount').textContent = n + ' of ' + poll.players.length + ' placed' + (n < poll.players.length ? ' · tap a tier again to skip a player' : '');
    };
    count();
    main.querySelectorAll('.poll-row[data-player]').forEach(function (row) {
      row.querySelectorAll('.poll-pick').forEach(function (b) {
        b.onclick = function () {
          var p = row.getAttribute('data-player'), t = b.getAttribute('data-tier');
          if (mine.votes[p] === t) delete mine.votes[p]; else mine.votes[p] = t;
          row.querySelectorAll('.poll-pick').forEach(function (x) { var on = mine.votes[p] === x.getAttribute('data-tier'); x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); });
          keepMine(); count();
        };
      });
    });
    document.getElementById('pollSend').onclick = sendVote;
  }

  async function sendVote() {
    var msg = document.getElementById('pollMsg');
    if (!Object.keys(mine.votes).length) { msg.textContent = 'Place at least one player first.'; return; }
    msg.textContent = 'Saving…';
    try {
      await db.collection('tierPollBallots').doc(mine.id).set({ poll: POLL, voter: mine.voter, votes: mine.votes, updatedAt: new Date().toISOString() });
      msg.textContent = 'Saved — thank you, ' + mine.voter + '. You can change it until the poll closes.';
    } catch (e) {
      msg.textContent = 'That didn’t save (' + (e && e.message ? e.message : 'no connection') + '). Try again.';
    }
  }

  // ---- Admin ------------------------------------------------------------------
  function renderAdminLink() {
    adminBox.innerHTML = '<button type="button" class="poll-link" id="pollAdminOpen">Admin</button>';
    document.getElementById('pollAdminOpen').onclick = renderSignIn;
  }

  function renderSignIn() {
    adminBox.innerHTML = '<h2>Admin</h2>'
      + '<input id="pollEmail" class="poll-select" type="email" autocomplete="username" placeholder="Admin email">'
      + '<input id="pollPassword" class="poll-select" type="password" autocomplete="current-password" placeholder="Password">'
      + '<button type="button" class="poll-go" id="pollSignIn">Sign in</button><p class="poll-msg" id="pollAdminMsg" role="status"></p>';
    document.getElementById('pollSignIn').onclick = async function () {
      var r = await adminSignIn(document.getElementById('pollEmail').value, document.getElementById('pollPassword').value);
      if (!r.ok) { document.getElementById('pollAdminMsg').textContent = r.message; return; }
      signedInAdmin = r.admin;
      renderAdmin();
    };
  }

  async function renderAdmin() {
    var ballots = [];
    try {
      var snap = await db.collection('tierPollBallots').get();
      ballots = snap.docs.map(function (d) { return d.data(); }).filter(function (b) { return b.poll === POLL; });
    } catch (e) { /* not readable: shown as no votes */ }
    var t = TierPoll.tally(poll.players, ballots);
    var html = '<h2>Admin <span class="poll-sub">· ' + esc(signedInAdmin.email) + '</span></h2>'
      + '<label class="poll-label" for="pollPlayers">Players, one per line</label>'
      + '<textarea id="pollPlayers" class="poll-select" rows="8" placeholder="One name per line">' + esc(poll.players.join('\n')) + '</textarea>'
      + '<div class="poll-actions"><button type="button" class="poll-go" id="pollSave">Save the list</button>'
      + '<button type="button" class="poll-go poll-alt" id="pollToggle">' + (poll.open ? 'Close the poll' : 'Open the poll') + '</button></div>'
      + '<p class="poll-msg" id="pollAdminMsg" role="status">The poll is ' + (poll.open ? '<b>open</b>' : '<b>closed</b>') + '. Share this page’s address with the group.</p>'
      + '<h2>Results <span class="poll-sub">· ' + t.voters.length + ' voter' + (t.voters.length === 1 ? '' : 's') + '</span></h2>'
      + (t.voters.length ? '<p class="poll-sub">Voted: ' + t.voters.map(esc).join(', ') + '</p>' : '')
      + '<table class="poll-results"><thead><tr><th>Player</th><th>S</th><th>A</th><th>B</th><th>C</th><th>Suggested</th></tr></thead><tbody>'
      + t.rows.map(function (r) {
        return '<tr><td>' + esc(r.player) + '</td>' + TierPoll.TIERS.map(function (x) { return '<td>' + (r.counts[x] || '·') + '</td>'; }).join('')
          + '<td><b>' + (r.suggested ? 'Tier ' + r.suggested : '—') + '</b></td></tr>';
      }).join('') + '</tbody></table>'
      + '<p class="poll-sub">Suggested is the middle vote: one outlier can’t move it, and an even split goes to the lower tier.</p>'
      + '<button type="button" class="poll-go" id="pollUse"' + (t.rows.some(function (r) { return r.suggested; }) ? '' : ' disabled') + '>Use as starting tiers</button>'
      + '<p class="poll-msg" id="pollUseMsg" role="status"></p>';
    adminBox.innerHTML = html;
    var say = function (s) { document.getElementById('pollAdminMsg').innerHTML = s; };
    document.getElementById('pollSave').onclick = async function () {
      var players = TierPoll.parsePlayers(document.getElementById('pollPlayers').value);
      try { await db.collection('tierPoll').doc(POLL).set({ players: players, open: poll.open, updatedAt: new Date().toISOString() }); }
      catch (e) { say('Save failed: ' + esc(e.message)); return; }
      poll.players = players; render(); renderAdmin();
    };
    document.getElementById('pollToggle').onclick = async function () {
      try { await db.collection('tierPoll').doc(POLL).set({ players: poll.players, open: !poll.open, updatedAt: new Date().toISOString() }); }
      catch (e) { say('Save failed: ' + esc(e.message)); return; }
      poll.open = !poll.open; render(); renderAdmin();
    };
    document.getElementById('pollUse').onclick = async function () {
      var msg = document.getElementById('pollUseMsg');
      var tags = {};
      try { var raw = await fsGet('moneypadel_player_tags'); tags = raw ? JSON.parse(raw) : {}; } catch (e) { tags = {}; }
      var set = [];
      t.rows.forEach(function (r) {
        if (!r.suggested) return;
        var key = Object.keys(tags).find(function (k) { return k.toLowerCase() === r.player.toLowerCase(); }) || r.player;
        tags[key] = Object.assign({}, tags[key] || {}, { tier: r.suggested, active: true });
        set.push(key + ' ' + r.suggested);
      });
      try { await fsSet('moneypadel_player_tags', JSON.stringify(tags)); }
      catch (e) { msg.textContent = 'Save failed: ' + e.message; return; }
      msg.textContent = 'Set as starting tiers: ' + set.join(', ') + '. A player is rated from these at their first approved game; anyone already rated keeps their rating.';
    };
  }

  async function boot() {
    if (!storageAvailable()) { main.innerHTML = '<h1>Tier poll</h1><p class="poll-sub">This page can’t reach ' + esc(CLUB.name) + ' right now. Try again in a moment.</p>'; return; }
    mine = loadMine();
    try { poll = await readPoll(); }
    catch (e) { main.innerHTML = '<h1>Tier poll</h1><p class="poll-sub">The poll couldn’t be read. Try again in a moment.</p>'; return; }
    if (mine.voter && poll.players.indexOf(mine.voter) === -1) mine.voter = '';
    render();
    var admin = await loadSignedInAdmin();
    if (admin) { signedInAdmin = admin; renderAdmin(); } else renderAdminLink();
    window.__pollReady = true;
  }
  boot();
})();
