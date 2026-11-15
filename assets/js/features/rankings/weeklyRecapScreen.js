// ===================== RANKINGS › WEEKLY RECAP =====================
// Shaun, 15 Nov. The week's games, most wins, biggest shock, doughnuts (and
// who gave and received the most), and anyone who had a bad week, for any
// week (Monday to Sunday), copyable for WhatsApp. The counting is
// domain/recap/weeklyRecap.js; this file draws it.
// Loads before leagueScreen.js; declarations only.

let recapWeek = null;   // the Monday of the week shown; null = the latest with games

const RECAP_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function recapRangeLabel(start, end){
  const [ys, ms, ds] = start.split('-').map(Number), [ye, me, de] = end.split('-').map(Number);
  return ms === me ? `${ds}–${de} ${RECAP_MONTHS[me - 1]} ${ye}` : `${ds} ${RECAP_MONTHS[ms - 1]}${ys !== ye ? ` ${ys}` : ''} – ${de} ${RECAP_MONTHS[me - 1]} ${ye}`;
}

function recapData(){
  const matches = getAllApprovedMatches();
  const weeks = WeeklyRecap.weeks(matches);
  if(recapWeek === null || (!weeks.includes(recapWeek) && recapWeek !== WeeklyRecap.weekStart(new Date().toISOString().slice(0, 10)))) recapWeek = weeks[0] || null;
  if(!recapWeek) return { weeks, recap: null };
  const recap = WeeklyRecap.build({ matches, journey: V3_JOURNEY, start: recapWeek, nameOf: displayNameFor });
  const end = recap.end;
  recap.rotations = new Set((typeof V3_ROTATIONS !== 'undefined' ? V3_ROTATIONS : [])
    .filter(m => m.date >= recapWeek && m.date <= end).map(m => m.rotation.session)).size;
  return { weeks, recap };
}

// The recap as lines: one source for the screen and the WhatsApp text.
function recapLines(r){
  // Tied players are a list, not a pair: "Kaz, Len and PDM".
  const list = (a) => a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
  const names = (x) => list(x.names);
  const tied = (x, verb) => x.names.length > 3 ? `${x.names.length} players ${verb} ${x.value} each` : `${verb} the most: ${names(x)} (${x.value})`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const lines = [];
  lines.push({ key: 'games', icon: '🎾', title: 'Games', text: r.games
    ? `${plural(r.games, 'game', 'games')} · ${plural(r.players, 'player', 'players')}${r.rotations ? ` · ${plural(r.rotations, 'rotation', 'rotations')}` : ''}`
    : `No games${r.rotations ? ` · ${plural(r.rotations, 'rotation', 'rotations')}` : ''}` });
  if(r.mostWins){
    const one = r.mostWins.names.length === 1 ? r.record[r.mostWins.names[0]] : null;
    lines.push({ key: 'mostWins', icon: '🏆', title: 'Most wins', text: `${names(r.mostWins)} · ${plural(r.mostWins.value, 'win', 'wins')}${one ? ` (${one.w}W${one.d ? ` ${one.d}D` : ''} ${one.l}L)` : ''}` });
  }
  if(r.mostLosses){
    const one = r.mostLosses.names.length === 1 ? r.record[r.mostLosses.names[0]] : null;
    lines.push({ key: 'mostLosses', icon: '😓', title: 'Most losses', text: `${names(r.mostLosses)} · ${plural(r.mostLosses.value, 'loss', 'losses')}${one ? ` (${one.w}W${one.d ? ` ${one.d}D` : ''} ${one.l}L)` : ''}` });
  }
  if(r.shock){
    const m = r.shock.match;
    lines.push({ key: 'shock', icon: '😱', title: 'Biggest shock', text: `${m.winners.join(' & ')} beat ${m.losers.join(' & ')} ${m.sets.map(s => s.join('-')).join(' ')}, rated ${r.shock.gap} points below them going in` });
  }
  lines.push({ key: 'doughnuts', icon: '🍩', title: 'Doughnuts', text: r.doughnuts
    ? `${plural(r.doughnuts, 'doughnut', 'doughnuts')} (6-0 sets)${r.gaveMost ? ` · ${tied(r.gaveMost, 'gave')}` : ''}${r.receivedMost ? ` · ${tied(r.receivedMost, 'received')}` : ''}`
    : 'None this week' });
  lines.push({ key: 'bad', icon: '📉', title: 'Bad week', text: r.bad
    ? `${r.bad.name} · ${r.bad.record.w}W${r.bad.record.d ? ` ${r.bad.record.d}D` : ''} ${r.bad.record.l}L · rating ${String(r.bad.change).replace('-', '−')}`
    : 'Nobody had a bad week' });
  return lines;
}

// Which lines go out (Shaun, 15 Nov: "include or deselect each metric before
// sending. Ie I don't want to send bad week"). Remembered on this device.
const RECAP_PICK_KEY = 'recapLinesOff';
let recapOff = (() => { try { return JSON.parse(localStorage.getItem(RECAP_PICK_KEY) || '[]'); } catch(e){ return []; } })();
function recapChosen(r){ return recapLines(r).filter(l => !recapOff.includes(l.key)); }
function setRecapLine(key, on){
  recapOff = on ? recapOff.filter(k => k !== key) : [...new Set(recapOff.concat([key]))];
  try { localStorage.setItem(RECAP_PICK_KEY, JSON.stringify(recapOff)); } catch(e){ /* not kept: fine */ }
}

function recapText(r){
  const text = [`${CLUB.name} · Weekly recap · ${recapRangeLabel(r.start, r.end)}`, '']
    .concat(recapChosen(r).map(l => `${l.icon} ${l.title}: ${l.text}`)).join('\n');
  const f = typeof recapFixturesIncluded === 'function' ? recapFixturesIncluded() : null;
  if(!f) return text;
  // The fixtures list without its club-name line: "📆 Next week's fixtures · …".
  const [head, ...rest] = recapFixturesText(f).split('\n');
  return `${text}\n\n📆 ${head.replace(`${CLUB.name} · `, '')}\n${rest.join('\n').trim()}`;
}

// The week's games, oldest day first, a rotation as one line per pairing.
const RECAP_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function recapDayLabel(date){
  const d = new Date(`${date}T12:00:00Z`);
  return `${RECAP_DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${RECAP_MONTHS[d.getUTCMonth()]}`;
}
function recapGames(r){
  const inWeek = (m) => m.date >= r.start && m.date <= r.end;
  const games = getAllApprovedMatches().filter(inWeek).map(m => ({ date: m.date, id: m.id,
    line: MatchOutcome.describe(m), score: m.sets.map(s => s.join('-')).join(' ') + MatchNote.mark(MatchNote.forMatch(matchNotesState, m.id)), rotation: false }));
  const rot = (typeof V3_ROTATIONS !== 'undefined' ? V3_ROTATIONS : []).filter(inWeek).map(m => ({ date: m.date, id: m.id,
    line: `Rotation: ${rotationPairLine(m)}`, score: '', rotation: true }));
  const all = games.concat(rot).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id.localeCompare(b.id, undefined, { numeric: true }));
  const days = [];
  all.forEach(g => { const last = days[days.length - 1]; if(last && last.date === g.date) last.games.push(g); else days.push({ date: g.date, label: recapDayLabel(g.date), games: [g] }); });
  return { days, count: games.length, rotations: rot.length };
}
function recapGamesText(r){
  const g = recapGames(r);
  const lines = [`${CLUB.name} · Games · ${recapRangeLabel(r.start, r.end)}`, ''];
  g.days.forEach(d => { lines.push(d.label); d.games.forEach(x => lines.push(`  ${x.line}${x.score ? ` ${x.score}` : ''}`)); lines.push(''); });
  return lines.join('\n').trim();
}

// Fixtures for a week ahead (Shaun, 15 Nov: "share upcoming fixtures for the
// following week"). Agreed games with a date in that week, court booked or
// called out; a game someone has backed out of is left off until it is fixed.
let recapFixturesWhich = 'next';   // 'next' (Monday to Sunday after this one) or 'this' (today to Sunday)
function recapAddDays(iso, n){
  const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
function recapFixtures(which){
  const today = localIsoToday();
  const monday = WeeklyRecap.weekStart(today);
  const start = which === 'this' ? today : recapAddDays(monday, 7);
  const end = WeeklyRecap.weekEnd(which === 'this' ? monday : start);
  const S = FixtureFlow.STAGE, now = new Date().toISOString();
  const live = gameRequestsState.filter(r => FixtureFlow.isAgreed(r) && [S.UPCOMING, S.CALLED_OUT].includes(FixtureFlow.stage(r, now)));
  const games = live.filter(r => r.preferredDate && r.preferredDate >= start && r.preferredDate <= end)
    .sort(FixtureFlow.upcomingOrder)
    .map(r => {
      const [a, b] = requestTeams(r);
      return { id: r.id, date: r.preferredDate, teams: `${a.join(' & ')} vs ${b.join(' & ')}`,
        when: [r.preferredTime, r.location].filter(Boolean).join(' · ') || 'Time and venue TBC',
        booked: FixtureFlow.stage(r, now) === S.UPCOMING };
    });
  // Courts booked with players still to confirm: shared too, so the group
  // can fill them (Play › Upcoming › Courts booked).
  const courts = (typeof courtBookingsState !== 'undefined' ? courtBookingsState : [])
    .filter(c => c.date >= start && c.date <= end)
    .map(c => ({ id: c.id, date: c.date, teams: CourtBookings.namesLine(c),
      when: [c.time, c.venue].filter(Boolean).join(' · ') || 'Time and venue TBC',
      booked: true, open: CourtBookings.needed(c) }));
  games.push(...courts);
  games.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const days = [];
  games.forEach(g => { const last = days[days.length - 1]; if(last && last.date === g.date) last.games.push(g); else days.push({ date: g.date, label: recapDayLabel(g.date), games: [g] }); });
  return { which, start, end, days, count: games.length - courts.length, courts: courts.length, undated: live.filter(r => !r.preferredDate).length,
    title: which === 'this' ? 'This week’s fixtures' : 'Next week’s fixtures' };
}
function recapFixturesCount(f){
  const p = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  return [f.count || !f.courts ? p(f.count, 'game', 'games') : null, f.courts ? `${p(f.courts, 'court', 'courts')} needing players` : null].filter(Boolean).join(' · ');
}
function recapFixturesText(f){
  const lines = [`${CLUB.name} · ${f.title.replace('’', "'")} · ${recapRangeLabel(f.start, f.end)}`, ''];
  if(!f.days.length) lines.push('No games arranged yet.');
  f.days.forEach(d => { lines.push(d.label); d.games.forEach(x => lines.push(x.open ? `  Court booked · ${x.when} · ${x.teams}` : `  ${x.teams} · ${x.when}${x.booked ? '' : ' (court not booked yet)'}`)); lines.push(''); });
  return lines.join('\n').trim();
}

const RECAP_PICTURE_MAX = 60;

// The picture is made BEFORE the tap: a phone opens its share sheet only
// straight from a tap, and building a picture first used up that moment, so
// iPhones fell back to a download (Shaun, 15 Nov). Each picture is built as
// soon as what it shows is known, and rebuilt when that changes.
const recapReady = { recap: null, games: null, both: null, fixtures: null };   // { key, file, title }

function recapPictureKey(kind, r){
  const recapKey = () => `${r.start}|${recapChosen(r).map(l => l.key + ':' + l.text).join('|')}`;
  if(kind === 'recap') return `recap|${recapKey()}`;
  if(kind === 'games') return `games|${recapGamesText(r)}`;
  const fx = () => { const f = recapFixturesIncluded(); return f ? recapFixturesText(f) : ''; };
  if(kind === 'both') return `both|${recapKey()}|${recapGamesText(r)}|${fx()}`;
  return `fixtures|${recapFixturesText(recapFixtures(recapFixturesWhich))}`;
}

// The week's games as picture rows: the first 60, and how many more (a phone
// can only hold a picture so tall).
function recapGameRows(r){
  const g = recapGames(r);
  const short = (date) => { const d = new Date(`${date}T12:00:00Z`); return `${RECAP_DAYS[d.getUTCDay()]} ${d.getUTCDate()}`; };
  const all = g.days.flatMap(d => d.games.map(x => ({ date: short(d.date), teams: x.line, score: x.score || 'rotation', result: '', tone: 'draw' })));
  const rows = all.slice(0, RECAP_PICTURE_MAX);
  return { title: 'This week’s games', rows, more: all.length - rows.length,
    subtitle: `${g.count} game${g.count === 1 ? '' : 's'}${g.rotations ? ` · ${g.rotations} rotation pairing${g.rotations === 1 ? '' : 's'}` : ''}` };
}

// The fixtures as picture rows (alone, or under the recap).
function recapFixtureRows(f){
  const range = recapRangeLabel(f.start, f.end);
  const all = f.days.flatMap(d => d.games.map(x => ({ date: recapDayLabel(d.date).replace(/ \w+$/, ''), teams: x.teams, score: x.when,
    result: x.open ? `Needs ${x.open}` : x.booked ? 'Booked' : 'Called out', tone: x.open ? 'open' : x.booked ? 'win' : 'draw' })));
  const rows = all.slice(0, RECAP_PICTURE_MAX);
  return { title: f.title, subtitle: `${range} · ${recapFixturesCount(f)}`, rows,
    more: all.length - rows.length, moreText: `+ ${all.length - rows.length} more` };
}

// Next week's fixtures go out with the recap too (Shaun, 15 Nov: "Put
// fixtures in the recap"), unless unticked. Remembered on this device.
const RECAP_FIXTURES_KEY = 'recapWithFixtures';
let recapWithFixtures = (() => { try { return localStorage.getItem(RECAP_FIXTURES_KEY) !== 'off'; } catch(e){ return true; } })();
function recapFixturesIncluded(){
  if(!recapWithFixtures) return null;
  const f = recapFixtures(recapFixturesWhich);
  return f.days.length ? f : null;
}

const RECAP_FILE = { recap: 'weekly-recap', games: 'week-games', both: 'weekly-recap-games', fixtures: 'fixtures' };
const RECAP_TITLE = { recap: 'Weekly recap', games: 'Games', both: 'Weekly recap', fixtures: 'Fixtures' };

async function buildRecapPicture(kind, r){
  const brand = await CardPainter.loadImage(CLUB.logo);
  let cv, range, start;
  if(kind === 'fixtures'){
    const f = recapFixtures(recapFixturesWhich);
    range = recapRangeLabel(f.start, f.end); start = f.start;
    cv = CardPainter.weeklyGames({ ...recapFixtureRows(f), range }, { brand });
  } else {
    range = recapRangeLabel(r.start, r.end); start = r.start;
    if(kind === 'recap') cv = CardPainter.weeklyRecap({ title: 'Weekly recap', range, lines: recapChosen(r) }, { brand });
    else if(kind === 'both'){
      const f = recapFixturesIncluded();
      cv = CardPainter.weeklyCombined({ title: 'Weekly recap', range, lines: recapChosen(r), games: recapGameRows(r), fixtures: f ? recapFixtureRows(f) : null }, { brand });
    }
    else cv = CardPainter.weeklyGames({ ...recapGameRows(r), range }, { brand });
  }
  const file = await CardPainter.toFile(cv, `${CLUB.fileSlug}-${RECAP_FILE[kind]}-${start}.png`);
  return { file, title: `${CLUB.name} — ${RECAP_TITLE[kind]} · ${range}` };
}

function prepareRecapPicture(kind, r){
  const key = recapPictureKey(kind, r);
  if(recapReady[kind] && recapReady[kind].key === key) return;
  recapReady[kind] = { key, pending: true };
  buildRecapPicture(kind, r).then(made => {
    if(recapReady[kind] && recapReady[kind].key === key) recapReady[kind] = { key, ...made };
  }, () => { if(recapReady[kind] && recapReady[kind].key === key) recapReady[kind] = null; });
}

async function shareRecapPicture(kind, r, btn){
  const msg = (t) => { const el = document.getElementById(kind === 'fixtures' ? 'recapFixturesMsg' : 'recapCopyMsg'); if(el) el.textContent = t; };
  const key = recapPictureKey(kind, r);
  const ready = recapReady[kind] && recapReady[kind].key === key && recapReady[kind].file ? recapReady[kind] : null;
  try {
    // Ready: straight to the share sheet, inside the tap.
    let made = ready;
    if(!made){
      btn.disabled = true;
      made = await buildRecapPicture(kind, r);
      recapReady[kind] = { key, ...made };
      btn.disabled = false;
    }
    const outcome = await CardPainter.share([made.file], { title: made.title });
    msg(outcome === 'shared' ? 'Picture shared.' : outcome === 'saved' ? 'Picture saved — post it from your photos.' : outcome === 'ready' ? 'Picture ready: tap again to share.' : '');
  } catch(e){ btn.disabled = false; msg('Could not make the picture.'); }
}

function renderWeeklyRecap(){
  const content = document.getElementById('summaryContent');
  const { weeks, recap } = recapData();
  if(!recap){
    content.innerHTML = `<div class="section-sub">No games recorded yet.</div>${recapFixturesHtml()}`;
    wireRecapFixtures(null);
    return;
  }
  const options = weeks.map(w => `<option value="${w}"${w === recapWeek ? ' selected' : ''}>${recapRangeLabel(w, WeeklyRecap.weekEnd(w))}</option>`).join('');
  content.innerHTML = `<div class="fg-row" style="margin-top:6px;"><label class="fg-label" for="recapWeekSelect">Week (Monday to Sunday)</label>
      <select id="recapWeekSelect" class="fg-select">${options}</select></div>
    <div class="section-heading">📅 Weekly recap · ${escapeHtml(recapRangeLabel(recap.start, recap.end))}</div>
    <div class="section-sub" style="margin:2px 0 0;">Untick anything you don’t want to send: the picture and the copied text leave it out.</div>
    <div class="recap-list" id="weeklyRecap">${recapLines(recap).map(l => { const on = !recapOff.includes(l.key); return `<label class="recap-item${on ? '' : ' is-off'}">
      <span class="recap-icon" aria-hidden="true">${l.icon}</span>
      <span class="recap-body"><b>${escapeHtml(l.title)}</b><span>${escapeHtml(l.text)}</span></span>
      <input type="checkbox" class="recap-pick" data-recap-line="${l.key}"${on ? ' checked' : ''} aria-label="Include ${escapeHtml(l.title)}"></label>`; }).join('')}</div>
    <div class="section-sub" style="font-size:10.5px;">Biggest shock: the win by the pair rated furthest below their opponents going in. Bad week: the biggest rating fall over the week, if ${WeeklyRecap.BAD_WEEK_POINTS} points or more. Rotations are not counted as games.</div>
    <div class="recap-actions">
      <button class="tab-btn active" id="recapPicture">🖼 Share recap picture</button>
      <button class="preset-btn" id="recapCopy">📋 Copy recap text</button>
      ${recapGames(recap).days.length ? `<button class="preset-btn" id="recapBothPicture">🖼 Share recap + games</button>` : ''}
    </div>
    ${(() => { const f = recapFixtures(recapFixturesWhich); return f.days.length ? `<label class="recap-with-fixtures"><input type="checkbox" id="recapWithFixtures"${recapWithFixtures ? ' checked' : ''}> Add ${escapeHtml(f.title.charAt(0).toLowerCase() + f.title.slice(1))} (${escapeHtml(recapFixturesCount(f))}) to the recap picture and text</label>` : ''; })()}
    <div id="recapCopyMsg" class="section-sub" role="status"></div>
    ${recapGamesHtml(recap)}
    ${recapFixturesHtml()}`;
  wireRequestPlayerLinks(content);
  content.querySelectorAll('[data-recap-line]').forEach(box => {
    box.onchange = () => {
      setRecapLine(box.dataset.recapLine, box.checked);
      box.closest('.recap-item').classList.toggle('is-off', !box.checked);
      prepareRecapPicture('recap', recap);
      if(document.getElementById('recapBothPicture')) prepareRecapPicture('both', recap);
    };
  });
  prepareRecapPicture('recap', recap);
  prepareRecapPicture('games', recap);
  const both = document.getElementById('recapBothPicture');
  if(both){ prepareRecapPicture('both', recap); both.onclick = (e) => shareRecapPicture('both', recap, e.currentTarget); }
  wireRecapFixtures(recap);
  const withFx = document.getElementById('recapWithFixtures');
  if(withFx) withFx.onchange = () => {
    recapWithFixtures = withFx.checked;
    try { localStorage.setItem(RECAP_FIXTURES_KEY, withFx.checked ? 'on' : 'off'); } catch(e){ /* not kept: fine */ }
    if(document.getElementById('recapBothPicture')) prepareRecapPicture('both', recap);
  };
  document.getElementById('recapWeekSelect').onchange = (e) => { recapWeek = e.target.value; renderWeeklyRecap(); };
  document.getElementById('recapPicture').onclick = (e) => shareRecapPicture('recap', recap, e.currentTarget);
  const gp = document.getElementById('recapGamesPicture');
  if(gp) gp.onclick = (e) => shareRecapPicture('games', recap, e.currentTarget);
  const gc = document.getElementById('recapGamesCopy');
  if(gc) gc.onclick = async () => {
    const ok = await copyText(recapGamesText(recap));
    document.getElementById('recapCopyMsg').textContent = ok ? 'Games list copied — paste it into WhatsApp.' : 'Could not copy on this device.';
  };
  document.getElementById('recapCopy').onclick = async () => {
    const ok = await copyText(recapText(recap));
    document.getElementById('recapCopyMsg').textContent = ok ? 'Copied — paste it into WhatsApp.' : 'Could not copy on this device.';
  };
}

// The week's games on screen, by day, with their own picture and copy.
function recapGamesHtml(r){
  const g = recapGames(r);
  if(!g.days.length) return '';
  return `<div class="section-heading" style="margin-top:18px;">🎾 This week’s games · ${g.count}${g.rotations ? ` <span class="section-sub">+ ${g.rotations} rotation pairing${g.rotations === 1 ? '' : 's'}</span>` : ''}</div>
    <div class="recap-actions">
      <button class="tab-btn active" id="recapGamesPicture">🖼 Share games picture</button>
      <button class="preset-btn" id="recapGamesCopy">📋 Copy games list</button>
    </div>
    <div class="recap-games" id="recapGames">${g.days.map(d => `<div class="recap-day">${escapeHtml(d.label)}</div>
      ${d.games.map(x => `<div class="recap-game${x.rotation ? ' is-rotation' : ''}"><span>${escapeHtml(x.line)}</span><span class="recap-score">${escapeHtml(x.score)}</span></div>`).join('')}`).join('')}</div>`;
}

// Next week's fixtures (or the rest of this one), with a picture and a copy.
function recapFixturesHtml(){
  const f = recapFixtures(recapFixturesWhich);
  const opt = (v, label) => `<option value="${v}"${recapFixturesWhich === v ? ' selected' : ''}>${label}</option>`;
  const thisWeek = recapFixtures('this'), nextWeek = recapFixtures('next');
  return `<div class="section-heading" style="margin-top:18px;">📆 ${escapeHtml(f.title)} · ${escapeHtml(recapFixturesCount(f))}</div>
    <div class="fg-row"><label class="fg-label" for="recapFixturesWeek">Which week</label>
      <select id="recapFixturesWeek" class="fg-select">${opt('next', `Next week · ${recapRangeLabel(nextWeek.start, nextWeek.end)}`)}${opt('this', `Rest of this week · ${recapRangeLabel(thisWeek.start, thisWeek.end)}`)}</select></div>
    ${f.days.length ? `<div class="recap-actions">
      <button class="tab-btn active" id="recapFixturesPicture">🖼 Share fixtures picture</button>
      <button class="preset-btn" id="recapFixturesCopy">📋 Copy fixtures list</button>
    </div>
    <div class="recap-games" id="recapFixtures">${f.days.map(d => `<div class="recap-day">${escapeHtml(d.label)}</div>
      ${d.games.map(x => `<div class="recap-game${x.open ? ' is-open' : x.booked ? ' is-booked' : ''}"><span>${x.open ? 'Court booked: ' : ''}${escapeHtml(x.teams)}<br><small>${escapeHtml(x.when)}</small></span><span class="recap-score">${x.open ? `Needs ${x.open}` : x.booked ? 'Booked' : 'Called out'}</span></div>`).join('')}`).join('')}</div>`
    : `<div class="section-sub" id="recapFixtures">No games with a date in this week yet. Agreed games come from Play › Upcoming.</div>`}
    <div id="recapFixturesMsg" class="section-sub" role="status"></div>
    ${f.undated ? `<div class="section-sub" style="font-size:10.5px;">${f.undated} agreed game${f.undated === 1 ? ' has' : 's have'} no date yet, so ${f.undated === 1 ? 'it is' : 'they are'} not listed.</div>` : ''}`;
}
function wireRecapFixtures(recap){
  const sel = document.getElementById('recapFixturesWeek');
  if(sel) sel.onchange = (e) => { recapFixturesWhich = e.target.value; renderWeeklyRecap(); };
  const pic = document.getElementById('recapFixturesPicture');
  if(pic){ prepareRecapPicture('fixtures', recap); pic.onclick = (e) => shareRecapPicture('fixtures', recap, e.currentTarget); }
  const copy = document.getElementById('recapFixturesCopy');
  if(copy) copy.onclick = async () => {
    const ok = await copyText(recapFixturesText(recapFixtures(recapFixturesWhich)));
    document.getElementById('recapFixturesMsg').textContent = ok ? 'Fixtures copied — paste them into WhatsApp.' : 'Could not copy on this device.';
  };
}
