import crypto from "crypto";
import { ethers } from "ethers";
import { Session, SignInChallenge } from "../models/Session.js";
import { HEMI_CHAIN_ID, createHemiProvider } from "./provider.js";

const CHALLENGE_TTL = 10 * 60_000;
const SESSION_TTL = 7 * 24 * 60 * 60_000;
const ERC1271_MAGIC = "0x1626ba7e";

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// A Sign-In with Ethereum (EIP-4361) message. Wallets recognise the format and warn when the site asking for
// the signature isn't the domain written in it, which is what stops a phishing page reusing it.
function signInMessage({ domain, uri, address, nonce, issuedAt, expiresAt }) {
    return [
        `${domain} wants you to sign in with your Ethereum account:`,
        address,
        "",
        "Sign in to Mintora to edit your profile. This doesn't send a transaction or cost gas.",
        "",
        `URI: ${uri}`,
        "Version: 1",
        `Chain ID: ${HEMI_CHAIN_ID}`,
        `Nonce: ${nonce}`,
        `Issued At: ${issuedAt.toISOString()}`,
        `Expiration Time: ${expiresAt.toISOString()}`,
    ].join("\n");
}

// The message for `address` to sign, written for the site (origin) that asked for it
export async function createChallenge(address, origin) {
    const nonce = crypto.randomBytes(16).toString("hex");
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL);
    const message = signInMessage({
        domain: new URL(origin).host,
        uri: origin,
        address: ethers.getAddress(address),
        nonce,
        issuedAt,
        expiresAt,
    });
    await SignInChallenge.create({ nonce, address, message, expiresAt });
    return message;
}

let provider;

// Whether `address` signed `message`: an ordinary wallet's signature recovers to the address; a contract wallet
// (a Safe, for example) answers through ERC-1271
async function signedBy(address, message, signature) {
    try {
        if (ethers.verifyMessage(message, signature).toLowerCase() === address) return true;
    } catch { }
    try {
        provider ??= createHemiProvider("sign-in");
        const wallet = new ethers.Contract(address, ["function isValidSignature(bytes32, bytes) view returns (bytes4)"], provider);
        return (await wallet.isValidSignature(ethers.hashMessage(message), signature)) === ERC1271_MAGIC;
    } catch {
        return false;
    }
}

// Checks a signed challenge and opens a session. Returns null if the challenge is unknown, used or expired, or
// the signature isn't from its wallet.
export async function signIn(message, signature) {
    const nonce = /^Nonce: ([0-9a-f]{32})$/m.exec(message)?.[1];
    if (!nonce) return null;
    // Deleted on first use, whatever the outcome, so a challenge can't be tried twice
    const challenge = await SignInChallenge.findOneAndDelete({ nonce }).lean();
    if (!challenge || challenge.message !== message || challenge.expiresAt < new Date()) return null;
    if (!(await signedBy(challenge.address, message, signature))) return null;

    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL);
    await Session.create({ tokenHash: sha256(token), address: challenge.address, expiresAt });
    return { token, address: challenge.address, expiresAt };
}

const bearer = (req) => /^Bearer (\S+)$/.exec(req.get("authorization") ?? "")?.[1];

export async function signOut(req) {
    const token = bearer(req);
    if (token) await Session.deleteOne({ tokenHash: sha256(token) });
}

// Lets the request through only with a live session, and sets req.wallet to the signed-in address
export async function requireAuth(req, res, next) {
    const token = bearer(req);
    const session = token && await Session.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } }).lean();
    if (!session) return res.status(401).json({ message: "Sign in with your wallet first." });
    req.wallet = session.address;
    next();
}
