// ===================== ASK CLAUDE: THE CALL =====================
// One question (with the conversation so far) -> one answer. The club's data
// goes up as three CSV files into Claude's code-execution sandbox, so counts
// and averages are computed, not estimated. Files expire on their own within
// the hour and are deleted as soon as the answer is back.

'use strict';

const MODEL = 'claude-opus-5-5';

function systemPrompt(club) {
  const p = club.period || { months: 1, noun: 'month' };
  return [
    `You answer an Admin's questions about ${club.name}, a padel community, using its own match record.`,
    '',
    'The record is in three CSV files in your sandbox: players.csv, matches.csv and rating_journey.csv. Always load them with code and compute the answer; never estimate a number by reading. Doubles is two players a side; singles leaves the second columns empty.',
    '',
    'What the columns mean:',
    '- matches.csv: one row per rated match, oldest first. For a decided match side A is the winning side. "draw (not finished)" means the match was not completed or was tied; on a draw the sides are arbitrary, so never call side A the winner. sets is "6-4 3-6" from side A\'s point of view; sets_a/sets_b and games_a/games_b are totals.',
    '- A forfeit: forfeit_by quit; the match counts as a loss for them and a win for side A; the partner named in forfeit_partner_left_out is not counted at all in that match.',
    '- A late arrival: late_by arrived late, so their side started a set down. The result already includes that set (the set adds no games). late_on_time_partner is rated on late_played_result instead and is left out of tables for that match.',
    '- asterisk / note: an Admin\'s mark and comment on a result (disputes, injuries, etc.).',
    '- players.csv: current tier (S strongest, then A, B, C), Power Rating, reliability (0-1, how settled the rating is), rated matches, and whether the player is still active.',
    '- rating_journey.csv: every rating event. MATCH_UPDATE rows are one player in one match: rating before and after, change, the expected score going in and the actual score (actual = 0.8 x share of games won + 0.2 x result, where a win is 1, a draw 0.5, a loss 0). PROMOTION / DEMOTION / CLUB_RATING_REASSESSMENT / PLAYER_INITIALISED rows are tier and rating decisions; new_tier is the tier after. tier_at_event is the tier the player held at that match.',
    '',
    `Periods: the club's tables run by the ${p.noun}${p.months === 3 ? ' (Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec)' : ''}. A player needs ${club.periodMinMatches || 5} matches in a ${p.noun} to qualify for its tables.`,
    'Merit points (the Merit Table): a win against an evenly matched pairing is 3 points; each tier-step the opponents are stronger adds 1, each step weaker takes 1, never below 0; draws and losses are 0. Hard / Even / Fav count wins against a stronger / evenly matched / weaker pairing. The Monthly Race scores each match by how hard it was going in. The app\'s own Merit, Race and League tables are the official figures; if you reconstruct one, say it is your reconstruction.',
    '',
    'How to answer:',
    '- Lead with the answer in a sentence or two, then the figures behind it. Keep it short: it is often copied to a WhatsApp group.',
    '- Plain text. Use "- " lists for several items; no tables, no headings, no code.',
    '- Say what you counted when it matters (which dates, whether draws were included, which tier).',
    '- Use the names exactly as in the files. If a name in the question is close to one in the files, say which player you took it to mean.',
    '- If the record cannot answer the question, say so and say what it can tell you instead. Never invent a match, a score or a player.',
  ].join('\n');
}

function textOf(message) {
  return (message.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}

// history: [{ role: 'user'|'assistant', text }] -- earlier turns, text only.
async function ask({ client, club, question, history, files, today }) {
  const uploaded = [];
  try {
    for (const f of files) {
      const { toFile } = require('@anthropic-ai/sdk');
      const meta = await client.files.upload({
        file: await toFile(Buffer.from(f.text, 'utf8'), f.filename, { type: 'text/csv' }),
        expires_in_seconds: 3600,
      });
      uploaded.push(meta.id);
    }
    const messages = (history || []).slice(-10).map((h) => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: String(h.text || '') }))
      .filter((m) => m.content);
    // The files ride with the new question: the sandbox is fresh each time.
    messages.push({ role: 'user', content: [
      ...uploaded.map((id) => ({ type: 'container_upload', file_id: id })),
      { type: 'text', text: `Today is ${today}.\n\n${question}` },
    ] });

    const params = {
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      // On a policy decline, another model answers instead of none.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: systemPrompt(club),
      tools: [{ type: 'code_execution_20260521', name: 'code_execution' }],
      messages,
    };
    let message;
    let container = null;
    for (let turn = 0; turn < 6; turn++) {
      message = await client.beta.messages.create(container ? { ...params, container } : params);
      if (message.container && message.container.id) container = message.container.id;
      if (message.stop_reason !== 'pause_turn') break;
      // A long piece of work paused; hand it back so it carries on.
      params.messages = params.messages.concat([{ role: 'assistant', content: message.content }]);
    }
    if (message.stop_reason === 'refusal') return { answer: 'Claude declined to answer that question.', usage: message.usage };
    const answer = textOf(message);
    return { answer: answer || 'No answer came back. Try asking again, perhaps more simply.', usage: message.usage, model: message.model };
  } finally {
    await Promise.all(uploaded.map((id) => client.files.delete(id).catch(() => null)));
  }
}

module.exports = { ask, systemPrompt, MODEL };
