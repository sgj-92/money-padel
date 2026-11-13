# Ask Claude (Admins only)

Admin › **Ask Claude** answers questions about the club's record: results,
head to heads, streaks, scores, ratings, tiers. Claude works each answer out
with code over the club's matches and ratings.

## Switching it on (about 5 minutes, once)

1. Go to <https://console.anthropic.com> and sign in (or create an account).
2. **Billing**: add a card and some credit (e.g. $10). Each question costs a
   few pence.
3. **API keys › Create key**. Call it `money-padel`. Copy the key (it starts
   `sk-ant-`). It is shown once.
4. Go to Vercel › the `money-padel` project › **Settings › Environment
   Variables**:
   - Key: `ANTHROPIC_API_KEY`
   - Value: the key from step 3
   - Environments: Production (and Preview if you like)
   - Save.
5. **Deployments** › the latest Production deployment › **⋯ › Redeploy**.
   - A new variable only reaches a new deployment.

One key serves every community: Money Padel and Padel Championships both
use it, each asking only about its own record.

## Who can use it

- Only someone signed in with their own Admin account. The server checks
  the sign-in against the community's `admins` list before anything is sent.
- The old shared Admin password can't be used for this.
- The key lives only in Vercel. It is never in the app or the page.

## Saved questions

- Every conversation is saved for the community's Admins: Admin › Ask
  Claude › **Previous questions**.
- Any Admin can reopen one to keep asking, or delete it (✕).
- They are stored in the community's own database under `askClaude`, which
  only Admins can read (firestore.rules). Publish the rules once for this.

## What is sent

Each question sends the community's record to Anthropic's API:

- players, tiers and ratings
- every rated match with its sets
- the rating history
- Admin notes on results

Nothing else is sent: no passwords, accounts or poll codes. The files are
deleted as soon as the answer is back, and they expire within the hour
regardless.

## Cost

- Pay as you go, billed to the Anthropic account. Roughly 2–15p a question.
- To cap spending, set a monthly limit in console.anthropic.com
  (Settings › Limits).
- To switch it off, delete the `ANTHROPIC_API_KEY` variable in Vercel and
  redeploy.
