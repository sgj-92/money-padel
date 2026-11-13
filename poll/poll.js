// ===================== THE TIER POLL PAGE =====================
// Shaun, 9 Nov: "For Padel Championships, we're going to do an initial poll
// for everyone's tiers ... add everyone's name in a list, then the rows to vote
// are Tier S, A, B and C." Then: "Can I assign each person their own personal
// code and once it's used, it can't be reused again? ... I also don't want
// people voting for themselves."
//
//   A player   opens their personal link (or types their code), sees every
//              player but themselves, taps S / A / B / C (or skips), and
//              sends it -- once. The code is then spent.
//   An Admin   (signed in, data/adminAuth.js) pastes the names, makes a code
//              for each, copies each person's link to send them privately,
//              opens and closes the poll, sees who has voted and the results,
//              can reset a code so someone can vote again, and can set the
//              suggested tiers as the players' starting tiers (Player tags).
//
// Stored in the community's own Firebase: tierPoll/current (list, open),
// tierPollCodes/{code} ({ name }) and tierPollBallots/{code} ({ voter, votes }).
// firestore.rules holds it: a ballot only with a real code, once, under that
// code's name, never for oneself, while open. Counting: TierPoll (tierPoll.js).

(function () {
  var main = document.getElementById('pollMain');
  var adminBox = document.getElementById('pollAdmin');
  var POLL = 'current';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var poll = null;            // { players: [...], open: bool }
  var me = null;              // { code, name } once a code is accepted
  var votes = {};

  document.title = CLUB.name + ' · Tier poll';
  document.getElementById('pollBrand').textContent = CLUB.name;
  document.getElementById('pollMark').src = '../' + CLUB.logo;

  var random = function (n) { var a = new Uint32Array(n); crypto.getRandomValues(a); return Array.prototype.slice.call(a); };
  var linkFor = function (code) { return location.origin + location.pathname + '?code=' + code; };
  // What an Admin sends with each link (Shaun, 9 Nov). {name} becomes the
  // player's name; {link} places the link, otherwise it goes on the end.
  var DEFAULT_MESSAGE = 'Hi {name}, here’s your personal link for the ' + CLUB.name + ' tier poll. It works once, so please don’t share it.';
  function messageFor(template, name, code) {
    var text = String(template || '').replace(/\{name\}/g, name);
    return /\{link\}/.test(text) ? text.replace(/\{link\}/g, linkFor(code)) : (text.trim() ? text.trim() + '\n' : '') + linkFor(code);
  }
  function pollDoc(changes) {
    return Object.assign({ players: poll.players, open: poll.open, message: poll.message, updatedAt: new Date().toISOString() }, changes);
  }
  // A short note at the foot of the screen that something has happened.
  function toast(text) {
    var el = document.getElementById('pollToast');
    if (!el) { el = document.createElement('div'); el.id = 'pollToast'; el.className = 'poll-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = text;
    el.classList.add('is-on');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { el.classList.remove('is-on'); }, 2600);
  }

  async function readPoll() {
    var doc = await db.collection('tierPoll').doc(POLL).get();
    var d = doc.exists ? doc.data() : null;
    return { players: (d && Array.isArray(d.players)) ? d.players : [], open: !!(d && d.open), message: (d && typeof d.message === 'string') ? d.message : DEFAULT_MESSAGE };
  }

  // ---- Voting ---------------------------------------------------------------
  function shell(inner) { main.innerHTML = '<h1>Tier poll</h1>' + inner; }

  function renderCodeEntry(message) {
    shell('<p class="poll-sub">Put each player in the tier you think they play at: <b>S</b> the strongest, then <b>A</b>, <b>B</b> and <b>C</b>. Enter the personal code you were sent to vote. Each code can be used once.</p>'
      + '<label class="poll-label" for="pollCode">Your code</label>'
      + '<input id="pollCode" class="poll-select poll-code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" placeholder="e.g. K7QM3P">'
      + '<button type="button" class="poll-go" id="pollCodeGo">Continue</button>'
      + '<p class="poll-msg" id="pollMsg" role="status">' + esc(message || '') + '</p>');
    var go = function () { useCode(document.getElementById('pollCode').value); };
    document.getElementById('pollCodeGo').onclick = go;
    document.getElementById('pollCode').onkeydown = function (e) { if (e.key === 'Enter') go(); };
  }

  async function useCode(text) {
    var code = TierPoll.normaliseCode(text);
    if (code.length < 6) { renderCodeEntry('That code is too short. It’s six letters and numbers.'); return; }
    var c, b;
    try {
      c = await db.collection('tierPollCodes').doc(code).get();
      b = await db.collection('tierPollBallots').doc(code).get();
    } catch (e) { renderCodeEntry('Couldn’t check that code. Try again in a moment.'); return; }
    if (!c.exists) { renderCodeEntry('That code isn’t right. Check it, or ask for your link again.'); return; }
    if (b.exists) { shell('<p class="poll-sub">Thanks, ' + esc(c.data().name) + ' — your vote is already in. Each code can be used once.</p>'); return; }
    me = { code: code, name: c.data().name };
    votes = {};
    renderGrid();
  }

  function renderGrid() {
    var others = poll.players.filter(function (p) { return p.toLowerCase() !== me.name.toLowerCase(); });
    var skipped = {};
    shell('<p class="poll-sub">Hi <b>' + esc(me.name) + '</b>. Put each player in the tier you think they play at. If you can’t judge someone, tap <b>Skip</b>. You can vote once, so check before you send.</p>'
      + '<div class="poll-grid" role="table" aria-label="Your votes">'
      + '<div class="poll-row poll-head" role="row"><span role="columnheader">Player</span>' + TierPoll.TIERS.map(function (t) { return '<span role="columnheader">' + t + '</span>'; }).join('') + '<span role="columnheader"></span></div>'
      + others.map(function (p) {
        return '<div class="poll-row" role="row" data-player="' + esc(p) + '"><span class="poll-name" role="cell">' + esc(p) + '</span>'
          + TierPoll.TIERS.map(function (t) { return '<button type="button" role="cell" class="poll-pick" data-tier="' + t + '" aria-pressed="false" aria-label="' + esc(p) + ': Tier ' + t + '">' + t + '</button>'; }).join('')
          + '<button type="button" role="cell" class="poll-pick poll-skip" data-skip aria-pressed="false" aria-label="' + esc(p) + ': skip, I can’t judge">Skip</button></div>';
      }).join('') + '</div>'
      + '<p class="poll-count" id="pollCount"></p>'
      + '<button type="button" class="poll-go" id="pollSend">Send my vote</button>'
      + '<p class="poll-msg" id="pollMsg" role="status"></p>');
    var count = function () {
      var n = Object.keys(votes).length, k = Object.keys(skipped).length, left = others.length - n - k;
      document.getElementById('pollCount').textContent = n + ' placed · ' + k + ' skipped' + (left ? ' · ' + left + ' still to do' : ' · all done');
    };
    sendVote.left = function () { return others.filter(function (p) { return !votes[p] && !skipped[p]; }); };
    count();
    main.querySelectorAll('.poll-row[data-player]').forEach(function (row) {
      row.querySelectorAll('.poll-pick').forEach(function (b) {
        b.onclick = function () {
          var p = row.getAttribute('data-player'), t = b.getAttribute('data-tier');
          if (t) { delete skipped[p]; if (votes[p] === t) delete votes[p]; else votes[p] = t; }
          else { delete votes[p]; if (skipped[p]) delete skipped[p]; else skipped[p] = true; }
          row.classList.toggle('is-skipped', !!skipped[p]);
          row.querySelectorAll('.poll-pick').forEach(function (x) {
            var on = x.hasAttribute('data-skip') ? !!skipped[p] : votes[p] === x.getAttribute('data-tier');
            x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on));
          });
          count();
        };
      });
    });
    document.getElementById('pollSend').onclick = sendVote;
  }

  async function sendVote() {
    var msg = document.getElementById('pollMsg');
    var left = sendVote.left ? sendVote.left() : [];
    if (left.length) { msg.textContent = 'Place or skip everyone first: ' + left.join(', ') + '.'; return; }
    if (!Object.keys(votes).length) { msg.textContent = 'Place at least one player first.'; return; }
    var btn = document.getElementById('pollSend');
    btn.disabled = true; msg.textContent = 'Sending…';
    try {
      // Spent once: a second send under this code is refused by the database.
      var already = await db.collection('tierPollBallots').doc(me.code).get();
      if (already.exists) { shell('<p class="poll-sub">Your vote is already in, ' + esc(me.name) + '. Each code can be used once.</p>'); me = null; return; }
      await db.collection('tierPollBallots').doc(me.code).set({ poll: POLL, voter: me.name, votes: votes, createdAt: new Date().toISOString() });
      shell('<p class="poll-sub">Thank you, <b>' + esc(me.name) + '</b> — your vote is in. Your code has now been used.</p>');
      me = null; votes = {};   // spent: this device goes back to asking for a code
    } catch (e) {
      btn.disabled = false;
      msg.textContent = 'That didn’t send (' + (e && e.message ? e.message : 'no connection') + '). Try again.';
    }
  }

  function render() {
    if (!poll.players.length) { shell('<p class="poll-sub">The poll isn’t ready yet. Check back soon.</p>'); return; }
    if (!poll.open) { shell('<p class="poll-sub">The poll is closed. Thanks to everyone who voted.</p>'); return; }
    var fromLink = new URLSearchParams(location.search).get('code');
    if (fromLink && !me) { useCode(fromLink); return; }
    if (me) { renderGrid(); return; }
    renderCodeEntry('');
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

  async function readAll(collection) {
    try { var snap = await db.collection(collection).get(); return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); }
    catch (e) { return []; }
  }

  // Who voted what: Admins only (the ballots are read with the Admin's
  // sign-in), by player or by voter, and copyable for the group.
  var whoView = 'player';
  function whoVotedHtml(b) {
    if (!b.byVoter.length) return '';
    var tierLine = function (t, names) { return names.length ? '<div class="poll-who-line"><b class="poll-who-tier">' + t + '</b> ' + esc(names.join(', ')) + ' <span class="poll-sub">(' + names.length + ')</span></div>' : ''; };
    var body = whoView === 'player'
      ? b.byPlayer.map(function (r) {
        return '<div class="poll-who-block"><div class="poll-who-name">' + esc(r.player) + '</div>'
          + TierPoll.TIERS.map(function (t) { return tierLine(t, r.tiers[t]); }).join('')
          + (r.skipped.length ? '<div class="poll-who-line poll-sub">Skipped: ' + esc(r.skipped.join(', ')) + '</div>' : '') + '</div>';
      }).join('')
      : b.byVoter.map(function (v) {
        return '<div class="poll-who-block"><div class="poll-who-name">' + esc(v.voter) + '</div>'
          + TierPoll.TIERS.map(function (t) { return tierLine(t, v.votes.filter(function (x) { return x.tier === t; }).map(function (x) { return x.player; })); }).join('') + '</div>';
      }).join('');
    return '<h2>Who voted what</h2>'
      + '<div class="poll-actions"><button type="button" class="poll-go' + (whoView === 'player' ? '' : ' poll-alt') + '" id="pollWhoPlayer">By player</button>'
      + '<button type="button" class="poll-go' + (whoView === 'voter' ? '' : ' poll-alt') + '" id="pollWhoVoter">By voter</button></div>'
      + '<div class="poll-who" id="pollWho">' + body + '</div>'
      + '<button type="button" class="poll-go poll-alt" id="pollWhoCopy">Copy who voted what</button>';
  }
  function whoVotedText(b) {
    var lines = [CLUB.name + ' · Tier poll · who voted what', ''];
    if (whoView === 'player') {
      b.byPlayer.forEach(function (r) {
        lines.push(r.player);
        TierPoll.TIERS.forEach(function (t) { if (r.tiers[t].length) lines.push('  ' + t + ': ' + r.tiers[t].join(', ')); });
        if (r.skipped.length) lines.push('  Skipped: ' + r.skipped.join(', '));
        lines.push('');
      });
    } else {
      b.byVoter.forEach(function (v) {
        lines.push(v.voter);
        TierPoll.TIERS.forEach(function (t) {
          var names = v.votes.filter(function (x) { return x.tier === t; }).map(function (x) { return x.player; });
          if (names.length) lines.push('  ' + t + ': ' + names.join(', '));
        });
        lines.push('');
      });
    }
    return lines.join('\n').trim();
  }

  async function renderAdmin() {
    var codes = await readAll('tierPollCodes');
    var ballots = (await readAll('tierPollBallots')).filter(function (b) { return b.poll === POLL; });
    var codeOf = {};
    var codeDoc = {};
    codes.forEach(function (c) { if (c.name) { codeOf[c.name.toLowerCase()] = c.id; codeDoc[c.id] = c; } });
    var used = {};
    ballots.forEach(function (b) { used[b.id] = true; });
    // Voted first (Shaun, 10 Nov), so who is still to vote is together at the
    // foot; each group keeps the list's order.
    var hasVoted = function (p) { var c = codeOf[p.toLowerCase()]; return !!(c && used[c]); };
    var byVoted = poll.players.filter(hasVoted).concat(poll.players.filter(function (p) { return !hasVoted(p); }));
    var votedCount = poll.players.filter(hasVoted).length;
    var missing = poll.players.filter(function (p) { return !codeOf[p.toLowerCase()]; });
    var t = TierPoll.tally(poll.players, ballots);
    var who = TierPoll.breakdown(poll.players, ballots);
    var html = '<h2>Admin <span class="poll-sub">· ' + esc(signedInAdmin.email) + '</span></h2>'
      + '<label class="poll-label" for="pollPlayers">Players, one per line</label>'
      + '<textarea id="pollPlayers" class="poll-select" rows="8" placeholder="One name per line">' + esc(poll.players.join('\n')) + '</textarea>'
      + '<div class="poll-actions"><button type="button" class="poll-go" id="pollSave">Save the list</button>'
      + '<button type="button" class="poll-go poll-alt" id="pollToggle">' + (poll.open ? 'Close the poll' : 'Open the poll') + '</button></div>'
      + '<p class="poll-msg" id="pollAdminMsg" role="status">The poll is ' + (poll.open ? '<b>open</b>' : '<b>closed</b>') + '.</p>'
      + '<h2>Codes</h2>'
      + '<p class="poll-sub">Send each person their own link (or code) privately. A code works once; resetting it lets that person vote again.</p>'
      + '<label class="poll-label" for="pollMessage">Message copied with each link</label>'
      + '<textarea id="pollMessage" class="poll-select" rows="3">' + esc(poll.message) + '</textarea>'
      + '<p class="poll-hint">{name} becomes the player’s name. The link goes on the end, or wherever you put {link}.</p>'
      + (missing.length ? '<button type="button" class="poll-go" id="pollMakeCodes">Make codes for ' + missing.length + ' player' + (missing.length === 1 ? '' : 's') + '</button>' : '')
      + '<p class="poll-sub" id="pollWaiting">' + (votedCount + ' voted · ' + (byVoted.length - votedCount ? 'waiting for ' + (byVoted.length - votedCount) : 'everyone has voted')) + '</p>'
      + '<table class="poll-results poll-codes"><thead><tr><th>Player</th><th>Code</th><th>Sent</th><th>Voted</th><th></th></tr></thead><tbody>'
      + byVoted.map(function (p) {
        var code = codeOf[p.toLowerCase()];
        return '<tr><td>' + esc(p) + '</td><td class="poll-codecell">' + (code ? esc(code) : '—') + '</td>'
          // Sent: the Admin's own note that the link has gone to them.
          + '<td>' + (code ? '<input type="checkbox" class="poll-sent" data-sent="' + esc(code) + '" aria-label="Link sent to ' + esc(p) + '"' + (codeDoc[code].sent ? ' checked' : '') + '>' : '') + '</td>'
          + '<td>' + (code && used[code] ? '✔︎' : '') + '</td>'
          + '<td>' + (code ? (used[code] ? '<button type="button" class="poll-mini" data-reset="' + esc(code) + '">Reset</button>'
            : '<button type="button" class="poll-mini" data-copy="' + esc(p) + '|' + esc(code) + '">Copy link</button>') : '') + '</td></tr>';
      }).join('') + '</tbody></table>'
      + (Object.keys(codeOf).length ? '<button type="button" class="poll-go poll-alt" id="pollCopyAll">Copy every link</button>' : '')
      + '<p class="poll-msg" id="pollCodesMsg" role="status"></p>'
      + '<h2>Results <span class="poll-sub">· ' + t.voters.length + ' of ' + poll.players.length + ' voted</span></h2>'
      + '<table class="poll-results"><thead><tr><th>Player</th><th>S</th><th>A</th><th>B</th><th>C</th><th>Suggested</th></tr></thead><tbody>'
      + t.rows.map(function (r) {
        return '<tr><td>' + esc(r.player) + '</td>' + TierPoll.TIERS.map(function (x) { return '<td>' + (r.counts[x] || '·') + '</td>'; }).join('')
          + '<td><b>' + (r.suggested ? 'Tier ' + r.suggested : '—') + '</b></td></tr>';
      }).join('') + '</tbody></table>'
      + '<p class="poll-sub">Suggested is the middle vote: one outlier can’t move it, and an even split goes to the lower tier. Nobody’s vote for themselves is possible.</p>'
      + '<button type="button" class="poll-go" id="pollUse"' + (t.rows.some(function (r) { return r.suggested; }) ? '' : ' disabled') + '>Use as starting tiers</button>'
      + '<p class="poll-msg" id="pollUseMsg" role="status"></p>'
      + whoVotedHtml(who);
    adminBox.innerHTML = html;
    var say = function (s) { document.getElementById('pollAdminMsg').innerHTML = s; };
    var sayCodes = function (s) { document.getElementById('pollCodesMsg').textContent = s; };
    var copy = function (text, done, button) {
      var ok = function () {
        sayCodes(done); toast('✓ ' + done);
        if (button) {
          var was = button.textContent;
          button.textContent = 'Copied ✓'; button.classList.add('is-copied');
          setTimeout(function () { button.textContent = was; button.classList.remove('is-copied'); }, 2600);
        }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { window.prompt('Copy this:', text); });
      else window.prompt('Copy this:', text);
    };
    var box = document.getElementById('pollMessage');
    var currentMessage = function () { return box.value; };
    box.onchange = async function () {
      try { await db.collection('tierPoll').doc(POLL).set(pollDoc({ message: box.value })); poll.message = box.value; toast('✓ Message saved'); }
      catch (e) { sayCodes('Saving the message failed: ' + e.message); }
    };
    document.getElementById('pollSave').onclick = async function () {
      var players = TierPoll.parsePlayers(document.getElementById('pollPlayers').value);
      try { await db.collection('tierPoll').doc(POLL).set(pollDoc({ players: players })); }
      catch (e) { say('Save failed: ' + esc(e.message)); return; }
      poll.players = players; render(); renderAdmin();
    };
    document.getElementById('pollToggle').onclick = async function () {
      try { await db.collection('tierPoll').doc(POLL).set(pollDoc({ open: !poll.open })); }
      catch (e) { say('Save failed: ' + esc(e.message)); return; }
      poll.open = !poll.open; render(); renderAdmin();
    };
    var make = document.getElementById('pollMakeCodes');
    if (make) make.onclick = async function () {
      try {
        for (var i = 0; i < missing.length; i++) {
          var code;
          do { code = TierPoll.makeCode(random); } while (codes.some(function (c) { return c.id === code; }));
          await db.collection('tierPollCodes').doc(code).set({ name: missing[i], createdAt: new Date().toISOString() });
          codes.push({ id: code, name: missing[i] });
        }
      } catch (e) { sayCodes('Making codes failed: ' + e.message); return; }
      renderAdmin();
    };
    adminBox.querySelectorAll('[data-copy]').forEach(function (b) {
      b.onclick = function () { var parts = b.getAttribute('data-copy').split('|'); copy(messageFor(currentMessage(), parts[0], parts[1]), 'Copied ' + parts[0] + '’s link — send it to them privately.', b); };
    });
    adminBox.querySelectorAll('[data-sent]').forEach(function (box) {
      box.onchange = async function () {
        var c = codeDoc[box.getAttribute('data-sent')];
        var doc = { name: c.name, createdAt: c.createdAt || null, sent: box.checked, sentAt: box.checked ? new Date().toISOString() : null };
        try { await db.collection('tierPollCodes').doc(c.id).set(doc); c.sent = box.checked; }
        catch (e) { box.checked = !box.checked; sayCodes('Saving failed: ' + e.message); return; }
        toast(box.checked ? '✓ Marked ' + c.name + '’s link as sent' : c.name + ' unmarked');
      };
    });
    adminBox.querySelectorAll('[data-reset]').forEach(function (b) {
      b.onclick = async function () {
        if (!window.confirm('Delete this person’s vote so their code works again?')) return;
        try { await db.collection('tierPollBallots').doc(b.getAttribute('data-reset')).delete(); } catch (e) { sayCodes('Reset failed: ' + e.message); return; }
        renderAdmin();
      };
    });
    var all = document.getElementById('pollCopyAll');
    if (all) all.onclick = function () {
      copy(poll.players.filter(function (p) { return codeOf[p.toLowerCase()]; }).map(function (p) { return p + ':\n' + messageFor(currentMessage(), p, codeOf[p.toLowerCase()]); }).join('\n\n'),
        'Copied every player’s link. Send each person only their own.', all);
    };
    var whoP = document.getElementById('pollWhoPlayer');
    if (whoP) {
      whoP.onclick = function () { whoView = 'player'; renderAdmin(); };
      document.getElementById('pollWhoVoter').onclick = function () { whoView = 'voter'; renderAdmin(); };
      var whoCopy = document.getElementById('pollWhoCopy');
      whoCopy.onclick = function () { copy(whoVotedText(who), 'Copied who voted what.', whoCopy); };
    }
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
    if (!storageAvailable()) { shell('<p class="poll-sub">This page can’t reach ' + esc(CLUB.name) + ' right now. Try again in a moment.</p>'); return; }
    try { poll = await readPoll(); }
    catch (e) { shell('<p class="poll-sub">The poll couldn’t be read. Try again in a moment.</p>'); return; }
    render();
    var admin = await loadSignedInAdmin();
    if (admin) { signedInAdmin = admin; renderAdmin(); } else renderAdminLink();
    window.__pollReady = true;
  }
  boot();
})();
