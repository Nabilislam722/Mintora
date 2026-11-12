import crypto from "crypto";
import { ethers } from "ethers";
import { Session, SignInChallenge } from "../models/Session.js";
import { HEMI_CHAIN_ID, createHemiProvider } from "./provider.js";

const CHALLENGE_TTL = 10 * 60_000;
const SESSION_TTL = 7 * 24 * 60 * 60_000;
const ERC1271_MAGIC = "0x1626ba7e";

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// The Sign-In with Ethereum (EIP-4361) message a wallet signs
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

// Creates a one-time sign-in message for `address`, written for the site that asked
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

// Whether `address` signed `message` (plain wallets, or contract wallets through ERC-1271)
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

// Checks a signed challenge and opens a 7-day session, or returns null
export async function signIn(message, signature) {
    const nonce = /^Nonce: ([0-9a-f]{32})$/m.exec(message)?.[1];
    if (!nonce) return null;
    const challenge = await SignInChallenge.findOneAndDelete({ nonce }).lean();
    if (!challenge || challenge.message !== message || challenge.expiresAt < new Date()) return null;
    if (!(await signedBy(challenge.address, message, signature))) return null;

    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL);
    await Session.create({ tokenHash: sha256(token), address: challenge.address, expiresAt });
    return { token, address: challenge.address, expiresAt };
}

const bearer = (req) => /^Bearer (\S+)$/.exec(req.get("authorization") ?? "")?.[1];

// Ends the request's session
export async function signOut(req) {
    const token = bearer(req);
    if (token) await Session.deleteOne({ tokenHash: sha256(token) });
}

// Middleware that lets only signed-in wallets through and sets req.wallet
export async function requireAuth(req, res, next) {
    const token = bearer(req);
    const session = token && await Session.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } }).lean();
    if (!session) return res.status(401).json({ message: "Sign in with your wallet first." });
    req.wallet = session.address;
    next();
}
