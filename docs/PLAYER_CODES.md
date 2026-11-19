# Player codes

Players sign in with a personal code instead of an email and password
(Shaun, 19 Nov). Switched on for Padel Championships first
(`playerAccounts: true` in `assets/js/config/club.js`).

## One-off setup (per community, in its Firebase console)

1. **Publish the database rules.** Firestore Database › Rules: paste the whole
   of `firestore.rules` from this repository, then **Publish**. They add
   `playerAccounts`, `playerCodes` and `playerLogins` (Admins only, except a
   player may read their own account entry, and anyone may look up which
   sign-in a name uses).
2. **Allow the app to make accounts.** Authentication › Settings › User
   actions: **Enable create (sign-up)** must be ticked. It is on by default.
   Email/Password sign-in is already on (the Admin accounts use it).
3. **Password policy.** Authentication › Settings › Password policy: leave it
   off (or at a 6-character minimum with no other requirements), so a player
   can choose 6 digits of their own.

## Making codes

Admin › **Player codes**: **Make code** beside a player, then **Copy message**
and send it to them on WhatsApp. **New code** replaces a lost or shared code;
the old one stops working at once.

A signed-in player can change their code to **6 digits of their own**: Who are
you? › Change code (current code once, new digits twice). Runs and repeated
digits (123456, 111111) are refused. Admin › Player codes then shows "chose
their own code"; the Admin never sees it. If they forget it, make a New code.

## How it works

Each player has an ordinary Firebase account with a made-up email
(`p<random>@players.sgj.luxe`, not a real mailbox, listed in `playerLogins` by
name) whose password is their code. The player taps their name and types only
the code. Firebase slows down repeated wrong attempts. Which player an account belongs to is written by an Admin in
`playerAccounts/{uid}`; a replaced code's account loses that entry and signs in
to nothing. Replaced accounts stay in Authentication › Users and can be deleted
there at any time; nothing depends on them.
