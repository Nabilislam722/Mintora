import { ethers } from "ethers";
import { createChallenge, signIn, signOut } from "../lib/auth.js";

// Wallet sign-in routes; `origins` are the sites a sign-in message can be written for
export function registerAuthRoutes(app, origins) {
    // Creates a sign-in message for a wallet to sign
    app.post("/api/auth/nonce", async (req, res) => {
        const origin = req.get("origin");
        if (!origins.includes(origin)) return res.status(403).json({ message: "Sign-in only works on Mintora." });

        const address = req.body?.address;
        if (typeof address !== "string" || !ethers.isAddress(address))
            return res.status(400).json({ message: "A wallet address is required." });

        try {
            res.json({ message: await createChallenge(address.toLowerCase(), origin) });
        } catch (err) {
            console.error("Sign-in challenge error:", err);
            res.status(500).json({ message: "Could not start sign-in." });
        }
    });

    // Checks the signed message and returns a session token
    app.post("/api/auth/verify", async (req, res) => {
        const { message, signature } = req.body ?? {};
        if (typeof message !== "string" || typeof signature !== "string")
            return res.status(400).json({ message: "message and signature are required." });

        try {
            const session = await signIn(message, signature);
            if (!session) return res.status(401).json({ message: "Sign-in failed or expired. Please try again." });
            res.json(session);
        } catch (err) {
            console.error("Sign-in error:", err);
            res.status(500).json({ message: "Could not sign in." });
        }
    });

    // Ends the session
    app.post("/api/auth/logout", async (req, res) => {
        try {
            await signOut(req);
            res.status(204).end();
        } catch (err) {
            res.status(500).json({ message: "Could not sign out." });
        }
    });
}
