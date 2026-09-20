# Islamic Society Hub

A public event calendar + team workspace, styled deep green and gold.
`index.html` + `style.css` + `app.js` is the whole front end — no build step.
`functions/` is one small Cloud Function that sends real emails.

Opening `index.html` directly (double-click) runs it in **demo mode**: sample
data, nothing saved. Follow the steps below to connect your Firebase project
so it's live for real.

## 1. Firebase project

In the [Firebase console](https://console.firebase.google.com):
1. Use your existing project (or create one).
2. **Build → Authentication → Sign-in method** → enable **Google**.
3. **Build → Firestore Database** → create a database, **production mode**,
   pick a region near your users.
4. **Project settings → General → Your apps** → add a **Web app** (the `</>`
   icon) → copy the `firebaseConfig` object it gives you.

Paste those four values into the top of `app.js`:
```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  appId: "..."
};
```
These are safe to be public — the Firestore rules below are what actually
protect the data, not this config.

## 2. Run it locally

Browsers block ES module imports from `file://`, so serve the folder instead
of opening the file directly. From this folder, any of these work:
```bash
npx serve .
# or
python3 -m http.server 5173
```
Then open the URL it gives you (e.g. `http://localhost:5173`).

## 3. Install the Firebase CLI and connect the project

```bash
npm install -g firebase-tools
firebase login
cd isoc-hub
firebase use --add        # pick your project, give it the alias "default"
```
This also updates `.firebaserc` — you can ignore the `PASTE_PROJECT_ID`
placeholder already in there once you've run this.

## 4. Deploy the security rules

```bash
firebase deploy --only firestore:rules
```
Without this, nobody (not even the team) can read or write anything —
Firestore denies by default.

## 5. Add yourself as the first team member

The app decides who's "team" by looking for a document in the `team`
collection whose ID is your Google account's email. Nobody can create that
first document through the app (chicken-and-egg — only team members can
write to `team`), so add it by hand once:

1. Firestore Database → **Start collection** → ID `team`.
2. Document ID: your Google email, **exactly as it appears in your Google
   account, lowercase** (e.g. `you@gmail.com`).
3. Fields: `email` (string, same value) and `name` (string, your name).

Now sign in with that Google account in the app and you'll see the **Team
workspace** tab. From there, use **Members → Add someone** to add the rest
of the committee the normal way.

## 6. Seed your events

The first time a team member signs in with an empty database, the app
automatically loads your full list of event ideas as **drafts** (nothing
public yet), each with the notes/tasks you gave me for tatreez, sisters'
night in, etc. Open **Team workspace → Events**, fill in a date and details,
then hit **Publish** when it's ready for everyone to see — that also
triggers the email step below.

## 7. Real email notifications

Cloud Functions need an SMTP account to send mail through. Two easy options:

- **Gmail** (fine for a small list): turn on 2-Step Verification on the
  sending Google account, then create an
  [App Password](https://myaccount.google.com/apppasswords). Use:
  - `SMTP_HOST` = `smtp.gmail.com`
  - `SMTP_PORT` = `465`
  - `SMTP_USER` = that Gmail address
  - `SMTP_PASS` = the 16-character app password
- **SendGrid / Mailgun / Resend** (better for a bigger list — free tiers
  cover a few hundred emails a day): create an account, verify a sender
  domain or address, and use the SMTP credentials they give you.

Set the secrets and deploy:
```bash
firebase functions:secrets:set SMTP_HOST
firebase functions:secrets:set SMTP_PORT
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
firebase functions:secrets:set FROM_EMAIL      # e.g. "ISOC <you@gmail.com>"
firebase functions:secrets:set SITE_URL        # e.g. https://your-project.web.app

cd functions
npm install
cd ..
firebase deploy --only functions
```
Each command will prompt you to type the value and press enter.

**This needs the Blaze (pay-as-you-go) plan** — Cloud Functions can't make
outbound network calls (i.e. talk to an SMTP server) on the free Spark plan.
For a society mailing list this normally stays within the free monthly
quota Blaze still includes, so it's usually $0.

From here on:
- Publishing a draft event (false → true) emails every subscriber.
- Posting a team announcement emails every subscriber.
- Anyone can subscribe from the **Email updates** box on the Home page —
  no Google account required, just an email address.

To see it work locally, use `firebase emulators:start` with the Functions
and Firestore emulators, or just deploy (`firebase deploy --only functions`)
and test against the live project — either works.

## 8. Put it online (optional)

```bash
firebase deploy --only hosting
```
Gives you a `https://your-project.web.app` link anyone can open. If you
used a `SITE_URL` secret above, set it to this URL so the email footer link
is correct.

## Notes

- **Calendar view**: the Calendar tab shows a month grid of every published
  event, filterable by category, plus a "This month" list and a "dates to
  be announced" section for anything without a date yet.
- **Who sees what**: everyone gets the public dashboard (Home, Calendar,
  Ask & suggest). Only accounts listed in the `team` collection get the
  Team workspace tab — Firestore rules enforce this server-side, not just
  in the UI, so it can't be bypassed from the browser.
- **In-app pop-ups vs. email**: the bell icon turns on browser pop-ups while
  the tab is open (good for last-minute reminders). The Home page email box
  is separate and works even with the app closed — that's the one this
  Cloud Function powers.
- Want to change the colours? They're CSS variables at the top of
  `style.css` (`--bg`, `--gold`, `--gold-br`, `--amber`, plus one accent
  colour per event category further down).
