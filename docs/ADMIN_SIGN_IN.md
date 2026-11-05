# Admin sign-in: setting it up in Firebase

Each Admin signs in with their own email and password. The database only
lets those accounts change results, tiers and everything else Admins
change. Members don't sign in and carry on as now: they can still submit
games, add Upcoming games and wishlist entries, send Find a Game
challenges and write development notes.

Do this once for each community, in its own Firebase project. For Money
Padel that is **`mp-dashboard-beta-v3`**. It takes about ten minutes.
Nothing changes for anyone until step 5, and the shared Admin password
keeps working until then.

## 1. Switch on email and password sign-in

1. Open <https://console.firebase.google.com> and choose the project.
2. In the left menu, go to **Build › Authentication**. Click **Get started** if asked.
3. Open the **Sign-in method** tab and choose **Email/Password**.
4. Turn on the first switch, **Email/Password**. Leave **Email link** off.
5. Click **Save**.
6. Open the **Settings** tab, then **User actions**.
7. Untick **Enable create (sign-up)** and click **Save**.

Step 7 means only accounts you make yourself can exist.

## 2. Make an account for each Admin

1. Open the **Users** tab and click **Add user**.
2. Enter the Admin's email and a starting password. They can change it
   later from the app.
3. In the list, copy that user's **User UID** (the long code). You need it
   in the next step.

Repeat for each Admin.

## 3. Say who is an Admin

1. In the left menu, go to **Build › Firestore Database**, then the **Data** tab.
2. Click **Start collection** and call it **`admins`**. For the second and
   later Admins, open `admins` and click **Add document** instead.
3. For **Document ID**, paste the Admin's **User UID**.
4. Add two fields, both of type *string*:
   - `role`: `owner` (you) or `board` (everyone else)
   - `name`: their name as it appears in the app, e.g. `Shaun`
5. Click **Save**.

An account with no entry here can't sign in as Admin. The app tells them
so and signs them straight out.

## 4. Check that everyone can sign in

1. Open the app and go to **More › Admin**, or **Results › Add a game**.
   The lock now asks for an email and password.
2. Sign in. **More › Admin › Admin account** should say *Signed in as … ·
   Owner* (or *Board*).
3. **Sign out and lock** signs you out on that phone.
4. **Change my password** sends a reset email. So does **Forgot your
   password?** on the sign-in screen.

Once every Admin has signed in successfully, tell Claude Code.

## 5. Publish the database rules

This is the step that makes the database secure.

1. Go to **Firestore Database › Rules**.
2. Replace everything there with the contents of
   [`firestore.rules`](../firestore.rules) from the repository.
3. Click **Publish**.

From then on:

- Only signed-in Admins can change Admin data.
- The old shared password stops working for changes, so Claude Code
  removes it from the app at the same time.
- Anyone still unlocked with the shared password on their phone gets
  *"Save failed"* until they sign in with their own account.

**If something goes wrong:** the Rules tab keeps a history. Pick the
previous version and publish it to undo straight away.

## What the rules allow

| Who | What |
|---|---|
| Anyone | Read everything the app, the standings site and the Monthly Reviews show |
| Members (no sign-in) | Write game submissions, Upcoming/wishlist games, Find a Game challenges, development notes, and the app's automatic health reports |
| Signed-in Admins | Everything else: approving and rating games, edits, deletions, tiers, settings, honours, Board Packs, published reviews, player packs |
| Nobody | Make or change an Admin. That is only done in the console (step 3) |

## Known limits

- **Members' documents are still open.** Anyone could overwrite the
  pending submissions or Upcoming list. They can't change results or
  ratings, and an Admin approves every game. Fully closing this needs
  member sign-in, which is planned with the Invitational group.
- **Claude Code's repair and import scripts** (`scripts/moneypadel/`) write
  without signing in. Once the rules are published, those writes need an
  Admin sign-in added first. Their dry runs and reports only read, so they
  still work.
