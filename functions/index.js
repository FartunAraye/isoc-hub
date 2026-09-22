/**
 * Real email notifications.
 *
 * Two triggers:
 *  - onEventPublished: fires when a doc in /events goes from published:false -> true
 *  - onAnnouncementPosted: fires when a new doc is created in /announcements
 *
 * Both read every doc in /subscribers and send one email via SMTP, BCC'd in
 * batches so no subscriber sees anyone else's address.
 *
 * Setup (see README.md for the full walkthrough):
 *   firebase functions:secrets:set SMTP_HOST
 *   firebase functions:secrets:set SMTP_PORT
 *   firebase functions:secrets:set SMTP_USER
 *   firebase functions:secrets:set SMTP_PASS
 *   firebase functions:secrets:set FROM_EMAIL
 *   firebase functions:secrets:set SITE_URL      (e.g. https://your-project.web.app)
 *   cd functions && npm install
 *   firebase deploy --only functions
 *
 * Requires the Blaze (pay-as-you-go) plan — Cloud Functions can't reach the
 * internet (to talk to an SMTP server) on the free Spark plan. This is
 * normally pennies a month for a society-sized mailing list.
 */
const { onDocumentUpdated, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

const SMTP_HOST = defineSecret("SMTP_HOST");
const SMTP_PORT = defineSecret("SMTP_PORT");
const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");
const FROM_EMAIL = defineSecret("FROM_EMAIL");
const SITE_URL = defineSecret("SITE_URL");

const SECRETS = [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL, SITE_URL];
const BATCH = 80; // max BCC recipients per email — safe for most SMTP providers

function transporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST.value(),
    port: Number(SMTP_PORT.value()) || 587,
    secure: Number(SMTP_PORT.value()) === 465,
    auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() }
  });
}

async function subscriberEmails() {
  const snap = await db.collection("subscribers").get();
  return snap.docs.map((d) => d.data().email).filter(Boolean);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function sendToAll(subject, html, text) {
  const emails = await subscriberEmails();
  if (!emails.length) return logger.info("No subscribers yet — nothing to send.");
  const t = transporter();
  const from = FROM_EMAIL.value();
  for (const group of chunk(emails, BATCH)) {
    try {
      await t.sendMail({ from, to: from, bcc: group, subject, html, text });
    } catch (err) {
      logger.error("Failed sending to a batch of subscribers", err);
    }
  }
  logger.info(`Sent "${subject}" to ${emails.length} subscriber(s).`);
}

const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function wrap(title, bodyHtml) {
  const site = SITE_URL.value();
  return `<div style="font-family:Georgia,serif;background:#f4f0e6;color:#293225;padding:28px">
    <div style="max-width:520px;margin:0 auto;background:#fbf9f3;border:1px solid #d9cdb4;border-radius:9px;padding:26px">
      <h1 style="font-size:22px;margin:0 0 14px;color:#293225">${h(title)}</h1>
      <div style="font-size:14px;line-height:1.6">${bodyHtml}</div>
      <p style="margin-top:24px"><a href="${site}" style="color:#8f6f38">Open the hub</a></p>
    </div></div>`;
}

exports.onEventPublished = onDocumentUpdated({ document: "events/{eventId}", secrets: SECRETS }, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (before.published || !after.published) return; // only fire on the false -> true transition

  const when = after.start ? new Date(after.start).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }) : "Date to be announced";
  const html = wrap(after.title, `<p>${after.blurb || ""}</p><p style="color:#93aa9c;margin-top:12px">${when}${after.location ? ` · ${after.location}` : ""}</p>`);
  await sendToAll(`New event: ${after.title}`, html, `${after.title}\n${when}\n${after.blurb || ""}`);
});

exports.onAnnouncementPosted = onDocumentCreated({ document: "announcements/{postId}", secrets: SECRETS }, async (event) => {
  const a = event.data.data();
  const html = wrap(a.title, `<p>${a.body || ""}</p>`);
  await sendToAll(a.title, html, `${a.title}\n\n${a.body || ""}`);
});
