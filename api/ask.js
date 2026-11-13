// ===================== POST /api/ask -- ASK CLAUDE (ADMINS ONLY) =====================
// Shaun, 13 Nov: "ask Claude questions about the data, for admins only."
//
//   body: { question, history?: [{ role, text }] }
//   header: Authorization: Bearer <the signed-in Admin's Firebase ID token>
//
// The community is the one whose address the request came to. Switched on by
// the ANTHROPIC_API_KEY environment variable in Vercel; without it the answer
// says so and nothing is sent anywhere.

'use strict';

const { resolveClub } = require('../assets/js/config/club.js');
const { verifyAdmin } = require('../lib/askClaude/admin.js');
const { loadRecord } = require('../lib/askClaude/load.js');
const Dataset = require('../lib/askClaude/dataset.js');
const { ask } = require('../lib/askClaude/ask.js');

const MAX_QUESTION = 2000;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { return {}; }
}

async function handler(req, res, deps) {
  const d = deps || {};
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  const hostname = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(':')[0];
  const club = (d.resolveClub || resolveClub)({ hostname, search: '' });
  if (!club.firebase || !club.firebase.projectId) return send(res, 503, { error: `${club.name} has no database yet.` });

  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const who = await verifyAdmin({ token, projectId: club.firebase.projectId, fetchImpl: d.fetch });
  if (!who.ok) return send(res, who.status, { error: who.message });

  const apiKey = d.apiKey !== undefined ? d.apiKey : process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return send(res, 503, { error: 'Ask Claude isn’t switched on yet: add ANTHROPIC_API_KEY in Vercel › Settings › Environment Variables, then redeploy.' });

  const body = await readBody(req);
  const question = String(body.question || '').trim();
  if (!question) return send(res, 400, { error: 'Type a question first.' });
  if (question.length > MAX_QUESTION) return send(res, 400, { error: `Keep the question under ${MAX_QUESTION} characters.` });
  const history = Array.isArray(body.history) ? body.history.slice(-10)
    .map((h) => ({ role: h && h.role === 'assistant' ? 'assistant' : 'user', text: String((h && h.text) || '').slice(0, 8000) })) : [];

  try {
    const record = await loadRecord({ projectId: club.firebase.projectId, fetchImpl: d.fetch });
    const files = Dataset.build(record);
    const client = d.client || new (require('@anthropic-ai/sdk').default)({ apiKey });
    const today = new Date().toISOString().slice(0, 10);
    const out = await (d.ask || ask)({ client, club, question, history, files, today });
    return send(res, 200, { answer: out.answer, model: out.model || null });
  } catch (e) {
    const status = e && e.status;
    const msg = status === 401 ? 'The Anthropic API key was refused. Check ANTHROPIC_API_KEY in Vercel.'
      : status === 429 ? 'Claude is busy right now. Try again in a minute.'
      : status === 400 && /credit|billing/i.test(String(e.message)) ? 'The Anthropic account is out of credit. Top it up at console.anthropic.com.'
      : 'Claude couldn’t answer just now. Try again in a moment.';
    console.error('ask failed', status, e && e.message);
    return send(res, 502, { error: msg });
  }
}

module.exports = (req, res) => handler(req, res);
module.exports.handler = handler;
