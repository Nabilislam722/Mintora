import { readFileSync } from "fs";
import { ethers } from "ethers";

export const HEMI_RPC = "https://rpc.hemi.network/rpc";
export const HEMI_CHAIN_ID = 43111;

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

// e.g. "Mintora/1.6.0 (crawler; +https://mintora.app)"
export const userAgent = (purpose) => `Mintora/${version} (${purpose}; +https://mintora.app)`;

// A Hemi provider that identifies itself. `purpose` names the part of Mintora making the calls.
export function createHemiProvider(purpose, options = {}) {
    const request = new ethers.FetchRequest(HEMI_RPC);
    request.setHeader("User-Agent", userAgent(purpose));
    // The chain is known, so ethers needn't ask the RPC for it
    return new ethers.JsonRpcProvider(request, HEMI_CHAIN_ID, { staticNetwork: true, ...options });
}
