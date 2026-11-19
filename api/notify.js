// ===================== POST /api/notify -- NOTIFY PLAYERS' PHONES =====================
// Shaun, 19 Nov: players "receive notifications". Decided: phone notifications.
//
//   body: { to: [names], title, body, tag?, url? }
//   header: Authorization: Bearer <the signed-in player's or Admin's Firebase ID token>
//
// The page calls this after a change to a game (domain/fixtures/fixtureNotices.js
// says who to tell). The community is the one whose address it came to.
// Switched on by VAPID_PRIVATE_KEY in Vercel; without it nothing is sent.

'use strict';

const { resolveClub } = require('../assets/js/config/club.js');
const Push = require('../lib/notify/push.js');

const MAX_TO = 12;

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

const clip = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

async function handler(req, res, deps) {
  const d = deps || {};
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  const hostname = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(':')[0];
  const club = (d.resolveClub || resolveClub)({ hostname, search: '' });
  if (!club.firebase || !club.firebase.projectId) return send(res, 503, { error: `${club.name} has no database yet.` });
  if (!club.playerAccounts) return send(res, 503, { error: `${club.name} has no player notifications yet.` });

  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const fetchImpl = d.fetch || globalThis.fetch;
  const who = await Push.whoIsAsking({ token, projectId: club.firebase.projectId, fetchImpl });
  if (!who.ok) return send(res, who.status, { error: who.message });

  const privateKey = d.privateKey !== undefined ? d.privateKey : process.env.VAPID_PRIVATE_KEY;
  if (!privateKey) return send(res, 503, { error: 'Notifications aren’t switched on for this deployment: VAPID_PRIVATE_KEY must be set in Vercel › Settings › Environment Variables, then redeploy.' });

  const body = await readBody(req);
  const to = [...new Set((Array.isArray(body.to) ? body.to : []).map((n) => clip(n, 60)).filter(Boolean))].slice(0, MAX_TO);
  const title = clip(body.title, 60), text = clip(body.body, 240);
  if (!to.length || !title) return send(res, 400, { error: 'Nobody to tell, or nothing to say.' });

  const subs = await Push.subscriptionsFor({ names: to, token, projectId: club.firebase.projectId, fetchImpl });
  const site = `https://${hostname}`;
  const icon = club.homeIcon ? `${site}/${club.homeIcon[180]}` : undefined;
  const payload = { title: `${club.homeScreenTitle || club.name} · ${title}`, body: text, tag: clip(body.tag, 80) || undefined, url: '/', icon };
  const webpush = d.webpush || require('web-push');
  const out = await Push.sendAll({ subs, payload, privateKey, subject: site, webpush, token, fetchImpl });
  return send(res, 200, { ...out, phones: subs.length, from: who.name });
}

module.exports = (req, res) => handler(req, res);
module.exports.handler = handler;
