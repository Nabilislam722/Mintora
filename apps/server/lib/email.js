import "dotenv/config";
import { Resend } from "resend";

export const SITE_URL = process.env.SITE_URL ?? "https://mintora.app";
const API_URL = process.env.API_URL ?? "https://api.mintora.app";
const FROM = process.env.EMAIL_FROM ?? "Mintora <notification@mintora.app>";
const GREEN = "#0DA04A";
const FONT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const emailConfigured = () => !!process.env.RESEND_API;
export const confirmUrl = (token) => `${API_URL}/api/email/confirm?token=${encodeURIComponent(token)}`;
export const unsubscribeUrl = (token) => `${API_URL}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// The email's HTML: a white card with a heading, a few lines and one button
function html({ heading, lines, button, footer, preheader }) {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(preheader ?? heading)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;font-family:${FONT};">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;">
<tr><td style="padding:32px 32px 0;font-size:13px;font-weight:700;letter-spacing:.12em;color:${GREEN};">MINTORA</td></tr>
<tr><td style="padding:16px 32px 0;font-size:22px;font-weight:700;line-height:1.3;color:#18181b;">${esc(heading)}</td></tr>
${lines.map((l) => `<tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.6;color:#3f3f46;">${esc(l)}</td></tr>`).join("\n")}
<tr><td style="padding:24px 32px 32px;"><a href="${esc(button.url)}" style="display:inline-block;background:${GREEN};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:12px;">${esc(button.label)}</a></td></tr>
</table>
<p style="max-width:480px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#71717a;">${footer}</p>
</td></tr>
</table>
</body></html>`;
}

// Sends one email. With `unsubscribeToken` it's a notification: it gets an unsubscribe link
// and the headers that give Gmail and Yahoo their one-click unsubscribe button.
export async function sendEmail({ to, subject, heading, lines, button, preheader, unsubscribeToken }) {
    if (!emailConfigured()) throw new Error("RESEND_API is not set");
    const unsubscribe = unsubscribeToken && unsubscribeUrl(unsubscribeToken);
    const footerText = unsubscribe
        ? "You get these emails because you turned them on in your Mintora settings."
        : "Someone entered this address in Mintora's settings. If it wasn't you, ignore this email: nothing more will be sent.";
    const footer = unsubscribe
        ? `${esc(footerText)} <a href="${esc(unsubscribe)}" style="color:#71717a;">Unsubscribe</a>`
        : esc(footerText);
    const text = [heading, ...lines, `${button.label}: ${button.url}`, footerText, unsubscribe && `Unsubscribe: ${unsubscribe}`]
        .filter(Boolean)
        .join("\n\n");

    const { data, error } = await new Resend(process.env.RESEND_API).emails.send({
        from: FROM,
        to,
        subject,
        html: html({ heading, lines, button, footer, preheader }),
        text,
        ...(unsubscribe && {
            headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        }),
    });
    if (error) throw new Error(`Resend: ${error.message}`);
    return data;
}

export const confirmEmail = (token) => ({
    subject: "Confirm your email for Mintora",
    heading: "Confirm your email",
    lines: [
        "Confirm this address to get an email when someone makes an offer on your veHEMI position, or buys your NFT or veHEMI position on Mintora.",
        "The link works for 24 hours.",
    ],
    button: { label: "Confirm email", url: confirmUrl(token) },
});

export const offerEmail = ({ tokenId, amount }) => ({
    subject: `New offer on veHEMI #${tokenId}: ${amount} HEMI`,
    heading: `New offer: ${amount} HEMI`,
    lines: [`Someone offered ${amount} HEMI for your veHEMI position #${tokenId}. You can accept it on the position's page.`],
    button: { label: "See the offer", url: `${SITE_URL}/vehemi/${tokenId}` },
});

export const veHemiSoldEmail = ({ tokenId, amount }) => ({
    subject: `veHEMI #${tokenId} sold for ${amount} HEMI`,
    heading: "Your veHEMI position sold",
    lines: [`veHEMI #${tokenId} sold for ${amount} HEMI.`],
    button: { label: "See the sale", url: `${SITE_URL}/vehemi/${tokenId}` },
});

export const nftSoldEmail = ({ name, collection, amount, url }) => ({
    subject: `${name} sold for ${amount} ETH`,
    heading: "Your NFT sold",
    lines: [`${name}${collection && !name.includes(collection) ? ` from ${collection}` : ""} sold for ${amount} ETH.`],
    button: { label: "See the NFT", url },
});

// A small page for the links in emails (confirm, unsubscribe); `action` adds a button that POSTs back to the same URL
export function emailPage({ title, text, action, link = { label: "Go to Mintora", url: SITE_URL } }) {
    const style = `display:inline-block;background:${GREEN};color:#fff;border:0;text-decoration:none;font:600 15px ${FONT};padding:12px 22px;border-radius:12px;cursor:pointer;`;
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} | Mintora</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f4f5;font-family:${FONT};padding:16px;box-sizing:border-box;">
<main style="max-width:420px;width:100%;background:#fff;border-radius:16px;padding:32px;box-sizing:border-box;">
<p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.12em;color:${GREEN};">MINTORA</p>
<h1 style="margin:16px 0 0;font-size:22px;color:#18181b;">${esc(title)}</h1>
<p style="margin:12px 0 24px;font-size:15px;line-height:1.6;color:#3f3f46;">${esc(text)}</p>
${action
        ? `<form method="post"><button type="submit" style="${style}">${esc(action)}</button></form>`
        : `<a href="${esc(link.url)}" style="${style}">${esc(link.label)}</a>`}
</main></body></html>`;
}
