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
  lines.push({ icon: '🎾', title: 'Games', text: r.games
    ? `${plural(r.games, 'game', 'games')} · ${plural(r.players, 'player', 'players')}${r.rotations ? ` · ${plural(r.rotations, 'rotation', 'rotations')}` : ''}`
    : `No games${r.rotations ? ` · ${plural(r.rotations, 'rotation', 'rotations')}` : ''}` });
  if(r.mostWins){
    const one = r.mostWins.names.length === 1 ? r.record[r.mostWins.names[0]] : null;
    lines.push({ icon: '🏆', title: 'Most wins', text: `${names(r.mostWins)} · ${plural(r.mostWins.value, 'win', 'wins')}${one ? ` (${one.w}W${one.d ? ` ${one.d}D` : ''} ${one.l}L)` : ''}` });
  }
  if(r.shock){
    const m = r.shock.match;
    lines.push({ icon: '😱', title: 'Biggest shock', text: `${m.winners.join(' & ')} beat ${m.losers.join(' & ')} ${m.sets.map(s => s.join('-')).join(' ')}, rated ${r.shock.gap} points below them going in` });
  }
  lines.push({ icon: '🍩', title: 'Doughnuts', text: r.doughnuts
    ? `${plural(r.doughnuts, 'doughnut', 'doughnuts')} (6-0 sets)${r.gaveMost ? ` · ${tied(r.gaveMost, 'gave')}` : ''}${r.receivedMost ? ` · ${tied(r.receivedMost, 'received')}` : ''}`
    : 'None this week' });
  lines.push({ icon: '📉', title: 'Bad week', text: r.bad
    ? `${r.bad.name} · ${r.bad.record.w}W${r.bad.record.d ? ` ${r.bad.record.d}D` : ''} ${r.bad.record.l}L · rating ${String(r.bad.change).replace('-', '−')}`
    : 'Nobody had a bad week' });
  return lines;
}

function recapText(r){
  return [`${CLUB.name} · Weekly recap · ${recapRangeLabel(r.start, r.end)}`, '']
    .concat(recapLines(r).map(l => `${l.icon} ${l.title}: ${l.text}`)).join('\n');
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

const RECAP_PICTURE_MAX = 60;
async function shareRecapPicture(kind, r, btn){
  const msg = (t) => { const el = document.getElementById('recapCopyMsg'); if(el) el.textContent = t; };
  btn.disabled = true;
  try {
    const brand = await CardPainter.loadImage(CLUB.logo);
    const range = recapRangeLabel(r.start, r.end);
    let cv;
    if(kind === 'recap'){
      cv = CardPainter.weeklyRecap({ title: 'Weekly recap', range, lines: recapLines(r) }, { brand });
    } else {
      const g = recapGames(r);
      // A phone can only hold a picture so tall: the first 60, and how many more.
      const short = (date) => { const d = new Date(`${date}T12:00:00Z`); return `${RECAP_DAYS[d.getUTCDay()]} ${d.getUTCDate()}`; };
      const all = g.days.flatMap(d => d.games.map(x => ({ date: short(d.date), teams: x.line, score: x.score || 'rotation', result: '', tone: 'draw' })));
      const rows = all.slice(0, RECAP_PICTURE_MAX);
      cv = CardPainter.weeklyGames({ title: 'This week’s games', range,
        subtitle: `${g.count} game${g.count === 1 ? '' : 's'}${g.rotations ? ` · ${g.rotations} rotation pairing${g.rotations === 1 ? '' : 's'}` : ''}`,
        rows, more: all.length - rows.length }, { brand });
    }
    const file = await CardPainter.toFile(cv, `${CLUB.fileSlug}-${kind === 'recap' ? 'weekly-recap' : 'week-games'}-${r.start}.png`);
    const outcome = await CardPainter.share([file], { title: `${CLUB.name} — ${kind === 'recap' ? 'Weekly recap' : 'Games'} · ${range}` });
    msg(outcome === 'shared' ? 'Picture shared.' : outcome === 'saved' ? 'Picture saved — post it from your photos.' : outcome === 'ready' ? 'Picture ready: tap again to share.' : '');
  } catch(e){ msg('Could not make the picture.'); }
  btn.disabled = false;
}

function renderWeeklyRecap(){
  const content = document.getElementById('summaryContent');
  const { weeks, recap } = recapData();
  if(!recap){ content.innerHTML = `<div class="section-sub">No games recorded yet.</div>`; return; }
  const options = weeks.map(w => `<option value="${w}"${w === recapWeek ? ' selected' : ''}>${recapRangeLabel(w, WeeklyRecap.weekEnd(w))}</option>`).join('');
  content.innerHTML = `<div class="fg-row" style="margin-top:6px;"><label class="fg-label" for="recapWeekSelect">Week (Monday to Sunday)</label>
      <select id="recapWeekSelect" class="fg-select">${options}</select></div>
    <div class="section-heading">📅 Weekly recap · ${escapeHtml(recapRangeLabel(recap.start, recap.end))}</div>
    <div class="recap-list" id="weeklyRecap">${recapLines(recap).map(l => `<div class="recap-item">
      <span class="recap-icon" aria-hidden="true">${l.icon}</span>
      <span class="recap-body"><b>${escapeHtml(l.title)}</b><span>${escapeHtml(l.text)}</span></span></div>`).join('')}</div>
    <div class="section-sub" style="font-size:10.5px;">Biggest shock: the win by the pair rated furthest below their opponents going in. Bad week: the biggest rating fall over the week, if ${WeeklyRecap.BAD_WEEK_POINTS} points or more. Rotations are not counted as games.</div>
    <div class="recap-actions">
      <button class="tab-btn active" id="recapPicture">🖼 Share recap picture</button>
      <button class="preset-btn" id="recapCopy">📋 Copy recap text</button>
    </div>
    <div id="recapCopyMsg" class="section-sub" role="status"></div>
    ${recapGamesHtml(recap)}`;
  wireRequestPlayerLinks(content);
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
