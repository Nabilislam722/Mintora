import crypto from "crypto";
import { requireAuth } from "../lib/auth.js";
import { EmailSubscription, emailSettings } from "../models/EmailSubscription.js";
import { sendEmail, confirmEmail, emailPage, emailConfigured, SITE_URL } from "../lib/email.js";

const CONFIRM_TTL = 24 * 60 * 60_000;
const RESEND_WAIT = 60_000;
const MAX_EMAIL = 254;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SETTINGS_LINK = { label: "Open settings", url: `${SITE_URL}/settings` };

const EXPIRED_PAGE = emailPage({ title: "This link has expired", text: "Confirm links work once, for 24 hours. Enter your email again in Mintora's settings to get a new one.", link: SETTINGS_LINK });
const UNKNOWN_LINK_PAGE = emailPage({ title: "Link not recognized", text: "Turn emails off in Mintora's settings instead.", link: SETTINGS_LINK });

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// The signed-in wallet if it's the one in the URL; otherwise answers 403 and returns null
function ownWallet(req, res) {
    const address = req.params.address.toLowerCase();
    if (address === req.wallet) return address;
    res.status(403).json({ message: "You can only change your own email settings." });
    return null;
}

// The subscription a confirm link belongs to, if the link is still good
const pendingFor = (token) =>
    EmailSubscription.findOne({ confirmTokenHash: sha256(String(token ?? "")), confirmExpiresAt: { $gt: new Date() } });

const byUnsubscribeToken = (token) => EmailSubscription.findOne({ unsubscribeToken: String(token ?? "") });

// Email notification settings, and the pages the links in the emails open
export function registerEmailRoutes(app) {
    // The signed-in wallet's email settings
    app.get("/api/users/:address/email", requireAuth, async (req, res) => {
        const address = ownWallet(req, res);
        if (!address) return;
        try {
            res.json(emailSettings(await EmailSubscription.findOne({ walletAddress: address }).lean()));
        } catch (err) {
            res.status(500).json({ message: "Could not load your email settings." });
        }
    });

    // Sets the address to email and sends it a confirm link; emails start once it's clicked. "" removes the email.
    app.put("/api/users/:address/email", requireAuth, async (req, res) => {
        const address = ownWallet(req, res);
        if (!address) return;
        const email = String(req.body?.email ?? "").trim().toLowerCase();
        if (email && (email.length > MAX_EMAIL || !EMAIL_SHAPE.test(email)))
            return res.status(400).json({ message: "Enter a valid email address." });

        try {
            const current = await EmailSubscription.findOne({ walletAddress: address }).lean();
            const clearPending = { $unset: { confirmTokenHash: "", confirmExpiresAt: "" } };

            if (!email || email === current?.email) {
                const s = await EmailSubscription.findOneAndUpdate(
                    { walletAddress: address },
                    { $set: { pendingEmail: "", ...(!email && { email: "" }) }, ...clearPending },
                    { returnDocument: "after" }
                ).lean();
                return res.json(emailSettings(s));
            }

            if (!emailConfigured()) return res.status(503).json({ message: "Email isn't set up on this server yet." });
            if (current?.confirmSentAt > Date.now() - RESEND_WAIT)
                return res.status(429).json({ message: "We just sent a link. Wait a minute before asking for another." });

            const token = crypto.randomBytes(32).toString("base64url");
            const s = await EmailSubscription.findOneAndUpdate(
                { walletAddress: address },
                {
                    $set: {
                        pendingEmail: email,
                        confirmTokenHash: sha256(token),
                        confirmExpiresAt: new Date(Date.now() + CONFIRM_TTL),
                        confirmSentAt: new Date(),
                    },
                },
                { upsert: true, returnDocument: "after" }
            ).lean();

            try {
                await sendEmail({ to: email, ...confirmEmail(token) });
            } catch (err) {
                console.error("Confirm email failed:", err.message);
                await EmailSubscription.updateOne({ walletAddress: address }, { $unset: { confirmSentAt: "" } });
                return res.status(502).json({ message: "Could not send the confirmation email. Try again in a moment." });
            }
            res.json(emailSettings(s));
        } catch (err) {
            console.error("Email settings error:", err);
            res.status(500).json({ message: "Could not save your email." });
        }
    });

    // Turns each kind of email on or off; fields left out stay as they are
    app.patch("/api/users/:address/email", requireAuth, async (req, res) => {
        const address = ownWallet(req, res);
        if (!address) return;
        const update = {};
        for (const key of ["offers", "sales"]) {
            const value = req.body?.[key];
            if (value === undefined) continue;
            if (typeof value !== "boolean") return res.status(400).json({ message: `${key} must be true or false.` });
            update[key] = value;
        }
        try {
            const s = await EmailSubscription.findOneAndUpdate(
                { walletAddress: address },
                { $set: update },
                { upsert: true, returnDocument: "after" }
            ).lean();
            res.json(emailSettings(s));
        } catch (err) {
            res.status(500).json({ message: "Could not save your email settings." });
        }
    });

    // Mail scanners open links on their own, so a GET only shows a button; the POST does the work

    app.get("/api/email/confirm", async (req, res) => {
        const s = await pendingFor(req.query.token).lean().catch(() => null);
        if (!s) return res.status(400).send(EXPIRED_PAGE);
        res.send(emailPage({ title: "Confirm your email", text: `Send Mintora notifications to ${s.pendingEmail}?`, action: "Confirm email" }));
    });

    app.post("/api/email/confirm", async (req, res) => {
        try {
            const s = await pendingFor(req.query.token);
            if (!s) return res.status(400).send(EXPIRED_PAGE);
            const email = s.pendingEmail;
            await EmailSubscription.updateOne(
                { _id: s._id },
                { $set: { email, pendingEmail: "" }, $unset: { confirmTokenHash: "", confirmExpiresAt: "" } }
            );
            res.send(emailPage({ title: "Email confirmed", text: `Mintora will email ${email} about offers and sales. Choose which emails you get in settings.`, link: SETTINGS_LINK }));
        } catch (err) {
            res.status(500).send(emailPage({ title: "Something went wrong", text: "Your email isn't confirmed yet. Try the link again in a moment." }));
        }
    });

    app.get("/api/email/unsubscribe", async (req, res) => {
        const s = await byUnsubscribeToken(req.query.token).lean().catch(() => null);
        if (!s) return res.status(400).send(UNKNOWN_LINK_PAGE);
        res.send(emailPage({ title: "Unsubscribe", text: `Stop all Mintora notification emails to ${s.email || "this address"}?`, action: "Unsubscribe" }));
    });

    // Also where Gmail's one-click unsubscribe posts to
    app.post("/api/email/unsubscribe", async (req, res) => {
        try {
            const s = await EmailSubscription.findOneAndUpdate(
                { unsubscribeToken: String(req.query.token ?? "") },
                { $set: { offers: false, sales: false } }
            );
            if (!s) return res.status(400).send(UNKNOWN_LINK_PAGE);
            res.send(emailPage({ title: "You're unsubscribed", text: "Mintora won't send you offer or sale emails. You can turn them back on in settings.", link: SETTINGS_LINK }));
        } catch (err) {
            res.status(500).send(emailPage({ title: "Something went wrong", text: "You're not unsubscribed yet. Try the link again in a moment." }));
        }
    });
}
