# Launching a new community (Padel Championships first)

The app already knows Padel Championships: its name, logo, Royal Amethyst
colours, quarters, 4-match minimum and its two addresses. It goes live once
these four things exist. Only you can do them, in your own accounts.

## 1. Its own Firebase project (about 10 minutes)

Its data must live apart from Money Padel's.

1. Go to <https://console.firebase.google.com> and click **Add project**.
   Call it e.g. `padel-championships`. Google Analytics is not needed.
2. Go to **Build › Firestore Database › Create database**. Choose **Production
   mode** and a location near Dubai, e.g. `me-central2` (Dammam).
3. Click **Project settings** (the cog), then under **Your apps** click the
   **web** icon (`</>`). Name it `Padel Championships` and leave Hosting off.
4. Firebase shows a `firebaseConfig` block. Send it to Claude Code.
   - It is not a secret: every web app ships it to the browser.
   - The database rules are what protect the data.
5. Set up Admin sign-in exactly as for Money Padel, in this project:
   [`ADMIN_SIGN_IN.md`](ADMIN_SIGN_IN.md) steps 1–3 and 5.
   - Do step 4 (signing in) once Claude Code has added the config.

## 2. The two addresses (about 5 minutes, plus DNS time)

1. Go to Vercel › the `money-padel` project › **Settings › Domains**.
2. Add `padelchamps.sgj.luxe` and `pcstandings.sgj.luxe`. Both serve
   Production, like `moneypadel.sgj.luxe`.
3. Add the DNS records Vercel shows (usually a `CNAME` to
   `cname.vercel-dns.com`) wherever `sgj.luxe` is managed.

The app recognises each address by name, so nothing else is needed:

- `padelchamps.…` is the full Padel Championships app.
- `pcstandings.…` is its read-only standings site.

## 3. The players

Send Claude Code the players and each one's starting tier (S, A, B or C).
They are set up the way Money Padel's were. Ratings start from each tier's
baseline and move with every game.

## 4. Past results (optional)

If there are earlier results worth keeping, send them in any form: a
spreadsheet, a WhatsApp export or a list. Claude Code imports them as
history before launch, so the first quarter starts with real ratings.

For the Invitational group's past results, wait. They go in with the
Invitational step, once it's decided who may see them.
