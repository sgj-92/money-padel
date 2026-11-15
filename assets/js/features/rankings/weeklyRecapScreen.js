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
    <div class="fg-row" style="margin-top:8px;"><button class="tab-btn active" id="recapCopy" style="width:100%;">📋 Copy as WhatsApp text</button></div>
    <div id="recapCopyMsg" class="section-sub" role="status"></div>`;
  wireRequestPlayerLinks(content);
  document.getElementById('recapWeekSelect').onchange = (e) => { recapWeek = e.target.value; renderWeeklyRecap(); };
  document.getElementById('recapCopy').onclick = async () => {
    const ok = await copyText(recapText(recap));
    document.getElementById('recapCopyMsg').textContent = ok ? 'Copied — paste it into WhatsApp.' : 'Could not copy on this device.';
  };
}
