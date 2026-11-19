# Player codes

Players sign in with a personal code instead of an email and password
(Shaun, 19 Nov). Switched on for Padel Championships first
(`playerAccounts: true` in `assets/js/config/club.js`).

## One-off setup (per community, in its Firebase console)

1. **Publish the database rules.** Firestore Database › Rules: paste the whole
   of `firestore.rules` from this repository, then **Publish**. They add
   `playerAccounts` and `playerCodes` (Admins only, except a player may read
   their own account entry).
2. **Allow the app to make accounts.** Authentication › Settings › User
   actions: **Enable create (sign-up)** must be ticked. It is on by default.
   Email/Password sign-in is already on (the Admin accounts use it).

## Making codes

Admin › **Player codes**: **Make code** beside a player, then **Copy message**
and send it to them on WhatsApp. **New code** replaces a lost or shared code;
the old one stops working at once.

## How it works

Each code is an ordinary Firebase account whose email (`<code>@players.sgj.luxe`,
not a real mailbox) and password are made from the code. The player only ever
types the code. Which player an account belongs to is written by an Admin in
`playerAccounts/{uid}`; a replaced code's account loses that entry and signs in
to nothing. Replaced accounts stay in Authentication › Users and can be deleted
there at any time; nothing depends on them.
