# Player codes

Players sign in with a personal code instead of an email and password
(Shaun, 19 Nov). Switched on for Padel Championships first
(`playerAccounts: true` in `assets/js/config/club.js`).

## One-off setup (per community, in its Firebase console)

1. **Publish the database rules.** Firestore Database › Rules: paste the whole
   of `firestore.rules` from this repository, then **Publish**. They add
   `playerAccounts`, `playerCodes`, `playerLogins`, `availability` and
   `pushSubscriptions` (Admins
   only, except a player may read their own account entry, anyone may look up
   which sign-in a name uses, and anyone may read when players can play, which
   only that player or an Admin may change).
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

## When I can play

A signed-in player: Who are you? › **When I can play**. A week of morning /
afternoon / evening, plus dates that are different (not free, or free at a
time). An Admin can set anyone's from Admin › Player codes › **Times**. When a
game is arranged with a date, the app shows who is free then.

## Notifications

**One-off, in Vercel:** Settings › Environment Variables › add
`VAPID_PRIVATE_KEY` (the private key Claude Code gave you; never commit it),
ticked for **Production** and **Preview**, then redeploy. The public half is in
`lib/notify/push.js` and `features/players/notificationsScreen.js`.

A signed-in player: Who are you? › **Notifications** › Turn on. On an iPhone the
app must be added to the Home Screen (Share › Add to Home Screen) and opened
from there first; the sheet says so. They are told when someone asks them to
play, when all four are in, when a court is booked, and when a game is
cancelled — never about something they did themselves. **Send me a test**
checks it end to end.

## Messages

**One-off, in Firebase:** publish the latest `firestore.rules` (Firestore
Database › Rules › paste › Publish). It adds `threads`: without it, sending a
message says "Couldn't send. Publish the latest database rules".

A player signed in with their code taps the speech bubble in the header:
their conversations, newest first, a dot on the unread ones, and **New
message** to start one with any player. A game's sheet has **Chat with the
four**; a player tapped in Rankings has **Message**. Each message notifies the
others (if they have notifications on).

Only the players in a conversation can read it. Admins have no special
access: an Admin sees a game chat only when they are one of its four, as their
own player.

## Suggesting a game (Admins)

Arrange a Game › Agreed › fill in the four (and a date, time, venue if known)
› **Not agreed yet? Suggest it to all four**. Each of the four gets a
"Suggested game" notification and answers Yes / Can't in Play › Needs you;
when all four say yes it becomes a game, as any request does.
