// ===================== FIXTURE PARSE =====================
// A pasted list of games, read into proposed fixtures for a person to review.
//
//   Me & PDM vs Rishi & Erf
//   Shaun/PDM v Tom/Osh
//   Me and KC against Len and Eli
//   Jords + Antz v Max + Rocky
//
// One game per line. The two sides are split on "vs", "v", "versus" or
// "against"; partners on "&", "/", "+", "and" or a comma. "Me" (and "myself",
// "I") is the player selected on the device.
//
// Names resolve only against the club's player directory, and only exactly
// (ignoring case). Anything else is never guessed:
//   - a name that could be more than one player is AMBIGUOUS and lists them;
//   - a name that starts, or is a word of, exactly one player is still only a
//     SUGGESTION -- the person picks it, the parser does not;
//   - anything else is UNKNOWN.
// Nothing here writes anything. It returns rows for a review screen, and the
// app creates requests only when the person confirms that screen.
//
// Pure: no storage, no screen.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FixtureParse = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SIDES = /\s+(?:vs\.?|v\.?|versus|against)\s+/i;
  const PARTNERS = /\s*(?:&|\/|\+|,)\s*|\s+and\s+/i;
  const SELF = ['me', 'myself', 'i', 'moi'];
  const BULLET = /^\s*(?:[-*•·]+|\d+[.)]|\(\d+\))\s*/;

  // Letters to change to turn one name into another (insert, delete, swap one).
  function editDistance(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return d[a.length][b.length];
  }

  // Every way one typed name can be read against the directory.
  //
  // `aliases` is the club's list of other spellings ({ jordz: 'Jords' },
  // Shaun 8 Nov): a known one is the player, read without asking. A name one
  // letter away from exactly one player ("Rishii") is offered as them -- read
  // that way and said so, never silently -- rather than taken for a new player.
  function resolveName(text, directory, me, aliases) {
    const t = String(text || '').trim();
    const low = t.toLowerCase();
    if (!t) return { text: t, status: 'missing', name: null, options: [] };
    if (SELF.includes(low)) {
      return me ? { text: t, status: 'ok', name: me, self: true, options: [] }
        : { text: t, status: 'no-self', name: null, options: [] };
    }
    const aka = aliases && aliases[low];
    const akaName = aka ? directory.find((n) => n.toLowerCase() === String(aka).toLowerCase()) : null;
    if (akaName && !directory.some((n) => n.toLowerCase() === low)) return { text: t, status: 'ok', name: akaName, alias: true, options: [] };
    const exact = directory.filter((n) => n.toLowerCase() === low);
    if (exact.length === 1) return { text: t, status: 'ok', name: exact[0], options: [] };
    if (exact.length > 1) return { text: t, status: 'ambiguous', name: null, options: exact };
    // Near: a name that begins with it, or has it as a whole word. Offered,
    // never chosen.
    const near = directory.filter((n) => {
      const l = n.toLowerCase();
      return l.startsWith(low) || l.split(/[\s-]+/).includes(low);
    });
    if (near.length > 1) return { text: t, status: 'ambiguous', name: null, options: near };
    if (near.length === 1) return { text: t, status: 'suggested', name: null, options: near };
    if (low.length >= 4) {
      const close = directory.filter((n) => n.length >= 4 && editDistance(n.toLowerCase(), low) === 1);
      if (close.length === 1) return { text: t, status: 'suggested', name: null, options: close, typo: true };
      if (close.length > 1) return { text: t, status: 'ambiguous', name: null, options: close };
    }
    return { text: t, status: 'unknown', name: null, options: [] };
  }

  // One line into one proposed game, with every problem named.
  function parseLine(raw, lineNo, directory, me, aliases) {
    const line = String(raw).replace(BULLET, '').trim();
    const row = { lineNo, text: String(raw).trim(), sides: [[], []], problems: [] };
    const parts = line.split(SIDES);
    if (parts.length !== 2) {
      row.problems.push(parts.length < 2
        ? { kind: 'unparseable', message: 'No "vs" found — can\'t tell the two sides apart.' }
        : { kind: 'unparseable', message: 'More than one "vs" on this line.' });
      return row;
    }
    row.sides = parts.map((side) => side.split(PARTNERS).map((x) => x.trim()));
    row.sides.forEach((side, i) => {
      if (side.some((x) => !x)) row.problems.push({ kind: 'incomplete', message: `Side ${i ? 'B' : 'A'} has a gap where a name should be.` });
    });
    row.sides = row.sides.map((side) => side.filter(Boolean).map((x) => resolveName(x, directory, me, aliases)));
    const counts = row.sides.map((s) => s.length);
    if (counts[0] !== 2 || counts[1] !== 2) {
      const total = counts[0] + counts[1];
      row.problems.push({ kind: 'player-count',
        message: `${total} player${total === 1 ? '' : 's'} (${counts[0]} v ${counts[1]}) — a game needs two on each side.` });
    }
    return row;
  }

  // The whole paste. Blank lines are skipped; every other line is a row.
  function parse(text, opts) {
    const o = opts || {};
    const directory = (o.directory || []).slice();
    return String(text || '').split(/\r?\n/)
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => l.trim())
      .map(({ l, i }) => parseLine(l, i + 1, directory, o.me || null, o.aliases || null));
  }

  // Where a row stands once the person's choices are applied: the four names
  // it would create, and anything still stopping it. `choices` holds a name
  // per seat ([sideIndex][seatIndex]) for anything picked or corrected.
  function review(row, choices, opts) {
    const o = opts || {};
    const canon = o.canon || ((n) => String(n).toLowerCase());
    const issues = row.problems.slice();
    const picked = row.sides.map((side, si) => side.map((p, pi) => {
      const chosen = choices && choices[si] && choices[si][pi];
      return chosen || p.name || null;
    }));
    row.sides.forEach((side, si) => side.forEach((p, pi) => {
      if (picked[si][pi]) return;
      if (p.status === 'ambiguous') issues.push({ kind: 'ambiguous', seat: [si, pi], message: `"${p.text}" could be ${p.options.join(' or ')} — choose one.` });
      else if (p.status === 'suggested') issues.push({ kind: 'unconfirmed', seat: [si, pi], message: `"${p.text}" isn't a player name. Did you mean ${p.options[0]}? Choose to confirm.` });
      else if (p.status === 'no-self') issues.push({ kind: 'no-self', seat: [si, pi], message: `"${p.text}" needs a selected player — choose who you are first.` });
      else issues.push({ kind: 'unknown', seat: [si, pi], message: `"${p.text}" isn't in the player directory.` });
    }));
    const flat = picked.flat();
    if (flat.every(Boolean)) {
      const seen = new Set();
      const dup = flat.filter((n) => { const k = canon(n); if (seen.has(k)) return true; seen.add(k); return false; });
      if (dup.length) issues.push({ kind: 'duplicate-player', message: `${[...new Set(dup)].join(', ')} appears twice in this game.` });
    }
    const ready = !issues.length && flat.length === 4 && flat.every(Boolean);
    return { ready, issues, teams: picked, players: flat };
  }

  return { parse, parseLine, resolveName, review, SELF };
});
