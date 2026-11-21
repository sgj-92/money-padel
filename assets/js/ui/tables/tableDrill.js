// ===================== UI: TABLE DRILL-DOWN =====================
// The one component behind every P / W / D / L / Hard / Fav count in the
// League and Merit tables: the count is a button, and its detail lists the
// games the ROW itself recorded -- never a fresh query (D6).
//
// Extracted from app.js unchanged (docs/architecture/PARALLEL_DEVELOPMENT_SPLIT.md).
// Owning stream: redesign (the rows it reads are built by functional code).

// ===================== TABLE DETAIL: THE GAMES BEHIND A COUNT =====================
// One component for every count a League or Merit row lets you open -- P, W,
// D, L, Hard and Fav. The cell is a button that opens a detail row straight
// under the player's row; the detail lists the games the ROW ITSELF recorded
// when it counted them (League: `matchList`, Merit: `games` / `hard` /
// `favoured`), never a fresh query. So a cell reading 2 opens exactly those 2
// games -- same month, same tier section, same split-month treatment -- and
// nothing is re-derived that could disagree with it.
const TABLE_COUNT_KINDS = {
  played: { label: 'Played', of: (list) => list },
  wins:   { label: 'Wins',   of: (list) => list.filter(g => g.result === 'W') },
  draws:  { label: 'Draws',  of: (list) => list.filter(g => g.result === 'D') },
  losses: { label: 'Losses', of: (list) => list.filter(g => g.result === 'L') },
};

function tableDrillKey(player, tier, kind){ return `${player}\u0000${tier || ''}\u0000${kind}`; }

// A count that opens its games. Nothing to explain means nothing to tap: a
// zero stays plain text (or the table's own dash), never an empty drawer.
function tableCountCell(openKey, player, tier, kind, n, opts){
  const o = opts || {};
  if(!n) return o.zero !== undefined ? o.zero : `${n}`;
  const key = tableDrillKey(player, tier, kind);
  const open = openKey === key;
  const label = TABLE_COUNT_KINDS[kind] ? TABLE_COUNT_KINDS[kind].label : kind;
  return `<button type="button" class="merit-count${o.plain ? ' tbl-count' : ''}${open ? ' is-open' : ''}"
    data-player="${escapeHtml(player)}" data-tier="${escapeHtml(tier || '')}" data-kind="${kind}"
    ${o.colour ? `style="color:${o.colour};"` : ''} aria-expanded="${open}" aria-label="${escapeHtml(`${player}: ${n} ${label.toLowerCase()} — show the games`)}">${n}</button>`;
}

// Where the detail applies, said in the heading: which month and which table.
function tableDrillContext(tier){
  const month = summaryMonth === 'all' ? 'All Time' : monthLabel(summaryMonth);
  return `${month} · ${tier === 'ALL' ? 'All tiers' : tier ? `Tier ${tier}` : 'All together'}`;
}

// One game from the row's own side of it.
function tableGameLineHtml(g, subject){
  const mine = (g.winners || []).includes(subject) ? 'winners' : 'losers';
  const team = (names) => names.map(escapeHtml).join(' &amp; ');
  const side = (names, which) => which === mine ? `<b>${team(names)}</b>` : team(names);
  const score = (g.sets && g.sets.length) ? g.sets.map(([a,b])=>`${a}-${b}`).join(' ') : '';
  const word = g.result === 'W' ? 'Won' : g.result === 'L' ? 'Lost' : 'Drew';
  const line = g.isDraw
    ? `${side(g.winners, 'winners')} drew with ${side(g.losers, 'losers')}`
    : `${side(g.winners, 'winners')} beat ${side(g.losers, 'losers')}`;
  return `<div class="merit-drill-row">
    <div class="merit-drill-top">
      <span class="merit-drill-date">${escapeHtml(g.date)}</span>
      <span class="merit-drill-pts tbl-result tbl-result-${g.result}">${word}</span>
    </div>
    <div class="merit-drill-teams">${line}</div>
    ${score ? `<div class="merit-drill-meta">${escapeHtml(score)}</div>` : ''}
  </div>`;
}

// The detail row itself, newest game first (same-day games in the order they
// were recorded, unless a caller keeps an order of its own).
const NEWEST_FIRST = (a,b)=> a.date < b.date ? 1 : a.date > b.date ? -1 : 0;

function tableDrillRowHtml(cols, head, games, lineFn, order){
  return `<tr class="merit-drill"><td colspan="${cols}" style="padding:0;">
    <div class="merit-drill-body">
      <div class="merit-drill-head">${head}</div>
      ${games.slice().sort(order || NEWEST_FIRST).map(lineFn).join('')}
    </div>
  </td></tr>`;
}

// The P/W/D/L detail for one row, if it is the one open.
function tableCountDrillHtml(openKey, cols, player, tier, list){
  const kind = Object.keys(TABLE_COUNT_KINDS).find(k => openKey === tableDrillKey(player, tier, k));
  if(!kind) return '';
  const games = TABLE_COUNT_KINDS[kind].of(list || []);
  const head = `${escapeHtml(player)} · ${TABLE_COUNT_KINDS[kind].label} · ${escapeHtml(tableDrillContext(tier))} · ${games.length} game${games.length === 1 ? '' : 's'}`;
  return tableDrillRowHtml(cols, head, games, (g) => tableGameLineHtml(g, player));
}

// Taps on any count in a table: the same tap again closes it.
function wireTableCounts(content, getOpen, setOpen, redraw){
  content.querySelectorAll('.merit-count').forEach(btn=>{
    btn.onclick = ()=>{
      const key = tableDrillKey(btn.dataset.player, btn.dataset.tier, btn.dataset.kind);
      setOpen(getOpen() === key ? null : key);
      redraw();
    };
  });
}
