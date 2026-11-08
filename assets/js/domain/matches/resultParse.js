// ===================== RESULT PARSE =====================
// A result typed or pasted the way people actually write one, read into the
// Add a game form: who played, who won, the sets, and the date if it says.
//
// It used to accept one exact layout (a team line with 🏆, each set on its own
// line, the other team line) and refuse anything else, so results had to be
// rewritten into it first (Shaun, 27 Oct). Now all of these read the same:
//
//   Rishi & Fatch 🏆            Rishi & Fatch beat Tom & Topsy 6-0 6-2
//   6-0                         Tom/Topsy lost to Rishi/Fatch 6-0, 6-2
//   6-2                         Rishi and Fatch def. Tom and Topsy 6–0 6:2
//   Tom & Topsy                 Rishi Fatch v Tom Topsy 6-0 6-2
//                               [26/10/2026, 21:03] Jords: Rishi & Fatch won 6-0 6-2 vs Tom & Topsy
//
// How it decides, in order:
//   sides    split on a result word (beat / def / lost to / drew with ...), a
//            "vs", or two lines of names; partners on & / + , "and" -- or, with
//            no separator at all, by recognising the club's names
//   winner   a result word or a 🏆 / "won" beside a team says so; otherwise
//            the team that won more sets. Sets level with no word for it read
//            as not finished (the club's draw)
//   sets     written first-listed-team first unless the words say otherwise:
//            when a winner is named and the scores, read that way, have the
//            other team winning, they were written winner-first and are turned
//            round ("Tom & Topsy lost to Rishi & Fatch 6-0 6-2")
//   names    the player directory, exactly and ignoring case; a unique
//            first-word/prefix match is used and said so; an ambiguous one is
//            left for the person; anything else stays as typed (a new player)
//   date     a WhatsApp timestamp, "26/10", "26 Oct", "today", "yesterday" or
//            a weekday (the most recent one)
//
// Every assumption is reported in `notes` and anything doubtful in
// `warnings`, so the person checking the form sees how it was read. Nothing is
// submitted from here.
//
// PURE: the directory, "me" and today are passed in.

(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ResultParse = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const FP = () => (root && root.FixtureParse) || require('../../fixtureParse.js');

  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const WIN_MARK = '\u0001';   // a 🏆 (or similar) once normalised

  // Separators between the two sides, strongest first. `winner` says which
  // side won when the word itself says so.
  const SPLITTERS = [
    { re: /\s(?:lost|lose|losing|went\s+down)\s+(?:out\s+)?(?:to|against|vs\.?|v\.?)\s/i, winner: 1 },
    { re: /\s(?:were|was|got)?\s*beaten\s+by\s/i, winner: 1 },
    { re: /\s(?:drew|draw|drawn|tied)\s+(?:with|against|vs\.?|v\.?)\s/i, draw: true },
    { re: /\s(?:won|win|wins)\s+(?:against|vs\.?|v\.?|over|to)\s/i, winner: 0 },
    { re: /\s(?:beat|beats|beating|bt|defeated|defeat|defeats|def\.?|d\.|over|edged|thrashed|smashed|destroyed|bagelled|bageled)\s/i, winner: 0 },
    { re: /\s(?:vs\.?|v\.?|versus|against|x)\s/i },
  ];
  const DRAW_WORDS = /\b(?:draw|drew|drawn|tied|unfinished|not\s+finished|didn'?t\s+finish|ran\s+out\s+of\s+time|out\s+of\s+time|no\s+result)\b/i;
  const WINNER_MARKS = /(?:\u0001|\b(?:won|win|wins|winners?|winning|champs?)\b|\(w\))/gi;
  const LOSER_MARKS = /(?:\b(?:lost|lose|losers?)\b|\(l\))/gi;
  const FILLER = /\b(?:score|scores|result|results|final|sets?|games?|in|straight|tie-?break|tb|super|match|played|today|yesterday|tonight|last\s+night|on|the|team|at|padel|with)\b/gi;
  const PARTNERS = /\s*(?:&|\+|\/|,|\band\b|\bn\b)\s*/i;

  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }
  function validDate(y, m, d) {
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  }
  // A day and month with no year: this year, or last year if that would be
  // in the future (a result is never from next month).
  function yearFor(m, d, today) {
    const [ty] = today.split('-').map(Number);
    return iso(ty, m, d) > today ? ty - 1 : ty;
  }
  function shiftDays(today, n) {
    const [y, m, d] = today.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }

  function normalise(text) {
    return String(text || '')
      .replace(/\r/g, '')
      .replace(/[🏆🥇👑✅]/gu, ` ${WIN_MARK} `)
      .replace(/[‐-―−]/g, '-')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}️‍]/gu, ' ');
  }

  // Dates, taken out of the text so "26-10" is never read as a set.
  function takeDate(text, today, out) {
    let found = null;
    const use = (date, how) => { if (!found && date) { found = date; out.notes.push(`Date read as ${date} (${how}).`); } };
    let t = text;
    // WhatsApp timestamps: "[26/10/2026, 21:03:12] Jords: " or "26/10/2026, 21:03 - Jords: ".
    t = t.replace(/^\s*\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?\]?\s*(?:-\s*)?[^:\n]{1,40}:\s*/gim, (m0, d, mo, y) => {
      const yy = Number(y) < 100 ? 2000 + Number(y) : Number(y);
      if (validDate(yy, Number(mo), Number(d))) use(iso(yy, Number(mo), Number(d)), 'from the message');
      return '';
    });
    // 26/10/2026, 26.10.26, 26-10-2026
    t = t.replace(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/g, (m0, d, mo, y) => {
      const yy = Number(y) < 100 ? 2000 + Number(y) : Number(y);
      if (validDate(yy, Number(mo), Number(d))) { use(iso(yy, Number(mo), Number(d)), `"${m0}"`); return ' '; }
      return m0;
    });
    // 26 Oct, 26th October, Oct 26
    t = t.replace(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\b/gi, (m0, d, mon) => {
      const m = MONTHS.indexOf(mon.slice(0, 3).toLowerCase()) + 1;
      const y = yearFor(m, Number(d), today);
      if (validDate(y, m, Number(d))) { use(iso(y, m, Number(d)), `"${m0.trim()}"`); return ' '; }
      return m0;
    });
    t = t.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi, (m0, mon, d) => {
      const m = MONTHS.indexOf(mon.slice(0, 3).toLowerCase()) + 1;
      const y = yearFor(m, Number(d), today);
      if (validDate(y, m, Number(d))) { use(iso(y, m, Number(d)), `"${m0.trim()}"`); return ' '; }
      return m0;
    });
    if (/\btoday\b|\btonight\b/i.test(t)) use(today, '"today"');
    if (/\byesterday\b|\blast\s+night\b/i.test(t)) use(shiftDays(today, -1), '"yesterday"');
    const day = (t.match(/\b(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|rsday|urday|sday)?\b/i) || [])[1];
    if (day) {
      const want = DAYS.findIndex((x) => x.startsWith(day.toLowerCase().slice(0, 3)));
      const [y, m, d] = today.split('-').map(Number);
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      use(shiftDays(today, -((dow - want + 7) % 7)), `"${day}"`);
      t = t.replace(/\b(?:sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|rsday|urday|sday)?\b/gi, ' ');
    }
    // A day/month with slashes and no year, only when the scores use - or :.
    out.date = found;
    return t;
  }

  // Set scores: "6-4", "6 - 4", "6:4", "7-6(5)". With no "-" or ":" scores at
  // all, "6/4" is a set; otherwise a lone "26/10" is a date.
  function takeSets(text, today, out) {
    const sets = [];
    const re = /(?<![\d\/.])(\d{1,2})\s*[-:]\s*(\d{1,2})(?:\s*[(\[]\s*\d{1,2}\s*[)\]])?(?![\d\/.])/g;
    let t = text.replace(re, (m0, a, b) => { sets.push([Number(a), Number(b)]); return ' , '; });
    const slash = /(?<![\d.])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d.\/])/g;
    if (!sets.length) {
      t = t.replace(slash, (m0, a, b) => { sets.push([Number(a), Number(b)]); return ' , '; });
    } else {
      t = t.replace(slash, (m0, d, mo) => {
        if (!out.date && validDate(2000, Number(mo), Number(d))) {
          const y = yearFor(Number(mo), Number(d), today);
          out.date = iso(y, Number(mo), Number(d));
          out.notes.push(`Date read as ${out.date} ("${m0}").`);
        }
        return ' ';
      });
    }
    sets.forEach(([a, b]) => {
      if (a > 30 || b > 30) out.problems.push(`"${a}-${b}" isn't a set score.`);
    });
    out.sets = sets;
    return t;
  }

  // One side's text into names: separators first; failing that, the club's
  // names recognised in it (longest first), so "Rishi Fatch" is two players
  // and "Ant Slice" one.
  function namesOf(text, directory) {
    const chunks = text.split(PARTNERS).map((x) => x.trim()).filter(Boolean);
    const out = [];
    chunks.forEach((chunk) => {
      const words = chunk.split(/\s+/).filter(Boolean);
      if (words.length < 2) { out.push(chunk); return; }
      const dir = directory.map((n) => ({ n, w: n.toLowerCase().split(/\s+/) })).sort((a, b) => b.w.length - a.w.length);
      const got = [];
      let i = 0, stuck = false;
      while (i < words.length) {
        const hit = dir.find((d) => d.w.every((w, k) => (words[i + k] || '').toLowerCase() === w));
        if (hit) { got.push(words.slice(i, i + hit.w.length).join(' ')); i += hit.w.length; }
        else { stuck = true; break; }
      }
      if (!stuck && got.length > 1) out.push(...got);
      else out.push(chunk);
    });
    return out;
  }

  function clean(side, marks) {
    let s = ` ${side} `;
    let winner = false, loser = false;
    s = s.replace(WINNER_MARKS, () => { winner = true; return ' '; });
    s = s.replace(LOSER_MARKS, () => { loser = true; return ' '; });
    s = s.replace(DRAW_WORDS, ' ').replace(FILLER, ' ').replace(/[()[\]{}!?.:;"“”]/g, ' ')
      .replace(/\s*,\s*,+/g, ',').replace(/^[\s,&+\/-]+|[\s,&+\/-]+$/g, '').replace(/\s+/g, ' ').trim();
    if (marks) { marks.winner = winner; marks.loser = loser; }
    return s;
  }

  // The two sides, and what the words say about who won.
  function splitSides(text, directory, out) {
    const flat = text.replace(/\n+/g, ' \n ');
    for (const sp of SPLITTERS) {
      const parts = flat.split(sp.re);
      if (parts.length === 2 && clean(parts[0]) && clean(parts[1])) {
        out.word = (flat.match(sp.re) || [''])[0].trim().replace(/\s+/g, ' ');
        if (sp.winner !== undefined) out.winnerSide = sp.winner;
        if (sp.draw) out.drawWord = true;
        return parts;
      }
    }
    // Two lines of names.
    const lines = text.split('\n').map((l) => clean(l)).filter(Boolean);
    const raw = text.split('\n').filter((l) => clean(l));
    if (lines.length === 2) return raw;
    // One line of names, no separator: recognise the names and split them in
    // half -- first pair against the second.
    const one = clean(text.replace(/\n/g, ' '));
    const names = namesOf(one.replace(PARTNERS, ' '), directory);
    // "Rishi & Fatch" is one pair, not two opponents.
    if (names.length === 2 && PARTNERS.test(one)) {
      out.problems.push(`Only one team found (${names.join(' & ')}). Add the other team, with "vs" or "beat" between them.`);
      return null;
    }
    if (names.length === 4 || names.length === 2) {
      out.assumedSplit = true;
      const half = names.length / 2;
      return [names.slice(0, half).join(' & '), names.slice(half).join(' & ')];
    }
    return null;
  }

  function parse(text, opts) {
    const o = opts || {};
    const directory = (o.directory || []).slice();
    const today = o.today || new Date().toISOString().slice(0, 10);
    const out = { notes: [], warnings: [], problems: [], date: null, sets: [], winnerSide: null, drawWord: false };

    let t = normalise(text);
    if (!t.trim()) return { ok: false, problems: ['Paste or type a result first.'], notes: [], warnings: [] };
    // More than one result pasted at once: several lines that each name both
    // sides and carry a score. One game at a time, said plainly.
    const full = t.split('\n').filter((l) => /\d{1,2}\s*[-:]\s*\d{1,2}/.test(l) && SPLITTERS.some((sp) => sp.re.test(` ${l} `)));
    if (full.length > 1) {
      return { ok: false, problems: [`This looks like ${full.length} results. Add them one at a time — paste the first, submit it, then the next.`], notes: [], warnings: [] };
    }
    t = takeDate(t, today, out);
    t = takeSets(t, today, out);

    const drawAnywhere = DRAW_WORDS.test(t);
    const sides = splitSides(t, directory, out);
    if (!sides) {
      if (!out.problems.length) out.problems.push('Couldn’t tell the two teams apart. Put "vs" (or "beat") between them, or each team on its own line.');
      return finish(out, null, directory, o);
    }
    const marks = [{}, {}];
    const sideText = sides.map((s, i) => clean(s, marks[i]));
    if (out.winnerSide === null) {
      if (marks[0].winner && !marks[1].winner) { out.winnerSide = 0; out.notes.push('Winners: the team marked as winning.'); }
      else if (marks[1].winner && !marks[0].winner) { out.winnerSide = 1; out.notes.push('Winners: the team marked as winning.'); }
      else if (marks[0].loser && !marks[1].loser) { out.winnerSide = 1; out.notes.push('Winners: the other team to the one marked as losing.'); }
      else if (marks[1].loser && !marks[0].loser) { out.winnerSide = 0; out.notes.push('Winners: the other team to the one marked as losing.'); }
      else if (marks[0].winner && marks[1].winner) out.problems.push('Both teams are marked as winning.');
    } else {
      out.notes.push(`Winners: from "${out.word}".`);
    }
    out.isDraw = out.drawWord || (drawAnywhere && out.winnerSide === null);
    const teams = sideText.map((s) => namesOf(s, directory));
    return finish(out, teams, directory, o);
  }

  function finish(out, teams, directory, o) {
    const res = { ok: false, notes: out.notes, warnings: out.warnings, problems: out.problems, date: out.date, sets: out.sets };
    if (!teams) return res;

    // Names against the directory.
    const resolved = teams.map((side) => side.map((n) => FP().resolveName(n, directory, o.me || null, o.aliases || null)));
    const names = resolved.map((side) => side.map((r) => {
      if (r.status === 'ok') { if (r.alias) out.notes.push(`Read "${r.text}" as ${r.name}.`); return r.name; }
      if (r.status === 'suggested') { out.warnings.push(`Read "${r.text}" as ${r.options[0]} — change it below if that's wrong.`); return r.options[0]; }
      if (r.status === 'ambiguous') { out.problems.push(`"${r.text}" could be ${r.options.join(' or ')} — pick the right one below.`); return r.text; }
      if (r.status === 'no-self') { out.problems.push(`"${r.text}" needs you to choose who you are first.`); return r.text; }
      out.warnings.push(`"${r.text}" isn't a club player yet — if they're new, give them a starting tier below.`);
      return r.text;
    }));
    const [a, b] = names;
    if (out.assumedSplit) out.warnings.push(`No "vs" or result word — read as ${a.join(' & ')} against ${b.join(' & ')}. Check the teams.`);
    if (!((a.length === 2 && b.length === 2) || (a.length === 1 && b.length === 1))) {
      out.problems.push(`Found ${a.length} v ${b.length} players (${a.join(', ') || '—'} v ${b.join(', ') || '—'}) — a game is 2 v 2, or 1 v 1 for singles.`);
    }
    const seen = new Set();
    a.concat(b).forEach((n) => { const k = String(n).toLowerCase(); if (seen.has(k)) out.problems.push(`${n} is on the court twice.`); seen.add(k); });

    // Who won, and which way round the sets were written.
    let sets = out.sets.slice();
    const won = (ss, side) => ss.filter(([x, y]) => (side === 0 ? x > y : y > x)).length;
    let winner = out.winnerSide;
    let isDraw = !!out.isDraw;
    if (!sets.length) out.problems.push('No set scores found — add them like "6-4 6-2".');
    if (isDraw) {
      winner = null;
      out.notes.push('Read as not finished / a draw.');
    } else if (winner !== null && sets.length) {
      if (won(sets, winner) < won(sets, 1 - winner)) {
        sets = sets.map(([x, y]) => [y, x]);
        out.notes.push('Scores were written winners-first — read them that way.');
      } else if (won(sets, winner) === won(sets, 1 - winner)) {
        out.warnings.push('The sets are level, but a winner was named — check the scores.');
      }
    } else if (sets.length) {
      const w0 = won(sets, 0), w1 = won(sets, 1);
      if (w0 !== w1) { winner = w0 > w1 ? 0 : 1; out.notes.push('Winners: the team that won more sets.'); }
      else { isDraw = true; out.notes.push('Sets level and no winner named — read as not finished / a draw.'); }
    } else {
      out.problems.push('Couldn’t tell who won — add the scores, or "beat"/🏆.');
    }

    // Into the form's shape: winners first, sets from the winners' side.
    const first = winner === 1 ? 1 : 0;
    res.winners = names[first];
    res.losers = names[1 - first];
    res.sets = first === 1 ? sets.map(([x, y]) => [y, x]) : sets;
    res.isDraw = isDraw;
    res.isSingles = names[0].length === 1 && names[1].length === 1;
    res.ok = !out.problems.length;
    return res;
  }

  // The result in one line, as the club writes it.
  function describe(r) {
    if (!r || !r.winners) return '';
    const s = r.sets.map(([x, y]) => `${x}-${y}`).join(', ');
    return `${r.winners.join(' & ')} ${r.isDraw ? 'drew with' : 'beat'} ${r.losers.join(' & ')}${s ? ` · ${s}` : ''}${r.date ? ` · ${r.date}` : ''}`;
  }

  return { parse, describe };
});
